// src/components/VideoMentorPopupiPhone.js
// Versión adaptada del VideoMentorPopup para iPhone con Whisper
// ✅ Usa Whisper (MediaRecorder) en lugar de Speech Recognition
// ✅ Detección de silencio integrada
// ✅ Player de Vimeo con controles personalizados
// ✅ Sistema de retroalimentación con 3 preguntas
// ✅ FIX AUDIO IOS: Botón de inicio manual para desbloquear sonido

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { whisperService } from '../services/whisperService';
import SilenceDetector from '../services/silenceDetector';
import { API_BASE_URL } from '../services/api';
import './VideoMentorPopup.css';

// Iconos SVG
const PlayIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const MicIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>;
const AiIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3-2h1v-1h-1v1zm-2 0h1v-1h-1v1z"/></svg>;
const RestartIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>;
const Replay10Icon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1L7 6l4.99 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h2c0 2.21 1.79 4 4 4s4-1.79 4-4-1.79-4-4-4zm-1.1 11H10v-3.3L9 13v-.7h3v.7l-1 1.3zm-3.4-3.3v-.7h3v.7l-1 1.3V16H6.5v-3.3z"/></svg>;

const VideoMentorPopupiPhone = ({
  isOpen,
  onClose,
  videoData,
  onComplete,
  documentId,
  sessionToken,
  userId,
  allowSeek = false
}) => {
  // Estados del video
  const [videoStatus, setVideoStatus] = useState('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showSeekWarning, setShowSeekWarning] = useState(false);
  
  // ✅ ESTADO NUEVO: Control del overlay de inicio (Fix iOS Audio)
  const [showStartOverlay, setShowStartOverlay] = useState(false);
  
  // Estados de voz (Whisper)
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Estados de chat
  const [chatHistory, setChatHistory] = useState([]);
  
  // Referencias
  const playerRef = useRef(null);
  const audioRef = useRef(null);
  const lastSavedTime = useRef(0);
  const maxTimeReached = useRef(0);
  const chatEndRef = useRef(null);
  const allowSeekRef = useRef(allowSeek); // Ref para evitar closure stale

  // Mantener ref sincronizada con prop
  useEffect(() => {
    console.log('🔄 allowSeek prop changed (iPhone):', allowSeek);
    allowSeekRef.current = allowSeek;
  }, [allowSeek]);

  // Referencias para grabación
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceDetectorRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  const cancelTranscriptionRef = useRef(false);

  
  // ============= FUNCIÓN: GUARDAR PROGRESO =============
  const saveProgress = useCallback(async (timeInSeconds) => {
    if (!videoData?.id || !documentId) return;
    
    try {
        const percentage = videoDuration > 0 ? (timeInSeconds / videoDuration) * 100 : 0;
        const isCompleted = percentage >= 90;
        
        console.log('💾 Guardando progreso:', {
            timeInSeconds: timeInSeconds.toFixed(1),
            videoDuration: videoDuration.toFixed(1),
            percentage: percentage.toFixed(1),
            isCompleted: isCompleted
        });
        
        const response = await fetch(`${API_BASE_URL}/video-mentor-progress.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                video_id: videoData.id,
                document_id: documentId,
                timestamp_actual: Math.round(timeInSeconds),
                timestamp_maximo: Math.max(Math.round(timeInSeconds), maxTimeReached.current),
                completado: isCompleted ? 1 : 0
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Progreso guardado:', result);
        } else {
            console.error('❌ Error guardando progreso:', response.status);
        }
    } catch (error) {
        console.error('❌ Error en saveProgress:', error);
    }
  }, [videoData, documentId, videoDuration]);
  
  // ============= FUNCIÓN: INICIALIZAR PLAYER VIMEO =============
  const loadVimeoPlayer = useCallback(() => {
    if (!window.Vimeo) {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.onload = initializePlayer;
      document.head.appendChild(script);
    } else {
      initializePlayer();
    }
  }, [videoData]);
  
  const initializePlayer = useCallback(() => {
    const iframe = document.getElementById('vimeo-player-iphone');
    if (!iframe || playerRef.current) return;
    
    playerRef.current = new window.Vimeo.Player(iframe);
    
    playerRef.current.ready().then(() => {
      setIsPlayerReady(true);
      
      playerRef.current.getDuration().then(duration => {
        console.log('📏 Duración del video:', duration, 'segundos');
        setVideoDuration(duration);
        
        // Guardar duración en BD
        if (videoData.id && duration > 0) {
          fetch(`${API_BASE_URL}/update-video-duration.php`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              video_id: videoData.id,
              duration_seconds: Math.round(duration)
            })
          }).then(response => response.json())
            .then(result => {
              if (result.success) {
                console.log('✅ Duración guardada');
              }
            })
            .catch(error => console.error('Error guardando duración:', error));
        }
      }).catch(error => {
        console.error('Error obteniendo duración:', error);
      });
      
      if (videoData.timestamp_actual > 0) {
        playerRef.current.setCurrentTime(videoData.timestamp_actual).catch(() => {});
      }
    });
    
    // ✅ EVENTOS PLAYER
    playerRef.current.on('play', () => {
        console.log('▶️ Video reproduciéndose');
        setVideoStatus('playing');
        stopSpeaking();
        stopListening();
    });

playerRef.current.on('pause', (data) => {
  console.log('⏸️ Video pausado en:', data.seconds);
  setVideoStatus('paused');
  if (!allowSeekRef.current) saveProgress(data.seconds); // No guardar en modo repaso

  // Iniciar conversación después de pausar
  setTimeout(() => {
    // Si el reproductor ya fue destruido, no hacemos nada
    if (!playerRef.current) {
      console.log('🚫 Reproductor destruido, no iniciar conversación');
      return;
    }

    const message =
      "¿Tienes alguna pregunta sobre lo que acabamos de ver o hay algo que te gustaría que te explique mejor?";

    addChatMessage(message, false);

    // Verificar nuevamente que el video SIGUE pausado antes de hablar/escuchar
    playerRef.current
      .getPaused()
      .then((isPaused) => {
        if (!isPaused || !playerRef.current) {
          console.log('🔇 El video volvió a reproducirse, no se inicia escucha');
          return;
        }

        speak(message, () => {
          // limpiar cualquier texto previo y empezar a escuchar
          setTranscript('');
          startListening();
        });
      })
      .catch((error) => {
        console.warn('⚠️ Error verificando pausa:', error);
        // Fallback: asumir pausado
        speak(message, () => {
          setTranscript('');
          startListening();
        });
      });
  }, 1000);
});


    playerRef.current.on('timeupdate', (data) => {
        setCurrentTime(data.seconds);

        // Actualizar máximo alcanzado
        if (data.seconds > maxTimeReached.current) {
            maxTimeReached.current = data.seconds;
        }

        // Guardar progreso cada 5 segundos - No en modo repaso
        if (!allowSeekRef.current && Math.floor(data.seconds) % 5 === 0) {
            saveProgress(data.seconds);
        }
    });

    playerRef.current.on('ended', () => {
        console.log('✅ Video completado');
        setVideoStatus('completed');

        // Solo guardar progreso y notificar si NO es modo repaso
        if (!allowSeekRef.current) {
            saveProgress(videoDuration);

            fetch(`${API_BASE_URL}/video-mentor-progress.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    video_id: videoData.id,
                    document_id: documentId,
                    completado: 1,
                    timestamp_actual: Math.floor(videoDuration),
                    timestamp_maximo: Math.floor(videoDuration)
                })
            });

            if (onComplete) onComplete();
        }
    });

    // Bloqueo de seek - Solo aplica si allowSeekRef.current es false (video no completado)
    playerRef.current.on('seeked', (data) => {
        console.log('🎯 SEEKED event (iPhone):', {
            seconds: data.seconds,
            maxTimeReached: maxTimeReached.current,
            allowSeekRef: allowSeekRef.current
        });
        if (!allowSeekRef.current && data.seconds > maxTimeReached.current + 2) {
            console.log('⛔ BLOCKING seek (iPhone)');
            playerRef.current.setCurrentTime(maxTimeReached.current).catch(() => {});
            setShowSeekWarning(true);
            setTimeout(() => setShowSeekWarning(false), 2000);
        }
    });
  }, [videoData, videoDuration, userId, saveProgress, onComplete, allowSeek]);

  // ============= ✅ NUEVO: LÓGICA PARA DETECTAR AUDIO EN IOS =============
  // Este efecto se activa cuando el player está listo e intenta reproducir.
  // Si iOS fuerza el mute, pausa y muestra el botón de desbloqueo.
