// ConsultaAsistentePage.js - VERSIÓN FINAL HÍBRIDA (Lógica Original + Diseño Refinado + Animaciones Originales)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import { consultaService, retoService, realtimeSessionService } from '../services/api';

import VideoMentorPopup from '../components/VideoMentorPopup';
import AudioCalibration from '../components/AudioCalibration';
import QuickAccessPanel from '../components/QuickAccessPanel';
import MobileSidebarDrawer from '../components/MobileSidebarDrawer';
import MentorProgressPanel from '../components/MentorProgressPanel';
import EvaluationProgress from '../components/EvaluationProgress';
import QuickQuestions from '../components/QuickQuestions';
import { RealtimeSession, SESSION_STATES, isRealtimeSupported } from '../services/realtimeService';

import './ConsultaAsistentePage.css';

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
  
  console.log('🔍 ConsultaAsistentePage - Detección iOS:');
  console.log('   User Agent:', userAgent);
  console.log('   Platform:', navigator.platform);
  console.log('   🍎 RESULTADO:', result);
  
  return result;
};



// Función para procesar formato Markdown básico
const procesarMarkdown = (texto) => {
  if (!texto) return '';
  
  let html = texto;
  
  // 1. Convertir negritas **texto** → <strong>texto</strong>
  html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
  
  // 2. Convertir itálicas *texto* → <em>texto</em>
  html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
  
  // 3. Convertir saltos de línea dobles \n\n → <br><br>
  html = html.replace(/\n\n/g, '<br><br>');
  
  // 4. Convertir saltos de línea simples \n → <br>
  html = html.replace(/\n/g, '<br>');
  
  // 5. Convertir listas con - o •
  html = html.replace(/^[\-•]\s+(.+)$/gm, '<li>$1</li>');
  
  // 6. Envolver listas en <ul>
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // 7. Convertir encabezados ## Título → <h3>Título</h3>
  html = html.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
  
  // 8. Convertir encabezados # Título → <h2>Título</h2>
  html = html.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');
  
  return html;
};

// NUEVO: Icono SVG para el Avatar de la IA
const MentorIAAvatar = ({ isSpeaking }) => (
  <svg width="60" height="60" viewBox="0 0 100 100" style={{ transform: 'scale(1.2)' }}>
    <defs>
      <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: 'var(--color-primary-light)', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: 'var(--color-primary)', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    {isSpeaking && (
      <circle 
        cx="50" cy="50" r="45" 
        fill="none" 
        stroke="var(--color-primary)" 
        strokeWidth="2" 
        style={{
          opacity: 0.5,
          animation: 'pulseRingAvatar 2s ease-out infinite'
        }}
      />
    )}
    <circle cx="50" cy="50" r="40" fill="url(#avatarGradient)" />
    <g stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" fill="none" strokeLinecap="round">
      <path d="M35 50 Q 50 35, 65 50" />
      <path d="M38 60 Q 50 70, 62 60" />
      <path d="M45 42 Q 50 48, 55 42" />
      <circle cx="35" cy="50" r="3" fill="white" />
      <circle cx="65" cy="50" r="3" fill="white" />
      <circle cx="50" cy="35" r="2.5" fill="white" />
      <circle cx="38" cy="60" r="2.5" fill="white" />
      <circle cx="62" cy="60" r="2.5" fill="white" />
    </g>
  </svg>
);

