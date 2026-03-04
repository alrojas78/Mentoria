import React, { useState, useEffect, useRef } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import { API_BASE_URL } from '../services/api';
import './VideoMentorPopup.css';

// --- Iconos SVG ---
const PlayIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>;
const PauseIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>;
const MicIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>;
const AiIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3-2h1v-1h-1v1zm-2 0h1v-1h-1v1z"/></svg>;

// --- ✅ AÑADIR ESTOS DOS NUEVOS ICONOS ---
const RestartIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>;
const Replay10Icon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 5V1L7 6l4.99 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h2c0 2.21 1.79 4 4 4s4-1.79 4-4-1.79-4-4-4zm-1.1 11H10v-3.3L9 13v-.7h3v.7l-1 1.3zm-3.4-3.3v-.7h3v.7l-1 1.3V16H6.5v-3.3z"/></svg>;

const VideoMentorPopup = ({ isOpen, onClose, videoData, onComplete, documentId, sessionToken, allowSeek = false }) => {
    const { speak, startListening, stopListening, isSpeaking, isListening, transcript, resetTranscript } = useVoice();
    const [videoStatus, setVideoStatus] = useState('loading');
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [showSeekWarning, setShowSeekWarning] = useState(false);
    const [showStartOverlay, setShowStartOverlay] = useState(false);

    // --- ✅ PEGA ESTAS DOS LÍNEAS QUE FALTAN AQUÍ ---
    const [showControls, setShowControls] = useState(true); // El estado para mostrar/ocultar
    const controlsTimeoutRef = useRef(null); // El ref para el temporizador
    // --- FIN DEL BLOQUE A PEGAR ---
    
    const playerRef = useRef(null);
    const lastSavedTime = useRef(0);
    const chatEndRef = useRef(null);
    const maxTimeReached = useRef(0);
    const allowSeekRef = useRef(allowSeek); // Ref para evitar closure stale

    // Mantener ref sincronizada con prop
    useEffect(() => {
        allowSeekRef.current = allowSeek;
    }, [allowSeek]);

    // ✅ FUNCIÓN QUE FALTABA
const getCompletionPercentage = () => {
    if (!videoDuration || videoDuration === 0) {
        return 0;
    }
    return (currentTime / videoDuration) * 100;
};

    // --- EFECTOS DE REACT ---
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
        };
    }, [isOpen, videoData?.vimeo_id]);

useEffect(() => {
        if (transcript && !isListening && !isSpeaking) {
            // ✅ VERIFICAR QUE EL VIDEO ESTÉ PAUSADO ANTES DE PROCESAR
            if (playerRef.current) {
                playerRef.current.getPaused().then(isPaused => {
                    if (isPaused) {
                        handleUserCommand(transcript);
                        resetTranscript();
                    } else {
                        console.warn('⚠️ Video reproduciéndose, ignorando comando de voz');
                        resetTranscript();
                    }
                }).catch(() => {
                    // Si hay error, procesar normalmente
                    handleUserCommand(transcript);
                    resetTranscript();
                });
            } else {
                handleUserCommand(transcript);
                resetTranscript();
            }
        }
    }, [transcript, isListening, isSpeaking]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory]);

