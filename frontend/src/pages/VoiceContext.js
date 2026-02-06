// src/contexts/VoiceContext.js
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { voiceService } from '../services/api';
import { audioProcessingService } from '../services/audioProcessing';

// ✅ DETECCIÓN MEJORADA DE iOS
const detectIOS = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Método 1: User agent
  const isIOSUserAgent = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  // Método 2: Detección por plataforma
  const isIOSPlatform = /iPad|iPhone|iPod/.test(navigator.platform) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad en iOS 13+
  
  // Método 3: Detección por características específicas de Safari iOS
  const isIOSSafari = /Safari/.test(userAgent) && 
                      /Apple/.test(navigator.vendor) &&
                      !(/Chrome|CriOS|FxiOS|EdgiOS/.test(userAgent));
  
  const isIOS = isIOSUserAgent || isIOSPlatform || isIOSSafari;
  
  console.log('🔍 Detección de iOS:');
  console.log('   User Agent:', userAgent);
  console.log('   Platform:', navigator.platform);
  console.log('   Vendor:', navigator.vendor);
  console.log('   isIOSUserAgent:', isIOSUserAgent);
  console.log('   isIOSPlatform:', isIOSPlatform);
  console.log('   isIOSSafari:', isIOSSafari);
  console.log('   🍎 RESULTADO FINAL iOS:', isIOS);
  
  return isIOS;
};


// Crear el contexto
const VoiceContext = createContext();

// Hook personalizado para acceder al contexto
export const useVoice = () => useContext(VoiceContext);

