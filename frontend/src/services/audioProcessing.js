// src/services/audioProcessing.js

/**
 * Servicio de procesamiento de audio para mejorar el reconocimiento de voz
 * Implementa filtros de ruido y mejoras de señal
 */

// ✅ DETECCIÓN MEJORADA DE iOS
const detectIOS = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isIOSUserAgent = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  const isIOSPlatform = /iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIOSSafari = /Safari/.test(userAgent) && 
                      /Apple/.test(navigator.vendor) &&
                      !(/Chrome|CriOS|FxiOS|EdgiOS/.test(userAgent));
  
  const result = isIOSUserAgent || isIOSPlatform || isIOSSafari;
  
  console.log('🔍 audioProcessing - Detección iOS:');
  console.log('   User Agent:', userAgent);
  console.log('   Platform:', navigator.platform);
  console.log('   🍎 RESULTADO:', result);
  
  return result;
};


class AudioProcessingService {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.filterNode = null;
    this.compressorNode = null;
    this.noiseGateNode = null;
    
    // Configuración por defecto
    this.config = {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 48000,
      noiseGateThreshold: -50, // dB
      gainBoost: 1.5,
      highpassFrequency: 200, // Hz - elimina ruidos bajos
      lowpassFrequency: 3000  // Hz - elimina ruidos muy altos
    };
  }

  /**
   * Inicializa el contexto de audio y obtiene acceso al micrófono
   */
async initialize(customConfig = {}) {
  try {
    // 🍎 DETECTAR iOS Y SALIR INMEDIATAMENTE
    const isIOS = detectIOS();
    
    if (isIOS) {
      console.log('🍎 iOS detectado - Audio processing DESHABILITADO');
      console.log('🍎 iOS usará su propio procesamiento nativo');
      
      // ✅ En iOS, obtener stream básico sin procesamiento
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,  // Solo las básicas que iOS soporta
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('✅ Stream de audio básico obtenido para iOS');
      return true; // Salir sin crear filtros
    }
    
    // 🖥️ RESTO DEL CÓDIGO PARA DESKTOP/ANDROID (sin cambios)
    this.config = { ...this.config, ...customConfig };
    
    console.log('🎤 Inicializando sistema de audio avanzado...');
    
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext({ 
      sampleRate: this.config.sampleRate 
    });
    
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: this.config.echoCancellation,
        noiseSuppression: this.config.noiseSuppression,
        autoGainControl: this.config.autoGainControl,
        channelCount: 1,
        sampleRate: this.config.sampleRate,
        sampleSize: 16,
        googEchoCancellation: true,
        googAutoGainControl: true,
        googNoiseSuppression: true,
        googHighpassFilter: true
      }
    });
    
    await this.createAudioProcessingChain();
    
    console.log('✅ Sistema de audio inicializado correctamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error al inicializar audio:', error);
    throw new Error(`No se pudo acceder al micrófono: ${error.message}`);
  }
}

  /**
   * Crea la cadena de procesamiento de audio con filtros
   */
  async createAudioProcessingChain() {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio context no inicializado');
    }

    // Nodo fuente desde el micrófono
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // 1. Filtro pasa-altos (elimina ruidos graves como viento, tráfico lejano)
    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = this.config.highpassFrequency;
    this.highpassFilter.Q.value = 1;
    
    // 2. Filtro pasa-bajos (elimina ruidos agudos como ventiladores, aire acondicionado)
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = this.config.lowpassFrequency;
    this.lowpassFilter.Q.value = 1;
    
    // 3. Compresor dinámico (normaliza el volumen)
    this.compressorNode = this.audioContext.createDynamicsCompressor();
    this.compressorNode.threshold.value = -30;
    this.compressorNode.knee.value = 20;
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;
    
    // 4. Control de ganancia
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.config.gainBoost;
    
    // 5. Conectar la cadena de procesamiento
    this.sourceNode
      .connect(this.highpassFilter)
      .connect(this.lowpassFilter)
      .connect(this.compressorNode)
      .connect(this.gainNode);
    
    // Crear destino procesado
    const destination = this.audioContext.createMediaStreamDestination();
    this.gainNode.connect(destination);
    
    // Reemplazar el stream original con el procesado
    this.processedStream = destination.stream;
    
    console.log('🔊 Cadena de procesamiento de audio creada');
  }

  /**
   * Obtiene el stream de audio procesado
   */
