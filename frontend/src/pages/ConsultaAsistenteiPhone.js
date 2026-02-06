// src/pages/ConsultaAsistenteiPhone.js
// FASE FINAL: Consolidación Total
// ✅ Fix Audio iOS (Unlock & Buffer)
// ✅ Lógica Evaluación Blindada (Candado + Start/Finish)
// ✅ Formato de Texto (Markdown HTML)
// ✅ Mensajes de Carga Personalizados
// ✅ Botón Stop y Ondas Flotantes

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { consultaService, retoService } from '../services/api';
import { whisperService } from '../services/whisperService';
import SilenceDetector from '../services/silenceDetector';
import VideoMentorPopupiPhone from '../components/VideoMentorPopupiPhone';
import MobileSidebarDrawer from '../components/MobileSidebarDrawer';
import RealtimePanel from '../components/RealtimePanel';
import { isRealtimeSupported } from '../services/realtimeService';
import MentorProgressPanel from '../components/MentorProgressPanel';
import EvaluationProgress from '../components/EvaluationProgress';
import QuickQuestions from '../components/QuickQuestions';
import './ConsultaAsistenteiPhone.css';

// 1. PROCESADOR DE TEXTO (MARKDOWN)
const procesarMarkdown = (texto) => {
  if (!texto) return '';
  let html = texto;
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Negritas
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Itálicas
  html = html.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>'); // Títulos
  html = html.replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>'); // Listas
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>'); // Envolver listas
  html = html.replace(/\n/g, '<br />'); // Saltos de línea
  return html;
};

// 2. TOKEN GENERATOR
function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 3. AVATAR COMPONENT
const MentorIAAvatar = ({ isSpeaking }) => (
  <svg width="45" height="45" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#22D3EE', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#0891B2', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    {isSpeaking && (
      <circle cx="50" cy="50" r="45" fill="none" stroke="#0891B2" strokeWidth="2" style={{ opacity: 0.5, animation: 'pulseRingAvatar 2s ease-out infinite' }} />
    )}
    <circle cx="50" cy="50" r="40" fill="url(#avatarGradient)" />
    <g stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" fill="none" strokeLinecap="round">
      <path d="M35 50 Q 50 35, 65 50" />
      <path d="M38 60 Q 50 70, 62 60" />
      <path d="M45 42 Q 50 48, 55 42" />
      <circle cx="35" cy="50" r="3" fill="white" />
      <circle cx="65" cy="50" r="3" fill="white" />
    </g>
  </svg>
);