// Proveedor del contexto de voz
export const VoiceProvider = ({ children }) => {
    // Estados básicos
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState(null);
    
    // Estados para procesamiento de audio avanzado
    const [audioInitialized, setAudioInitialized] = useState(false);
    const [noiseLevel, setNoiseLevel] = useState(null);
    const [sensitivity, setSensitivity] = useState(1.5);
    const [audioQuality, setAudioQuality] = useState('good');
    
    // Referencias
    const recognitionRef = useRef(null);
    const audioRef = useRef(null);
    const speakingLockRef = useRef(false);
    const listeningLockRef = useRef(false);
    const processedStreamRef = useRef(null);

    // ✅ AGREGAR ESTE useEffect COMPLETO AQUÍ
useEffect(() => {
    console.log('🔄 VoiceContext montado - Verificando estado de permisos');
    
    // Verificar si hay sesión activa (usuario autenticado)
    const checkAndInitialize = async () => {
        try {
            // Verificar si hay token en localStorage (sesión persistente)
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');
            
            if (token && user) {
                console.log('✅ Sesión persistente detectada');
                
                // Verificar permisos de micrófono
                if (navigator.permissions) {
                    try {
                        const permission = await navigator.permissions.query({ name: 'microphone' });
                        console.log('🎤 Estado de permiso de micrófono:', permission.state);
                        
                        if (permission.state === 'granted') {
                            console.log('✅ Permisos ya concedidos, inicializando audio...');
                            // NO inicializar automáticamente, solo verificar
                            // El usuario debe hacer clic para activar
                        } else if (permission.state === 'prompt') {
                            console.log('⚠️ Permisos pendientes - Se solicitarán al usar micrófono');
                        } else if (permission.state === 'denied') {
                            console.warn('❌ Permisos de micrófono denegados');
                            setError('Permisos de micrófono denegados. Por favor, habilítalos en la configuración del navegador.');
                        }
                    } catch (permError) {
                        console.warn('⚠️ No se puede verificar permisos (navegador no compatible):', permError);
                    }
                }
                
                // Verificar que SpeechRecognition esté disponible
                if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                    console.error('❌ SpeechRecognition no disponible en este navegador');
                    setError('Tu navegador no soporta reconocimiento de voz');
                }
                
                // Verificar que SpeechSynthesis esté disponible
                if (!('speechSynthesis' in window)) {
                    console.error('❌ SpeechSynthesis no disponible en este navegador');
                }
                
                console.log('✅ Sistema de voz verificado y listo');
            }
        } catch (error) {
            console.error('❌ Error al verificar permisos:', error);
        }
    };
    
    checkAndInitialize();
    
    // Cleanup cuando se desmonta el componente
    return () => {
        console.log('🧹 VoiceContext desmontándose - Limpiando recursos');
        cleanup();
    };
}, []);
    
    // Función auxiliar para dividir texto en frases
    const splitTextIntoSentences = (text) => {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        
        if (sentences.length === 0) {
          return [text];
        }
        
        let combinedLength = sentences.reduce((acc, s) => acc + s.length, 0);
        if (combinedLength < text.length) {
          const lastSentence = text.substring(combinedLength);
          if (lastSentence.trim().length > 0) {
            sentences.push(lastSentence);
          }
        }
        
        return sentences;
    };

    // Función para detener el reconocimiento
    const stopListening = useCallback(async () => {
        try {
          listeningLockRef.current = true;
      
          if (recognitionRef.current) {
            console.log("🛑 Forzando aborto del reconocimiento");
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.abort();
            recognitionRef.current = null;
          }
      
          setIsListening(false);
        } catch (e) {
          console.error("Error en stopListening:", e);
        } finally {
          listeningLockRef.current = false;
        }
    }, []);
    
    // Función para detener la síntesis de voz
    const stopSpeaking = useCallback(() => {
        console.log("🛑 FORZANDO DETENER - stopSpeaking llamado");
        
        try {
            // 1. Cancelar síntesis del navegador
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                console.log("✅ SpeechSynthesis cancelado");
            }
            
            // 2. Detener audio HTML5 si existe
            if (audioRef.current) {
                try {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                    audioRef.current.src = "";
                    audioRef.current = null;
                    console.log("✅ Audio HTML5 detenido");
                } catch (e) {
                    console.warn("Error deteniendo audio HTML5:", e);
                }
            }
            
            // 3. Detener todos los elementos audio en la página
            const allAudio = document.querySelectorAll('audio');
            allAudio.forEach(audio => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (e) {
                    console.warn("Error deteniendo audio global:", e);
                }
            });
            
            // 4. Actualizar estado
            setIsSpeaking(false);
            speakingLockRef.current = false;
            
            console.log("✅ stopSpeaking completado");
            
        } catch (error) {
            console.error("Error en stopSpeaking:", error);
            setIsSpeaking(false);
            speakingLockRef.current = false;
        }
    }, []);

    // Función principal de síntesis de voz
    const speak = useCallback(async (text, onEndCallback = null, options = {}, sessionToken = null) => {
        if (speakingLockRef.current) {
            console.log("⚠️ Ya hay un proceso de habla en curso");
            return;
        }

        speakingLockRef.current = true;
        setIsSpeaking(true);
        setError(null);

            // ✅ AGREGAR ESTAS LÍNEAS AQUÍ
    // Verificar que el navegador esté listo para reproducir audio
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
        console.log('🔇 Cancelando síntesis anterior antes de hablar');
        window.speechSynthesis.cancel();
    }

        const mergedOptions = {
            service: 'polly',
            voice_id: 'Lupe',
            ...options
        };

        console.log(`🗣️ Iniciando síntesis con servicio ${mergedOptions.service}, voz ${mergedOptions.voice_id}`);

        try {
            if (text.length > 800) {
                console.log("Texto largo detectado, dividiendo en frases...");
                const sentences = splitTextIntoSentences(text);
                console.log(`Dividido en ${sentences.length} frases`);

                let audioQueue = [];

                for (const [index, sentence] of sentences.entries()) {
                    console.log(`Procesando frase ${index + 1}/${sentences.length}`);

                    try {
                       // AGREGAR ESTAS LÍNEAS ANTES DE: const response = await voiceService.speak(sentence, {
console.log('🔍 DEBUG VoiceContext - sessionToken recibido:', sessionToken);
console.log('🔍 DEBUG VoiceContext - typeof:', typeof sessionToken); 

                       const response = await voiceService.speak(sentence, {
    ...mergedOptions,
    sessionToken: sessionToken
});

                        if (response.data && response.data.success) {
                            if (index === 0) {
                                audioRef.current = new Audio(response.data.url);

audioRef.current.onended = () => {
    console.log("Primera frase terminada");
    
    if (audioQueue.length > 0) {
        const nextAudio = audioQueue.shift();
        audioRef.current = nextAudio;
        nextAudio.play().catch(error => {
            console.error("Error reproduciendo audio de cola:", error);
        });
    } else if (index === sentences.length - 1) {
        // 🍎 DETECTAR iOS PARA MANEJAR CALLBACK
        const isIOS = detectIOS();
        console.log("🍎 iOS detectado en primera frase (cola):", isIOS);
        
        setIsSpeaking(false);
        speakingLockRef.current = false;
        
        if (typeof onEndCallback === 'function') {
            if (isIOS) {
                // 🍎 iOS: NO ejecutar callback automáticamente
                console.log("🍎 iOS: Callback bloqueado - Usuario debe presionar micrófono");
                // NO llamar onEndCallback() en iOS
            } else {
                // 🖥️ Desktop/Android: Ejecutar callback normal
                console.log("🖥️ Desktop: Ejecutando callback de cola");
                onEndCallback();
            }
        }
    }
};

                                audioRef.current.onerror = (error) => {
                                    console.error("Error en primera frase:", error);
                                    setError('Error en reproducción de audio');
                                    setIsSpeaking(false);
                                    speakingLockRef.current = false;
                                };

                                await audioRef.current.play();
                            } else {
                                const audioElement = new Audio(response.data.url);

                                audioElement.onended = () => {
                                    if (audioQueue.length > 0) {
                                        const nextAudio = audioQueue.shift();
                                        audioRef.current = nextAudio;
                                        nextAudio.play().catch(console.error);
                                    } else if (index === sentences.length - 1) {
                                        setIsSpeaking(false);
                                        speakingLockRef.current = false;
                                        if (typeof onEndCallback === 'function') {
                                            onEndCallback();
                                        }
                                    }
                                };

                                audioQueue.push(audioElement);
                            }
                        }
                    } catch (sentenceError) {
                        console.error(`Error en frase ${index + 1}:`, sentenceError);
                    }
                }
            } else {
               const response = await voiceService.speak(text, {
    ...mergedOptions,
    sessionToken: sessionToken
});

if (response.data && response.data.success) {
    audioRef.current = new Audio(response.data.url);

    audioRef.current.onended = () => {
        console.log("✅ Audio terminado");
        
        // 🍎 DETECTAR iOS PARA MANEJAR CALLBACK
        const isIOS = detectIOS();
        console.log("🍎 iOS detectado en audio simple:", isIOS);
        
        setIsSpeaking(false);
        speakingLockRef.current = false;
        audioRef.current = null;
        
        if (typeof onEndCallback === 'function') {
            if (isIOS) {
                // 🍎 iOS: NO ejecutar callback automáticamente
                console.log("🍎 iOS: Callback bloqueado - Usuario debe presionar micrófono");
                // NO llamar onEndCallback() en iOS
            } else {
                // 🖥️ Desktop/Android: Ejecutar callback normal
                console.log("🖥️ Desktop: Ejecutando callback normal");
                onEndCallback();
            }
        }
    };

                    audioRef.current.onerror = (error) => {
                        console.error("❌ Error en audio:", error);
                        setError('Error en síntesis de voz');
                        setIsSpeaking(false);
                        speakingLockRef.current = false;
                    };

                    await audioRef.current.play();
                } else {
                    throw new Error('Respuesta inválida del servicio de voz');
                }
            }
        } catch (error) {
            console.error("❌ Error en speak:", error);
            setError(`Error en síntesis de voz: ${error.message}`);
            setIsSpeaking(false);
            speakingLockRef.current = false;

            // Fallback con Web Speech API
            try {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'es-ES';
                    utterance.onend = () => {
                        setIsSpeaking(false);
                        speakingLockRef.current = false;
                        if (typeof onEndCallback === 'function') {
                            onEndCallback();
                        }
                    };
                    window.speechSynthesis.speak(utterance);
                }
            } catch (fallbackError) {
                console.error("❌ Error en fallback:", fallbackError);
            }
        }
    }, []);

    // Función speakStreaming (si la usas)
    const speakStreaming = useCallback(async (text, onEndCallback = null) => {
        return speak(text, onEndCallback, { streaming: true });
    }, [speak]);

    // Función para resetear transcript
    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);

    // Función para inicializar el procesamiento de audio
