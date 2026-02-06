// src/components/VideoMentorPopupiPhone.js
// Versión adaptada del VideoMentorPopup para iPhone con Whisper
// ✅ Usa Whisper (MediaRecorder) en lugar de Speech Recognition
// ✅ Detección de silencio integrada
// ✅ Player de Vimeo con controles personalizados
// ✅ Sistema de retroalimentación con 3 preguntas

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { whisperService } from '../services/whisperService';
import SilenceDetector from '../services/silenceDetector';
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
  userId 
}) => {
  // Estados del video
  const [videoStatus, setVideoStatus] = useState('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showSeekWarning, setShowSeekWarning] = useState(false);
  
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
  
  // Referencias para grabación
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceDetectorRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  
  // ============= FUNCIÓN: GUARDAR PROGRESO =============
  const saveProgress = useCallback((timeInSeconds) => {
    if (!videoData?.id || !userId) return;
    
    const roundedTime = Math.floor(timeInSeconds);
    if (roundedTime === lastSavedTime.current) return;
    
    lastSavedTime.current = roundedTime;
    maxTimeReached.current = Math.max(maxTimeReached.current, roundedTime);
    
    fetch('https://mentoria.ateneo.co/backend/api/update-video-progress.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        user_id: userId,
        video_id: videoData.id,
        timestamp_actual: roundedTime,
        timestamp_maximo: maxTimeReached.current
      })
    })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log('✅ Progreso guardado:', roundedTime);
      }
    })
    .catch(error => console.error('❌ Error guardando progreso:', error));
  }, [videoData, userId]);
  
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
          fetch('https://mentoria.ateneo.co/backend/api/update-video-duration.php', {
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
    
    // Event Listeners
    playerRef.current.on('play', () => {
      console.log('▶️ Video reproduciéndose');
      setVideoStatus('playing');
      
      // Detener voz si está hablando o escuchando
      stopSpeaking();
      stopListening();
    });
    
    playerRef.current.on('pause', (data) => {
      console.log('⏸️ Video pausado en:', data.seconds);
      setVideoStatus('paused');
      saveProgress(data.seconds);
      
      // Iniciar conversación después de pausar
      setTimeout(() => {
        if (!playerRef.current) return;
        
        const message = "¿Tienes alguna pregunta sobre lo que acabamos de ver o hay algo que te gustaría que te explique mejor?";
        addChatMessage(message, false);
        speak(message, () => {
          startListening();
        });
      }, 1000);
    });
    
    playerRef.current.on('timeupdate', (data) => {
      setCurrentTime(data.seconds);
      
      if (data.seconds > maxTimeReached.current + 5) {
        playerRef.current.setCurrentTime(maxTimeReached.current).catch(() => {});
        setShowSeekWarning(true);
        setTimeout(() => setShowSeekWarning(false), 2000);
      }
      
      if (Math.floor(data.seconds) % 5 === 0) {
        saveProgress(data.seconds);
      }
    });
    
    playerRef.current.on('ended', () => {
      console.log('✅ Video completado');
      setVideoStatus('completed');
      saveProgress(videoDuration);
      
      // Marcar como completado
      fetch('https://mentoria.ateneo.co/backend/api/update-video-progress.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          user_id: userId,
          video_id: videoData.id,
          completado: 1,
          timestamp_actual: Math.floor(videoDuration),
          timestamp_maximo: Math.floor(videoDuration)
        })
      });
      
      if (onComplete) onComplete();
    });
  }, [videoData, videoDuration, userId, saveProgress, onComplete]);
  
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
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
        
        if (audioBlob.size === 0) {
          console.error('❌ Audio vacío');
          return;
        }
        
        try {
          console.log('🔄 Transcribiendo con Whisper...');
          const transcription = await whisperService.transcribe(audioBlob, userId);
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
    
    console.log('🛑 Deteniendo grabación...');
    
    if (silenceDetectorRef.current) silenceDetectorRef.current.stop();
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('Error deteniendo recorder:', error);
      }
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
  
  // ============= EFECTOS =============
  useEffect(() => {
    if (isOpen && videoData?.vimeo_id) {
      setIsPlayerReady(false);
      setChatHistory([]);
      setVideoStatus('loading');
      setCurrentTime(videoData.timestamp_actual || 0);
      maxTimeReached.current = videoData.timestamp_maximo || 0;
      loadVimeoPlayer();
    }
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
      stopListening();
      stopSpeaking();
    };
  }, [isOpen, videoData, loadVimeoPlayer, stopListening, stopSpeaking]);
  
  useEffect(() => {
    if (isPlayerReady && playerRef.current) {
      playerRef.current.play().catch(() => {
        setVideoStatus('paused');
      });
    }
  }, [isPlayerReady]);
  
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);
  
  // ============= CLEANUP AL CERRAR =============
  const handleClose = useCallback(() => {
    stopListening();
    stopSpeaking();
    if (playerRef.current) {
      playerRef.current.destroy().catch(() => {});
      playerRef.current = null;
    }
    onClose();
  }, [stopListening, stopSpeaking, onClose]);
  
  if (!isOpen) return null;
  
  const percentage = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  
  return (
    <div className="video-popup-overlay">
      <div className="video-popup-container">
        <div className="video-section">
          <div className="video-header">
            <h3>{videoData?.titulo_completo || 'Video del Mentor'}</h3>
            <button className="close-button" onClick={handleClose}>
              <span style={{ fontSize: '1.3rem', fontWeight: '700' }}>×</span>
              <span style={{ fontSize: '0.9rem' }}>Cerrar</span>
            </button>
          </div>
          
          <div className="video-container">
            <iframe
              id="vimeo-player-iphone"
              src={`https://player.vimeo.com/video/${videoData?.vimeo_id}?h=${videoData?.hash_privacidad}&autoplay=0&autopause=0&controls=0&muted=0&dnt=1&playsinline=1&transparent=0&responsive=1&keyboard=0&portrait=0&title=0&byline=0`}
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
            
            {!isPlayerReady && <div className="video-loader">Cargando video...</div>}
            {showSeekWarning && <div className="seek-warning">No puedes adelantar el video.</div>}
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
        
        <div className="interactive-panel">
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
          
          <div className="chat-container">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.isUser ? 'user' : 'assistant'}`}>
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