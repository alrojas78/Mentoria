// frontend/src/services/realtimeService.js
// OpenAI Realtime API GA — Servicio de conversación bidireccional por voz
// Fase 4.2: Soporte de function calling para bloques temáticos
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
 * RealtimeSession — OpenAI Realtime API GA
 * Flujo: backend obtiene client_secret → frontend conecta WebSocket →
 *        session.update con instructions+audio config+tools → response.create para auto-saludo
 *
 * Function Calling (bloques temáticos):
 * Cuando el AI necesita info detallada, invoca obtener_bloque →
 * frontend fetcha el bloque del backend → inyecta como function_call_output →
 * AI responde con la info completa
 */
export class RealtimeSession {
  constructor(options = {}) {
    this.documentId = options.documentId || null;
    this.mode = options.mode || 'consulta';
    this.videoId = options.videoId || null;
    this.videoTitle = options.videoTitle || null;
    this.lessonContext = options.lessonContext || null;
    this.currentTime = options.currentTime || 0;

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

    // Config from backend
    this._instructions = '';
    this._voice = 'sage';
    this._model = 'gpt-4o-realtime-preview';
    this._tools = null;
    this._documentId = null;

    // Function call tracking — processed in response.done to avoid duplicates
    this._pendingFunctionCalls = {};
    this._functionCallInProgress = false; // Suppress audio during function calls
    this._functionCallCache = {}; // Cache de bloques ya consultados (evita re-fetch en interrupciones)

    // Audio playback
    this._activeAudioSources = []; // Track scheduled sources for hard stop
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
      const postData = {
        document_id: this.documentId,
        mode: this.mode
      };
      if (this.videoId) postData.video_id = this.videoId;
      if (this.videoTitle) postData.video_title = this.videoTitle;
      if (this.lessonContext) postData.lesson_context = this.lessonContext;
      if (this.currentTime) postData.current_time = this.currentTime;
      const response = await axios.post(`${API_BASE_URL}/realtime-session.php`, postData);

      if (!response.data?.success) {
        throw new Error('No se pudo crear la sesión Realtime');
      }

      // Si el backend indica que realtime no está disponible, informar
      if (!response.data.realtime_available) {
        throw new Error('REALTIME_NOT_AVAILABLE');
      }

      const { client_secret, instructions, voice, model, tools, document_id } = response.data;

      if (!client_secret) {
        throw new Error('No se recibió client_secret del servidor');
      }

      // Guardar config para session.update
      this._instructions = instructions || '';
      this._voice = voice || 'sage';
      this._model = model || 'gpt-4o-realtime-preview';
      this._tools = tools || null;
      this._documentId = document_id || this.documentId;

      // DEBUG: verificar que tools llegan del backend
      console.log('[REALTIME DEBUG] Backend response keys:', Object.keys(response.data));
      console.log('[REALTIME DEBUG] tools recibidos:', this._tools);
      console.log('[REALTIME DEBUG] document_id:', this._documentId);

      // 2. Conectar WebSocket a OpenAI Realtime API GA
      const wsUrl = `wss://api.openai.com/v1/realtime?model=${this._model}`;
      this.ws = new WebSocket(wsUrl, [
        'realtime',
        `openai-insecure-api-key.${client_secret}`
      ]);

      this.ws.onopen = () => this._onWSOpen();
      this.ws.onmessage = (event) => this._onWSMessage(event);
      this.ws.onerror = (event) => this._onWSError(event);
      this.ws.onclose = (event) => this._onWSClose(event);

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
    // No iniciamos micrófono aún — esperamos session.created para enviar session.update
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
    console.error('WebSocket readyState:', this.ws?.readyState, 'model:', this._model);
    this._setState(SESSION_STATES.ERROR);
    this.onError('Error en la conexión WebSocket');
  }

  _onWSClose(event) {
    if (!this._destroyed) {
      console.log('WebSocket cerrado inesperadamente, code:', event?.code, 'reason:', event?.reason);
      this._setState(SESSION_STATES.DISCONNECTED);
    }
  }

  _handleServerEvent(event) {
    switch (event.type) {
      case 'session.created':
        this._sendSessionUpdate();
        break;

      case 'session.updated':
        console.log('[REALTIME DEBUG] session.updated recibido:', JSON.stringify(event.session?.tools || 'NO TOOLS IN RESPONSE'));
        this._startMicrophone();
        this._sendAutoGreeting();
        break;

      case 'input_audio_buffer.speech_started':
        this._setState(SESSION_STATES.LISTENING);
        if (this.isPlaying && !this._functionCallInProgress) {
          this._stopPlayback();
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'response.cancel' }));
          }
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        this._setState(SESSION_STATES.CONNECTED);
        break;

      // GA event name for input transcription
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          this.onTranscript(event.transcript);

          // Modo grupal: solo responder si mencionan "mentoria"/"mentoría"
          if (this.mode === 'consulta_grupo') {
            const texto = event.transcript.toLowerCase();
            if (texto.includes('mentoria') || texto.includes('mentoría') || texto.includes('mentor ia')) {
              console.log('[REALTIME GRUPAL] Invocación detectada:', event.transcript);
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'response.create' }));
              }
            } else {
              console.log('[REALTIME GRUPAL] Escuchando (sin invocación):', event.transcript.substring(0, 60));
            }
          }
        }
        break;

      // GA: response.audio.delta → response.output_audio.delta
      case 'response.output_audio.delta':
      case 'response.audio.delta': // fallback for compatibility
        if (event.delta) {
          this._enqueueAudio(event.delta);
        }
        if (this.state !== SESSION_STATES.AI_SPEAKING) {
          this._setState(SESSION_STATES.AI_SPEAKING);
        }
        break;

      // GA: response.audio_transcript.delta → response.output_audio_transcript.delta
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': // fallback
        if (event.delta) {
          this.onAITranscript(event.delta, false);
        }
        break;

      // GA: response.audio_transcript.done → response.output_audio_transcript.done
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': // fallback
        if (event.transcript) {
          this.onAITranscript(event.transcript, true);
        }
        break;

      case 'response.output_audio.done':
      case 'response.audio.done':
        break;

      // === Function Calling: bloques temáticos ===
      // Estrategia: acumular info durante el response, ejecutar en response.done
      // para evitar duplicaciones y race conditions.
      case 'response.function_call_arguments.delta':
        // Acumular argumentos (solo para tracking/debug)
        if (event.call_id) {
          if (!this._pendingFunctionCalls[event.call_id]) {
            this._pendingFunctionCalls[event.call_id] = { args: '' };
          }
          this._pendingFunctionCalls[event.call_id].args += (event.delta || '');
        }
        break;

      case 'response.function_call_arguments.done':
        // Log solamente — la ejecución real ocurre en response.done
        if (event.call_id && event.name) {
          console.log(`[REALTIME] Function call listo: ${event.name} (${event.call_id})`);
        }
        break;

      // GA: output item added — detectar function_call para detener audio prematuro
      case 'response.output_item.added':
        if (event.item?.type === 'function_call') {
          console.log('[REALTIME] Function call detectado, cortando audio y suprimiendo nuevos deltas');
          // Hard-stop cualquier audio que el AI esté reproduciendo
          this._stopPlayback();
          // Suprimir futuros audio deltas de esta respuesta (el AI puede seguir enviando)
          this._functionCallInProgress = true;
        }
        break;

      case 'response.output_item.done':
        // No procesar function calls aquí — se manejan en response.done
        break;

      case 'response.done': {
        // Verificar si la respuesta completada contiene function calls
        const output = event.response?.output || [];
        const funcCalls = output.filter(item => item.type === 'function_call');

        if (funcCalls.length > 0) {
          // Procesar function calls (async, no bloquea el event loop)
          this._processFunctionCalls(funcCalls);
        } else {
          if (!this.isPlaying) {
            this._setState(SESSION_STATES.CONNECTED);
          }
        }
        break;
      }

      case 'error':
        console.error('[REALTIME] Error del servidor:', event.error?.type, event.error?.code, event.error?.message);
        // No propagar errores menores al usuario (como response_cancel_not_active)
        if (event.error?.code !== 'response_cancel_not_active' &&
            event.error?.code !== 'conversation_already_has_active_response') {
          this.onError(event.error?.message || 'Error del servidor');
        }
        break;

      default:
        // Log de eventos no manejados para debug
        if (event.type && event.type.includes('function')) {
          console.log('Evento function no manejado:', event.type, event);
        }
        break;
    }
  }

  // ====== Session Configuration (GA) ======

  _sendSessionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Modo grupal: no auto-responder, mayor tolerancia a pausas
    const isGrupal = this.mode === 'consulta_grupo';

    // GA structure: session.type required, audio config nested
    const sessionConfig = {
      type: 'realtime',
      instructions: this._instructions,
      output_modalities: ['audio'],
      audio: {
        input: {
          format: {
            type: 'audio/pcm',
            rate: 24000
          },
          transcription: {
            model: 'gpt-4o-transcribe'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: isGrupal ? 2000 : 500,
            create_response: isGrupal ? false : true
          }
        },
        output: {
          format: {
            type: 'audio/pcm',
            rate: 24000
          },
          voice: this._voice
        }
      }
    };

    // Agregar tools si el backend los proporcionó (bloques temáticos)
    if (this._tools && this._tools.length > 0) {
      sessionConfig.tools = this._tools;
      sessionConfig.tool_choice = 'auto';
    }

    const sessionUpdate = {
      type: 'session.update',
      session: sessionConfig
    };

    console.log('[REALTIME DEBUG] session.update payload:', JSON.stringify(sessionUpdate, null, 2));
    this.ws.send(JSON.stringify(sessionUpdate));
    console.log('[REALTIME DEBUG] session.update enviado', this._tools ? `con ${this._tools.length} tools` : 'SIN TOOLS');
  }

  _sendAutoGreeting() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const greetingInstructions = this.mode === 'consulta_grupo'
      ? 'Saluda muy brevemente, indica que estas en modo grupal escuchando la conversacion y que te invoquen por nombre cuando necesiten tu ayuda. Maximo 1 frase corta. NO uses ninguna funcion ni herramienta.'
      : 'Saluda brevemente al estudiante y ofrece tu ayuda con el documento. NO uses ninguna funcion ni herramienta. Solo un saludo corto y amigable, maximo 2 frases.';

    this.ws.send(JSON.stringify({
      type: 'response.create',
      response: {
        instructions: greetingInstructions
      }
    }));
    console.log('response.create enviado (auto-saludo, modo:', this.mode, ')');
  }

  // ====== Function Calling: Bloques Temáticos ======

  /**
   * Procesa todos los function calls de una respuesta completada.
   * Se ejecuta desde response.done para evitar duplicaciones.
   */
  async _processFunctionCalls(funcCalls) {
    // Detener audio residual antes de procesar
    this._stopPlayback();

    for (const fc of funcCalls) {
      console.log(`[REALTIME] Procesando function call: ${fc.name} (${fc.call_id})`);
      await this._handleFunctionCall(fc.call_id, fc.name, fc.arguments || '{}');
    }

    // Limpiar tracking
    this._pendingFunctionCalls = {};
  }

  async _handleFunctionCall(callId, functionName, argsString) {
    if (functionName !== 'obtener_bloque') {
      this._sendFunctionCallOutput(callId, `Función ${functionName} no disponible.`);
      return;
    }

    try {
      const args = JSON.parse(argsString);
      const bloqueTitulo = args.bloque_titulo || '';
      const cacheKey = `${this._documentId}_${bloqueTitulo.toLowerCase()}`;

      // Usar cache si ya consultamos este bloque (evita re-fetch en interrupciones)
      if (this._functionCallCache[cacheKey]) {
        console.log(`[REALTIME] Cache hit: "${bloqueTitulo}" (${this._functionCallCache[cacheKey].length} chars)`);
        this._sendFunctionCallOutput(callId, this._functionCallCache[cacheKey]);
        return;
      }

      console.log(`[REALTIME] Buscando bloque: "${bloqueTitulo}" para documento ${this._documentId}`);

      const response = await axios.get(`${API_BASE_URL}/documento-bloques.php`, {
        params: {
          documento_id: this._documentId,
          titulo: bloqueTitulo
        }
      });

      let output;
      if (response.data?.success && response.data?.bloque) {
        const bloque = response.data.bloque;
        let contenido = bloque.contenido;

        // Truncar contenido largo para no exceder límites del Realtime API
        // ~15000 chars ≈ 4000 tokens — suficiente para responder cualquier pregunta
        const MAX_CONTENT_CHARS = 15000;
        if (contenido.length > MAX_CONTENT_CHARS) {
          contenido = contenido.substring(0, MAX_CONTENT_CHARS) + '\n\n[...contenido truncado por longitud. Si necesitas mas detalle de esta seccion, pide al estudiante que sea mas especifico.]';
          console.log(`[REALTIME] Bloque truncado: ${bloque.contenido.length} → ${MAX_CONTENT_CHARS} chars`);
        }

        output = `BLOQUE: ${bloque.titulo}\n\n${contenido}`;
        console.log(`[REALTIME] Bloque encontrado: ${bloque.titulo} (${contenido.length} chars enviados)`);
      } else {
        const disponibles = response.data?.bloques_disponibles || [];
        output = `No se encontró bloque con "${bloqueTitulo}". Bloques disponibles:\n${disponibles.map(t => `- ${t}`).join('\n')}\nIntenta con uno de estos títulos.`;
        console.warn(`[REALTIME] Bloque no encontrado: ${bloqueTitulo}. Disponibles:`, disponibles);
      }

      // Guardar en cache
      this._functionCallCache[cacheKey] = output;

      this._sendFunctionCallOutput(callId, output);

    } catch (err) {
      console.error('[REALTIME] Error obteniendo bloque:', err);
      this._sendFunctionCallOutput(callId, `Error al consultar el bloque: ${err.message}`);
    }
  }

  _sendFunctionCallOutput(callId, output) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // 1. Crear item con el resultado de la función
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: output
      }
    }));

    // 2. Pedir al AI que genere respuesta con el resultado
    this.ws.send(JSON.stringify({
      type: 'response.create'
    }));

    // Permitir audio de la nueva respuesta (con datos reales del bloque)
    this._functionCallInProgress = false;

    console.log(`[REALTIME] Function call output enviado, audio re-habilitado (call_id: ${callId})`);
  }

  // ====== Audio Input (Micrófono) ======

  async _startMicrophone() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });

      // En iOS, el AudioContext puede estar suspendido
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

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
    // Suppress audio if a function call is in progress
    if (this._functionCallInProgress) return;

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

      // Track source for hard stop capability
      this._activeAudioSources.push(source);

      source.onended = () => {
        this._activeAudioSources = this._activeAudioSources.filter(s => s !== source);
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

    // Hard-stop any scheduled/playing audio sources
    for (const source of this._activeAudioSources) {
      try { source.stop(); } catch (e) { /* already stopped */ }
    }
    this._activeAudioSources = [];
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