const initializeAudioProcessing = useCallback(async () => {
    // 🍎 DETECTAR iOS Y SALIR INMEDIATAMENTE
    const isIOS = detectIOS()
    
    if (isIOS) {
        console.log('🍎 iOS detectado - Audio processing DESHABILITADO');
        console.log('🍎 iOS usa su propio procesamiento nativo optimizado');
        setAudioInitialized(false); // Mantener deshabilitado
        setAudioQuality('good'); // Asumir buena calidad
        return false; // No inicializar
    }
    
    if (audioInitialized) {
        console.log('✔ Audio ya inicializado');
        return true;
    }

    try {
        console.log('🎤 Inicializando sistema de audio mejorado...');

        const config = {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
            sampleRate: 48000,
            noiseGateThreshold: -50,
            gainBoost: sensitivity,
            highpassFrequency: 200,
            lowpassFrequency: 3000
        };

        await audioProcessingService.initialize(config);

        processedStreamRef.current = audioProcessingService.getProcessedStream();

        console.log('🔊 Analizando ruido ambiente...');
        const noiseAnalysis = await audioProcessingService.analyzeNoiseLevel(2000);

        setNoiseLevel(noiseAnalysis.noiseLevel);
        console.log(`🔊 Nivel de ruido: ${noiseAnalysis.noiseLevel.toFixed(2)}`);
        console.log(`🔊 Evaluación: ${noiseAnalysis.recommendation}`);

        if (noiseAnalysis.noiseLevel > 50) {
            setAudioQuality('poor');
            console.log('⚠️ Mucho ruido detectado');
        } else if (noiseAnalysis.noiseLevel > 25) {
            setAudioQuality('fair');
            console.log('⚡ Ruido moderado');
        } else {
            setAudioQuality('good');
            console.log('✅ Ambiente óptimo detectado');
        }

        setAudioInitialized(true);
        console.log('✅ Sistema de audio mejorado listo');
        return true;

    } catch (error) {
        console.error('❌ Error al inicializar audio mejorado:', error);
        setError(`No se pudo acceder al micrófono: ${error.message}`);
        return false;
    }
}, [audioInitialized, sensitivity]);

    // Función para inicializar el reconocimiento