// 🆕 Función para generar sessionToken en el frontend
function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const ConsultaAsistentePage = () => {
  const { documentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
const {
  speak, startListening, stopListening, stopSpeaking,  // ← VERIFICAR que stopSpeaking esté aquí
  isListening, isSpeaking, transcript, resetTranscript
} = useVoice();
  
  // Estados principales (Lógica original intacta)
  const [messages, setMessages] = useState([]);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [showConsultaSubmodes, setShowConsultaSubmodes] = useState(false);
  const [firstInteraction, setFirstInteraction] = useState(false);
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [userName, setUserName] = useState('');
 const [sessionToken, setSessionToken] = useState(() => {
  // 🆕 Intentar cargar sessionToken existente de localStorage
  const stored = localStorage.getItem('sessionToken');
  if (stored) {
    console.log('🔑 SessionToken cargado desde localStorage:', stored.substring(0, 8) + '...');
    return stored;
  }
  
  // 🆕 Si no existe, generar uno nuevo
  const newToken = generateSessionToken();
  console.log('🔑 SessionToken generado en frontend:', newToken.substring(0, 8) + '...');
  localStorage.setItem('sessionToken', newToken);
  return newToken;
});
  const [currentMode, setCurrentMode] = useState('consulta');
  const [awaitingValidation, setAwaitingValidation] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  // 🆕 Estados para sistema de 3 preguntas
const [retroalimentacionActiva, setRetroalimentacionActiva] = useState(false);
const [numeroPregunta, setNumeroPregunta] = useState(null);
const [videoIdRetro, setVideoIdRetro] = useState(null);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  // Realtime states
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [realtimeState, setRealtimeState] = useState(SESSION_STATES.DISCONNECTED);
  const [realtimeUserTranscripts, setRealtimeUserTranscripts] = useState([]);
  const [realtimeAiTranscript, setRealtimeAiTranscript] = useState('');
  const [realtimeAiTranscripts, setRealtimeAiTranscripts] = useState([]);
  const [realtimeAudioLevel, setRealtimeAudioLevel] = useState(0);
  const [realtimeError, setRealtimeError] = useState('');
  const [showRealtimeTranscript, setShowRealtimeTranscript] = useState(true);
  const [realtimeSessionDuration, setRealtimeSessionDuration] = useState(0);

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

  // ✅ AGREGAR ESTAS LÍNEAS
const awaitingValidationRef = useRef(false);
const awaitingConfirmationRef = useRef(false);
const realtimeSessionRef = useRef(null);
const realtimeAiTranscriptBuffer = useRef('');
const realtimeTimerRef = useRef(null);
const transcriptsSavedRef = useRef(false);

  // --- INICIO: FASE 6 ---
  // AGREGAR después de la línea 50 (estados)
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [allowSeek, setAllowSeek] = useState(false); // Modo repaso: permite adelantar/retroceder
  // --- FIN: FASE 6 ---
  const [showCalibration, setShowCalibration] = useState(false);
  
  // RE-INTEGRADO: Estados para las animaciones del panel de control original
  const [waveIntensities, setWaveIntensities] = useState([15, 25, 40, 30, 20, 35, 18]);
  const [showWaves, setShowWaves] = useState(false);

  

  // 🆕 Estado para gestionar el progreso de la evaluación
  const [evaluationState, setEvaluationState] = useState({
    isActive: false,
    currentQuestion: 1,
    totalQuestions: 10,
    correctAnswers: 0,
    incorrectAnswers: 0,
    questionsAnswered: [],
    timeElapsed: 0,
    startTime: null
  });

  const [mentorProgressVersion, setMentorProgressVersion] = useState(0);

  // RE-INTEGRADO: useEffect para la animación de las ondas de voz
  useEffect(() => {
    let interval;
    let timeout;
    
    if (isSpeaking) {
      timeout = setTimeout(() => {
        setShowWaves(true);
        interval = setInterval(() => {
          setWaveIntensities(prev => prev.map(() => 
            Math.random() * 25 + 5 // Altura ajustada para el nuevo diseño (entre 5 y 30px)
          ));
        }, 150);
      }, 300); // Delay para sincronizar con el inicio real del audio
      
    } else {
      setShowWaves(false);
    }
    
    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
 }, [isSpeaking]);

  // 🆕 ============= FUNCIONES PARA GESTIONAR EVALUACIÓN =============
  
  const startEvaluation = useCallback((totalQuestions = 10) => {
    console.log('📝 Iniciando evaluación con', totalQuestions, 'preguntas');
    setEvaluationState({
      isActive: true,
      currentQuestion: 1,
      totalQuestions: totalQuestions,
      correctAnswers: 0,
      incorrectAnswers: 0,
      questionsAnswered: [],
      timeElapsed: 0,
      startTime: Date.now()
    });
  }, []);

const updateEvaluationProgress = useCallback((isCorrect) => {
    console.log('🔄 updateEvaluationProgress llamado:', isCorrect ? 'CORRECTA' : 'INCORRECTA');
    
    setEvaluationState(prev => {
      console.log('📊 Estado ANTES de actualizar:', {
        isActive: prev.isActive,
        currentQuestion: prev.currentQuestion,
        totalQuestions: prev.totalQuestions
      });
      
      if (!prev.isActive) {
        console.log('⚠️ Evaluación no activa, no se actualiza');
        return prev;
      }
      
      const newQuestionsAnswered = [
        ...prev.questionsAnswered,
        {
          number: prev.currentQuestion,
          isCorrect: isCorrect,
          timestamp: Date.now()
        }
      ];
      
      const newCurrentQuestion = prev.currentQuestion + 1;
      const newCorrectAnswers = prev.correctAnswers + (isCorrect ? 1 : 0);
      const newIncorrectAnswers = prev.incorrectAnswers + (isCorrect ? 0 : 1);
      const newTimeElapsed = Math.floor((Date.now() - prev.startTime) / 1000);
      
const newState = {
        ...prev,
        currentQuestion: newCurrentQuestion,
        correctAnswers: newCorrectAnswers,
        incorrectAnswers: newIncorrectAnswers,
        questionsAnswered: newQuestionsAnswered,
        timeElapsed: newTimeElapsed
      };
      
      console.log('✅ NUEVO ESTADO DE EVALUACIÓN:', {
        pregunta: newCurrentQuestion,
        total: prev.totalQuestions,
        correctas: newCorrectAnswers,
        incorrectas: newIncorrectAnswers,
        isActive: prev.isActive
      });
      
      return newState;
    });
  }, []);

  const finishEvaluation = useCallback(() => {
    console.log('✅ Evaluación finalizada');
    setEvaluationState(prev => ({
      ...prev,
      isActive: false,
      timeElapsed: prev.startTime ? Math.floor((Date.now() - prev.startTime) / 1000) : 0
    }));
  }, []);

  const resetEvaluation = useCallback(() => {
    console.log('🔄 Reiniciando evaluación');
    setEvaluationState({
      isActive: false,
      currentQuestion: 1,
      totalQuestions: 10,
      correctAnswers: 0,
      incorrectAnswers: 0,
      questionsAnswered: [],
      timeElapsed: 0,
      startTime: null
    });
  }, []);
  
  // 🆕 ============= FIN FUNCIONES DE EVALUACIÓN =============

// ============= REEMPLAZAR detectModeChange (LÍNEA 95) =============
// ============= REEMPLAZAR detectModeChange (LÍNEA 95) =============
const detectModeChange = useCallback((response) => {
    const responseLower = response.toLowerCase();
    
    // 🆕 CRÍTICO: NO permitir cambios de modo si hay evaluación activa
    // (excepto si es la salida explícita de evaluación)
    if (evaluationState && evaluationState.isActive) {
      // Solo permitir salida explícita de evaluación
      if (responseLower.includes('salido del modo evaluación') || 
          (responseLower.includes('evaluación completada') && responseLower.includes('modo consulta'))) {
        console.log('🔵 Modo CONSULTA detectado (salida de evaluación)');
        setCurrentMode('consulta');
        finishEvaluation();
        return 'consulta';
      }
      
      console.log('⚠️ Evaluación activa - Bloqueando cambios de modo');
      return 'evaluacion'; // Mantener en evaluación
    }
    
    // Detectar activación de modo mentor
    if (responseLower.includes('modo mentor') && 
        (responseLower.includes('activado') || 
         responseLower.includes('he activado') ||
         responseLower.includes('perfecto, continuemos con tu programa') ||
         responseLower.includes('programa de estudio'))) {
      console.log('🟢 Modo MENTOR detectado');
      setCurrentMode('mentor');
      return 'mentor';
    }
    
    // Detectar salida de modo mentor
    if ((responseLower.includes('salido del modo mentor') || 
         responseLower.includes('volvemos al modo consulta') ||
         responseLower.includes('modo consulta activado')) &&
        !responseLower.includes('activar modo mentor')) {
      console.log('🔵 Modo CONSULTA detectado (salida de mentor)');
      setCurrentMode('consulta');
      return 'consulta';
    }
    
// 🆕 Detectar activación de modo evaluación
if (responseLower.includes('modo evaluación') && 
    (responseLower.includes('activado') || 
     responseLower.includes('he activado'))) {
  console.log('🟡 Modo EVALUACIÓN detectado');
  setCurrentMode('evaluacion');

  // 🆕 Iniciar la evaluación automáticamente
  // Detectar número de preguntas según los textos reales del backend
  let totalQuestions = 10;

  // Caso 1: "Preguntas: 7 (generadas aleatoriamente para ti)"
  let numberMatch = response.match(/preguntas:\s*(\d+)/i);

  // Caso 2: "Llevas 1 de 7 preguntas respondidas"
  if (!numberMatch) {
    numberMatch = response.match(/llevas\s+\d+\s+de\s+(\d+)\s+preguntas/i);
  }

  // Caso 3: "7 preguntas" (fallback genérico)
  if (!numberMatch) {
    numberMatch = response.match(/(\d+)\s+preguntas?/i);
  }

  if (numberMatch) {
    totalQuestions = parseInt(numberMatch[1], 10);
  }

  console.log('📝 Total de preguntas detectado:', totalQuestions);
  startEvaluation(totalQuestions);
  return 'evaluacion';
}

    
// 🆕 Detectar salida de modo evaluación
    if (responseLower.includes('salido del modo evaluación') || 
        (responseLower.includes('evaluación completada') && responseLower.includes('modo consulta'))) {
      console.log('🔵 Modo CONSULTA detectado (salida de evaluación)');
      setCurrentMode('consulta');
      
      // 🆕 Finalizar evaluación
      finishEvaluation();
      
      return 'consulta';
    }
    
    console.log('ℹ️ No se detectó cambio de modo, permanece en:', currentMode);
    return currentMode;
 }, [currentMode, startEvaluation, finishEvaluation, evaluationState]);
// ============= FIN DE LA FUNCIÓN =============

  const getModeInfo = useCallback((mode) => {
    switch(mode) {
      case 'mentor':
        return { label: '👨‍🏫 Modo Mentor', color: '#10B981', description: 'Aprendizaje guiado' };
      case 'evaluacion':
        return { label: '📝 Modo Evaluación', color: '#F59E0B', description: 'Evaluación de conocimientos' };
      case 'reto':
        return { label: '🎯 Modo Reto', color: '#8B5CF6', description: 'Reto semanal' };
      case 'consulta_grupo':
        return { label: '👥 Modo Grupal', color: '#8B5CF6', description: 'Espectador en reunión grupal' };
      default:
        return { label: '💬 Modo Consulta', color: 'var(--color-primary-light)', description: 'Consultas libres' };
    }
  }, []);

  // 🔍 NUEVO: Verificación de detección iOS
useEffect(() => {
  const isIOS = detectIOS();
  console.log('🔍 ConsultaAsistentePage montado');
  console.log('   Dispositivo iOS:', isIOS);
  console.log('   User Agent:', navigator.userAgent);
  console.log('   Platform:', navigator.platform);
}, []);


  useEffect(() => {
    const loadDocumentInfo = async () => {
      try {
        const response = await consultaService.getDocumentById(documentId);
        setDocumentInfo(response.data);

        const userFirstName = user?.nombre?.split(' ')[0] || 'estudiante';
setUserName(userFirstName);
        
        const welcomeMessage = {
          text: `Hola ${userFirstName}, estoy lista para acompañarte en "${response.data.titulo}". Cuéntame, ¿en qué te puedo ayudar?`,
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages([welcomeMessage]);
        setIsInitializing(false);
      } catch (error) {
        console.error('Error al cargar información del documento:', error);
        setMessages([{
          text: "Lo siento, ha ocurrido un error al cargar la información del documento.",
          isUser: false,
          timestamp: new Date()
        }]);
        setIsInitializing(false);
        setShowWelcomeModal(false);
      }
    };
    
    loadDocumentInfo();
  }, [documentId, user]);

  // ============= FUNCIÓN PARA VERIFICAR RETO PENDIENTE =============
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

      console.log('🎯 Estado del reto:', response.data);
    } catch (error) {
      console.error('Error verificando reto:', error);
      setRetoState(prev => ({ ...prev, cargando: false }));
    }
  }, [documentId, user]);

  // ============= FUNCIÓN PARA RESPONDER AL RETO =============
  const handleResponderReto = useCallback(async (respuesta) => {
    if (!retoState.reto?.id || !user?.id) return;

    try {
      setRetoState(prev => ({ ...prev, respondiendo: true }));

      const response = await retoService.responderReto(
        retoState.reto.id,
        user.id,
        respuesta
      );

      if (response.data.success) {
        // Mostrar retroalimentación
        const retroMensaje = {
          text: response.data.retroalimentacion,
          isUser: false,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, retroMensaje]);

        // Actualizar estado del reto
        setRetoState(prev => ({
          ...prev,
          tieneRetoPendiente: false,
          respondiendo: false,
          retroalimentacion: response.data
        }));

        // Hablar la retroalimentación y mensaje de despedida
        const textoCompleto = `${response.data.retroalimentacion} ${response.data.mensaje_despedida}`;

        // Agregar mensaje de despedida
        setMessages(prev => [...prev, {
          text: response.data.mensaje_despedida,
          isUser: false,
          timestamp: new Date()
        }]);

        // ============= ENVIAR CONTEXTO DEL RETO AL BACKEND =============
        // Esto permite que el modo consulta tenga memoria del reto completado
        try {
          const contextoReto = `[CONTEXTO DEL RETO SEMANAL COMPLETADO]
Pregunta del reto: ${retoState.reto.pregunta}
Respuesta del usuario: ${respuesta}
Retroalimentación: ${response.data.retroalimentacion}
Puntuación: ${response.data.puntuacion}
[FIN DEL CONTEXTO DEL RETO]`;

          await consultaService.sendQuestion({
            documentId: documentId,
            userId: user.id,
            question: contextoReto,
            sessionToken: sessionToken,
            es_contexto_reto: true // Flag para que el backend sepa que es contexto, no una pregunta
          });

          console.log('✅ Contexto del reto enviado al backend para memoria');
        } catch (contextError) {
          console.warn('⚠️ No se pudo enviar contexto del reto:', contextError);
        }

        await speak(textoCompleto, () => {
          // Cambiar a modo consulta después de la retroalimentación
          setCurrentMode('consulta');
          setTimeout(() => {
            startListening();
          }, 300);
        }, {}, sessionToken);

      } else {
        throw new Error(response.data.error || 'Error al procesar respuesta');
      }
    } catch (error) {
      console.error('Error al responder reto:', error);
      setRetoState(prev => ({ ...prev, respondiendo: false }));

      const errorMsg = {
        text: 'Lo siento, hubo un error al procesar tu respuesta. Por favor, intenta de nuevo.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  }, [retoState.reto, user, speak, sessionToken, startListening, documentId]);

  // ============= useEffect PARA VERIFICAR RETO AL CARGAR =============
  useEffect(() => {
    if (documentId && user?.id) {
      verificarRetoPendiente();
    }
  }, [documentId, user, verificarRetoPendiente]);

// ============= AGREGAR AQUÍ LA FUNCIÓN HELPER (LÍNEA 138) =============
// Función para detectar preguntas obvias fuera del tema
const isObviouslyOffTopic = (question, documentTitle) => {
  const questionLower = question.toLowerCase();
  const titleLower = documentTitle.toLowerCase();
  
  const offTopicPatterns = [
    /que es (la |el )?(diabetes|hipertension|covid|cancer)/i,
    /como se cura (la |el )?/i,
    /tratamiento para/i,
    /sintomas de/i,
    /que causa (la |el )?/i
  ];
  
  // Si coincide con patrón médico general pero no menciona el título del documento
  for (let pattern of offTopicPatterns) {
    if (pattern.test(questionLower) && !questionLower.includes(titleLower)) {
      return true;
    }
  }
  
  return false;
};
// ============= FIN DE LA FUNCIÓN HELPER =============


  const handleUserMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    // ============= PROCESAR RESPUESTA EN MODO RETO =============
    if (currentMode === 'reto' && retoState.tieneRetoPendiente && retoState.reto) {
      console.log('🎯 Procesando respuesta del reto...');

      // Agregar mensaje del usuario
      setMessages(prev => [...prev, {
        text: text,
        isUser: true,
        timestamp: new Date()
      }]);

      setIsWaitingForResponse(true);

      // Enviar respuesta al servicio de reto
      await handleResponderReto(text);

      setIsWaitingForResponse(false);
      return; // No continuar con el flujo normal
    }

        // ============= AGREGAR VALIDACIÓN AQUÍ (DESPUÉS DE LÍNEA 144) =============
    // Validación local para preguntas fuera del tema
    if (documentInfo && isObviouslyOffTopic(text, documentInfo.titulo)) {
      const quickResponse = {
        text: `Lo siento, solo puedo orientarte sobre ${documentInfo.titulo}.`,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, 
        { text, isUser: true, timestamp: new Date() },
        quickResponse
      ]);
      
    await speak(quickResponse.text, () => {
        setTimeout(() => {
          startListening();
        }, 300);
    }, {}, sessionToken);
      
      return; // Salir sin enviar al backend
    }
    // ============= FIN DE LA VALIDACIÓN =============
    
    if (!user || !user.id) {
      console.error('Usuario no autenticado');
      alert('Error: Usuario no autenticado. Por favor, inicia sesión nuevamente.');
      navigate('/login');
      return;
    }
    
    if (isListening) {
      stopListening();
    }
    
    const userMessage = { text, isUser: true, timestamp: new Date() };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsWaitingForResponse(true);

        // ✅ AGREGAR ESTOS LOGS AQUÍ (ANTES DE try)
    console.log('🔍 ESTADO ACTUAL ANTES DE ENVIAR:');
    console.log('   awaitingValidation:', awaitingValidation);
    console.log('   awaitingConfirmation:', awaitingConfirmation);
    console.log('   Tipo awaitingValidation:', typeof awaitingValidation);
    console.log('   Tipo awaitingConfirmation:', typeof awaitingConfirmation);

    
try {
    // ✅ LEER DESDE SESSIONSTORAGE (valor inmediato)
    const currentAwaitingValidation = sessionStorage.getItem('awaitingValidation') === 'true';
    const currentAwaitingConfirmation = sessionStorage.getItem('awaitingConfirmation') === 'true';
    
    console.log('🔍 Valores desde sessionStorage:');
    console.log('   awaitingValidation:', currentAwaitingValidation);
    console.log('   awaitingConfirmation:', currentAwaitingConfirmation);

    // 🆕 Leer flags del sistema de 3 preguntas
    const currentRetroalimentacionActiva = sessionStorage.getItem('retroalimentacionActiva') === 'true';
    const currentNumeroPregunta = parseInt(sessionStorage.getItem('numeroPregunta')) || null;
    const currentVideoIdRetro = parseInt(sessionStorage.getItem('videoIdRetro')) || null;
    
    console.log('   retroalimentacionActiva:', currentRetroalimentacionActiva);
    console.log('   numeroPregunta:', currentNumeroPregunta);
    console.log('   videoIdRetro:', currentVideoIdRetro);
    
const requestData = {
        documentId,
        userId: user.id,
        question: text,
        sessionToken: sessionToken,
        awaiting_validation: currentAwaitingValidation,
        awaiting_confirmation: currentAwaitingConfirmation,
        // 🆕 Campos del sistema de 3 preguntas
        retroalimentacion_activa: currentRetroalimentacionActiva,
        numero_pregunta: currentNumeroPregunta,
        video_id: currentVideoIdRetro,
        chatHistory: messages.map(m => ({
            role: m.isUser ? "user" : "assistant",
            content: m.text
        }))
    };

 console.log('📤 requestData completo:', JSON.stringify(requestData, null, 2));

// ✅ LOGS CRÍTICOS
console.log('═══════════════════════════════════════');
console.log('📤 ENVIANDO REQUEST AL BACKEND');
console.log('   Question:', text);
console.log('   awaiting_validation:', awaitingValidation);
console.log('   awaiting_confirmation:', awaitingConfirmation);
console.log('   Tipo awaiting_validation:', typeof awaitingValidation);
console.log('   Tipo awaiting_confirmation:', typeof awaitingConfirmation);
console.log('   requestData completo:', JSON.stringify(requestData, null, 2));
console.log('═══════════════════════════════════════');

const response = await consultaService.sendQuestion(requestData);

console.log('📊 DEBUG - Respuesta completa:', response.data);
console.log('📊 DEBUG - Acción:', response.data.action);
console.log('📊 DEBUG - Video data:', response.data.video_data);
console.log('📊 DEBUG - awaiting_validation:', response.data.awaiting_validation);
console.log('📊 DEBUG - awaiting_confirmation:', response.data.awaiting_confirmation);

if (response.data.sessionToken) {
    setSessionToken(response.data.sessionToken);
}

// ✅ PROCESAR ACCIÓN DE VIDEO PRIMERO (antes de actualizar flags)
const videoActions = ['open_video', 'resume_video', 'video_ready'];

// 🆕 Acción especial: Solo mostrar mensaje, NO abrir video
if (response.data.action === 'awaiting_user_confirmation') {
    console.log('⏳ Esperando confirmación del usuario para abrir video');
    
    const assistantMessage = {
        text: response.data.answer,
        isUser: false,
        timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, assistantMessage]);
    setIsWaitingForResponse(false);
    
    // Hablar el mensaje
    if (response.data.answer && response.data.answer.trim()) {
   
console.log('🔍 DEBUG - sessionToken antes de speak:', sessionToken);
console.log('🔍 DEBUG - Tipo de sessionToken:', typeof sessionToken);
console.log('🔍 DEBUG - sessionToken es null?:', sessionToken === null);
console.log('🔍 DEBUG - sessionToken es undefined?:', sessionToken === undefined);

        await speak(response.data.answer, () => {
            setTimeout(() => {
                startListening();
            }, 300);
        }, {}, sessionToken);
    } else {
        setTimeout(() => {
            startListening();
        }, 300);
    }
    
    return; // Salir sin abrir video
}

// Continuar con acciones de video normales
if (videoActions.includes(response.data.action) && response.data.video_data) {
    console.log('🎬 Abriendo video con acción:', response.data.action);
    console.log('📹 Video data:', response.data.video_data);
    
    setIsWaitingForResponse(false);
    
    // ✅ DETENER ESCUCHA DE LA PÁGINA PRINCIPAL
    if (isListening) {
        stopListening();
    }
    
    // ✅ RESETEAR FLAGS solo cuando abre el video
    setAwaitingValidation(false);
    setAwaitingConfirmation(false);
    awaitingValidationRef.current = false; // ✅ AGREGAR
awaitingConfirmationRef.current = false; // ✅ AGREGAR
    
    
    // La IA habla PRIMERO, y al terminar, se ejecuta el callback para abrir el popup.
// ✅ Solo hablar si hay texto
if (response.data.answer && response.data.answer.trim()) {
    speak(response.data.answer, () => {
        setCurrentVideoData(response.data.video_data);
        setAllowSeek(false); // Video normal: con restricciones
        setShowVideoPopup(true);
    }, {}, sessionToken);
} else {
    // Abrir video directamente sin audio
    setCurrentVideoData(response.data.video_data);
    setAllowSeek(false); // Video normal: con restricciones
    setShowVideoPopup(true);
}

} else if (response.data.action === 'program_completed') {
    const assistantMessage = {
        text: response.data.answer,
        isUser: false,
        timestamp: new Date()
    };
    setMessages(prevMessages => [...prevMessages, assistantMessage]);
    setIsWaitingForResponse(false);
    
    // Cambiar el modo de vuelta a consulta después de felicitar
    setCurrentMode('consulta');
    
    // ✅ Resetear flags
    setAwaitingValidation(false);
    setAwaitingConfirmation(false);

    // ✅ AGREGAR ESTAS LÍNEAS
sessionStorage.setItem('awaitingValidation', 'false');
sessionStorage.setItem('awaitingConfirmation', 'false');

    await speak(assistantMessage.text, () => {
        setTimeout(() => {
            startListening();
        }, 300);
    }, {}, sessionToken);

    // 🆕 Forzar refresco del panel de progreso
if (currentMode === 'mentor') {
  setMentorProgressVersion(prev => prev + 1);
}

} else {
    // ✅ ACTUALIZAR FLAGS Y GUARDAR EN VARIABLES TEMPORALES
    let nextAwaitingValidation = false;
    let nextAwaitingConfirmation = false;
    
    if (response.data.awaiting_validation) {
        console.log('⏳ Sistema esperando validación de retroalimentación');
        nextAwaitingValidation = true;
        setAwaitingValidation(true);
        setAwaitingConfirmation(false);
    } else if (response.data.awaiting_confirmation) {
        console.log('⏳ Sistema esperando confirmación para avanzar');
        nextAwaitingConfirmation = true;
        setAwaitingValidation(false);
        setAwaitingConfirmation(true);
    } else {
        console.log('✅ Sin flags de espera');
        setAwaitingValidation(false);
        setAwaitingConfirmation(false);
    }
    
    // ✅ GUARDAR EN SESSIONSTORAGE PARA USO INMEDIATO
    sessionStorage.setItem('awaitingValidation', nextAwaitingValidation.toString());
    sessionStorage.setItem('awaitingConfirmation', nextAwaitingConfirmation.toString());

    // 🆕 Guardar flags del sistema de 3 preguntas
    if (response.data.retroalimentacion_activa) {
        console.log('🎯 Sistema de retroalimentación activado');
        console.log('   - Pregunta:', response.data.numero_pregunta);
        console.log('   - Video ID:', response.data.video_id);
        
        setRetroalimentacionActiva(true);
        setNumeroPregunta(response.data.numero_pregunta);
        setVideoIdRetro(response.data.video_id);
        
        // Guardar en sessionStorage
        sessionStorage.setItem('retroalimentacionActiva', 'true');
        sessionStorage.setItem('numeroPregunta', response.data.numero_pregunta);
        sessionStorage.setItem('videoIdRetro', response.data.video_id);
    } else {
        setRetroalimentacionActiva(false);
        setNumeroPregunta(null);
        setVideoIdRetro(null);
        
        // Limpiar sessionStorage
        sessionStorage.removeItem('retroalimentacionActiva');
        sessionStorage.removeItem('numeroPregunta');
        sessionStorage.removeItem('videoIdRetro');
    }
    
    // Lógica original para manejar una respuesta de texto
    const assistantMessage = {
      text: response.data.answer,
      isUser: false,
      timestamp: new Date(),
      images: response.data.images || [],
      has_images: response.data.has_images || false
    };
    
setMessages(prevMessages => [...prevMessages, assistantMessage]);
    setIsWaitingForResponse(false);
    
    // 🆕 PRIMERO: Actualizar progreso de evaluación si está activa (ANTES de detectModeChange)
if (currentMode === 'evaluacion' && evaluationState.isActive) {
  console.log('🧪 Modo evaluación activo, analizando respuesta para progreso...');

  const answerText = response.data.answer || '';

  // Buscar algo como: "Pregunta 2 de 7"
  const matchPregunta = answerText.match(/pregunta\s+(\d+)\s+de\s+(\d+)/i);

  if (matchPregunta) {
    const nuevaPregunta = parseInt(matchPregunta[1], 10);   // 2
    const totalPreguntas = parseInt(matchPregunta[2], 10);  // 7

    console.log('🔍 Detectada nueva pregunta desde el backend:', nuevaPregunta, 'de', totalPreguntas);

    setEvaluationState(prev => {
      // Si no está activa o no cambió nada, no tocamos el estado
      if (!prev.isActive) return prev;

      // Si el backend repite la misma pregunta, no avanzamos
      if (nuevaPregunta <= prev.currentQuestion && totalPreguntas === prev.totalQuestions) {
        return prev;
      }

      // Si avanzamos, marcamos la ANTERIOR como respondida
      const answered = [...(prev.questionsAnswered || [])];

      if (nuevaPregunta > prev.currentQuestion) {
        answered.push({
          number: prev.currentQuestion,    // la que acabas de responder
          isCorrect: null,                 // aún no sabemos si fue correcta
          timestamp: Date.now()
        });
      }

      return {
        ...prev,
        currentQuestion: nuevaPregunta,
        totalQuestions: totalPreguntas,
        questionsAnswered: answered
      };
    });
  } else {
    console.log('ℹ️ No se encontró patrón "Pregunta X de Y" en la respuesta.');
  }
}

    
// 🆕 SEGUNDO: Detectar cambio de modo (DESPUÉS de actualizar progreso)
const newMode = detectModeChange(response.data.answer);

// 🆕 Si estamos (o quedamos) en modo mentor, refrescamos el panel
if (newMode === 'mentor' || currentMode === 'mentor') {
  console.log('🔄 Refrescando progreso del mentor (respuesta de texto)');
  setMentorProgressVersion(prev => prev + 1);
}

await speak(assistantMessage.text, () => {
  setTimeout(() => {
    startListening();
  }, 300);
}, {}, sessionToken);
}

    } catch (error) {
      console.error('Error al procesar consulta:', error);
      
      const errorMessage = {
        text: "Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, intenta de nuevo.",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
      setIsWaitingForResponse(false);
      
      await speak(errorMessage.text, () => {
        setTimeout(() => {
          startListening();
        }, 300);
      }, {}, sessionToken);
    }
  }, [documentId, user, sessionToken, messages, isListening, stopListening, speak, startListening, detectModeChange, navigate, currentMode, evaluationState, updateEvaluationProgress, finishEvaluation]);

  // ====== REALTIME: Funciones de conexión/desconexión ======

  const connectRealtime = useCallback(async (mode) => {
    setRealtimeError('');
    setRealtimeUserTranscripts([]);
    setRealtimeAiTranscripts([]);
    setRealtimeAiTranscript('');
    setRealtimeSessionDuration(0);
    realtimeAiTranscriptBuffer.current = '';
    transcriptsSavedRef.current = false;

    const session = new RealtimeSession({
      documentId,
      mode: mode || currentMode,
      onStateChange: (state) => setRealtimeState(state),
      onTranscript: (text) => {
        setRealtimeUserTranscripts(prev => [...prev, text]);
      },
      onAITranscript: (text, isDone) => {
        if (isDone) {
          setRealtimeAiTranscripts(prev => [...prev, text]);
          setRealtimeAiTranscript('');
          realtimeAiTranscriptBuffer.current = '';
        } else {
          realtimeAiTranscriptBuffer.current += text;
          setRealtimeAiTranscript(realtimeAiTranscriptBuffer.current);
        }
      },
      onError: (msg) => {
        setRealtimeError(msg);
        if (msg === 'REALTIME_NOT_AVAILABLE') {
          setRealtimeActive(false);
        }
      },
      onAudioLevel: (level) => setRealtimeAudioLevel(level)
    });

    realtimeSessionRef.current = session;
    setRealtimeActive(true);
    await session.connect();
  }, [documentId, currentMode]);

  // Guardar transcripciones realtime antes de desconectar
  const saveRealtimeTranscripts = useCallback(async () => {
    if (transcriptsSavedRef.current) return;
    if (!realtimeUserTranscripts || realtimeUserTranscripts.length === 0) return;
    transcriptsSavedRef.current = true;
    try {
      const transcriptsPayload = realtimeUserTranscripts.map(text => ({ text }));
      const res = await realtimeSessionService.saveTranscripts(
        documentId, transcriptsPayload, realtimeSessionDuration, currentMode
      );
      console.log('Transcripciones guardadas:', res.data);
    } catch (err) {
      console.error('Error guardando transcripciones:', err);
    }
  }, [realtimeUserTranscripts, documentId, realtimeSessionDuration, currentMode]);

  const disconnectRealtime = useCallback(() => {
    saveRealtimeTranscripts();
    if (realtimeSessionRef.current) {
      realtimeSessionRef.current.disconnect();
      realtimeSessionRef.current = null;
    }
    setRealtimeActive(false);
    setRealtimeState(SESSION_STATES.DISCONNECTED);
    if (realtimeTimerRef.current) {
      clearInterval(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    }
  }, [saveRealtimeTranscripts]);

  const handleRealtimeFallbackToText = useCallback(() => {
    disconnectRealtime();
  }, [disconnectRealtime]);

  const handleRealtimeFinish = useCallback(() => {
    disconnectRealtime();
    navigate('/documentos');
  }, [disconnectRealtime, navigate]);

  // Timer de duración de sesión realtime
  useEffect(() => {
    const isActiveRealtime = realtimeState === SESSION_STATES.CONNECTED ||
      realtimeState === SESSION_STATES.LISTENING ||
      realtimeState === SESSION_STATES.AI_SPEAKING;

    if (isActiveRealtime) {
      realtimeTimerRef.current = setInterval(() => {
        setRealtimeSessionDuration(d => d + 1);
      }, 1000);
    } else {
      if (realtimeTimerRef.current) {
        clearInterval(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    }
    return () => {
      if (realtimeTimerRef.current) clearInterval(realtimeTimerRef.current);
    };
  }, [realtimeState]);

  // Cleanup realtime al desmontar
  useEffect(() => {
    return () => {
      if (realtimeSessionRef.current) {
        realtimeSessionRef.current.disconnect();
      }
    };
  }, []);

const startFirstInteraction = useCallback(async (selectedMode = 'consulta') => {
  if (!firstInteraction) {
    setFirstInteraction(true);
    setShowWelcomeModal(false);
    setLastProcessedTranscript('');

    console.log('Iniciando con modo:', selectedMode);

    try {
      // PASO 1: Establecer el modo INMEDIATAMENTE
      setCurrentMode(selectedMode);

      // PASO 1.5: Modos consulta y consulta_grupo usan Realtime (mentor/evaluación/reto mantienen flujo tradicional)
      if (isRealtimeSupported() && (selectedMode === 'consulta' || selectedMode === 'consulta_grupo')) {
        console.log('Iniciando modo Realtime para:', selectedMode);
        connectRealtime(selectedMode);
        return; // No ejecutar flujo texto
      }
      
      // ✅ PASO 2: Según el modo, ejecutar acción correspondiente
      if (selectedMode === 'mentor') {
        // Modo Mentor: Enviar comando de activación directamente
        console.log('👨‍🏫 Activando Modo Mentor...');
        await handleUserMessage('activar modo mentor');
        
      } else if (selectedMode === 'evaluacion') {
        // Modo Evaluación: Enviar comando de activación directamente
        console.log('📝 Activando Modo Evaluación...');
        await handleUserMessage('activar modo evaluación');

      } else if (selectedMode === 'reto') {
        // Modo Reto: Presentar la pregunta del reto
        console.log('🎯 Activando Modo Reto...');

        if (retoState.reto?.pregunta) {
          const mensajeReto = `¡Bienvenido al Reto Semanal! Tu pregunta de hoy es: ${retoState.reto.pregunta}. Tómate tu tiempo para responder.`;

          setMessages(prev => [...prev, {
            text: mensajeReto,
            isUser: false,
            timestamp: new Date()
          }]);

          await speak(mensajeReto, () => {
            resetTranscript();
            setTimeout(() => {
              startListening();
            }, 300);
          }, {}, sessionToken);
        }

} else {
  // Modo Consulta: Notificar backend y comenzar conversación normal
  console.log('💬 Iniciando Modo Consulta...');
  
  // 🍎 DETECTAR iOS
  const isIOS = detectIOS();
  console.log('🍎 iOS detectado en startFirstInteraction:', isIOS);
  
  // 🆕 NOTIFICAR AL BACKEND para cerrar contexto anterior
  try {
    const requestData = {
      documentId: documentId,
      userId: user.id,
      question: 'iniciar modo consulta',
      sessionToken: sessionToken
    };
    
    await consultaService.sendQuestion(requestData);
    console.log('✅ Backend notificado: modo consulta iniciado (contexto cerrado)');
  } catch (error) {
    console.error('⚠️ Error notificando backend:', error);
  }
  
  if (isIOS) {
    // 🍎 iOS: Solo hablar, NO iniciar escucha automática
    console.log('🍎 iOS: Flujo manual - Usuario debe presionar micrófono');
    
    if (messages.length > 0) {
      await speak(messages[0].text, () => {
        console.log("🍎 Audio terminado - Usuario debe presionar micrófono manualmente");
        resetTranscript();
        // ❌ NO llamar startListening() aquí en iOS
      }, {}, sessionToken);
      
      // Agregar mensaje visual
      setTimeout(() => {
        setMessages(prevMessages => [...prevMessages, {
          text: "👆 Toca el botón del micrófono para hablar",
          isUser: false,
          timestamp: new Date()
        }]);
      }, 500);
    }
    
  } else {
    // 🖥️ Desktop/Android: Funciona automático
    if (messages.length > 0) {
      await speak(messages[0].text, () => {
        console.log("✅ Iniciando escucha después del saludo");
        resetTranscript();
        setTimeout(() => {
          startListening();
        }, 300);
      }, {}, sessionToken);
    }
  }
}


      
    } catch (error) {
      console.error('❌ Error al iniciar la interacción:', error);
    }
  }
}, [firstInteraction, messages, speak, resetTranscript, startListening, handleUserMessage, connectRealtime]);

useEffect(() => {
    // ✅ NO PROCESAR si hay un video activo
    if (showVideoPopup) {
      console.log('⏸️ Video activo - ConsultaAsistente NO procesa transcript');
      return;
    }
    
    if (transcript && !isListening && !isSpeaking && !isWaitingForResponse && firstInteraction && transcript !== lastProcessedTranscript) {
      console.log("Procesando transcript:", transcript);
      setLastProcessedTranscript(transcript);
      handleUserMessage(transcript);
    }
  }, [transcript, isListening, isSpeaking, isWaitingForResponse, firstInteraction, lastProcessedTranscript, handleUserMessage, showVideoPopup]);

  // CORRECCIÓN: Este es el `useEffect` ajustado para un auto-scroll robusto.
  useEffect(() => {
    // El setTimeout asegura que el scroll se ejecute DESPUÉS de que el DOM se haya actualizado
    // con el nuevo mensaje, evitando problemas de timing.
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100); // Un pequeño delay de 100ms es suficiente.

    // Limpiamos el timer si el componente se desmonta o los mensajes cambian de nuevo rápidamente.
    return () => clearTimeout(timer);
  }, [messages]); // Se ejecuta cada vez que el array de mensajes cambia.

  // 🆕 LIMPIAR sessionToken cuando el usuario sale del documento
useEffect(() => {
  // Esta función se ejecuta cuando el componente se DESMONTA
  return () => {
    console.log('🧹 Usuario saliendo del documento - limpiando sessionToken');
    
    // Limpiar sessionToken del localStorage
    localStorage.removeItem('sessionToken');
    
    // Limpiar sessionToken del estado
    setSessionToken(null);
    
    console.log('✅ SessionToken limpiado - próxima entrada creará nueva sesión');
  };
}, []); // Array vacío = se ejecuta solo al montar/desmontar

const handleVoiceButtonClick = useCallback(() => {
    const isIOS = detectIOS();
    console.log('🎤 handleVoiceButtonClick - iOS:', isIOS);
    
    if (!firstInteraction) {
      startFirstInteraction();
    } else if (isSpeaking) {
      console.log('🛑 Deteniendo audio');
      stopSpeaking();
    } else if (isListening) {
      console.log('🛑 Deteniendo escucha');
      stopListening();
    } else {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        console.log('✅ SpeechRecognition disponible');
        
        if (isIOS) {
          // 🍎 iOS: Asegurarse de que NO hay audio reproduciéndose
          console.log('🍎 iOS: Verificando estado antes de escuchar');
          
          // Forzar detención de cualquier audio
          if (window.speechSynthesis.speaking) {
            console.log('🍎 Cancelando síntesis de voz activa');
            window.speechSynthesis.cancel();
          }
          
          // Esperar un poco más en iOS para liberar recursos de audio
          setTimeout(() => {
            console.log('🎤 iOS: Iniciando reconocimiento de voz');
            startListening();
          }, 200);
          
        } else {
          // 🖥️ Desktop/Android: Inicio normal
          console.log('🖥️ Desktop: Iniciando reconocimiento');
          startListening();
        }
        
      } else {
        alert("Este navegador no soporta reconocimiento de voz. Por favor, usa el input de texto.");
      }
    }
  }, [firstInteraction, isSpeaking, isListening, startFirstInteraction, stopSpeaking, stopListening, startListening]);

  const handleSendMessage = useCallback(() => {
    if (manualInput.trim() !== '') {
      handleUserMessage(manualInput.trim());
      setManualInput('');
    }
  }, [manualInput, handleUserMessage]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

const handleGoBack = useCallback(() => {
  console.log('Limpiando sessionToken antes de regresar');

  // Guardar transcripciones y desconectar realtime si activo
  saveRealtimeTranscripts();
  if (realtimeSessionRef.current) {
    realtimeSessionRef.current.disconnect();
    realtimeSessionRef.current = null;
  }

  // Limpiar sessionToken
  localStorage.removeItem('sessionToken');
  setSessionToken(null);
  sessionStorage.removeItem('lastDocumentId');

  // Navegar
  navigate('/documentos');
}, [navigate, setSessionToken, saveRealtimeTranscripts]);

  const handleToggleCalibration = useCallback(() => {
  setShowCalibration(prev => !prev);
}, []);

  // ============= NUEVA FUNCIÓN: Manejar click en preguntas rápidas =============
  const handleQuickQuestionClick = useCallback((questionText) => {
    console.log('⚡ Pregunta rápida seleccionada:', questionText);
    
    // Detener cualquier narración en curso
    if (isSpeaking) {
      stopSpeaking();
    }
    
    // Detener escucha si está activa
    if (isListening) {
      stopListening();
    }
    
    // Enviar la pregunta directamente
    handleUserMessage(questionText);
  }, [isSpeaking, isListening, stopSpeaking, stopListening, handleUserMessage]);

  // ============= AGREGAR DESPUÉS DE handleKeyPress (LÍNEA 280) =============
const handleModeChange = useCallback(async (newMode) => {
    if (currentMode === newMode) {
      // Ya está en ese modo
      return;
    }
    
    let commandText = '';
    
    switch(newMode) {
      case 'mentor':
        commandText = 'activar modo mentor';
        break;
      case 'evaluacion':
        commandText = 'activar modo evaluación';
        break;
      case 'consulta':
        if (currentMode === 'mentor') {
          commandText = 'salir modo mentor';
        } else if (currentMode === 'evaluacion') {
          commandText = 'salir modo evaluación';
        }
        break;
      default:
        return;
    }
    
    // Enviar el comando al backend como si el usuario lo hubiera dicho
    await handleUserMessage(commandText);
  }, [currentMode, handleUserMessage]);
// ============= FIN DE LA FUNCIÓN =============

  // --- INICIO: FASE 6 ---
  // AGREGAR funciones de manejo de video después de la línea 250
  const handleVideoProgress = (currentTime) => {
      // Actualizar progreso en tiempo real
      console.log('Video progress:', currentTime);
  };

  // Función de emergencia para detener todo
const emergencyStopSpeaking = useCallback(() => {
    console.log("🚨 EMERGENCIA: Deteniendo todo el audio");
    
    // Método 1: Usar la función del contexto
    stopSpeaking();
    
    // Método 2: Detener todos los elementos de audio en la página
    const allAudio = document.querySelectorAll('audio');
    allAudio.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
    });
    
    // Método 3: Cancelar Web Audio API si existe
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    // Método 4: Forzar actualización manual del estado
    setTimeout(() => {
        // Esto es un hack para forzar re-render
        setManualInput(prev => prev + "");
    }, 100);
    
    console.log("🚨 EMERGENCIA COMPLETADA");
}, [stopSpeaking]);

// Handler para click en lección del sidebar (modo repaso)
const handleLessonClick = useCallback(async (lessonData) => {
    console.log('📚 Lección clickeada:', lessonData);

    // Si es lección completada, abrir en modo repaso (allowSeek = true)
    // Si es lección actual, abrir normal (allowSeek = false)
    const isReplayMode = lessonData.isCompleted;

    try {
        // Obtener datos del video de la lección
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
            // Opcional: mostrar mensaje al usuario
        }
    } catch (error) {
        console.error('❌ Error obteniendo video de lección:', error);
    }
}, [documentId]);

const handleVideoComplete = async () => {
    console.log("🎬 handleVideoComplete ejecutado");
    
    // ✅ 1. DETENER TODO INMEDIATAMENTE
    if (isSpeaking) {
        window.speechSynthesis.cancel();
    }
    if (isListening) {
        stopListening();
    }
    
    // ✅ 2. LIMPIAR ESTADO DE VOZ
    resetTranscript();
    setLastProcessedTranscript('');
    
    // ✅ 3. CERRAR EL POPUP (destruye el reproductor)
    setShowVideoPopup(false);
    setCurrentVideoData(null);
    
    // ✅ 4. ESPERAR A QUE EL POPUP SE CIERRE COMPLETAMENTE
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ✅ 5. AHORA SÍ, NOTIFICAR AL BACKEND
    try {
        console.log("📤 Enviando 'accion_video_completado' al backend");
        
        const requestData = {
            documentId,
            userId: user.id,
            question: "accion_video_completado",
            sessionToken: sessionToken,
            awaiting_validation: awaitingValidation,
            chatHistory: messages.map(m => ({
                role: m.isUser ? "user" : "assistant",
                content: m.text
            }))
        };
        

const response = await consultaService.sendQuestion(requestData);

        console.log('📊 Respuesta de accion_video_completado:', response.data);
        
        if (response.data.sessionToken) {
            setSessionToken(response.data.sessionToken);
        }
        
        // 🆕 GUARDAR FLAGS DE RETROALIMENTACIÓN
        if (response.data.retroalimentacion_activa) {
            console.log('🎯 Sistema de retroalimentación activado después de video completado');
            console.log('   - Pregunta:', response.data.numero_pregunta);
            console.log('   - Video ID:', response.data.video_id);
            
            setRetroalimentacionActiva(true);
            setNumeroPregunta(response.data.numero_pregunta);
            setVideoIdRetro(response.data.video_id);
            
            // Guardar en sessionStorage
            sessionStorage.setItem('retroalimentacionActiva', 'true');
            sessionStorage.setItem('numeroPregunta', response.data.numero_pregunta.toString());
            sessionStorage.setItem('videoIdRetro', response.data.video_id.toString());
            
            // Limpiar awaiting_validation (no se usa en este flujo)
            sessionStorage.setItem('awaitingValidation', 'false');
            sessionStorage.setItem('awaitingConfirmation', 'false');
        }
        
        // ✅ MOSTRAR LA RESPUESTA DEL MENTOR (USAR response NO answer)
        const assistantMessage = {
            text: response.data.response || response.data.answer,  // ✅ Probar ambos por si acaso
            isUser: false,
            timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, assistantMessage]);
        setIsWaitingForResponse(false);

        if (currentMode === 'mentor') {
            setMentorProgressVersion(prev => prev + 1);
        }
        
        // ✅ ESPERAR UN POCO ANTES DE HABLAR
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Solo hablar si hay texto
        if (assistantMessage.text && assistantMessage.text.trim()) {
const isIOS = detectIOS();
console.log('🍎 iOS detectado en handleUserMessage:', isIOS);

await speak(assistantMessage.text, () => {
  if (isIOS) {
    console.log('🍎 iOS: NO iniciar escucha automática después de respuesta');
    // Usuario debe presionar micrófono manualmente
  } else {
    setTimeout(() => {
      startListening();
    }, 300);
  }
}, {}, sessionToken);
        }
        
    } catch (error) {
        console.error('❌ Error al procesar video completado:', error);
    }
};

const handleCloseVideo = (lastTime, duration) => {
    console.log('❌ Video cerrado');
    
    // ✅ DETENER TODO ANTES DE CERRAR
    if (isSpeaking) {
        window.speechSynthesis.cancel();
    }
    if (isListening) {
        stopListening();
    }
    
    // ✅ LIMPIAR TRANSCRIPT
    resetTranscript();
    setLastProcessedTranscript('');
    
    // ✅ CERRAR POPUP (esto destruirá el reproductor)
    setShowVideoPopup(false);
    setCurrentVideoData(null);
    
    // ✅ SOLO MENSAJE SI NO COMPLETÓ Y NO ES MODO REPASO
    const percentage = duration > 0 ? (lastTime / duration) * 100 : 0;

    // No mostrar mensaje de progreso en modo repaso (allowSeek = true)
    if (!allowSeek && percentage < 85) {
        setTimeout(() => {
            const message = `Progreso guardado (${percentage.toFixed(0)}%). Puedes retomar activando el modo mentor cuando quieras.`;

            setMessages(prevMessages => [...prevMessages, {
                text: message,
                isUser: false,
                timestamp: new Date()
            }]);

            speak(message, null, {}, sessionToken);
        }, 1000);
    }

    // Resetear allowSeek después de cerrar
    setAllowSeek(false);
};
  // --- FIN: FASE 6 ---

  const currentModeInfo = getModeInfo(currentMode);

  if (!user) { return ( <div style={{ minHeight: '100vh', background: 'var(--color-background, #121826)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '20px' }}><p>Error: Usuario no autenticado</p><button onClick={() => navigate('/login')} style={{ background: 'var(--color-primary, #0891B2)', color: 'white', border: 'none', padding: '15px 30px', borderRadius: '25px' }}>Ir al Login</button></div> ); }
  if (isInitializing) { return ( <div style={{ minHeight: '100vh', background: 'var(--color-background, #121826)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Cargando asistente MentorIA...</div> ); }

  // Modo Realtime activo: renderizar UI inline con orbe
  if (realtimeActive) {
    const isRealtimeConnected = realtimeState === SESSION_STATES.CONNECTED || realtimeState === SESSION_STATES.LISTENING || realtimeState === SESSION_STATES.AI_SPEAKING;
    const formatDuration = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };
    const getOrbStyle = () => {
      switch (realtimeState) {
        case SESSION_STATES.CONNECTING: return { border: '3px solid #6b7280', background: 'radial-gradient(circle, rgba(107,114,128,0.15) 0%, transparent 70%)' };
        case SESSION_STATES.CONNECTED: return { border: '3px solid #10b981', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' };
        case SESSION_STATES.LISTENING: return { border: '3px solid #ef4444', background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)' };
        case SESSION_STATES.AI_SPEAKING: return { border: '3px solid #0891B2', background: 'radial-gradient(circle, rgba(8,145,178,0.15) 0%, transparent 70%)' };
        case SESSION_STATES.ERROR: return { border: '3px solid #ef4444', background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)' };
        default: return { border: '3px solid #374151', background: 'rgba(255,255,255,0.03)' };
      }
    };
    const getStateLabel = () => {
      const isGrupal = currentMode === 'consulta_grupo';
      switch (realtimeState) {
        case SESSION_STATES.CONNECTING: return 'Conectando...';
        case SESSION_STATES.CONNECTED: return isGrupal ? 'Escuchando grupo — di "MentorIA" para preguntar' : 'Listo — habla para comenzar';
        case SESSION_STATES.LISTENING: return isGrupal ? 'Escuchando grupo...' : 'Escuchando...';
        case SESSION_STATES.AI_SPEAKING: return 'MentorIA respondiendo...';
        case SESSION_STATES.ERROR: return 'Error de conexión';
        default: return 'Desconectado';
      }
    };
    const getStateColor = () => {
      switch (realtimeState) {
        case SESSION_STATES.CONNECTING: return '#6b7280';
        case SESSION_STATES.CONNECTED: return '#10b981';
        case SESSION_STATES.LISTENING: return '#ef4444';
        case SESSION_STATES.AI_SPEAKING: return '#0891B2';
        case SESSION_STATES.ERROR: return '#ef4444';
        default: return '#6b7280';
      }
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#121826', color: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 25px', background: 'rgba(18, 24, 38, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleRealtimeFinish} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRealtimeConnected ? '\u2715' : '\u2190'}
            </button>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{currentMode === 'consulta_grupo' ? 'MentorIA Grupal' : 'MentorIA Realtime'}</h3>
              {documentInfo && <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>{documentInfo.titulo}</p>}
            </div>
            {documentInfo?.logo && (
              <img src={`https://mentoria.ateneo.co/backend/${documentInfo.logo}`} alt="" style={{ height: '32px', objectFit: 'contain', marginLeft: '8px', flexShrink: 0 }} />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isRealtimeConnected && <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{formatDuration(realtimeSessionDuration)}</span>}
            <button
              onClick={handleRealtimeFallbackToText}
              style={{ background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(51,65,85,0.9) 100%)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '7px 16px', color: '#CBD5E1', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease', backdropFilter: 'blur(8px)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(51,65,85,0.95) 0%, rgba(71,85,105,0.95) 100%)'; e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(51,65,85,0.9) 100%)'; e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>
              Texto
            </button>
          </div>
        </header>

        {/* Zona central con orbe */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '2rem', overflow: 'hidden' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '160px', height: '160px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', transition: 'all 0.5s ease', animation: (realtimeState === SESSION_STATES.LISTENING || realtimeState === SESSION_STATES.AI_SPEAKING) ? 'rtPulse 1.5s infinite' : (realtimeState === SESSION_STATES.CONNECTING ? 'rtPulse 1s infinite' : 'none'), ...getOrbStyle() }}>
              {realtimeState === SESSION_STATES.LISTENING && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '80px' }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{ width: '6px', backgroundColor: '#ef4444', borderRadius: '3px', height: `${20 + realtimeAudioLevel * 300 + Math.sin(Date.now()/200 + i) * 15}px`, maxHeight: '70px', transition: 'height 0.1s ease' }} />
                  ))}
                </div>
              )}
              {realtimeState === SESSION_STATES.AI_SPEAKING && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '80px' }}>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{ width: '6px', backgroundColor: '#0891B2', borderRadius: '3px', animation: `rtSoundWave 0.8s ${i * 0.15}s ease-in-out infinite`, height: '40px' }} />
                  ))}
                </div>
              )}
              {realtimeState === SESSION_STATES.CONNECTED && <span style={{ fontSize: '3rem' }}>&#127908;</span>}
              {realtimeState === SESSION_STATES.DISCONNECTED && <span style={{ fontSize: '3rem', opacity: 0.4 }}>&#127908;</span>}
              {realtimeState === SESSION_STATES.CONNECTING && <span style={{ fontSize: '2.5rem' }}>&#8987;</span>}
              {realtimeState === SESSION_STATES.ERROR && <span style={{ fontSize: '2.5rem' }}>&#9888;</span>}
            </div>
            <p style={{ marginTop: '1rem', color: getStateColor(), fontSize: '1rem', fontWeight: 500 }}>{getStateLabel()}</p>
            {currentMode === 'consulta_grupo' && (
              <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '4px 14px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#A78BFA', fontSize: '0.8rem', fontWeight: 500 }}>
                👥 Modo Grupal — Espectador
              </span>
            )}
          </div>

          {/* Botones de acción */}
          {realtimeState === SESSION_STATES.AI_SPEAKING && (
            <button onClick={() => realtimeSessionRef.current?.interrupt()} style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid #F43F5E', borderRadius: '50px', padding: '12px 32px', color: '#F43F5E', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' }}>
              Interrumpir
            </button>
          )}

          {isRealtimeConnected && (
            <button onClick={handleRealtimeFinish} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '50px', padding: '10px 28px', color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer' }}>
              Finalizar sesion
            </button>
          )}

          {/* Error */}
          {realtimeError && realtimeError !== 'REALTIME_NOT_AVAILABLE' && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px 20px', maxWidth: '500px', color: '#fca5a5', fontSize: '0.9rem', textAlign: 'center' }}>
              {realtimeError}
              <br />
              <button onClick={handleRealtimeFallbackToText} style={{ marginTop: '8px', background: 'none', border: '1px solid #94A3B8', borderRadius: '16px', padding: '6px 16px', color: '#94A3B8', fontSize: '0.85rem', cursor: 'pointer' }}>
                Cambiar a modo texto
              </button>
            </div>
          )}
        </div>

        {/* Panel de transcripción */}
        {showRealtimeTranscript && (realtimeUserTranscripts.length > 0 || realtimeAiTranscripts.length > 0 || realtimeAiTranscript) && (
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '0', background: 'linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)', borderTop: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
            <div style={{ position: 'sticky', top: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px 8px', background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.85) 100%)', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transcripción</span>
              </div>
              <button onClick={() => setShowRealtimeTranscript(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 10px', color: '#64748B', cursor: 'pointer', fontSize: '0.7rem', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#94A3B8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748B'; }}
              >Ocultar</button>
            </div>
            <div style={{ padding: '4px 20px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                const allTranscripts = [];
                const maxLen = Math.max(realtimeUserTranscripts.length, realtimeAiTranscripts.length);
                for (let i = 0; i < maxLen; i++) {
                  if (i < realtimeUserTranscripts.length) allTranscripts.push({ type: 'user', text: realtimeUserTranscripts[i], idx: i });
                  if (i < realtimeAiTranscripts.length) allTranscripts.push({ type: 'ai', text: realtimeAiTranscripts[i], idx: i });
                }
                return allTranscripts.map((t, i) => (
                  <div key={`${t.type}-${t.idx}`} style={{ display: 'flex', justifyContent: t.type === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '8px 14px',
                      borderRadius: t.type === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: t.type === 'user' ? 'linear-gradient(135deg, #0E7490 0%, #0891B2 100%)' : 'rgba(255,255,255,0.06)',
                      border: t.type === 'user' ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      fontSize: '0.82rem',
                      lineHeight: '1.4',
                      color: t.type === 'user' ? '#E0F2FE' : '#CBD5E1'
                    }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: t.type === 'user' ? 'rgba(224,242,254,0.6)' : 'rgba(148,163,184,0.7)', display: 'block', marginBottom: '2px' }}>
                        {t.type === 'user' ? 'Tú' : 'MentorIA'}
                      </span>
                      {t.text}
                    </div>
                  </div>
                ));
              })()}
              {realtimeAiTranscript && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '8px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.82rem', lineHeight: '1.4', color: '#94A3B8', fontStyle: 'italic' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(148,163,184,0.7)', display: 'block', marginBottom: '2px' }}>MentorIA</span>
                    {realtimeAiTranscript}<span style={{ animation: 'rtBlink 1s infinite' }}>...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {!showRealtimeTranscript && (realtimeUserTranscripts.length > 0 || realtimeAiTranscripts.length > 0) && (
          <button
            onClick={() => setShowRealtimeTranscript(true)}
            style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(51,65,85,0.95) 100%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', padding: '10px 18px', color: '#94A3B8', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(34,211,238,0.3)'; e.currentTarget.style.color = '#22D3EE'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(8,145,178,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Transcripción
          </button>
        )}

        <style>{`
          @keyframes rtPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
          @keyframes rtSoundWave {
            0%, 100% { transform: scaleY(0.3); }
            50% { transform: scaleY(1); }
          }
          @keyframes rtBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        :root {
          --color-background: #121826;
          --color-surface: #1E293B;
          --color-primary: #0891B2;
          --color-primary-light: #22D3EE;
          --color-user-message: #0E7490;
          --color-text-primary: #F1F5F9;
          --color-text-secondary: #94A3B8;
          --color-accent-red: #F43F5E;
          --font-family: 'Inter', sans-serif;
        }
        body { font-family: var(--font-family); background-color: var(--color-background); color: var(--color-text-primary); overflow: hidden; }
        @keyframes pulseRingAvatar { 0% { transform: scale(0.95); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .messages-container::-webkit-scrollbar { width: 6px; }
        .messages-container::-webkit-scrollbar-track { background: transparent; }
        .messages-container::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
        
        /* RE-INTEGRADO: Animaciones del panel de control del diseño original */
        @keyframes thinking { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
        @keyframes soundWave { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
        @keyframes listeningPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); } 50% { transform: scale(1.1); box-shadow: 0 0 0 20px rgba(244, 63, 94, 0); } }
        @keyframes pulse {
  0%, 100% { 
    opacity: 1; 
    transform: scale(1); 
  }
  50% { 
    opacity: 0.7; 
    transform: scale(1.2); 
  }
}
  @keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
      `}</style>

      <div style={{ height: '100vh', maxHeight: '100vh', background: 'var(--color-background)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
<header className="page-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 25px', zIndex: 1000, background: 'rgba(18, 24, 38, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
  
  {/* Sección Izquierda: Botón Regresar + Avatar */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: '0 0 auto' }}>
    <button onClick={handleGoBack} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', color: 'white', fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}>←</button>
    
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <MentorIAAvatar isSpeaking={isSpeaking} />
      <div style={{ marginLeft: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>MentorIA</h3>
        {documentInfo && <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--color-text-secondary)', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{documentInfo.titulo}</p>}
      </div>
      {documentInfo?.logo && (
        <img src={`https://mentoria.ateneo.co/backend/${documentInfo.logo}`} alt="" style={{ height: '36px', objectFit: 'contain', marginLeft: '12px', flexShrink: 0 }} />
      )}
    </div>
  </div>
  
  {/* Sección Central: Indicador de Modo Activo */}
  <div className="mode-indicator-desktop" style={{ 
    //display: 'flex', 
    alignItems: 'center', 
    gap: '10px',
    padding: '8px 20px',
    borderRadius: '20px',
    background: currentMode === 'consulta' ? 'rgba(8, 145, 178, 0.15)' :
                currentMode === 'consulta_grupo' ? 'rgba(139, 92, 246, 0.15)' :
                currentMode === 'mentor' ? 'rgba(16, 185, 129, 0.15)' :
                'rgba(245, 158, 11, 0.15)',
    border: currentMode === 'consulta' ? '1px solid rgba(34, 211, 238, 0.3)' :
            currentMode === 'consulta_grupo' ? '1px solid rgba(139, 92, 246, 0.3)' :
            currentMode === 'mentor' ? '1px solid rgba(52, 211, 153, 0.3)' :
            '1px solid rgba(251, 191, 36, 0.3)',
    animation: 'slideUp 0.5s ease-out'
  }}>
    <span style={{ fontSize: '1.3rem' }}>
      {currentMode === 'consulta' ? '💬' : currentMode === 'consulta_grupo' ? '👥' : currentMode === 'mentor' ? '👨‍🏫' : '📝'}
    </span>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-secondary)',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Modo Activo
      </span>
      <span style={{
        fontSize: '0.95rem',
        fontWeight: '700',
        color: currentMode === 'consulta' ? '#22D3EE' :
               currentMode === 'consulta_grupo' ? '#A78BFA' :
               currentMode === 'mentor' ? '#34D399' :
               '#FBBF24'
      }}>
        {currentMode === 'consulta' ? 'Consulta' :
         currentMode === 'consulta_grupo' ? 'Grupal' :
         currentMode === 'mentor' ? 'Mentor' :
         'Evaluación'}
      </span>
    </div>
    <span style={{ 
      width: '8px', 
      height: '8px', 
      borderRadius: '50%', 
      background: currentMode === 'consulta' ? '#22D3EE' :
                  currentMode === 'consulta_grupo' ? '#A78BFA' :
                  currentMode === 'mentor' ? '#34D399' :
                  '#FBBF24',
      boxShadow: currentMode === 'consulta' ? '0 0 10px #22D3EE' :
                 currentMode === 'consulta_grupo' ? '0 0 10px #A78BFA' :
                 currentMode === 'mentor' ? '0 0 10px #34D399' :
                 '0 0 10px #FBBF24',
      animation: 'pulse 2s ease-in-out infinite'
    }}></span>
  </div>
  
  {/* Sección Derecha: Botones de Cambio de Modo */}
  <div className="mode-buttons-desktop" style={{ 
    //display: 'flex', 
    gap: '8px', alignItems: 'center', flex: '0 0 auto' }}>
    
    {/* Botón Modo Consulta */}
    <button
      onClick={() => handleModeChange('consulta')}
      disabled={isWaitingForResponse || isSpeaking}
      style={{
        padding: '10px 16px',
        borderRadius: '12px',
        border: currentMode === 'consulta' ? '2px solid #22D3EE' : '2px solid rgba(255, 255, 255, 0.1)',
        background: currentMode === 'consulta' ? 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)' : 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        fontSize: '0.8rem',
        fontWeight: currentMode === 'consulta' ? '600' : '500',
        cursor: (isWaitingForResponse || isSpeaking) ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.3s ease',
        opacity: (isWaitingForResponse || isSpeaking) ? 0.5 : 1,
        boxShadow: currentMode === 'consulta' ? '0 4px 15px rgba(34, 211, 238, 0.4)' : 'none',
        transform: currentMode === 'consulta' ? 'scale(1.05)' : 'scale(1)'
      }}
      title="Consultas libres sobre el contenido"
    >
      <span style={{ fontSize: '1rem' }}>💬</span>
      <span>Consulta</span>
    </button>
    
    {/* Botón Modo Mentor → Navega al Mentor 2.0 */}
    {documentInfo?.modo_mentor !== 0 && parseInt(documentInfo?.modo_mentor) !== 0 && (
    <button
      onClick={() => navigate(`/mentor/${documentId}`)}
      style={{
        padding: '10px 16px',
        borderRadius: '12px',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        fontSize: '0.8rem',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.3s ease'
      }}
      title="Ir al Mentor 2.0 — Video + Quiz + Chat IA"
    >
      <span style={{ fontSize: '1rem' }}>👨‍🏫</span>
      <span>Mentor</span>
    </button>
    )}

    {/* Botón Modo Evaluación */}
    {documentInfo?.modo_evaluacion !== 0 && parseInt(documentInfo?.modo_evaluacion) !== 0 && (
    <button
      onClick={() => handleModeChange('evaluacion')}
      disabled={isWaitingForResponse || isSpeaking}
      style={{
        padding: '10px 16px',
        borderRadius: '12px',
        border: currentMode === 'evaluacion' ? '2px solid #FBBF24' : '2px solid rgba(255, 255, 255, 0.1)',
        background: currentMode === 'evaluacion' ? 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)' : 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        fontSize: '0.8rem',
        fontWeight: currentMode === 'evaluacion' ? '600' : '500',
        cursor: (isWaitingForResponse || isSpeaking) ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.3s ease',
        opacity: (isWaitingForResponse || isSpeaking) ? 0.5 : 1,
        boxShadow: currentMode === 'evaluacion' ? '0 4px 15px rgba(251, 191, 36, 0.4)' : 'none',
        transform: currentMode === 'evaluacion' ? 'scale(1.05)' : 'scale(1)'
      }}
      title="Evalúa tus conocimientos"
    >
      <span style={{ fontSize: '1rem' }}>📝</span>
      <span>Evaluación</span>
    </button>
    )}
  </div> 

  {/* BOTÓN DE MODOS PARA MÓVIL */}
<button 
className="mode-button-mobile"
onClick={() => setShowModeDropdown(prev => !prev)}
>
<span>{currentMode === 'consulta' ? '💬' : currentMode === 'mentor' ? '👨‍🏫' : '📝'}</span>
Modos ▾
</button>

</header>

{/* 🆕 MENÚ DESPLEGABLE DE MODOS PARA MÓVIL */}
{showModeDropdown && (
  <div 
    style={{
      position: 'fixed',
      top: '60px', // Justo debajo del header
      right: '10px',
      background: 'var(--color-surface)',
      borderRadius: '12px',
      padding: '8px',
      zIndex: 9999,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      minWidth: '200px',
      animation: 'slideDown 0.2s ease-out'
    }}
    className="mode-dropdown-mobile"
  >
    {/* Botón Modo Consulta */}
    <button
      onClick={() => {
        handleModeChange('consulta');
        setShowModeDropdown(false);
      }}
      disabled={isWaitingForResponse || isSpeaking}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: 'none',
        background: currentMode === 'consulta' 
          ? 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)' 
          : 'transparent',
        color: 'white',
        fontSize: '0.9rem',
        fontWeight: currentMode === 'consulta' ? '600' : '500',
        cursor: (isWaitingForResponse || isSpeaking) ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.2s ease',
        opacity: (isWaitingForResponse || isSpeaking) ? 0.5 : 1,
        marginBottom: '4px',
        textAlign: 'left'
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>💬</span>
      <span>Modo Consulta</span>
      {currentMode === 'consulta' && (
        <span style={{ marginLeft: 'auto', fontSize: '1rem' }}>✓</span>
      )}
    </button>

    {/* Botón Modo Mentor → Navega al Mentor 2.0 */}
    {documentInfo?.modo_mentor !== 0 && parseInt(documentInfo?.modo_mentor) !== 0 && (
    <button
      onClick={() => {
        setShowModeDropdown(false);
        navigate(`/mentor/${documentId}`);
      }}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'white',
        fontSize: '0.9rem',
        fontWeight: '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.2s ease',
        marginBottom: '4px',
        textAlign: 'left'
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>👨‍🏫</span>
      <span>Modo Mentor</span>
    </button>
    )}

    {/* Botón Modo Evaluación */}
    {documentInfo?.modo_evaluacion !== 0 && parseInt(documentInfo?.modo_evaluacion) !== 0 && (
    <button
      onClick={() => {
        handleModeChange('evaluacion');
        setShowModeDropdown(false);
      }}
      disabled={isWaitingForResponse || isSpeaking}
      style={{
        width: '100%',
        padding: '12px 16px',
        borderRadius: '8px',
        border: 'none',
        background: currentMode === 'evaluacion' 
          ? 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)' 
          : 'transparent',
        color: 'white',
        fontSize: '0.9rem',
        fontWeight: currentMode === 'evaluacion' ? '600' : '500',
        cursor: (isWaitingForResponse || isSpeaking) ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.2s ease',
        opacity: (isWaitingForResponse || isSpeaking) ? 0.5 : 1,
        textAlign: 'left'
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>📝</span>
      <span>Modo Evaluación</span>
      {currentMode === 'evaluacion' && (
        <span style={{ marginLeft: 'auto', fontSize: '1rem' }}>✓</span>
      )}
    </button>
    )}
  </div>
)}

{/* 🆕 OVERLAY PARA CERRAR EL DROPDOWN AL HACER CLICK FUERA */}
{showModeDropdown && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9998
    }}
    onClick={() => setShowModeDropdown(false)}
  />
)}


        <main className="messages-container" style={{ flex: 1, overflowY: 'auto', padding: '110px 20px 120px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
            {messages.map((message, index) => (
              <div key={index} style={{ maxWidth: '85%', margin: '10px 0', alignSelf: message.isUser ? 'flex-end' : 'flex-start', animation: 'slideUp 0.4s ease-out' }}>
                <div style={{ padding: '15px 20px', borderRadius: '18px', lineHeight: 1.6, background: message.isUser ? 'var(--color-user-message)' : 'var(--color-surface)', color: 'var(--color-text-primary)', borderBottomLeftRadius: message.isUser ? '18px' : '4px', borderBottomRightRadius: message.isUser ? '4px' : '18px' }}>
                  <div 
  style={{ wordWrap: 'break-word' }}
  dangerouslySetInnerHTML={{ __html: procesarMarkdown(message.text) }}
/>
                  {message.images && message.images.length > 0 && (
                    <div style={{ marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                      {message.images.map((image, imgIndex) => (
                        <div key={imgIndex} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => setSelectedImage(image)}>
                          <img src={image.public_url} alt={image.titulo} style={{ width: '100%', height: 'auto', display: 'block' }}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isWaitingForResponse && (
              <div style={{ display: 'flex', alignSelf: 'flex-start', margin: '10px 0' }}>
                <div style={{ padding: '15px 20px', background: 'var(--color-surface)', borderRadius: '18px', borderBottomLeftRadius: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', animation: `thinking 1.4s infinite ease-in-out both ${-0.32 + i * 0.16}s` }}></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} style={{ height: '1px' }} />
        </main>

<footer className="page-footer" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(180deg, transparent, rgba(18, 24, 38, 0.9) 50%)', zIndex: 1000 }}>
  <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '15px', padding: '20px' }}>
    
    {/* Panel de control de voz mejorado */}
    <div style={{ width: '56px', height: '56px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {showWaves ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }} onClick={handleVoiceButtonClick}>
          {waveIntensities.map((height, i) => (
            <div key={i} style={{ width: '4px', height: `${height}px`, background: 'var(--color-primary-light)', borderRadius: '2px', animation: `soundWave 0.8s infinite ease-in-out`, animationDelay: `${i * 0.1}s`, transition: 'height 0.1s ease-out' }}></div>
          ))}
        </div>
      ) : isWaitingForResponse ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', animation: `thinking 1.4s infinite ease-in-out both ${-0.32 + i * 0.16}s` }}></div>
          ))}
        </div>
      ) : (
        <button onClick={handleVoiceButtonClick} style={{ width: '56px', height: '56px', borderRadius: '50%', border: 'none', background: isListening ? 'var(--color-accent-red)' : 'var(--color-primary)', color: 'white', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: isListening ? 'listeningPulse 2s infinite' : 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"></path></svg>
        </button>
      )}
    </div>

{/* NUEVO: Botón de detener con función de emergencia */}
{isSpeaking && (
  <button
    onClick={() => {
      console.log("🔴 BOTÓN EMERGENCIA presionado");
      emergencyStopSpeaking();
    }}
    style={{
      padding: '12px 20px',
      background: 'var(--color-accent-red)',
      color: 'white',
      border: 'none',
      borderRadius: '20px',
      fontSize: '0.9rem',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: 'listeningPulse 2s infinite',
      transition: 'all 0.3s ease'
    }}
    title="Detener narración (FORZADO)"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h12v12H6z"/>
    </svg>
    🛑 DETENER
  </button>
)}

    {!isSpeaking && ( <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input type="text" placeholder={isListening ? 'Escuchando...' : 'Escribe tu consulta o presiona el micrófono'} value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyPress={handleKeyPress} disabled={isWaitingForResponse} style={{ width: '100%', padding: '16px 60px 16px 22px', border: '1px solid #334155', borderRadius: '28px', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: '1rem', outline: 'none' }}/>
      <button onClick={handleSendMessage} disabled={isWaitingForResponse || !manualInput.trim()} style={{ position: 'absolute', right: '8px', padding: '8px 16px', border: 'none', borderRadius: '20px', background: 'var(--color-primary)', color: 'white', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.3s ease', opacity: (isWaitingForResponse || !manualInput.trim()) ? 0.5 : 1 }}>Enviar</button>
    </div> )}
  </div>
</footer>

{showWelcomeModal && !isInitializing && (
  <div className="initial-modal">
    <div className="modal-content" style={{ position: 'relative' }}>
      <button
        onClick={handleGoBack}
        style={{
          position: 'absolute', top: '14px', right: '14px',
          width: '34px', height: '34px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.08)',
          color: '#94A3B8', fontSize: '1.3rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s', zIndex: 1, lineHeight: 1, padding: 0
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94A3B8'; }}
        title="Volver a contenidos"
      >&times;</button>
      <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
          <defs><linearGradient id="mChip" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#14b6cb"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient></defs>
          <rect x="22" y="22" width="56" height="56" rx="12" stroke="url(#mChip)" strokeWidth="3" fill="none"/>
          <line x1="38" y1="12" x2="38" y2="22" stroke="#14b6cb" strokeWidth="3" strokeLinecap="round"/>
          <line x1="50" y1="12" x2="50" y2="22" stroke="#14b6cb" strokeWidth="3" strokeLinecap="round"/>
          <line x1="62" y1="12" x2="62" y2="22" stroke="#14b6cb" strokeWidth="3" strokeLinecap="round"/>
          <line x1="38" y1="78" x2="38" y2="88" stroke="#14b6cb" strokeWidth="3" strokeLinecap="round"/>
          <line x1="50" y1="78" x2="50" y2="88" stroke="#14b6cb" strokeWidth="3" strokeLinecap="round"/>
          <line x1="62" y1="78" x2="62" y2="88" stroke="#14b6cb" strokeWidth="3" strokeLinecap="round"/>
          <line x1="12" y1="38" x2="22" y2="38" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          <line x1="12" y1="50" x2="22" y2="50" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          <line x1="78" y1="50" x2="88" y2="50" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          <line x1="78" y1="62" x2="88" y2="62" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="50" cy="50" r="6" fill="#14b6cb"/><circle cx="50" cy="50" r="3" fill="#fff"/>
        </svg>
        Asistente MentorIA
      </h2>
      <p>Selecciona cómo deseas comenzar tu sesión de aprendizaje:</p>
      
      <div className="mode-selection-container">

        {/* Botón Modo Consulta con sub-opciones */}
        {documentInfo?.modo_consulta !== 0 && parseInt(documentInfo?.modo_consulta) !== 0 && (
          showConsultaSubmodes ? (
            <>
              <button
                className="mode-button consulta"
                onClick={() => startFirstInteraction('consulta')}
              >
                <div className="mode-button-icon">🧑</div>
                <div className="mode-button-content">
                  <h3>Conversación 1 a 1</h3>
                  <p>Habla directamente con MentorIA. Ideal para resolver dudas específicas.</p>
                </div>
              </button>
              <button
                className="mode-button consulta"
                onClick={() => startFirstInteraction('consulta_grupo')}
                style={{ borderColor: '#8B5CF6' }}
              >
                <div className="mode-button-icon">👥</div>
                <div className="mode-button-content">
                  <h3>Modo Grupal</h3>
                  <p>MentorIA escucha la reunión y solo responde cuando la invocan por nombre.</p>
                </div>
              </button>
              <button
                onClick={() => setShowConsultaSubmodes(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.8rem', cursor: 'pointer', padding: '4px 0', textAlign: 'center' }}
              >
                ← Volver
              </button>
            </>
          ) : (
            <button
              className="mode-button consulta"
              onClick={() => setShowConsultaSubmodes(true)}
            >
              <div className="mode-button-icon">💬</div>
              <div className="mode-button-content">
                <h3>Modo Consulta</h3>
                <p>Haz preguntas libres sobre el contenido. Ideal para resolver dudas específicas.</p>
              </div>
            </button>
          )
        )}

        {/* Botón Modo Mentor → Navega al Mentor 2.0 */}
        {documentInfo?.modo_mentor !== 0 && parseInt(documentInfo?.modo_mentor) !== 0 && (
        <button
          className="mode-button mentor"
          onClick={() => navigate(`/mentor/${documentId}`)}
        >
          <div className="mode-button-icon">👨‍🏫</div>
          <div className="mode-button-content">
            <h3>Modo Mentor</h3>
            <p>Aprendizaje guiado con video, quiz y chat IA integrado.</p>
          </div>
        </button>
        )}

        {/* Botón Modo Evaluación */}
        {documentInfo?.modo_evaluacion !== 0 && parseInt(documentInfo?.modo_evaluacion) !== 0 && (
        <button
          className="mode-button evaluacion"
          onClick={() => startFirstInteraction('evaluacion')}
        >
          <div className="mode-button-icon">📝</div>
          <div className="mode-button-content">
            <h3>Modo Evaluación</h3>
            <p>Pon a prueba tus conocimientos con preguntas sobre el material.</p>
          </div>
        </button>
        )}

        {/* Botón Modo Reto */}
        {documentInfo?.modo_reto !== 0 && parseInt(documentInfo?.modo_reto) !== 0 && (
        <button
          className={`mode-button reto ${!retoState.tieneRetoPendiente ? 'disabled' : ''}`}
          onClick={() => retoState.tieneRetoPendiente && startFirstInteraction('reto')}
          disabled={!retoState.tieneRetoPendiente || retoState.cargando}
        >
          <div className="mode-button-icon">🎯</div>
          <div className="mode-button-content">
            <h3>Reto Semanal</h3>
            {retoState.cargando ? (
              <p>Cargando...</p>
            ) : retoState.tieneRetoPendiente ? (
              <p>¡Tienes un reto pendiente! Demuestra lo que has aprendido.</p>
            ) : retoState.retoCompletado ? (
              <p>¡Ya completaste el reto! Próximo: {retoState.proximoReto?.dia}</p>
            ) : (
              <p>Próximo reto: {retoState.proximoReto?.dia || 'Lunes o Jueves'}</p>
            )}
          </div>
          {!retoState.tieneRetoPendiente && !retoState.cargando && (
            <div className="mode-button-badge">
              {retoState.retoCompletado ? '✓' : '🔒'}
            </div>
          )}
        </button>
        )}

      </div>

      {/* Info: Todos los modos inician en realtime si el navegador lo soporta */}
      {isRealtimeSupported() && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: '#22D3EE', margin: 0 }}>
            &#127908; Conversacion por voz en tiempo real activada
          </p>
        </div>
      )}

      {/* Enlace para cambiar a vista iOS */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--color-border, rgba(255,255,255,0.1))',
        textAlign: 'center'
      }}>
        <button
          onClick={() => {
            const currentPath = window.location.pathname;
            window.location.href = currentPath + '?forceios=1';
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary, #888)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#007AFF';
            e.currentTarget.style.background = 'rgba(0, 122, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary, #888)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 814 1000" fill="currentColor"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.8-155.5-127.4c-58.8-82-109.5-209.7-109.5-332 0-195.6 127.1-299.4 252.1-299.4 66.5 0 121.8 43.7 163.5 43.7 39.5 0 101.1-46.4 175.6-46.4 28.4 0 130.3 2.6 197.9 99.5z"/><path d="M554.1 159.4c31.2-36.9 53.1-88.1 53.1-139.4 0-7.1-.6-14.3-1.9-20-50.6 1.9-110.8 33.7-147.1 75.8-28.4 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 103.3-30.4 135.5-71.3z"/></svg>
          ¿Usas iPhone o iPad? Cambiar a vista iOS
        </button>
      </div>
    </div>
  </div>
)}
        {selectedImage && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, backdropFilter: 'blur(10px)' }} onClick={() => setSelectedImage(null)}><div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%', background: 'var(--color-surface)', borderRadius: '20px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}><img src={selectedImage.public_url} alt={selectedImage.titulo} style={{ width: '100%', height: 'auto', maxHeight: '90vh', display: 'block' }}/><button onClick={() => setSelectedImage(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button></div></div>}
      
      {/* Botón flotante de calibración */}
<button
  onClick={handleToggleCalibration}
  title="Calibrar micrófono"
  className="calibration-button"
  
  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
>
  🎚️
</button>

{/* Modal de calibración */}
{showCalibration && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease'
    }}
    onClick={handleToggleCalibration}
  >
    <div
      style={{
        maxWidth: '500px',
        width: '100%',
        animation: 'slideUp 0.3s ease'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <AudioCalibration onClose={handleToggleCalibration} />
    </div>
  </div>
)}

        {/* --- INICIO: FASE 6 --- */}
        {/* AGREGAR antes del cierre del return principal (línea 400+) */}
    {showVideoPopup && currentVideoData && (
        <VideoMentorPopup
            isOpen={showVideoPopup}
            onClose={handleCloseVideo}
            videoData={currentVideoData}
            onProgress={handleVideoProgress}
            onComplete={handleVideoComplete}
            documentId={documentId}
            sessionToken={sessionToken}
            allowSeek={allowSeek} // Modo repaso: permite adelantar/retroceder
            voiceHook={{ speak, startListening, stopListening, stopSpeaking, isListening, isSpeaking, transcript, resetTranscript }}
        />
    )}
        {/* --- FIN: FASE 6 --- */}
        
        {/* --- NUEVO: Panel Lateral de Acceso Rápido (Desktop >= 1024px) --- */}
        {!isInitializing && !showWelcomeModal && (
          <QuickAccessPanel
            currentMode={currentMode}
            documentId={documentId}
            sessionToken={sessionToken}
            userId={user?.id}
            onQuestionClick={handleQuickQuestionClick}
            onLessonClick={handleLessonClick}
            evaluationState={evaluationState}
            mentorProgressVersion={mentorProgressVersion}
          />
        )}
        {/* --- FIN: Panel Lateral Desktop --- */}

        {/* --- NUEVO: Drawer Móvil para Sidebar (< 1024px) --- */}
        {!isInitializing && !showWelcomeModal && (
          <MobileSidebarDrawer currentMode={currentMode}>
            {currentMode === 'consulta' && (
              <>
                <h4 style={{ color: '#F1F5F9', marginBottom: '16px' }}>⚡ Preguntas Frecuentes</h4>
                <QuickQuestions
                  documentId={documentId}
                  sessionToken={sessionToken}
                  onQuestionClick={handleQuickQuestionClick}
                />
              </>
            )}
            {currentMode === 'mentor' && (
              <>
                <h4 style={{ color: '#F1F5F9', marginBottom: '16px' }}>🌲 Progreso del Programa</h4>
                <MentorProgressPanel
                  documentId={documentId}
                  userId={user?.id}
                  refreshKey={mentorProgressVersion}
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
        )}
        {/* --- FIN: Drawer Móvil --- */}
        
      </div>
    </>
  );
};

export default ConsultaAsistentePage;