// 🔊 Autoplay en silencio para iOS: el video arranca reproduciendo muteado
useEffect(() => {
  if (isPlayerReady && playerRef.current) {
    // Forzamos inicio en silencio (iOS suele permitir autoplay si está muteado)
    playerRef.current.setMuted(true);
    playerRef.current.setVolume(0).catch(() => {});

    const playPromise = playerRef.current.play();

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          console.log('▶️ Video iniciado en silencio (iOS Fix)');
          // El video está reproduciendo (aunque sea sin sonido)
          setVideoStatus('playing');
          // Mostramos overlay para que el usuario active el sonido
          setShowStartOverlay(true);
        })
        .catch((error) => {
          // Autoplay bloqueado incluso en silencio: el usuario tendrá que iniciar manual
          console.log('🍎 Autoplay bloqueado incluso en silencio:', error);
          setVideoStatus('paused');
          setShowStartOverlay(true);
        });
    }
  }
}, [isPlayerReady]);



// ============= ✅ HANDLER DE INICIO MANUAL (activar sonido y quitar overlay) =============
// ============= ✅ NUEVO: HANDLER DE INICIO MANUAL =============
// ============= ✅ HANDLER DE INICIO MANUAL (activar sonido y quitar overlay) =============
const handleManualStart = useCallback(() => {
  if (!playerRef.current) return;

  // Quitar mute y subir volumen
  playerRef.current.setMuted(false);
  playerRef.current.setVolume(1).catch(() => {});

  // Quitamos el overlay inmediatamente al hacer click
  setShowStartOverlay(false);

  const playPromise = playerRef.current.play();

  if (playPromise && typeof playPromise.then === 'function') {
    playPromise
      .then(() => {
        console.log('▶️ Reproducción manual con sonido');
        setVideoStatus('playing');
      })
      .catch((error) => {
        console.error('Error al iniciar video manualmente:', error);
        // Si falla, igual ya quitamos el overlay y el usuario puede usar el play de Vimeo
      });
  } else {
    // Por si el player no devuelve promesa (caso raro)
    setVideoStatus('playing');
  }
}, []);



  
  // ============= FUNCIÓN: HABLAR (TTS) =============
  const speak = useCallback(async (text, onEndCallback = null) => {
    if (!text || text.trim() === '') return;
    
    try {
      setIsSpeaking(true);
      
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      
      const { voiceService } = await import('../services/api');
      
      console.log('🗣️ Generando audio...');
      const response = await voiceService.speak(text, {
        service: 'polly',
        voice_id: 'Lupe',
        sessionToken: sessionToken
      });
      
      if (!response.data?.url) throw new Error('Sin URL de audio');
      
      audio.src = response.data.url;
      audio.load();
      
      audio.onended = () => {
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
      };
      
      await audio.play();
      
    } catch (error) {
      console.error('❌ Error en TTS:', error);
      setIsSpeaking(false);
    }
  }, [sessionToken]);
  
  // ============= FUNCIÓN: DETENER AUDIO =============
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  }, []);
  
  // ============= FUNCIÓN: INICIAR GRABACIÓN (WHISPER) =============
  const startListening = useCallback(() => {
    if (isListening) return;
    
    console.log('🎤 Iniciando grabación Whisper...');
    
    navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    })
    .then(async (stream) => {
      mediaStreamRef.current = stream;
      
      // Inicializar detector de silencio
      const detector = new SilenceDetector({
        silenceThreshold: 0.01,
        silenceDuration: 1500,
        minRecordingTime: 500,
        maxRecordingTime: 15000
      });
      
      await detector.initialize(stream);
      silenceDetectorRef.current = detector;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstart = () => {
        console.log('✅ Grabación iniciada');
        setIsListening(true);
        
        detector.start({
          onSilenceDetected: () => {
            console.log('🔇 Silencio detectado');
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
          },
          onSoundDetected: (level) => setAudioLevel(level),
          onMaxTimeReached: () => {
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
          }
        });
        
        audioLevelIntervalRef.current = setInterval(() => {
          if (detector) setAudioLevel(detector.getCurrentLevel());
        }, 100);
      };
      
      mediaRecorder.onstop = async () => {
        console.log('🛑 Grabación detenida');
        setIsListening(false);
        setAudioLevel(0);

        if (silenceDetectorRef.current) silenceDetectorRef.current.stop();
        if (audioLevelIntervalRef.current) {
          clearInterval(audioLevelIntervalRef.current);
          audioLevelIntervalRef.current = null;
        }

        const wasCancelled = cancelTranscriptionRef.current;
        cancelTranscriptionRef.current = false;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioBlob.size === 0 || wasCancelled) {
          if (wasCancelled) {
            console.log('🟡 Grabación cancelada, no se envía a Whisper');
          } else {
            console.error('❌ Audio vacío');
          }
          return;
        }

        try {
          console.log('🔄 Transcribiendo con Whisper...');
          const transcription = await whisperService.transcribe(audioBlob, userId);

          // ============================================================
  // 🛡️ FIX: FILTRO ANTI-ALUCINACIONES (VIDEOPOPUP)
  // ============================================================
  if (transcription) {
      const lowerText = transcription.toLowerCase();
      // Filtramos las mismas frases fantasma
      if (
          lowerText.includes('amara.org') || 
          lowerText.includes('subtítulos realizados') ||
          lowerText.includes('subtitulos realizados') ||
          lowerText.includes('alejo 20')
      ) {
          console.log('👻 Alucinación de Whisper bloqueada en VideoPopup:', transcription);
          // ⛔️ Importante: Salimos sin agregar al chat ni enviar comando
          return; 
      }
  }
  // ============================================================
  
          console.log('✅ Transcripción:', transcription);

          setTranscript(transcription);
          addChatMessage(transcription, true);

          await handleUserCommand(transcription);
        } catch (error) {
          console.error('❌ Error en Whisper:', error);
        }
      };

      
      mediaRecorder.onerror = (event) => {
        console.error('❌ Error MediaRecorder:', event.error);
        setIsListening(false);
        if (silenceDetectorRef.current) silenceDetectorRef.current.stop();
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
    })
    .catch(error => {
      console.error('❌ Error accediendo al micrófono:', error);
      setIsListening(false);
    });
  }, [isListening, userId]);
  
  // ============= FUNCIÓN: DETENER GRABACIÓN =============
  const stopListening = useCallback(() => {
    if (!isListening) return;
    console.log('🛑 Deteniendo grabación (cancelando transcripción)...');

    // Esta parada viene de código (play video, cerrar, etc.)
    cancelTranscriptionRef.current = true;

    if (silenceDetectorRef.current) silenceDetectorRef.current.stop();
    if (audioLevelIntervalRef.current) clearInterval(audioLevelIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch (error) {}
    }
    setIsListening(false);
    setAudioLevel(0);
  }, [isListening]);

  
  // ============= FUNCIÓN: AGREGAR MENSAJE AL CHAT =============
  const addChatMessage = useCallback((message, isUser) => {
    setChatHistory(prev => [...prev, {
      text: message,
      isUser,
      timestamp: new Date()
    }]);
  }, []);
  
  // ============= FUNCIÓN: MANEJAR COMANDOS DEL USUARIO =============
  const handleUserCommand = useCallback(async (command) => {
    const lowerCommand = command.toLowerCase().trim();
    
    // Comandos explícitos de continuar
    const comandosContinuar = [
      'continuar', 'continuemos', 'continúa', 'continua el video',
      'seguir', 'sigamos', 'sigue el video',
      'reproducir', 'reproduce', 'play',
      'reanudar', 'reanuda', 'reanudemos'
    ];
    
    if (comandosContinuar.some(cmd => lowerCommand.includes(cmd))) {
      if (playerRef.current) {
        stopSpeaking();
        try {
          await playerRef.current.play();
        } catch (error) {
          console.error('Error al reproducir:', error);
        }
      }
      return;
    }
    
    // Comando para pausar
    if (lowerCommand.includes('pausar') || lowerCommand.includes('detener')) {
      if (playerRef.current && videoStatus === 'playing') {
        await playerRef.current.pause();
      }
      return;
    }
    
    // Si no es comando, es una pregunta - enviar al backend
    try {
      const { consultaService } = await import('../services/api');
      
      const requestData = {
        documentId: documentId,
        userId: userId,
        question: command,
        sessionToken: sessionToken,
        videoContext: {
          videoId: videoData.id,
          currentTime: currentTime,
          videoDuration: videoDuration,
          videoTitle: videoData.titulo_completo
        }
      };
      
      const response = await consultaService.sendQuestion(requestData);
      
      const answer = response.data.answer;
      addChatMessage(answer, false);
      
      await speak(answer, () => {
        startListening();
      });
      
    } catch (error) {
      console.error('❌ Error consultando backend:', error);
      const errorMsg = 'Lo siento, hubo un error. ¿Puedes repetir tu pregunta?';
      addChatMessage(errorMsg, false);
      await speak(errorMsg, () => startListening());
    }
  }, [documentId, userId, sessionToken, videoData, currentTime, videoDuration, videoStatus, speak, startListening, stopSpeaking, addChatMessage]);
  
  // ============= CONTROLES DEL PLAYER =============
  const togglePlayPause = useCallback(async () => {
    if (!playerRef.current) return;
    
    try {
      if (videoStatus === 'playing') {
        await playerRef.current.pause();
      } else {
        await playerRef.current.play();
      }
    } catch (error) {
      console.error('Error toggle play/pause:', error);
    }
  }, [videoStatus]);
  
  const handleRestart = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      await playerRef.current.setCurrentTime(0);
      await playerRef.current.play();
    } catch (error) {
      console.error('Error reiniciando:', error);
    }
  }, []);
  
  const handleRewind10 = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      const newTime = Math.max(0, currentTime - 10);
      await playerRef.current.setCurrentTime(newTime);
    } catch (error) {
      console.error('Error retrocediendo:', error);
    }
  }, [currentTime]);
  
  // ============= EFECTOS DE INICIO =============