const initializeRecognition = useCallback((callback) => {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // ✅ DETECTAR iOS
        const isIOS = detectIOS();

            recognition.lang = 'es-ES';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 3;

            console.log('🎤 Inicializando reconocimiento de voz');
                    console.log('📱 Dispositivo iOS:', isIOS);

                            // 🍎 CRÍTICO: En iOS, NO usar stream procesado
        if (isIOS) {
            console.log('🍎 iOS: Usando micrófono directo SIN procesamiento');
            // SpeechRecognition en iOS usa su propio acceso al micrófono
            // NO intentar conectar un MediaStream procesado
        } else {
            console.log('🖥️ Desktop: Puede usar procesamiento de audio si está disponible');
            // En desktop, el procesamiento funciona pero es opcional
        }


            recognition.onstart = () => {
                console.log("✅ Reconocimiento iniciado");
                setIsListening(true);
                listeningLockRef.current = false;
            };

            recognition.onresult = (event) => {
                if (event.results && event.results[0]) {
                    const result = event.results[0];
                    const text = result[0].transcript;
                    const confidence = result[0].confidence;

                    console.log("🎤 Texto reconocido:", text);
                    console.log("📊 Confianza:", (confidence * 100).toFixed(1) + '%');

                    if (confidence < 0.6) {
                        console.warn('⚠️ Confianza baja');
                        setError('Audio detectado pero con baja confianza. Intenta hablar más claro.');
                    }

                    setTranscript(text);

                    if (callback) {
                        callback(text);
                    }
                }
            };

            recognition.onerror = (event) => {
                console.error("❌ Error de reconocimiento:", event.error);

                let errorMessage = null;

                switch(event.error) {
                    case 'no-speech':
                        errorMessage = 'No se detectó voz. Habla más cerca del micrófono.';
                        console.log('💡 Sugerencia: Abre la calibración (🎚️) para ver el nivel de ruido');
                        break;
                    case 'audio-capture':
                        errorMessage = 'No se pudo acceder al micrófono. Verifica los permisos.';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Permiso de micrófono denegado.';
                        break;
                    case 'network':
                        errorMessage = 'Error de red. Verifica tu conexión.';
                        break;
                    case 'aborted':
                        errorMessage = null;
                        break;
                    default:
                        errorMessage = `Error de reconocimiento: ${event.error}`;
                }

                if (errorMessage) {
                    setError(errorMessage);
                }
                listeningLockRef.current = false;
            };

            recognition.onend = () => {
                console.log("🛑 Reconocimiento finalizado");
                setIsListening(false);
                recognitionRef.current = null;
                listeningLockRef.current = false;
            };

            recognition.start();
            recognitionRef.current = recognition;

        } catch (error) {
            console.error("❌ Error al iniciar reconocimiento:", error);
            setError(`Error al iniciar reconocimiento: ${error.message}`);
            setIsListening(false);
            listeningLockRef.current = false;
        }
    }, []);



    // Función para iniciar reconocimiento
const startListening = useCallback((callback) => {
    // 🍎 DETECTAR iOS
    const isIOS = detectIOS();
    
    if (isListening || listeningLockRef.current) {
        console.log('⚠️ Ya está escuchando o bloqueado');
        return;
    }
    
    listeningLockRef.current = true;

    if (recognitionRef.current) {
        try {
            recognitionRef.current.abort();
        } catch (e) {
            console.warn("Abortando instancia anterior");
        }
        recognitionRef.current = null;
    }

    setTranscript('');
    setError(null);

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        setError('Tu navegador no soporta reconocimiento de voz');
        listeningLockRef.current = false;
        return;
    }
    
    // 🍎 EN iOS: NO inicializar audio processing
    if (isIOS) {
        console.log('🍎 iOS: Saltando audio processing, usando micrófono nativo');
        // Ir directo a inicializar reconocimiento
    }

    if (isSpeaking) {
        stopSpeaking();
        setTimeout(() => {
            initializeRecognition(callback);
        }, isIOS ? 500 : 100); // iOS necesita más tiempo
    } else {
        initializeRecognition(callback);
    }
}, [isListening, isSpeaking, stopSpeaking, initializeRecognition]);

    // Función para interpretar comandos
    const interpretCommand = useCallback(async (command, context = {}) => {
        try {
            const response = await voiceService.interpretCommand(command, context);

            if (response.data && response.data.success && response.data.interpretation) {
                return response.data.interpretation;
            }

            return null;
        } catch (error) {
            console.error("Error interpretando comando:", error);
            setError(`Error al interpretar comando: ${error.message}`);
            return null;
        }
    }, []);

    // Función para limpiar recursos
    const cleanup = useCallback(() => {
        try {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch (e) {
                    console.warn("Error abortando reconocimiento:", e);
                }
                recognitionRef.current = null;
            }

            if (audioRef.current) {
                try {
                    audioRef.current.pause();
                    audioRef.current.src = '';
                } catch (e) {
                    console.warn("Error limpiando audio:", e);
                }
                audioRef.current = null;
            }

            if (audioInitialized) {
                audioProcessingService.cleanup();
                setAudioInitialized(false);
                processedStreamRef.current = null;
            }

            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }

            console.log('🧹 Recursos completamente liberados');

        } catch (error) {
            console.error("Error en cleanup:", error);
        }
    }, [audioInitialized]);

    // Valor del contexto
    const contextValue = {
        isListening,
        isSpeaking,
        transcript,
        error,
        startListening,
        stopListening,
        speak,
        speakStreaming,
        interpretCommand,
        stopSpeaking,
        cleanup,
        resetTranscript,
        // Nuevos valores para audio mejorado
        audioInitialized,
        noiseLevel,
        sensitivity,
        audioQuality,
        setSensitivity: (level) => {
            setSensitivity(level);
            if (audioInitialized) {
                audioProcessingService.setSensitivity(level);
            }
        },
        initializeAudioProcessing,
        analyzeNoise: () => audioProcessingService.analyzeNoiseLevel(2000)
    };

    return (
        <VoiceContext.Provider value={contextValue}>
            {children}
        </VoiceContext.Provider>
    );
};