// ================= COMPONENTE PRINCIPAL =================
const ConsultaAsistenteiPhone = () => {
  const { documentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // --- ESTADOS ---
  const [isListening, setIsListening] = useState(false);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [firstInteraction, setFirstInteraction] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [useRealtimeMode, setUseRealtimeMode] = useState(false);

  // Estados para modo Reto
  const [retoState, setRetoState] = useState({
    tieneRetoPendiente: false,
    reto: null,
    proximoReto: null,
    mensaje: '',
    cargando: true,
    respondiendo: false,
    retroalimentacion: null
  });
  
  const [messages, setMessages] = useState([]);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [transcript, setTranscript] = useState('');
const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const messagesHistoryRef = useRef([]);
    // 🧠 Sistema de 3 preguntas de retroalimentación (igual que en desktop)
  const [retroalimentacionActiva, setRetroalimentacionActiva] = useState(false);
  const [numeroPregunta, setNumeroPregunta] = useState(null);
  const [videoIdRetro, setVideoIdRetro] = useState(null);

  
  const [showWaves, setShowWaves] = useState(false);
  const [waveIntensities, setWaveIntensities] = useState([15, 25, 40, 30, 20, 35, 18]);
  const [manualInput, setManualInput] = useState('');
  const messagesEndRef = useRef(null);


  
  
  const [sessionToken, setSessionToken] = useState(() => {
    const stored = localStorage.getItem('sessionToken');
    if (stored) return stored;
    const newToken = generateSessionToken();
    localStorage.setItem('sessionToken', newToken);
    return newToken;
  });
  
  // Estados Modos y Popup
  const [currentMode, setCurrentMode] = useState('consulta');
  const [evaluationState, setEvaluationState] = useState({ isActive: false });
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [allowSeek, setAllowSeek] = useState(false); // Modo repaso: permite adelantar/retroceder
  const allowSeekRef = useRef(allowSeek); // Ref para evitar closure stale en callbacks

  // Audio Refs
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(new Audio());
  const recognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const listeningLockRef = useRef(false);
  const silenceDetectorRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  
  const cancelTranscriptionRef = useRef(false);

  // Ref para siempre acceder a la función más reciente de sendQuestionToBackend
  const sendQuestionToBackendRef = useRef(null);

  // Refs para mantener valores actualizados en callbacks asíncronos
  const currentModeRef = useRef(currentMode);
  const retoStateRef = useRef(retoState);

  // Actualizar refs sincrónicamente en cada render
  currentModeRef.current = currentMode;
  retoStateRef.current = retoState;

  // --- FUNCIONES DE LIMPIEZA Y NAVEGACIÓN ---
const handleGoBack = useCallback(() => {
  // 1. Detener audio en reproducción
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  // 2. Detener cualquier grabación de micrófono
  if (recognitionRef.current && recognitionRef.current.state === 'recording') {
    recognitionRef.current.stop();
  }
  if (mediaStreamRef.current) {
    mediaStreamRef.current.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  }
  if (silenceDetectorRef.current) {
    try {
      silenceDetectorRef.current.stop?.();
      silenceDetectorRef.current.cleanup?.();
    } catch (e) {}
    silenceDetectorRef.current = null;
  }
  if (audioLevelIntervalRef.current) {
    clearInterval(audioLevelIntervalRef.current);
    audioLevelIntervalRef.current = null;
  }

  // 3. Reset UI de audio
  setIsListening(false);
  setAudioLevel(0);
  setIsSpeaking(false);
  setIsGeneratingVoice(false);

  // 4. Limpiar token y banderas de sesión
  localStorage.removeItem('sessionToken');
  sessionStorage.removeItem('awaitingValidation');
  sessionStorage.removeItem('awaitingConfirmation');
  sessionStorage.removeItem('retroalimentacionActiva');
  sessionStorage.removeItem('numeroPregunta');
  sessionStorage.removeItem('videoIdRetro');
  sessionStorage.removeItem('pendingVideoData');

  // 5. Reset de modo/evaluación
  setEvaluationState({ isActive: false });
  setCurrentMode('consulta');

  // 6. Volver a la lista de documentos
  navigate('/documentos');
}, [navigate]);


  // --- AUDIO UNLOCK (iOS) ---
  const enableAudioContext = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQAAAAA=';
      audioRef.current.play().catch(() => {});
    }
  }, []);

  // --- FUNCIONES DE EVALUACIÓN (CRÍTICAS PARA QUE NO FALLE) ---
  const startEvaluation = useCallback((totalQuestions = 10) => {
    setEvaluationState({ 
      isActive: true, 
      currentQuestion: 1, 
      totalQuestions: totalQuestions, 
      startTime: Date.now() 
    });
  }, []);

  const finishEvaluation = useCallback(() => {
    setEvaluationState(prev => ({ ...prev, isActive: false }));
  }, []);

  // --- LÓGICA DE MODOS ---
  const getModeInfo = useCallback((mode) => {
    switch(mode) {
      case 'mentor': return { label: 'Mentor', color: '#10B981', emoji: '👨‍🏫' };
      case 'evaluacion': return { label: 'Evaluación', color: '#F59E0B', emoji: '📝' };
      case 'reto': return { label: 'Reto', color: '#8B5CF6', emoji: '🎯' };
      default: return { label: 'Consulta', color: '#22D3EE', emoji: '💬' };
    }
  }, []);

  // ============= FUNCIONES PARA MODO RETO =============
  const verificarRetoPendiente = useCallback(async () => {
    if (!documentId || !user?.id) return;

    try {
      setRetoState(prev => ({ ...prev, cargando: true }));
      const response = await retoService.verificarRetoPendiente(documentId, user.id);

      setRetoState({
        tieneRetoPendiente: response.data.tiene_reto_pendiente || false,
        reto: response.data.reto || null,
        proximoReto: response.data.proximo_reto || null,
        mensaje: response.data.mensaje || '',
        cargando: false,
        respondiendo: false,
        retroalimentacion: null,
        retoCompletado: response.data.reto_completado || false
      });

      console.log('🎯 Estado del reto (iPhone):', response.data);
    } catch (error) {
      console.error('Error verificando reto:', error);
      setRetoState(prev => ({ ...prev, cargando: false }));
    }
  }, [documentId, user]);

  // Ref para almacenar datos del reto completado (para usar en useEffect posterior)
  const retoCompletadoRef = useRef(null);

  const handleResponderReto = useCallback(async (respuesta) => {
    // Usar ref para obtener el estado más actualizado
    const estadoReto = retoStateRef.current;

    if (!estadoReto.reto?.id || !user?.id) return;

    try {
      setRetoState(prev => ({ ...prev, respondiendo: true }));

      const response = await retoService.responderReto(
        estadoReto.reto.id,
        user.id,
        respuesta
      );

      if (response.data.success) {
        const retroMensaje = {
          text: response.data.retroalimentacion,
          isUser: false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, retroMensaje]);

        // Guardar datos para el useEffect que manejará speak
        retoCompletadoRef.current = {
          textoCompleto: `${response.data.retroalimentacion} ${response.data.mensaje_despedida}`,
          pregunta: estadoReto.reto.pregunta,
          respuesta: respuesta,
          retroalimentacion: response.data.retroalimentacion,
          puntuacion: response.data.puntuacion
        };

        setRetoState(prev => ({
          ...prev,
          tieneRetoPendiente: false,
          respondiendo: false,
          retroalimentacion: response.data
        }));

        setMessages(prev => [...prev, {
          text: response.data.mensaje_despedida,
          isUser: false,
          timestamp: new Date()
        }]);

        // Enviar contexto al backend
        try {
          const contextoReto = `[CONTEXTO DEL RETO SEMANAL COMPLETADO]
Pregunta del reto: ${estadoReto.reto.pregunta}
Respuesta del usuario: ${respuesta}
Retroalimentación: ${response.data.retroalimentacion}
Puntuación: ${response.data.puntuacion}
[FIN DEL CONTEXTO DEL RETO]`;

          await consultaService.sendQuestion({
            documentId: documentId,
            userId: user.id,
            question: contextoReto,
            sessionToken: sessionToken,
            es_contexto_reto: true
          });
          console.log('✅ Contexto del reto enviado al backend');
        } catch (contextError) {
          console.warn('⚠️ No se pudo enviar contexto:', contextError);
        }

      } else {
        throw new Error(response.data.error || 'Error al procesar respuesta');
      }
    } catch (error) {
      console.error('Error al responder reto:', error);
      setRetoState(prev => ({ ...prev, respondiendo: false }));
      setMessages(prev => [...prev, {
        text: 'Lo siento, hubo un error al procesar tu respuesta.',
        isUser: false,
        timestamp: new Date()
      }]);
    }
  }, [retoState.reto, user, documentId, sessionToken]);

// ============= DETECTAR CAMBIO DE MODO (VERSIÓN BLINDADA) =============
  const detectModeChange = useCallback((response) => {
    if (!response) return currentMode;
    const res = response.toLowerCase();
    
    // 🔒 1. LÓGICA DE "CANDADO": Si ya estamos en evaluación, NO salir.
    if (evaluationState.isActive) {
      // Solo salimos si el backend dice explícitamente que terminó
      if (res.includes('salido del modo') || 
          (res.includes('evaluación') && res.includes('completada')) ||
          (res.includes('resumen') && res.includes('resultado'))) {
            
        console.log('🔵 Fin de evaluación detectado -> Cambiando a CONSULTA');
        setCurrentMode('consulta');
        finishEvaluation(); 
        return 'consulta';
      }
      
      console.log('🔒 Candado activo: Manteniendo modo EVALUACIÓN');
      return 'evaluacion';
    }
    
    // 🔑 2. DETECCIÓN DE ACTIVACIÓN (LLAVE DE ENTRADA)
    // Aceptamos "activado", "iniciando", "comencemos"
    if ((res.includes('modo evaluación') && (res.includes('activado') || res.includes('he activado'))) ||
        (res.includes('iniciando') && res.includes('evaluación')) ||
        (res.includes('pregunta') && res.includes('1'))) {
      
      console.log('🟡 Inicio de evaluación detectado');
      setCurrentMode('evaluacion');
      
      let totalQuestions = 10;
      const numberMatch = res.match(/(\d+)\s+preguntas?/i);
      if (numberMatch) totalQuestions = parseInt(numberMatch[1], 10);
      
      startEvaluation(totalQuestions); // 🔒 PONE EL CANDADO
      return 'evaluacion';
    }
    
    // 3. OTROS MODOS
    if (res.includes('modo mentor') && (res.includes('activado') || res.includes('continuemos'))) {
      setCurrentMode('mentor');
      return 'mentor';
    }
    
    if (res.includes('modo consulta') || res.includes('salido del modo')) {
      setCurrentMode('consulta');
      return 'consulta';
    }
    
    return currentMode;
  }, [currentMode, startEvaluation, finishEvaluation, evaluationState]);




  // --- AUDIO CONTROL (GRABACIÓN Y REPRODUCCIÓN) ---
  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current?.state === 'recording') recognitionRef.current.stop();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (silenceDetectorRef.current) silenceDetectorRef.current.cleanup();
    if (audioLevelIntervalRef.current) clearInterval(audioLevelIntervalRef.current);
    audioChunksRef.current = [];
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
      setIsGeneratingVoice(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    cleanupRecognition();
    setIsListening(false);
    setAudioLevel(0);
    listeningLockRef.current = false;
  }, [cleanupRecognition]);

  const speak = useCallback(async (text, onEndCallback = null) => {
    if (!text?.trim()) return;
    stopListening();
    try {
      setIsGeneratingVoice(true);
      const audio = audioRef.current;
      const { voiceService } = await import('../services/api');
      const response = await voiceService.speak(text, { service: 'polly', voice_id: 'Lupe', sessionToken });
      
      if (!response.data?.url) throw new Error('No URL');
      setIsGeneratingVoice(false);
      setIsSpeaking(true);
      audio.src = response.data.url;
      
      audio.onended = () => {
        setIsSpeaking(false);
        if (onEndCallback) setTimeout(onEndCallback, 800);
      };
      audio.onerror = () => { setIsSpeaking(false); setIsGeneratingVoice(false); };
      await audio.play();
    } catch (e) {
      setIsSpeaking(false);
      setIsGeneratingVoice(false);
    }
  }, [sessionToken, stopListening]);

  const initializeRecording = useCallback(() => {
    if (isSpeaking) return;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    .then(async (stream) => {
      mediaStreamRef.current = stream;
      const detector = new SilenceDetector({ silenceThreshold: 0.02, silenceDuration: 1500 });
      await detector.initialize(stream);
      silenceDetectorRef.current = detector;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstart = () => {
        setIsListening(true);
        listeningLockRef.current = false;
        detector.start({
          onSilenceDetected: () => { if (mediaRecorder.state === 'recording') mediaRecorder.stop(); },
          onSoundDetected: (l) => setAudioLevel(l)
        });
        audioLevelIntervalRef.current = setInterval(() => setAudioLevel(detector.getCurrentLevel()), 100);
      };
  mediaRecorder.onstop = async () => {
  setIsListening(false);
  setAudioLevel(0);

  if (silenceDetectorRef.current) silenceDetectorRef.current.stop();
  clearInterval(audioLevelIntervalRef.current);
  stream.getTracks().forEach(t => t.stop());
  mediaStreamRef.current = null;

  // 👇 Revisamos si esta grabación fue cancelada por el usuario
  const wasCancelled = cancelTranscriptionRef.current;
  cancelTranscriptionRef.current = false;

  const blob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
  if (blob.size < 100 || wasCancelled) {
    // Si fue cancelada o casi no hay audio, no mandamos nada a Whisper
    return;
  }

  setIsWaitingForResponse(true);
  try {
    const text = await whisperService.transcribe(blob, user?.id);
// ============================================================
    // 🛡️ FIX: FILTRO ANTI-AMARA.ORG (ALUCINACIONES WHISPER)
    // ============================================================
    if (text) {
        const lowerText = text.toLowerCase();
        // Si Whisper alucina con créditos de subtítulos o silencios extraños
        if (
            lowerText.includes('amara.org') || 
            lowerText.includes('subtítulos realizados') ||
            lowerText.includes('subtitulos realizados') ||
            lowerText.includes('alejo 20') // Otra alucinación común
        ) {
            console.log('👻 Alucinación de Whisper detectada y bloqueada:', text);
            setIsWaitingForResponse(false);
            return; // ⛔️ DETENEMOS AQUÍ, NO ENVIAMOS AL CHAT
        }
    }
    // ============================================================

    if (!text || text.trim().length < 2) {
      setIsWaitingForResponse(false);
      return;
    }
    setMessages(prev => [...prev, { text, isUser: true, timestamp: new Date() }]);
    if (sendQuestionToBackendRef.current) {
      sendQuestionToBackendRef.current(text);
    }
  } catch (e) {
    setIsWaitingForResponse(false);
  }
};

      recognitionRef.current = mediaRecorder;
      mediaRecorder.start();
    }).catch(e => { setIsListening(false); });
  }, [isSpeaking, user]);

  const startListening = useCallback(() => {
    if (isSpeaking) return;
    cleanupRecognition();
    initializeRecording();
  }, [isSpeaking, cleanupRecognition, initializeRecording]);


// 👉 Click en el botón del micrófono (toggle)
const handleMicButtonClick = useCallback(() => {
  enableAudioContext();

  if (isListening) {
    // El usuario quiere cancelar esta grabación: no la mandamos a Whisper
    cancelTranscriptionRef.current = true;
    stopListening();
  } else {
    // Empezar a escuchar normalmente
    startListening();
  }
}, [enableAudioContext, isListening, startListening, stopListening]);

  // Sincronizar allowSeekRef con allowSeek state
  useEffect(() => {
    allowSeekRef.current = allowSeek;
  }, [allowSeek]);

  // ============= useEffect PARA MANEJAR AUDIO DEL RETO COMPLETADO =============
  useEffect(() => {
    if (retoState.retroalimentacion && retoCompletadoRef.current) {
      const datos = retoCompletadoRef.current;
      retoCompletadoRef.current = null; // Limpiar para evitar repeticiones

      speak(datos.textoCompleto, () => {
        setCurrentMode('consulta');
        setTimeout(() => {
          startListening();
        }, 300);
      });
    }
  }, [retoState.retroalimentacion, speak, startListening]);

  // --- COMUNICACIÓN BACKEND (CON LOGICA DE MENTOR RESTAURADA) ---
// --- COMUNICACIÓN BACKEND (video + evaluación bien diferenciados) ---
const sendQuestionToBackend = async (text) => {
  if (!user?.id) return;
  if (!text || !text.trim()) return;

  // Usar refs para obtener valores más actualizados (evitar closures desactualizados)
  const modoActual = currentModeRef.current;
  const estadoReto = retoStateRef.current;

  // ============= PROCESAR RESPUESTA EN MODO RETO =============
  if (modoActual === 'reto' && estadoReto.tieneRetoPendiente && estadoReto.reto) {
    console.log('🎯 Procesando respuesta del reto (iPhone)...');
    setIsWaitingForResponse(true);
    await handleResponderReto(text);
    setIsWaitingForResponse(false);
    return;
  }

  // 1️⃣ BYPASS PARA CONFIRMACIÓN DE VIDEO
  const isConfirmation = /^(s[ií]|si|listo|continuar|continuemos|sigamos|sigue|adelante|ok|perfecto|estoy listo|avanzar)/i
    .test(text.trim());
  const awaitingConf = sessionStorage.getItem('awaitingConfirmation') === 'true';
  const pendingVideo = sessionStorage.getItem('pendingVideoData');

  if (isConfirmation && awaitingConf && pendingVideo) {
    try {
      const videoData = JSON.parse(pendingVideo);

      // limpiamos flags de confirmación de video
      sessionStorage.setItem('awaitingConfirmation', 'false');
      sessionStorage.removeItem('pendingVideoData');

      const assistantMsg = '¡Perfecto! Vamos a ver el video juntos. 🎬';

      setMessages(prev => [
        ...prev,
        { text: assistantMsg, isUser: false, timestamp: new Date() },
      ]);

      speak(assistantMsg, () => {
        setCurrentVideoData(videoData);
        setAllowSeek(false); // Video normal: con restricciones de seek
        setShowVideoPopup(true);
      });

      // ⚡ importante: NO llamamos al backend en este flujo
      return;
    } catch (e) {
      // si falla el parse, seguimos flujo normal hacia el backend
      console.error('Error parseando pendingVideoData:', e);
    }
  }

  // 2️⃣ LLAMADA NORMAL AL BACKEND (CON FLAGS DE RETRO)
  setIsWaitingForResponse(true);

  try {
    // Historial de mensajes que mandamos al backend
    const history = messagesHistoryRef.current.map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.text,
    }));

    // Flags actuales desde sessionStorage
    const currentAwaitingValidation =
      sessionStorage.getItem('awaitingValidation') === 'true';
    const currentAwaitingConfirmation =
      sessionStorage.getItem('awaitingConfirmation') === 'true';
    const currentRetroalimentacionActiva =
      sessionStorage.getItem('retroalimentacionActiva') === 'true';
    const currentNumeroPregunta = sessionStorage.getItem('numeroPregunta');
    const currentVideoIdRetro = sessionStorage.getItem('videoIdRetro');

    // Payload que espera el backend de Mentoría
    const res = await consultaService.sendQuestion({
      documentId,
      userId: user.id,
      question: text,
      sessionToken,

      awaiting_validation: currentAwaitingValidation,
      awaiting_confirmation: currentAwaitingConfirmation,

      // 🧠 Sistema de 3 preguntas de retroalimentación
      retroalimentacion_activa: currentRetroalimentacionActiva,
      numero_pregunta: currentNumeroPregunta,
      video_id: currentVideoIdRetro,

      chatHistory: history,
    });

    if (res.data.sessionToken) {
      setSessionToken(res.data.sessionToken);
    }

    setIsWaitingForResponse(false);

    const action = res.data.action || null;
    const hasVideoData = !!res.data.video_data;

    // 2.a️⃣ MENSAJE "HE GENERADO X PREGUNTAS, ¿ESTÁS LISTO?" (VIDEO O EVALUACIÓN)
    if (action === 'awaiting_user_confirmation') {
      // Aplica para:
      // - Confirmación de video (cuando NO abrimos todavía el popup)
      // - Confirmación de evaluación (después de generar preguntas)
      sessionStorage.setItem('awaitingConfirmation', 'true');
      sessionStorage.setItem('awaitingValidation', 'false');

      if (res.data.video_data) {
        // Caso de video: dejamos preparado el popup
        sessionStorage.setItem(
          'pendingVideoData',
          JSON.stringify(res.data.video_data)
        );
      }

      const answer = res.data.answer || '';

      setMessages(prev => [
        ...prev,
        { text: answer, isUser: false, timestamp: new Date() },
      ]);

      // Detectar cambio de modo a partir de este mensaje
      const newMode = detectModeChange(answer);

      // Siempre queremos escuchar tu "sí, estoy listo"
      speak(answer, () => {
        startListening();
      });

      return; // salimos, no seguimos procesando abajo
    }

    // 2.b️⃣ ACCIONES DIRECTAS DE VIDEO (abrir inmediatamente)
    if (hasVideoData && ['open_video', 'video_ready'].includes(action)) {
      // Nos aseguramos de limpiar flags de confirmación
      sessionStorage.setItem('awaitingConfirmation', 'false');
      sessionStorage.setItem('awaitingValidation', 'false');

      const answer = res.data.answer || '';

      setMessages(prev => [
        ...prev,
        { text: answer, isUser: false, timestamp: new Date() },
      ]);

      speak(answer, () => {
        setCurrentVideoData(res.data.video_data);
        setAllowSeek(false); // Video normal: con restricciones de seek
        setShowVideoPopup(true);
      });

      return;
    }

    // 2.c️⃣ PROGRAMA COMPLETADO (modo mentor)
    if (action === 'program_completed') {
      sessionStorage.setItem('awaitingConfirmation', 'false');
      sessionStorage.setItem('awaitingValidation', 'false');
      setCurrentMode('consulta');
    }

    // 2.d️⃣ RESPUESTA NORMAL (consulta / evaluación / mentor)
    // Actualizamos flags según la respuesta del backend
    const nextAwaitingValidation = !!res.data.awaiting_validation;
    const nextAwaitingConfirmation = !!res.data.awaiting_confirmation;

    sessionStorage.setItem(
      'awaitingValidation',
      nextAwaitingValidation ? 'true' : 'false'
    );
    sessionStorage.setItem(
      'awaitingConfirmation',
      nextAwaitingConfirmation ? 'true' : 'false'
    );

    // 🧠 Actualizar flags del sistema de 3 preguntas de retroalimentación
    if (res.data.retroalimentacion_activa) {
      console.log('🎯 Sistema de retroalimentación activado (iPhone)');
      console.log('   - Pregunta:', res.data.numero_pregunta);
      console.log('   - Video ID:', res.data.video_id);

      setRetroalimentacionActiva(true);
      setNumeroPregunta(res.data.numero_pregunta);
      setVideoIdRetro(res.data.video_id);

      sessionStorage.setItem('retroalimentacionActiva', 'true');
      sessionStorage.setItem('numeroPregunta', res.data.numero_pregunta?.toString() || '');
      sessionStorage.setItem('videoIdRetro', res.data.video_id?.toString() || '');
    } else {
      // ✅ Limpiar estados cuando termina la retroalimentación
      setRetroalimentacionActiva(false);
      setNumeroPregunta(null);
      setVideoIdRetro(null);

      sessionStorage.removeItem('retroalimentacionActiva');
      sessionStorage.removeItem('numeroPregunta');
      sessionStorage.removeItem('videoIdRetro');
    }

    const answer = res.data.answer || 'No pude procesar la respuesta.';

    setMessages(prev => [
      ...prev,
      { text: answer, isUser: false, timestamp: new Date() },
    ]);

    const newMode = detectModeChange(answer);

    // En consulta/mentor seguimos escuchando de una vez.
    // En evaluación, el backend controla el flujo de preguntas
    speak(answer, () => {
      if (newMode === 'consulta' || newMode === 'mentor') {
        startListening();
      }
      // En evaluación el flujo de "Pregunta 1, Pregunta 2..." lo lleva el backend
    });
  } catch (e) {
    console.error('❌ Error en sendQuestionToBackend (iPhone):', e);
    setIsWaitingForResponse(false);
    setMessages(prev => [
      ...prev,
      {
        text: 'Error de conexión.',
        isError: true,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
  }
};

// Actualizar ref para que siempre tenga la versión más reciente
sendQuestionToBackendRef.current = sendQuestionToBackend;

// Handler para click en lección del sidebar (modo repaso)
const handleLessonClick = useCallback(async (lessonData) => {
    console.log('📚 Lección clickeada (iPhone):', lessonData);

    // Si es lección completada, abrir en modo repaso (allowSeek = true)
    const isReplayMode = lessonData.isCompleted;

    try {
        const response = await consultaService.getVideoForLesson(
            documentId,
            lessonData.moduleNumber,
            lessonData.lessonNumber
        );

        if (response.data && response.data.video) {
            const videoData = response.data.video;

            setCurrentVideoData({
                ...videoData,
                modulo_numero: lessonData.moduleNumber,
                leccion_numero: lessonData.lessonNumber,
                titulo_completo: `${lessonData.moduleTitle} - ${lessonData.lessonTitle}`
            });
            setAllowSeek(isReplayMode);
            setShowVideoPopup(true);

            console.log(isReplayMode
                ? '🔄 Abriendo video en MODO REPASO (sin restricciones)'
                : '▶️ Abriendo video en modo normal (con restricciones)'
            );
        } else {
            console.warn('⚠️ No se encontró video para esta lección');
        }
    } catch (error) {
        console.error('❌ Error obteniendo video de lección:', error);
    }
}, [documentId]);

// ✅ Al completar el video en iPhone: cerrar popup + pedir retro al backend
const handleVideoComplete = useCallback(async () => {
  console.log('🎬 handleVideoComplete (iPhone) ejecutado');

  // 1️⃣ Detener audio y escucha
  try {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  } catch (e) {}
  setIsSpeaking(false);

  if (isListening) {
    stopListening();
    setIsListening(false);
  }
  cleanupRecognition();

  // 2️⃣ Cerrar popup y limpiar video actual
  setShowVideoPopup(false);
  setCurrentVideoData(null);

  // 3️⃣ Pequeña espera para que el popup desaparezca visualmente
  await new Promise(resolve => setTimeout(resolve, 500));

  if (!user?.id) return;

  try {
    console.log("📤 Enviando 'accion_video_completado' al backend (iPhone)");

    const history = messagesHistoryRef.current.map(m => ({
      role: m.isUser ? 'user' : 'assistant',
      content: m.text,
    }));

    const currentAwaitingValidation = sessionStorage.getItem('awaitingValidation') === 'true';

    const res = await consultaService.sendQuestion({
      documentId,
      userId: user.id,
      question: 'accion_video_completado',
      sessionToken,
      awaiting_validation: currentAwaitingValidation,
      chatHistory: history,
    });

    if (res.data.sessionToken) setSessionToken(res.data.sessionToken);

    // 🧠 Activar sistema de retro si viene en la respuesta
    if (res.data.retroalimentacion_activa) {
      console.log('🎯 Retro después de video (iPhone):', res.data.numero_pregunta, res.data.video_id);
      setRetroalimentacionActiva(true);
      setNumeroPregunta(res.data.numero_pregunta);
      setVideoIdRetro(res.data.video_id);

      sessionStorage.setItem('retroalimentacionActiva', 'true');
      sessionStorage.setItem('numeroPregunta', res.data.numero_pregunta.toString());
      sessionStorage.setItem('videoIdRetro', res.data.video_id.toString());

      // En este flujo no usamos awaiting_* → los dejamos en false
      sessionStorage.setItem('awaitingValidation', 'false');
      sessionStorage.setItem('awaitingConfirmation', 'false');
    }

    const textRespuesta = res.data.response || res.data.answer || 'Hemos terminado el video.';

    const assistantMessage = {
      text: textRespuesta,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsWaitingForResponse(false);

    // Que lo lea en voz y vuelva a escuchar (como en desktop)
    if (assistantMessage.text && assistantMessage.text.trim()) {
      speak(assistantMessage.text, () => {
        // Solo tiene sentido escuchar si seguimos en modo mentor
        if (currentMode === 'mentor') {
          startListening();
        }
      });
    }
  } catch (e) {
    console.error('❌ Error en handleVideoComplete (iPhone):', e);
    setMessages(prev => [
      ...prev,
      {
        text: 'Tuvimos un problema al procesar el final del video.',
        isUser: false,
        isError: true,
        timestamp: new Date(),
      },
    ]);
  }
}, [
  user,
  documentId,
  sessionToken,
  isListening,
  isSpeaking,
  currentMode,
  audioRef,
  cleanupRecognition,
  stopListening,
  setShowVideoPopup,
  setCurrentVideoData,
  setIsSpeaking,
  setIsListening,
  setMessages,
  setIsWaitingForResponse,
  setSessionToken,
  setRetroalimentacionActiva,
  setNumeroPregunta,
  setVideoIdRetro,
  speak,
  startListening,
]);


// === MANEJAR CIERRE DE VIDEO MENTOR (iPhone) ===
// ✅ Al cerrar el popup de video: mostrar "Progreso guardado (XX%)..."
// ✅ Cierre del popup de video en iPhone
const handleVideoClose = useCallback((lastTime = 0, duration = 0) => {
  console.log('❌ Cierre de video (iPhone) con progreso:', { lastTime, duration });

  // 1️⃣ Reset de estados de "pensando" y audio
  setIsWaitingForResponse(false);   // ← esto apaga los tres puntitos y muestra el mic
  setIsGeneratingVoice(false);
  setIsSpeaking(false);
  setIsListening(false);
  setAudioLevel(0);

  stopListening();
  stopSpeaking();
  cleanupRecognition();

  // 2️⃣ Cerrar popup y limpiar datos del video
  setShowVideoPopup(false);
  setCurrentVideoData(null);

  // 3️⃣ Si es modo repaso, no mostrar mensaje de progreso guardado
  if (allowSeekRef.current) {
    setAllowSeek(false); // Reset para próximos videos
    return;
  }

  // 4️⃣ Si no tenemos duración válida, no mostramos mensaje de progreso
  if (!duration || duration <= 0) return;

  const percentage = (lastTime / duration) * 100;

  // 5️⃣ Mensaje "Progreso guardado..."
  const msg = `Progreso guardado (${percentage.toFixed(
    0
  )}%). Si quieres continuar, vuelve a activar el modo mentor cuando lo desees.`;

  setMessages(prev => [
    ...prev,
    { text: msg, isUser: false, timestamp: new Date() },
  ]);

  // 6️⃣ Que lo diga en voz y luego vuelva a mostrar el mic
  speak(msg);
}, [
  stopListening,
  stopSpeaking,
  cleanupRecognition,
  setShowVideoPopup,
  setCurrentVideoData,
  setIsWaitingForResponse,
  setIsGeneratingVoice,
  setIsSpeaking,
  setIsListening,
  setAudioLevel,
  setMessages,
  speak,
  enableAudioContext,
  startListening,
]);



  // --- HANDLERS UI ---
  const handleSendMessage = () => {
    if (manualInput.trim()) {
      enableAudioContext();
      setMessages(prev => [...prev, { text: manualInput, isUser: true, timestamp: new Date() }]);
      // Usar ref para siempre tener la versión más reciente
      if (sendQuestionToBackendRef.current) {
        sendQuestionToBackendRef.current(manualInput);
      }
      setManualInput('');
    }
  };

const handleModeChange = useCallback((newMode) => {
  if (currentMode === newMode) {
    setShowModeDropdown(false);
    return;
  }

  // 👇 Si había una grabación en curso, la cancelamos para que NO se transcriba
  cancelTranscriptionRef.current = true;
  stopListening();

  // Si salimos de evaluación, soltamos el candado y limpiamos flags
  if (currentMode === 'evaluacion' && newMode !== 'evaluacion') {
    setEvaluationState({ isActive: false });
    sessionStorage.setItem('awaitingValidation', 'false');
    sessionStorage.setItem('awaitingConfirmation', 'false');
  }

  setShowModeDropdown(false);
  enableAudioContext();

  let command = '';
  if (newMode === 'mentor') command = 'activar modo mentor';
  else if (newMode === 'evaluacion') command = 'activar modo evaluación';
  else command = 'salir del modo actual';

  setMessages(prev => [
    ...prev,
    { text: command, isUser: true, timestamp: new Date() }
  ]);

  // Usar ref para siempre tener la versión más reciente
  if (sendQuestionToBackendRef.current) {
    sendQuestionToBackendRef.current(command);
  }
  setCurrentMode(newMode);
}, [currentMode, stopListening, enableAudioContext, setMessages, setCurrentMode, setEvaluationState]);




  // ✅ NUEVO: Bloquear scroll GLOBAL solo mientras este componente esté vivo
  useEffect(() => {
    // 1. Guardar el estado original del body (por seguridad)
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const originalBg = document.body.style.backgroundColor;
    
    // 2. Aplicar bloqueo estilo "App Nativa"
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.body.style.backgroundColor = '#121826'; // Color de fondo oscuro para evitar flash blanco

    // 3. Limpieza al salir (Unmount): Restaurar scroll y fondo
    return () => {
      document.body.style.overflow = originalStyle; // Vuelve a 'auto' o lo que tuviera antes
      document.body.style.height = '';
      document.body.style.backgroundColor = originalBg;
    };
  }, []); // El array vacío asegura que solo corra al montar y desmontar

  

  // --- EFECTOS ---
  useEffect(() => {
    let interval;
    if (isSpeaking) {
        setShowWaves(true);
        interval = setInterval(() => setWaveIntensities(prev => prev.map(() => Math.random() * 25 + 5)), 100);
    } else { setShowWaves(false); }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); messagesHistoryRef.current = messages; }, [messages]);

  useEffect(() => {
    const load = async () => {
        try {
            const res = await consultaService.getDocumentById(documentId);
            setDocumentInfo(res.data);
            setMessages([{ text: `Hola, estoy lista para acompañarte en "${res.data.titulo}".`, isUser: false, timestamp: new Date() }]);
            setIsInitializing(false);
        } catch (e) { setIsInitializing(false); }
    };
    if (user) load();
    return () => {
  // 1. Detener reconocimiento y audio
  cleanupRecognition();
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  // 2. Limpiar sesión para que no se arrastre al próximo documento
  localStorage.removeItem('sessionToken');
  sessionStorage.removeItem('awaitingValidation');
  sessionStorage.removeItem('awaitingConfirmation');
  sessionStorage.removeItem('awaitingVideoConfirmation');
  sessionStorage.removeItem('retroalimentacionActiva');
  sessionStorage.removeItem('numeroPregunta');
  sessionStorage.removeItem('videoIdRetro');
  sessionStorage.removeItem('pendingVideoData');

  // 3. Reset de estado local clave
  setEvaluationState({ isActive: false });
  setCurrentMode('consulta');
  setIsSpeaking(false);
  setIsGeneratingVoice(false);
  setIsListening(false);
  setAudioLevel(0);
  messagesHistoryRef.current = [];
};

  }, [documentId, user, cleanupRecognition]);

  // ============= useEffect PARA VERIFICAR RETO AL CARGAR =============
  useEffect(() => {
    if (documentId && user?.id) {
      verificarRetoPendiente();
    }
  }, [documentId, user, verificarRetoPendiente]);

// ============= FUNCIÓN: INICIAR PRIMERA INTERACCIÓN (CORREGIDA) =============
  const startFirstInteraction = useCallback(async (selectedMode = 'consulta') => {
    if (!firstInteraction) {
      setFirstInteraction(true);
      setShowWelcomeModal(false);
      enableAudioContext();
      
      sessionStorage.setItem('awaitingConfirmation', 'false');
      sessionStorage.setItem('awaitingValidation', 'false');
      
      setCurrentMode(selectedMode);

      // Pequeña espera para asegurar renderizado
      await new Promise(resolve => setTimeout(resolve, 100));

      let command = '';
      if (selectedMode === 'mentor') {
          command = 'activar modo mentor';
      } else if (selectedMode === 'evaluacion') {
          command = 'activar modo evaluación';
      } else if (selectedMode === 'reto') {
          // Modo Reto: Presentar la pregunta del reto

          if (retoState.reto?.pregunta) {
            const mensajeReto = `¡Bienvenido al Reto Semanal! Tu pregunta de hoy es: ${retoState.reto.pregunta}. Tómate tu tiempo para responder.`;

            setMessages(prev => [...prev, {
              text: mensajeReto,
              isUser: false,
              timestamp: new Date()
            }]);

            speak(mensajeReto, () => {
              setTimeout(() => {
                startListening();
              }, 300);
            });
          }
          return;
      } else {
          // Modo consulta: solo habla el saludo inicial
          if (messages[0]?.text) {
            speak(messages[0].text, () => startListening());
          }
          return;
      }

      // 🔥 CRÍTICO: Agregamos el comando al historial visual y lógico
      // Esto asegura que el backend sepa de dónde venimos cuando respondamos "Sí"
      const userMsg = { text: command, isUser: true, timestamp: new Date() };
      setMessages(prev => [...prev, userMsg]);

      // Enviamos al backend
      if (sendQuestionToBackendRef.current) {
        sendQuestionToBackendRef.current(command);
      }

    }
  }, [firstInteraction, enableAudioContext, messages, speak, startListening]);

  const currentModeInfo = getModeInfo(currentMode);

  if (isInitializing) return <div className="iphone-loading">Cargando...</div>;

  // Modo Realtime: renderizar panel dedicado
  if (useRealtimeMode) {
    return (
      <RealtimePanel
        documentId={documentId}
        mode={currentMode}
        documentInfo={documentInfo}
        onFallbackToText={() => setUseRealtimeMode(false)}
        onGoBack={handleGoBack}
      />
    );
  }

  return (
    <div className="iphone-container">
      <header className="iphone-header">
        <div className="header-left">
          <button onClick={handleGoBack} className="back-btn-icon">←</button>
          <div className="avatar-container">
            <MentorIAAvatar isSpeaking={isSpeaking} />
            <div className="header-info">
              <h3>MentorIA</h3>
              {documentInfo && <p>{documentInfo.titulo}</p>}
            </div>
          </div>
        </div>
        <div className="mode-selector-container">
            <button className={`mode-toggle-btn ${currentMode}`} onClick={() => setShowModeDropdown(!showModeDropdown)}>
                <span className="mode-emoji">{currentModeInfo.emoji}</span>
                <span className="mode-label">{currentModeInfo.label}</span>
                <span className="dropdown-arrow">▼</span>
            </button>
            {showModeDropdown && (
                <>
                    <div className="mode-dropdown-overlay" onClick={() => setShowModeDropdown(false)} />
                    <div className="mode-dropdown-menu">
                        <button onClick={() => handleModeChange('consulta')} className="dropdown-item consulta"><span>💬</span> Consulta</button>
                        <button onClick={() => handleModeChange('mentor')} className="dropdown-item mentor"><span>👨‍🏫</span> Mentor</button>
                        <button onClick={() => handleModeChange('evaluacion')} className="dropdown-item evaluacion"><span>📝</span> Evaluación</button>
                    </div>
                </>
            )}
        </div>
      </header>

      <main className="iphone-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message-bubble ${msg.isUser ? 'user' : 'assistant'}`}>
            <div dangerouslySetInnerHTML={{ __html: procesarMarkdown(msg.text) }} />
          </div>
        ))}
        
        {/* INDICADOR DE CARGA + MENSAJE ESPECIAL DE EVALUACIÓN */}
        {isWaitingForResponse && (
          <div className="message-bubble assistant thinking" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ display: 'flex' }}><span>.</span><span>.</span><span>.</span></div>
             {currentMode === 'evaluacion' && (
               <span style={{ fontSize: '0.85rem', fontWeight: 'normal', opacity: 0.9, animation: 'none', lineHeight: '1.2', color: 'white' }}>
                 Generando evaluación...
               </span>
             )}
          </div>
        )}
        
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </main>

      <footer className="iphone-footer">
        {showWaves && (
            <div className="waves-floating-container">
                {waveIntensities.map((h, i) => <div key={i} className="wave-bar" style={{ height: `${h}px` }} />)}
            </div>
        )}

        <div className="footer-controls">
             <div className="action-btn-wrapper">
                {isSpeaking ? (
                    <button className="action-btn stop-btn" onClick={stopSpeaking}>⏹</button>
                ) : isWaitingForResponse ? (
                    <div className="spinner-mini" />
                ) : (
                 <button 
  className={`action-btn mic-btn ${isListening ? 'listening' : ''}`}
  onClick={handleMicButtonClick}
>
  🎙
</button>

                )}
             </div>

             <div className="input-wrapper">
                <input 
                    type="text" 
                    placeholder="Escribe aquí..." 
                    value={manualInput} 
                    onChange={(e) => setManualInput(e.target.value)} 
                    disabled={isWaitingForResponse} 
                />
                <button onClick={handleSendMessage} disabled={!manualInput.trim()}>Enviar</button>
             </div>
        </div>
      </footer>



      {showWelcomeModal && !isInitializing && (
        <div className="welcome-modal-overlay">
            <div className="welcome-card">
                <h2>Bienvenido</h2>
                <p>Elige tu modo de aprendizaje:</p>
                
                <button onClick={() => startFirstInteraction('consulta')} className="mode-btn consulta">
                  💬 Consulta Libre
                </button>
                
                <button onClick={() => startFirstInteraction('mentor')} className="mode-btn mentor">
                  👨‍🏫 Mentor Guiado
                </button>
                
                <button onClick={() => startFirstInteraction('evaluacion')} className="mode-btn evaluacion">
                  📝 Evaluación
                </button>

                {/* Botón Modo Reto */}
                <button
                  onClick={() => retoState.tieneRetoPendiente && startFirstInteraction('reto')}
                  className={`mode-btn reto ${!retoState.tieneRetoPendiente ? 'disabled' : ''}`}
                  disabled={!retoState.tieneRetoPendiente || retoState.cargando}
                >
                  <span>🎯 Reto Semanal</span>
                  {retoState.cargando ? (
                    <span className="coming-soon-tag">Cargando...</span>
                  ) : retoState.tieneRetoPendiente ? (
                    <span className="reto-pending-tag">¡Pendiente!</span>
                  ) : retoState.retoCompletado ? (
                    <span className="coming-soon-tag">✓ Completado</span>
                  ) : (
                    <span className="coming-soon-tag">Próximo: {retoState.proximoReto?.dia || 'Lun/Jue'}</span>
                  )}
                </button>

                {/* Botón Modo Realtime */}
                {isRealtimeSupported() && (
                  <button
                    onClick={() => { setShowWelcomeModal(false); setUseRealtimeMode(true); }}
                    className="mode-btn realtime"
                    style={{
                      background: 'linear-gradient(135deg, rgba(8, 145, 178, 0.2), rgba(34, 211, 238, 0.1))',
                      border: '1px solid rgba(8, 145, 178, 0.4)',
                      color: '#22D3EE'
                    }}
                  >
                    <span>🎙 Modo Realtime</span>
                    <span className="coming-soon-tag" style={{ color: '#22D3EE', background: 'rgba(8, 145, 178, 0.15)' }}>Conversacion por voz</span>
                  </button>
                )}

                {/* Botón de Soporte */}
                <button className="mode-btn support" disabled>
                  <span>🛠 Ayuda y Soporte</span>
                  <span className="coming-soon-tag">Próximamente disponible 24/7</span>
                </button>

            </div>
        </div>
      )}

      
{showVideoPopup && currentVideoData && (
  <VideoMentorPopupiPhone
      isOpen={showVideoPopup}
      onClose={handleVideoClose}
      onComplete={handleVideoComplete}
      videoData={currentVideoData}
      documentId={documentId}
      sessionToken={sessionToken}
      userId={user?.id}
      allowSeek={allowSeek}
  />
)}

{/* --- Drawer Móvil para Sidebar --- */}
<MobileSidebarDrawer currentMode={currentMode}>
  {currentMode === 'consulta' && (
    <>
      <h4 style={{ color: '#F1F5F9', marginBottom: '16px' }}>⚡ Preguntas Frecuentes</h4>
      <QuickQuestions
        documentId={documentId}
        sessionToken={sessionToken}
        onQuestionClick={(question) => {
          // Manejar click en pregunta rápida
          console.log('Pregunta seleccionada:', question);
        }}
      />
    </>
  )}
  {currentMode === 'mentor' && (
    <>
      <h4 style={{ color: '#F1F5F9', marginBottom: '16px' }}>🌲 Progreso del Programa</h4>
      <MentorProgressPanel
        documentId={documentId}
        userId={user?.id}
        onLessonClick={handleLessonClick}
      />
    </>
  )}
  {currentMode === 'evaluacion' && (
    <>
      <h4 style={{ color: '#F1F5F9', marginBottom: '16px' }}>📊 Progreso de Evaluación</h4>
      <EvaluationProgress evaluationState={evaluationState} />
    </>
  )}
</MobileSidebarDrawer>

    </div>
  );
};

export default ConsultaAsistenteiPhone;