useEffect(() => {
  if (isOpen && videoData?.vimeo_id) {
    // Solo cuando se abre el popup
    setIsPlayerReady(false);
    setChatHistory([]);
    setVideoStatus('loading');
    setCurrentTime(videoData.timestamp_actual || 0);
    maxTimeReached.current = videoData.timestamp_maximo || 0;
    loadVimeoPlayer();
  }

  return () => {
    // Solo cuando el componente se desmonta / se cierra el popup
    if (playerRef.current) {
      playerRef.current.destroy().catch(() => {});
      playerRef.current = null;
    }
    stopListening();
    stopSpeaking();
  };
}, [isOpen]); // 👈 OJO: solo depende de isOpen

  
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);
  
  // ============= CLEANUP AL CERRAR =============
const handleClose = useCallback(() => {
  console.log('❌ Cerrando popup de video (iPhone)');

  const finish = (lastTime, duration) => {
    stopListening();
    stopSpeaking();

    if (playerRef.current) {
      playerRef.current
        .destroy()
        .catch(() => {})
        .finally(() => {
          playerRef.current = null;
        });
    }

    if (typeof onClose === 'function') {
      onClose(lastTime || 0, duration || videoDuration || 0);
    }
  };

  if (isPlayerReady && playerRef.current) {
    playerRef.current
      .getCurrentTime()
      .then((time) => {
        if (!allowSeekRef.current) saveProgress(time); // No guardar en modo repaso
        finish(time, videoDuration);
      })
      .catch(() => {
        finish(currentTime, videoDuration);
      });
  } else {
    finish(currentTime, videoDuration);
  }
}, [isPlayerReady, currentTime, videoDuration, stopListening, stopSpeaking, onClose, saveProgress, allowSeek]);



  
  if (!isOpen) return null;
  
  const percentage = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  
