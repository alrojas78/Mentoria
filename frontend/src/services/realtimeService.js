// frontend/src/services/realtimeService.js
// OpenAI Realtime API - Servicio de conversación bidireccional por voz
import axios from 'axios';

const API_BASE_URL = 'https://mentoria.ateneo.co/backend/api';

// Estados de la sesión
export const SESSION_STATES = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  LISTENING: 'listening',
  AI_SPEAKING: 'ai_speaking',
  ERROR: 'error'
};

/**
 * RealtimeSession - Encapsula toda la lógica de WebSocket + Audio
 * para conversación bidireccional con OpenAI Realtime API
 */
export class RealtimeSession {
  constructor(options = {}) {
    this.documentId = options.documentId || null;
    this.mode = options.mode || 'consulta';

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onAITranscript = options.onAITranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {});

    // Internal state
    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.sourceNode = null;
    this.playbackQueue = [];
    this.isPlaying = false;
    this.state = SESSION_STATES.DISCONNECTED;
    this._destroyed = false;

    // Audio playback
    this.nextPlaybackTime = 0;
  }

  /**
   * Inicia la sesión: obtiene client_secret del backend, conecta WebSocket, inicia micrófono
   */
  async connect() {
    if (this._destroyed) return;
    this._setState(SESSION_STATES.CONNECTING);

    try {
      // 1. Obtener client_secret del backend
      const response = await axios.post(`${API_BASE_URL}/realtime-session.php`, {
        document_id: this.documentId,
        mode: this.mode
      });

      if (!response.data?.success || !response.data?.client_secret) {
        throw new Error('No se pudo crear la sesión Realtime');
      }

      const { client_secret } = response.data;

      // 2. Conectar WebSocket a OpenAI Realtime API
      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
      this.ws = new WebSocket(wsUrl, [
        'realtime',
        `openai-insecure-api-key.${client_secret.value || client_secret}`
      ]);

      this.ws.onopen = () => this._onWSOpen();
      this.ws.onmessage = (event) => this._onWSMessage(event);
      this.ws.onerror = (event) => this._onWSError(event);
      this.ws.onclose = () => this._onWSClose();

    } catch (err) {
      console.error('Error conectando Realtime:', err);
      this._setState(SESSION_STATES.ERROR);
      this.onError(err.message || 'Error de conexión');
    }
  }

  /**
   * Desconecta la sesión: cierra WebSocket, detiene micrófono y audio
   */
  disconnect() {
    this._destroyed = true;
    this._stopMicrophone();
    this._stopPlayback();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    this._setState(SESSION_STATES.DISCONNECTED);
  }

  /**
   * Interrumpir al AI mientras habla
   */
  interrupt() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'response.cancel' }));
    }
    this._stopPlayback();
  }

  // ====== WebSocket Handlers ======

  _onWSOpen() {
    console.log('Realtime WebSocket conectado');
    this._startMicrophone();
  }

  _onWSMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this._handleServerEvent(data);
    } catch (err) {
      console.error('Error procesando mensaje WS:', err);
    }
  }

  _onWSError(event) {
    console.error('WebSocket error:', event);
    this._setState(SESSION_STATES.ERROR);
    this.onError('Error en la conexión WebSocket');
  }

  _onWSClose() {
    if (!this._destroyed) {
      console.log('WebSocket cerrado inesperadamente');
      this._setState(SESSION_STATES.DISCONNECTED);
    }
  }

  _handleServerEvent(event) {
    switch (event.type) {
      case 'session.created':
        this._setState(SESSION_STATES.CONNECTED);
        break;

      case 'session.updated':
        break;

      case 'input_audio_buffer.speech_started':
        this._setState(SESSION_STATES.LISTENING);
        if (this.isPlaying) {
          this.interrupt();
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        this._setState(SESSION_STATES.CONNECTED);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          this.onTranscript(event.transcript);
        }
        break;

      case 'response.audio.delta':
        if (event.delta) {
          this._enqueueAudio(event.delta);
        }
        if (this.state !== SESSION_STATES.AI_SPEAKING) {
          this._setState(SESSION_STATES.AI_SPEAKING);
        }
        break;

      case 'response.audio_transcript.delta':
        if (event.delta) {
          this.onAITranscript(event.delta, false);
        }
        break;

      case 'response.audio_transcript.done':
        if (event.transcript) {
          this.onAITranscript(event.transcript, true);
        }
        break;

      case 'response.audio.done':
        break;

      case 'response.done':
        if (!this.isPlaying) {
          this._setState(SESSION_STATES.CONNECTED);
        }
        break;

      case 'error':
        console.error('Error del servidor Realtime:', event.error);
        this.onError(event.error?.message || 'Error del servidor');
        break;

      default:
        break;
    }
  }

  // ====== Audio Input (Micrófono) ======

  async _startMicrophone() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      await this._setupAudioProcessing();
      this._setState(SESSION_STATES.CONNECTED);

    } catch (err) {
      console.error('Error accediendo al micrófono:', err);
      this.onError('No se pudo acceder al micrófono. Verifica los permisos.');
      this._setState(SESSION_STATES.ERROR);
    }
  }

  async _setupAudioProcessing() {
    try {
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const samples = input[0];
              const pcm16 = new Int16Array(samples.length);
              for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;

      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.workletNode.port.onmessage = (event) => {
        this._sendAudioData(event.data);
        const view = new Int16Array(event.data);
        let sum = 0;
        for (let i = 0; i < view.length; i++) {
          sum += Math.abs(view[i]);
        }
        const avg = sum / view.length / 32768;
        this.onAudioLevel(avg);
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

    } catch (workletErr) {
      console.warn('AudioWorklet no disponible, usando ScriptProcessor:', workletErr);
      this._setupScriptProcessor();
    }
  }

  _setupScriptProcessor() {
    const bufferSize = 4096;
    const processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this._sendAudioData(pcm16.buffer);

      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        sum += Math.abs(samples[i]);
      }
      this.onAudioLevel(sum / samples.length);
    };

    this.sourceNode.connect(processor);
    processor.connect(this.audioContext.destination);
    this._scriptProcessor = processor;
  }

  _sendAudioData(buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const base64 = this._arrayBufferToBase64(buffer);
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64
      }));
    }
  }

  _stopMicrophone() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this._scriptProcessor) {
      this._scriptProcessor.disconnect();
      this._scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  // ====== Audio Output (Reproducción) ======

  _enqueueAudio(base64Delta) {
    const buffer = this._base64ToArrayBuffer(base64Delta);
    this.playbackQueue.push(buffer);
    if (!this.isPlaying) {
      this._playNextChunk();
    }
  }

  _playNextChunk() {
    if (this.playbackQueue.length === 0 || !this.audioContext) {
      this.isPlaying = false;
      if (this.state === SESSION_STATES.AI_SPEAKING) {
        this._setState(SESSION_STATES.CONNECTED);
      }
      return;
    }

    this.isPlaying = true;
    const buffer = this.playbackQueue.shift();

    try {
      const pcm16 = new Int16Array(buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlaybackTime);
      source.start(startTime);
      this.nextPlaybackTime = startTime + audioBuffer.duration;

      source.onended = () => {
        this._playNextChunk();
      };
    } catch (err) {
      console.error('Error reproduciendo audio:', err);
      this._playNextChunk();
    }
  }

  _stopPlayback() {
    this.playbackQueue = [];
    this.isPlaying = false;
    this.nextPlaybackTime = 0;
  }

  // ====== Helpers ======

  _setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange(newState);
    }
  }

  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * Verificar si el navegador soporta WebSocket y getUserMedia
 */
export function isRealtimeSupported() {
  return !!(window.WebSocket && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export default RealtimeSession;