getProcessedStream() {
  const isIOS = detectIOS();
  
  if (isIOS) {
    // 🍎 iOS: Retornar stream original sin procesar
    console.log('🍎 Retornando stream original para iOS');
    return this.mediaStream;
  }
  
  // 🖥️ Desktop/Android: Retornar stream procesado
  return this.processedStream || this.mediaStream;
}

  /**
   * Obtiene el stream original sin procesar
   */
  getOriginalStream() {
    return this.mediaStream;
  }

  /**
   * Ajusta la sensibilidad del micrófono
   * @param {number} level - Nivel de 0.5 a 2.0 (1.0 es normal)
   */
setSensitivity(level) {
    const isIOS = detectIOS();
    
    if (isIOS) {
      console.log('🍎 iOS: Sensibilidad no ajustable (usa configuración nativa)');
      return;
    }
    
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0.5, Math.min(2.0, level));
      console.log(`🎚️ Sensibilidad ajustada a: ${level}`);
    }
  }

  /**
   * Ajusta el filtro de ruido de fondo
   * @param {number} frequency - Frecuencia en Hz (100-500 recomendado)
   */
setNoiseFloor(frequency) {
    const isIOS = detectIOS();
    
    if (isIOS) {
      console.log('🍎 iOS: Filtro de ruido no ajustable (usa configuración nativa)');
      return;
    }
    
    if (this.highpassFilter) {
      this.highpassFilter.frequency.value = frequency;
      console.log(`🔇 Filtro de ruido ajustado a: ${frequency}Hz`);
    }
  }

  /**
   * Analiza el nivel de ruido ambiente
   */
async analyzeNoiseLevel(duration = 2000) {
    const isIOS = detectIOS();
    
    if (isIOS) {
      console.log('🍎 iOS: Análisis de ruido no disponible');
      return {
        noiseLevel: 0,
        recommendation: 'iOS usa procesamiento nativo optimizado',
        samples: []
      };
    }
    
    return new Promise((resolve) => {
      if (!this.audioContext || !this.sourceNode) {
        resolve({ noiseLevel: 0, recommendation: 'No disponible' });
        return;
      }

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      this.sourceNode.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let samples = [];
      
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        samples.push(average);
      }, 100);
      
      setTimeout(() => {
        clearInterval(interval);
        this.sourceNode.disconnect(analyser);
        
        const avgNoise = samples.reduce((a, b) => a + b) / samples.length;
        
        let recommendation;
        if (avgNoise < 10) {
          recommendation = 'Excelente - Ambiente muy silencioso';
        } else if (avgNoise < 25) {
          recommendation = 'Bueno - Nivel de ruido aceptable';
        } else if (avgNoise < 50) {
          recommendation = 'Regular - Se recomienda buscar lugar más silencioso';
        } else {
          recommendation = 'Malo - Mucho ruido ambiente, busque lugar silencioso';
        }
        
        resolve({
          noiseLevel: avgNoise,
          recommendation: recommendation,
          samples: samples
        });
      }, duration);
    });
  }

  /**
   * Libera todos los recursos
   */
  cleanup() {
    try {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      
      if (this.sourceNode) {
        this.sourceNode.disconnect();
      }
      
      if (this.audioContext) {
        this.audioContext.close();
      }
      
      console.log('🧹 Recursos de audio liberados');
    } catch (error) {
      console.error('Error al limpiar recursos:', error);
    }
  }
}

// Exportar instancia singleton
export const audioProcessingService = new AudioProcessingService();