return (
  <div
    className="video-popup-overlay"
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
      padding: '20px'
    }}
  >
<div
  className="video-popup-container mobile-responsive-container" // Agregamos una clase específica
  style={{
    // Eliminamos width, maxWidth y height de aquí
    background: '#020617',
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }}
>
      <div
        className="video-section"
        style={{ padding: '12px 16px 8px' }}
      >
<div className="video-header">
  <h3
    className="video-title-iphone"
    style={{
      fontSize: '0.95rem',
      fontWeight: 600,
      margin: 0,
      marginRight: 8,
      color: '#e5e7eb',
    }}
  >
    {videoData?.titulo_completo || 'Video del Mentor'}
  </h3>

  

  <button
    className="close-button"
    onClick={handleClose}
    style={{
      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
      color: 'white',
      border: 'none',
      padding: '6px 14px',
      borderRadius: 999,
      fontSize: '0.9rem',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      boxShadow: '0 2px 6px rgba(220, 38, 38, 0.35)',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
  >
    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>×</span>
    <span>Cerrar</span>
  </button>
</div>

          
          <div className="video-container">
            <iframe
              id="vimeo-player-iphone"
              src={`https://player.vimeo.com/video/${videoData?.vimeo_id}?h=${videoData?.hash_privacidad}&autoplay=0&autopause=0&controls=${allowSeek ? 1 : 0}&muted=0&dnt=1&playsinline=1&transparent=0&responsive=1&keyboard=0&portrait=0&title=0&byline=0`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
            
            <div className="video-custom-controls visible">
              <button className="control-button-overlay" onClick={handleRestart} title="Reiniciar">
                <RestartIcon />
              </button>
              <button className="control-button-overlay" onClick={handleRewind10} title="Retroceder 10s">
                <Replay10Icon />
              </button>
              <button className="control-button-overlay play-pause" onClick={togglePlayPause}>
                {videoStatus === 'playing' ? <PauseIcon/> : <PlayIcon/>}
              </button>
              <div style={{ flex: 1 }}></div>
            </div>
            
            {/* ✅ AÑADIDO: EL BOTÓN DE INICIO PARA IOS */}
            {showStartOverlay && (
                <div className="ios-start-overlay" onClick={handleManualStart}>
                    <button className="ios-start-button">
                        <PlayIcon />
                        <span>Activar Sonido y Clase</span>
                    </button>
                </div>
            )}
            
            {videoStatus === 'loading' && (
  <div className="video-loader">Cargando video...</div>
)}

            {showSeekWarning && <div className="seek-warning">No puedes adelantar el video.</div>}
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
        
          <div
        className="interactive-panel"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '8px 16px 12px',
          overflow: 'hidden',
        }}
      >
          <h4 className="panel-title">Panel Interactivo del Mentor</h4>
          
          <div className="status-grid">
            <div className={`status-item ${isListening ? 'listening' : isSpeaking ? 'speaking' : ''}`}>
              <div className="status-icon">
                {isSpeaking ? <AiIcon/> : <MicIcon/>}
              </div>
              <div className="status-text">
                <span>Estado del Mentor</span>
                <strong>
                  {isListening ? 'Escuchando...' : isSpeaking ? 'Hablando...' : 'Listo'}
                </strong>
              </div>
            </div>
            
            {isListening && (
              <div className="audio-level-indicator">
                <div 
                  className="audio-level-bar" 
                  style={{ width: `${audioLevel * 100}%` }}
                ></div>
              </div>
            )}
          </div>
          
<div
  className="chat-container"
  style={{
    flex: 1,
    overflowY: 'auto',
    marginTop: 8,
  }}
>
  {chatHistory.map((msg, idx) => (
    <div
      key={idx}
      className={`chat-message ${msg.isUser ? 'user' : 'assistant'}`}
    >
      <div className="message-content">{msg.text}</div>
    </div>
  ))}
  <div ref={chatEndRef} />
</div>

          
          {transcript && (
            <div className="transcript-display">
              <small>Transcripción: {transcript}</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoMentorPopupiPhone;