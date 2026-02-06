// src/services/silenceDetector.js
/**
 * Detector de Silencio para iOS Safari
 * Analiza el stream de audio en tiempo real y detecta cuando el usuario deja de hablar
 */

class SilenceDetector {
  constructor(options = {}) {
    // Configuración por defecto optimizada para voz humana
    this.config = {
      silenceThreshold: options.silenceThreshold || 0.01,  // Umbral de volumen (0-1)
      silenceDuration: options.silenceDuration || 1500,    // 1.5s de silencio para confirmar
      minRecordingTime: options.minRecordingTime || 500,   // Mínimo 0.5s de grabación
      maxRecordingTime: options.maxRecordingTime || 15000, // Máximo 15s (seguridad)
      sampleRate: options.sampleRate || 44100,
      fftSize: 2048
    };
    
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    
    this.isListening = false;
    this.lastSoundTime = 0;
    this.recordingStartTime = 0;
    this.silenceCheckInterval = null;
    
    this.onSilenceDetected = null;
    this.onSoundDetected = null;
    this.onMaxTimeReached = null;
  }
  
  /**
   * Inicializa el detector con el stream de audio
   */
  async initialize(mediaStream) {
    try {
      // Crear contexto de audio
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
      
      // Crear analizador
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.config.fftSize;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Conectar micrófono al analizador
      this.microphone = this.audioContext.createMediaStreamSource(mediaStream);
      this.microphone.connect(this.analyser);
      
      // Buffer para datos de frecuencia
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      console.log('🎤 SilenceDetector inicializado correctamente');
      return true;
      
    } catch (error) {
      console.error('❌ Error inicializando SilenceDetector:', error);
      throw error;
    }
  }
  
  /**
   * Comienza a monitorear el audio
   */
  start(callbacks = {}) {
    if (this.isListening) {
      console.warn('⚠️ SilenceDetector ya está escuchando');
      return;
    }
    
    this.onSilenceDetected = callbacks.onSilenceDetected || null;
    this.onSoundDetected = callbacks.onSoundDetected || null;
    this.onMaxTimeReached = callbacks.onMaxTimeReached || null;
    
    this.isListening = true;
    this.lastSoundTime = Date.now();
    this.recordingStartTime = Date.now();
    
    console.log('🎧 Iniciando monitoreo de silencio...');
    
    // Iniciar chequeo periódico (cada 100ms)
    this.silenceCheckInterval = setInterval(() => {
      this._checkAudioLevel();
    }, 100);
  }
  
  /**
   * Detiene el monitoreo
   */
  stop() {
    if (!this.isListening) return;
    
    this.isListening = false;
    
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    
    console.log('🛑 Monitoreo de silencio detenido');
  }
  
  /**
   * Limpia todos los recursos
   */
  cleanup() {
    this.stop();
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('🧹 SilenceDetector limpiado');
  }
  
  /**
   * Método interno: Analiza el nivel de audio actual
   */
  _checkAudioLevel() {
    if (!this.isListening || !this.analyser) return;
    
    // Obtener datos de frecuencia
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calcular nivel promedio de volumen (0-255 → 0-1)
    const average = this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length;
    const normalizedLevel = average / 255;
    
    const now = Date.now();
    const timeSinceStart = now - this.recordingStartTime;
    const timeSinceLastSound = now - this.lastSoundTime;
    
    // Seguridad: Tiempo máximo alcanzado
    if (timeSinceStart >= this.config.maxRecordingTime) {
      console.log('⏱️ Tiempo máximo de grabación alcanzado');
      if (this.onMaxTimeReached) {
        this.onMaxTimeReached();
      }
      this.stop();
      return;
    }
    
    // Detectar si hay sonido
    if (normalizedLevel > this.config.silenceThreshold) {
      this.lastSoundTime = now;
      
      // Callback de sonido detectado (opcional, para UI)
      if (this.onSoundDetected) {
        this.onSoundDetected(normalizedLevel);
      }
    }
    
    // Detectar silencio sostenido
    if (timeSinceLastSound >= this.config.silenceDuration && 
        timeSinceStart >= this.config.minRecordingTime) {
      
      console.log(`🔇 Silencio detectado (${(timeSinceLastSound / 1000).toFixed(1)}s)`);
      
      if (this.onSilenceDetected) {
        this.onSilenceDetected({
          recordingDuration: timeSinceStart,
          silenceDuration: timeSinceLastSound
        });
      }
      
      this.stop();
    }
  }
  
  /**
   * Obtiene el nivel actual de audio (útil para UI)
   */
  getCurrentLevel() {
    if (!this.analyser) return 0;
    
    this.analyser.getByteFrequencyData(this.dataArray);
    const average = this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length;
    return average / 255;
  }
}

// Exportar instancia singleton
export const silenceDetector = new SilenceDetector();
export default SilenceDetector;