// --- ✅ AÑADIR ESTAS 3 NUEVAS FUNCIONES ---

    // Muestra los controles y los oculta después de 3 segundos
    const showThenHideControls = () => {
     //   if (controlsTimeoutRef.current) {
       //     clearTimeout(controlsTimeoutRef.current);
       // }
       // setShowControls(true);
       // controlsTimeoutRef.current = setTimeout(() => {
       //     setShowControls(false);
       // }, 3000); // Ocultar después de 3 segundos
    };

    // Función para el botón de Retroceder 10s
    const handleRewind10 = () => {
        if (!playerRef.current) return;
        playerRef.current.getCurrentTime().then(time => {
            playerRef.current.setCurrentTime(Math.max(0, time - 10));
        }).catch(e => console.error("Error al retroceder:", e));
     //   showThenHideControls(); // Mantener controles visibles
    };

    // Función para el botón de Reiniciar
    const handleRestart = () => {
        if (!playerRef.current) return;
        playerRef.current.setCurrentTime(0).catch(e => console.error("Error al reiniciar:", e));
    //    showThenHideControls(); // Mantener controles visibles
    };

    // --- AÑADE ESTA NUEVA FUNCIÓN ---
    const togglePlayPause = () => {
        if (!playerRef.current) return;

        playerRef.current.getPaused().then(isPaused => {
            if (isPaused) {
                // Si está pausado, lo reproduce
                playerRef.current.play().catch(e => console.error("Error al reproducir video:", e));
            } else {
                // Si está reproduciendo, lo pausa
                playerRef.current.pause().catch(e => console.error("Error al pausar video:", e));
            }
        }).catch(e => console.error("Error al obtener estado del video:", e));

    //    showThenHideControls();
    };
    // --- FIN DE LA NUEVA FUNCIÓN ---
    const handleManualStart = () => {
        if (playerRef.current) {
            // Aseguramos volumen y desmuteo antes de reproducir
            playerRef.current.setMuted(false);
            playerRef.current.setVolume(1);
            
            playerRef.current.play().then(() => {
                setShowStartOverlay(false);
                setVideoStatus('playing');
            }).catch(e => console.error("Error al iniciar manual:", e));
        }
    };
    // ✅ CORRECCIÓN CRÍTICA: Efecto para reproducir el video cuando esté listo.
    // Esto separa la inicialización de la acción de reproducir.
// ✅ CORRECCIÓN PARA IOS (DETECTAR MUTE FORZADO)
    useEffect(() => {
        if (isPlayerReady && playerRef.current) {
            const playPromise = playerRef.current.play();

            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // El video arrancó. Ahora verificamos si iOS lo forzó a Mute.
                    return Promise.all([
                        playerRef.current.getMuted(),
                        playerRef.current.getVolume()
                    ]);
                }).then(([isMuted, volume]) => {
                    // Si está muteado O el volumen es muy bajo (comportamiento de iOS)
                    if (isMuted || volume < 0.1) {
                        console.log("iOS reprodujo el video pero forzó MUTE. Pausando y pidiendo clic.");
                        playerRef.current.pause(); // 🛑 Pausamos para que no se pierda contenido
                        setVideoStatus('paused');
                        setShowStartOverlay(true); // 👆 Mostramos botón para activar sonido
                    } else {
                        // Todo perfecto, tiene sonido
                        setVideoStatus('playing');
                        setShowStartOverlay(false);
                    }
                }).catch((error) => {
                    // Bloqueo total (ni siquiera arrancó el video)
                    console.log("Autoplay bloqueado totalmente:", error);
                    setVideoStatus('paused');
                    setShowStartOverlay(true);
                });
            }
        }
    }, [isPlayerReady]);


    // --- FUNCIONES ---
    const loadVimeoPlayer = () => {
        if (!window.Vimeo) {
            const script = document.createElement('script');
            script.src = 'https://player.vimeo.com/api/player.js';
            script.onload = initializePlayer;
            document.head.appendChild(script);
        } else {
            initializePlayer();
        }
    };

const initializePlayer = () => {
    const iframe = document.getElementById('vimeo-player');
    if (!iframe || playerRef.current) return;
    
    playerRef.current = new window.Vimeo.Player(iframe);

    playerRef.current.ready().then(() => {
        setIsPlayerReady(true);
        
        // ✅ AGREGAR ESTA SECCIÓN COMPLETA
        playerRef.current.getDuration().then(duration => {
            console.log('📏 Duración del video:', duration, 'segundos');
            setVideoDuration(duration);
            
            // ✅ GUARDAR DURACIÓN EN BD SI NO EXISTE
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
                          console.log('✅ Duración guardada:', result);
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

// ✅ EVENT LISTENERS SUPER SIMPLES - SIN COMPLICACIONES
playerRef.current.on('play', () => {
    console.log('▶️ Video reproduciéndose');
    setVideoStatus('playing');

 //   showThenHideControls();
    
    // ✅ DETENER RECONOCIMIENTO DE VOZ Y AUDIO DEL MENTOR
    if (isSpeaking) {
        window.speechSynthesis.cancel();
    }
    if (isListening) {
        stopListening();
    }
});

playerRef.current.on('pause', (data) => {
    console.log('⏸️ Video pausado en:', data.seconds);
    setVideoStatus('paused');
    if (!allowSeekRef.current) saveProgress(data.seconds); // No guardar en modo repaso

  //  setShowControls(true);
    
    // ✅ CONVERSACIÓN NATURAL SOLO SI EL REPRODUCTOR SIGUE ACTIVO
    setTimeout(() => {
        // ✅ VERIFICAR QUE EL REPRODUCTOR NO SE HAYA DESTRUIDO
        if (!playerRef.current) {
            console.log('🚫 Reproductor destruido, no iniciar conversación');
            return;
        }
        
        const message = "¿Tienes alguna pregunta sobre lo que acabamos de ver o hay algo que te gustaría que te explique mejor?";
        setChatHistory(prev => [...prev, { role: 'ai', text: message }]);
        
        // ✅ VERIFICAR NUEVAMENTE ANTES DE HABLAR
        playerRef.current.getPaused().then(isPaused => {
            if (isPaused && playerRef.current) {
                speak(message, () => {
                    resetTranscript();
                    startListening();
                });
            }
        }).catch(error => {
            console.warn('⚠️ Error verificando pausa:', error);
        });
    }, 1000);
});

playerRef.current.on('timeupdate', (data) => {
    setCurrentTime(data.seconds);
    
    // Actualizar máximo alcanzado
    if (data.seconds > maxTimeReached.current) {
        maxTimeReached.current = data.seconds;
    }
    
    // Guardar progreso cada 10 segundos (menos frecuente) - No en modo repaso
    if (!allowSeekRef.current && Math.abs(data.seconds - lastSavedTime.current) >= 10) {
        lastSavedTime.current = data.seconds;
        saveProgress(data.seconds);
    }
});

playerRef.current.on('ended', () => {
    console.log('🎬 Video terminado al 100%');
    setVideoStatus('completed');

    // ✅ Solo notificar al sistema si NO es modo repaso
    if (!allowSeekRef.current && onComplete) {
        onComplete();
    }
});

// Bloqueo de seek - Solo aplica si allowSeekRef.current es false (video no completado)
playerRef.current.on('seeked', (data) => {
    console.log('🎯 SEEKED event:', {
        seconds: data.seconds,
        maxTimeReached: maxTimeReached.current,
        allowSeekRef: allowSeekRef.current
    });
    if (!allowSeekRef.current && data.seconds > maxTimeReached.current + 2) {
        console.log('⛔ BLOCKING seek');
        playerRef.current.setCurrentTime(maxTimeReached.current).catch(() => {});
        setShowSeekWarning(true);
        setTimeout(() => setShowSeekWarning(false), 3000);
    }
});
};


const actualizarDuracionVideo = async (videoId, duracion) => {
    try {
        const response = await fetch(`${API_BASE_URL}/update-video-duration.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                video_id: videoId,
                duracion_segundos: duracion
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Duración guardada en BD:', result);
        }
    } catch (error) {
        console.error('❌ Error guardando duración:', error);
    }
};

const handleIntelligentFeedback = async (action, context) => {
    try {
        let prompt = "";
        
        switch (action) {
            case 'pause':
                prompt = `RETROALIMENTACIÓN_PAUSA: El estudiante pausó el video "${context.videoTitle}" en el minuto ${Math.floor(context.currentTime / 60)}:${Math.floor(context.currentTime % 60)} (${context.percentage.toFixed(1)}% del video). 
                
                Analiza este momento específico del contenido y:
                1. Haz una pregunta específica sobre lo que acabó de ver
                2. O pregunta si necesita aclaración de algún concepto particular
                3. Sé específico, no genérico
                4. Menciona el tema/concepto del momento actual`;
                break;
                
            case 'close':
                prompt = `RETROALIMENTACIÓN_CIERRE: El estudiante cerró el video "${context.videoTitle}" habiendo visto solo ${context.percentage.toFixed(1)}% del contenido (${Math.floor(context.currentTime / 60)} minutos).
                
                Analiza por qué pudo cerrar el video:
                1. ¿Algo específico lo confundió?
                2. Ofrece ayuda sobre el último tema visto
                3. Motívalo a continuar de manera específica`;
                break;
        }
        
        const response = await fetch(`${API_BASE_URL}/consulta.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                documentId: documentId,
                question: prompt,
                sessionToken: sessionToken,
                videoContext: {
                    action: action,
                    ...context,
                    needsIntelligentResponse: true
                }
            })
        });
        
const data = await response.json();
            if (data.answer) {
                setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
                
                // ✅ SOLO HABLAR SI EL VIDEO ESTÁ PAUSADO
                if (playerRef.current) {
                    playerRef.current.getPaused().then(isPaused => {
                        if (isPaused) {
                            // ✅ Video pausado → Hablar
                            speak(data.answer, () => {
                                resetTranscript();
                                startListening();
                            });
                        } else {
                            // ✅ Video reproduciéndose → NO hablar, solo mostrar texto
                            console.log('🔇 Video reproduciéndose, no se reproduce audio de respuesta');
                        }
                    }).catch(() => {
                        // Si hay error, asumir que está pausado
                        speak(data.answer, () => {
                            resetTranscript();
                            startListening();
                        });
                    });
                }
            }
        
    } catch (error) {
        console.error('Error en retroalimentación inteligente:', error);
        // Fallback a mensaje genérico
        speak("¿Tienes alguna duda sobre lo que acabamos de ver o quieres continuar?", () => {
            resetTranscript();
            startListening();
        });
    }
};

const saveProgress = async (timeInSeconds, forceCompleted = false) => {
    try {
        // ✅ CÁLCULO CORRECTO DE COMPLETADO
        const percentage = videoDuration > 0 ? (timeInSeconds / videoDuration) * 100 : 0;
        const isCompleted = forceCompleted || percentage >= 90;
        
        console.log('💾 Guardando progreso:', {
            timeInSeconds: timeInSeconds.toFixed(1),
            videoDuration: videoDuration.toFixed(1),
            percentage: percentage.toFixed(1),
            isCompleted: isCompleted,
            forceCompleted: forceCompleted
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
                completado: isCompleted ? 1 : 0 // ✅ MARCAR COMO COMPLETADO CORRECTAMENTE
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
};

const handleUserCommand = async (command) => {
    const lowerCommand = command.toLowerCase();
    setChatHistory(prev => [...prev, { role: 'user', text: command }]);

    // ✅ VERIFICAR SI EL REPRODUCTOR EXISTE ANTES DE USARLO
    if (!playerRef.current) {
        console.warn('⚠️ Reproductor no disponible');
        return;
    }

    // ✅ 1. DETECTAR COMANDOS EXPLÍCITOS DE CONTINUAR (alta confianza)
    const comandosExplicitosContinuar = [
        'continuar', 'continuemos', 'continúa', 'continua el video',
        'seguir', 'sigamos', 'sigue el video',
        'reproducir', 'reproduce', 'play',
        'reanudar', 'reanuda', 'reanudemos',
        'ver el video', 'poner el video'
    ];
    
    const esComandoExplicito = comandosExplicitosContinuar.some(palabra => 
        lowerCommand.includes(palabra)
    );
    
    if (esComandoExplicito) {
        // ✅ VERIFICAR QUE EL REPRODUCTOR EXISTA
        if (playerRef.current) {
            if (isSpeaking) {
                window.speechSynthesis.cancel();
            }
            
            try {
                await playerRef.current.play();
            } catch (error) {
                console.error('Error al reproducir:', error);
            }
        }
        return;
    }
    
    // ✅ 2. DETECTAR SI ES UNA PREGUNTA ESPECÍFICA (mantener conversación)
    const esPreguntaEspecifica = 
        lowerCommand.includes('qué') || 
        lowerCommand.includes('que') ||
        lowerCommand.includes('cómo') || 
        lowerCommand.includes('como') ||
        lowerCommand.includes('cuál') || 
        lowerCommand.includes('cual') ||
        lowerCommand.includes('por qué') || 
        lowerCommand.includes('explica') ||
        lowerCommand.includes('dije') ||
        lowerCommand.includes('dijiste') ||
        lowerCommand.includes('dijeron') ||
        lowerCommand.includes('hablaron') ||
        lowerCommand.includes('mencionaron') ||
        lowerCommand.includes('últimos') ||
        lowerCommand.includes('ultimos') ||
        lowerCommand.includes('primeros') ||
        lowerCommand.length > 30; // Preguntas largas = conversación
    
    if (esPreguntaEspecifica) {
        // ✅ Es una pregunta real, enviar al backend para respuesta contextual
        try {
            let tiempoActual = currentTime;
            if (playerRef.current) {
                try {
                    tiempoActual = await playerRef.current.getCurrentTime();
                } catch (e) {
                    console.warn('No se pudo obtener tiempo actual, usando estado');
                }
            }
            
            const response = await fetch(`${API_BASE_URL}/consulta.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    documentId: documentId,
                    question: command,
                    sessionToken: sessionToken,
                    videoContext: {
                        currentTime: tiempoActual,
                        videoDuration: videoDuration,
                        percentage: (tiempoActual / videoDuration) * 100,
                        videoTitle: videoData.titulo,
                        videoId: videoData.id
                    }
                })
            });
            
            const data = await response.json();
            if (data.answer) {
                setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
                speak(data.answer, () => {
                    resetTranscript();
                    startListening();
                });
            }
        } catch (error) {
            console.error('Error:', error);
        }
        return;
    }
    
    // ✅ 3. DETECTAR RESPUESTAS CORTAS AFIRMATIVAS (contexto: última respuesta del mentor)
    const respuestasAfirmativasCortas = [
        'sí', 'si', 'ok', 'okay', 'vale', 'dale', 'listo',
        'entiendo', 'entendido', 'claro', 'perfecto', 'bien'
    ];
    
    const esRespuestaAfirmativaCorta = 
        respuestasAfirmativasCortas.some(palabra => lowerCommand === palabra) ||
        (lowerCommand.length < 10 && respuestasAfirmativasCortas.some(palabra => lowerCommand.includes(palabra)));
    
    if (esRespuestaAfirmativaCorta) {
        // ✅ Analizar última respuesta del mentor para determinar contexto
        const ultimoMensajeMentor = chatHistory.filter(m => m.role === 'ai').pop();
        
        if (ultimoMensajeMentor) {
            const textoMentor = ultimoMensajeMentor.text.toLowerCase();
            
            // Si el mentor preguntó si quiere continuar/avanzar
if (textoMentor.includes('continuar') || 
                textoMentor.includes('seguir') ||
                textoMentor.includes('avanzar') ||
                textoMentor.includes('listo para') ||
                textoMentor.includes('¿tienes alguna pregunta') ||
                textoMentor.includes('¿hay algo')) {
                
                // ✅ DETENER AUDIO DEL MENTOR Y REPRODUCIR VIDEO
                if (isSpeaking) {
                    window.speechSynthesis.cancel();
                }
                
                if (playerRef.current) {
                    playerRef.current.play().catch(() => {});
                }
                return;
            }
            
            // Si el mentor dio una explicación pero no preguntó por continuar
            if (textoMentor.length > 50 && 
                !textoMentor.includes('continuar') && 
                !textoMentor.includes('¿')) {
                
                // ✅ Contexto: Mentor explicó algo → Usuario confirma comprensión
                // No hacer nada automático, dejar que el flujo natural siga
                return;
            }
        }
    }
    
    // ✅ 4. CASO POR DEFECTO: Enviar al backend para análisis contextual
    try {
        let tiempoActual = currentTime;
        if (playerRef.current) {
            try {
                tiempoActual = await playerRef.current.getCurrentTime();
            } catch (e) {
                console.warn('No se pudo obtener tiempo actual, usando estado');
            }
        }
        
        const response = await fetch(`${API_BASE_URL}/consulta.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                documentId: documentId,
                question: command,
                sessionToken: sessionToken,
                videoContext: {
                    currentTime: tiempoActual,
                    videoDuration: videoDuration,
                    percentage: (tiempoActual / videoDuration) * 100,
                    videoTitle: videoData.titulo,
                    videoId: videoData.id
                }
            })
        });
        
        const data = await response.json();
        if (data.answer) {
            setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
            speak(data.answer, () => {
                resetTranscript();
                startListening();
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
};

// ✅ NUEVA FUNCIÓN: Manejar preguntas específicas
const handleSpecificQuestion = async (question) => {
    try {
        const contextualPrompt = `El estudiante pausó un video educativo sobre "${videoData.titulo}" en el minuto ${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60)} y tiene esta pregunta o duda: "${question}"

Responde de manera clara y educativa como un tutor. Después de responder, pregunta si ya puede continuar con el video o si necesita más aclaraciones.`;

        const response = await fetch(`${API_BASE_URL}/consulta.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                documentId: documentId,
                question: contextualPrompt,
                sessionToken: sessionToken
            })
        });
        
        const data = await response.json();
        if (data.answer) {
            setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
            speak(data.answer, () => {
                resetTranscript();
                startListening();
            });
        }
    } catch (error) {
        console.error('Error manejando pregunta específica:', error);
        const errorMsg = "Lo siento, hubo un error. ¿Puedes repetir tu pregunta?";
        setChatHistory(prev => [...prev, { role: 'ai', text: errorMsg }]);
        speak(errorMsg, () => {
            resetTranscript();
            startListening();
        });
    }
};

    const handleTextSubmit = (e) => {
        e.preventDefault();
        if (chatMessage.trim()) {
            handleUserCommand(chatMessage);
            setChatMessage('');
        }
    };
    
const handleClose = () => {
    console.log('❌ Usuario cerró el video en:', currentTime.toFixed(1), 'segundos');

    if (isPlayerReady && playerRef.current) {
        playerRef.current.getCurrentTime().then(time => {
            if (!allowSeekRef.current) saveProgress(time); // No guardar en modo repaso
            
            // ✅ COMPORTAMIENTO EMPÁTICO AL CERRAR
            const percentage = videoDuration > 0 ? (time / videoDuration) * 100 : 0;
            
            if (percentage < 85) {
                // Programar mensaje después de cerrar
                setTimeout(() => {
                    const message = `Has cerrado la lección habiendo visto ${percentage.toFixed(0)}% del contenido. ¿Te gustaría continuar desde donde quedaste, tienes alguna duda, o prefieres retomar el estudio más tarde?`;
                    
                    // Como ya se cerró el video, usar el sistema de consulta principal
                    // Este mensaje aparecerá en la pantalla principal
                    console.log('💬 Mensaje para pantalla principal:', message);
                    
                }, 1000);
            }
            
        }).catch(() => {});
    }
    
    onClose(currentTime, videoDuration);
}
    
    const percentage = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
    
    if (!isOpen) return null;

// --- RENDER (AJUSTADO) ---
    return (
        <div className="video-mentor-popup-overlay">
            <div className="video-mentor-popup">
                <div className="video-panel">
                    <div className="video-header">
                        <div className="video-title-container">
<span className="video-module">
  {videoData?.modulo_numero && videoData?.leccion_numero 
    ? `Módulo ${videoData.modulo_numero} - Lección ${videoData.leccion_numero}`
    : videoData?.titulo_completo 
      ? videoData.titulo_completo
      : 'Lección de Video'
  }
</span>
                            <h3 className="video-title">{videoData?.titulo}</h3>
                        </div>
                       
{/* Tu botón de cerrar está perfecto aquí, no lo movemos */}
<button 
  className="close-button" 
  onClick={handleClose}
  style={{
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    color: 'white',
    border: 'none',
    padding: '8px 16px', /* ✅ Aumentamos el padding para más espacio */
    borderRadius: '8px', /* ✅ Un poco más de radio para suavizar */
    fontSize: '0.9rem', /* ✅ Ligeramente más grande */
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center', /* ✅ Centramos el contenido */
    gap: '6px', /* ✅ Aumentamos un poco el espacio entre el icono y el texto */
    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
    transition: 'all 0.3s ease',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minWidth: '100px', /* ✅ ESTO ES CLAVE: Asegura un ancho mínimo para que el texto no se comprima */
    height: '40px' /* ✅ ESTO ES CLAVE: Asegura una altura fija para consistencia */
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
    e.currentTarget.style.transform = 'scale(1.05)';
    e.currentTarget.style.boxShadow = '0 3px 8px rgba(220, 38, 38, 0.4)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
  }}
>
  <span style={{ fontSize: '1.3rem', fontWeight: '700', lineHeight: '1' }}>×</span> {/* ✅ Ligeramente más grande */}
  <span style={{ fontSize: '0.9rem', letterSpacing: '0.3px' }}>Cerrar</span> {/* ✅ Ligeramente más grande */}
</button>
                    </div>
                    
                    {/* ✅ AÑADIDO: Eventos para mostrar/ocultar controles */}
                    <div 
                        className="video-container"
                      //  onMouseMove={showThenHideControls}
                      //  onMouseLeave={() => setShowControls(false)}
                    >
                        <iframe
                            id="vimeo-player"
                            // ✅ controls=1 en modo repaso para permitir adelantar, controls=0 en modo normal
                            src={`https://player.vimeo.com/video/${videoData?.vimeo_id}?h=${videoData?.hash_privacidad}&autoplay=0&autopause=0&controls=${allowSeek ? 1 : 0}&muted=0&dnt=1&playsinline=1&transparent=0&responsive=1&keyboard=0&portrait=0&title=0&byline=0`}
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                        />

                        {/* ✅ AÑADIDO: Barra de controles minimalista superpuesta */}
                      <div className="video-custom-controls visible">
                            <button className="control-button-overlay" onClick={handleRestart} title="Reiniciar Video">
                                <RestartIcon />
                            </button>
                            <button className="control-button-overlay" onClick={handleRewind10} title="Retroceder 10s">
                                <Replay10Icon />
                            </button>
                            <button className="control-button-overlay play-pause" onClick={togglePlayPause} title={videoStatus === 'playing' ? 'Pausar' : 'Reproducir'}>
                                {videoStatus === 'playing' ? <PauseIcon/> : <PlayIcon/>}
                            </button>
                            {/* Espacio flexible para alinear botones */}
                            <div style={{ flex: 1 }}></div> 
                        </div>

                        {showStartOverlay && (
    <div className="ios-start-overlay" onClick={handleManualStart}>
        <button className="ios-start-button">
            <PlayIcon /> {/* O un icono de volumen */}
            <span>Activar Sonido y Clase</span>
        </button>
    </div>
)}
                        
                        {/* ❌ ELIMINADO: El 'seek-blocker-curtain' ya no es necesario con controls=0 */}
                        
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

                        {/* --- ❌ ELIMINADO: Botón de Play/Pausa del panel lateral --- */}
                        
                        {/* Este es el único item que queda, centrado por el CSS */}
                        <div className={`status-item ${isListening ? 'listening' : isSpeaking ? 'speaking' : ''}`}>
                            <div className="status-icon">{isSpeaking ? <AiIcon/> : <MicIcon/>}</div>
                            <div className="status-text">
                                <span>Estado del Mentor</span>
                                <strong>{isListening ? 'Escuchando...' : isSpeaking ? 'Hablando...' : 'En espera'}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="chat-container">
                        <div className="chat-history">
                            {chatHistory.length === 0 && (
                                <div className="chat-placeholder">
                                    <AiIcon/>
                                    <p>El historial de tu conversación con el mentor sobre este video aparecerá aquí.</p>
                                    <p><strong>Pausa el video</strong> para hacer una pregunta por voz.</p>
                                </div>
                            )}
                            {chatHistory.map((msg, index) => (
                                <div key={index} className={`chat-message ${msg.role}`}>
                                    <div className="chat-bubble">{msg.text}</div>
                                </div>
                            ))}
                            <div ref={chatEndRef}></div>
                        </div>
                        <form className="chat-input-form" onSubmit={handleTextSubmit}>
                            <input
                                type="text"
                                placeholder="Escribe aquí si lo prefieres..."
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                disabled={isSpeaking || isListening}
                            />
                            <button type="submit" disabled={!chatMessage.trim()}>Enviar</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoMentorPopup;