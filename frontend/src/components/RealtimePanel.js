// components/RealtimePanel.js
// Panel de conversación Realtime bidireccional (OpenAI Realtime API)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeSession, SESSION_STATES, isRealtimeSupported } from '../services/realtimeService';

const RealtimePanel = ({ documentId, mode, documentInfo, onFallbackToText, onGoBack }) => {
  const [sessionState, setSessionState] = useState(SESSION_STATES.DISCONNECTED);
  const [userTranscripts, setUserTranscripts] = useState([]);
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiTranscripts, setAiTranscripts] = useState([]);
  const [error, setError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [sessionDuration, setSessionDuration] = useState(0);

  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  const aiTranscriptBuffer = useRef('');

  // Verificar soporte
  useEffect(() => {
    if (!isRealtimeSupported()) {
      setError('Tu navegador no soporta conversación en tiempo real. Usa el modo texto.');
    }
  }, []);

  // Timer de duración de sesión
  useEffect(() => {
    if (sessionState === SESSION_STATES.CONNECTED || sessionState === SESSION_STATES.LISTENING || sessionState === SESSION_STATES.AI_SPEAKING) {
      timerRef.current = setInterval(() => {
        setSessionDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sessionState]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, []);

  const handleConnect = useCallback(async () => {
    setError('');
    setUserTranscripts([]);
    setAiTranscripts([]);
    setAiTranscript('');
    setSessionDuration(0);
    aiTranscriptBuffer.current = '';

    const session = new RealtimeSession({
      documentId,
      mode,
      onStateChange: (state) => setSessionState(state),
      onTranscript: (text) => {
        setUserTranscripts(prev => [...prev, text]);
      },
      onAITranscript: (text, isDone) => {
        if (isDone) {
          setAiTranscripts(prev => [...prev, text]);
          setAiTranscript('');
          aiTranscriptBuffer.current = '';
        } else {
          aiTranscriptBuffer.current += text;
          setAiTranscript(aiTranscriptBuffer.current);
        }
      },
      onError: (msg) => setError(msg),
      onAudioLevel: (level) => setAudioLevel(level)
    });

    sessionRef.current = session;
    await session.connect();
  }, [documentId, mode]);

  const handleDisconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.disconnect();
      sessionRef.current = null;
    }
  }, []);

  const handleInterrupt = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.interrupt();
    }
  }, []);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isActive = sessionState === SESSION_STATES.CONNECTED || sessionState === SESSION_STATES.LISTENING || sessionState === SESSION_STATES.AI_SPEAKING;
  const isConnecting = sessionState === SESSION_STATES.CONNECTING;

  // Indicador visual del estado
  const getStateInfo = () => {
    switch (sessionState) {
      case SESSION_STATES.DISCONNECTED: return { label: 'Desconectado', color: '#6b7280', icon: '⏸' };
      case SESSION_STATES.CONNECTING: return { label: 'Conectando...', color: '#f59e0b', icon: '🔄' };
      case SESSION_STATES.CONNECTED: return { label: 'Listo — habla para comenzar', color: '#10b981', icon: '🎙' };
      case SESSION_STATES.LISTENING: return { label: 'Escuchando...', color: '#ef4444', icon: '🔴' };
      case SESSION_STATES.AI_SPEAKING: return { label: 'MentorIA respondiendo...', color: '#0891B2', icon: '🤖' };
      case SESSION_STATES.ERROR: return { label: 'Error', color: '#ef4444', icon: '⚠' };
      default: return { label: '', color: '#6b7280', icon: '' };
    }
  };

  const stateInfo = getStateInfo();

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#121826',
      color: '#F1F5F9',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '15px 25px',
        background: 'rgba(18, 24, 38, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={isActive ? handleDisconnect : onGoBack} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: '40px', height: '40px', color: 'white', fontSize: '1.2rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {isActive ? '✕' : '←'}
          </button>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>MentorIA Realtime</h3>
            {documentInfo && <p style={{ margin: 0, fontSize: '0.7rem', color: '#94A3B8' }}>{documentInfo.titulo}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isActive && (
            <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>{formatDuration(sessionDuration)}</span>
          )}
          <button onClick={onFallbackToText} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px', padding: '6px 14px', color: '#94A3B8', fontSize: '0.8rem',
            cursor: 'pointer'
          }}>
            Modo Texto
          </button>
        </div>
      </header>

      {/* Zona central */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '2rem', overflow: 'hidden' }}>

        {/* Estado visual */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '160px', height: '160px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
            background: isActive
              ? `radial-gradient(circle, ${stateInfo.color}22 0%, transparent 70%)`
              : 'rgba(255,255,255,0.03)',
            border: `3px solid ${stateInfo.color}`,
            transition: 'all 0.5s ease',
            animation: sessionState === SESSION_STATES.LISTENING ? 'pulse 1.5s infinite' :
                       sessionState === SESSION_STATES.AI_SPEAKING ? 'pulse 2s infinite' : 'none'
          }}>
            {/* Ondas de audio para listening */}
            {sessionState === SESSION_STATES.LISTENING && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '80px' }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{
                    width: '6px',
                    backgroundColor: '#ef4444',
                    borderRadius: '3px',
                    height: `${20 + audioLevel * 300 + Math.sin(Date.now()/200 + i) * 15}px`,
                    maxHeight: '70px',
                    transition: 'height 0.1s ease'
                  }} />
                ))}
              </div>
            )}
            {/* Icono para AI speaking */}
            {sessionState === SESSION_STATES.AI_SPEAKING && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '80px' }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{
                    width: '6px',
                    backgroundColor: '#0891B2',
                    borderRadius: '3px',
                    animation: `soundWave 0.8s ${i * 0.15}s ease-in-out infinite`,
                    height: '40px'
                  }} />
                ))}
              </div>
            )}
            {/* Icono conectado (idle) */}
            {sessionState === SESSION_STATES.CONNECTED && (
              <span style={{ fontSize: '3rem' }}>🎙</span>
            )}
            {/* Icono desconectado */}
            {sessionState === SESSION_STATES.DISCONNECTED && (
              <span style={{ fontSize: '3rem', opacity: 0.4 }}>🎙</span>
            )}
            {/* Icono conectando */}
            {sessionState === SESSION_STATES.CONNECTING && (
              <span style={{ fontSize: '2.5rem', animation: 'pulse 1s infinite' }}>🔄</span>
            )}
          </div>

          <p style={{ marginTop: '1rem', color: stateInfo.color, fontSize: '1rem', fontWeight: 500 }}>
            {stateInfo.label}
          </p>
        </div>

        {/* Botón principal */}
        {!isActive && !isConnecting && (
          <button
            onClick={handleConnect}
            disabled={!!error && !isRealtimeSupported()}
            style={{
              background: 'linear-gradient(135deg, #0891B2, #06b6d4)',
              border: 'none', borderRadius: '50px',
              padding: '18px 48px',
              color: 'white', fontSize: '1.1rem', fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(8, 145, 178, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            Iniciar conversacion
          </button>
        )}

        {/* Botón interrumpir */}
        {sessionState === SESSION_STATES.AI_SPEAKING && (
          <button onClick={handleInterrupt} style={{
            background: 'rgba(244, 63, 94, 0.15)', border: '1px solid #F43F5E',
            borderRadius: '50px', padding: '12px 32px',
            color: '#F43F5E', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer'
          }}>
            Interrumpir
          </button>
        )}

        {/* Botón desconectar */}
        {isActive && (
          <button onClick={handleDisconnect} style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '50px', padding: '10px 28px',
            color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer'
          }}>
            Finalizar sesion
          </button>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px', padding: '12px 20px', maxWidth: '500px',
            color: '#fca5a5', fontSize: '0.9rem', textAlign: 'center'
          }}>
            {error}
            <br />
            <button onClick={onFallbackToText} style={{
              marginTop: '8px', background: 'none', border: '1px solid #94A3B8',
              borderRadius: '16px', padding: '6px 16px', color: '#94A3B8',
              fontSize: '0.85rem', cursor: 'pointer'
            }}>
              Cambiar a modo texto
            </button>
          </div>
        )}
      </div>

      {/* Panel de transcripción */}
      {showTranscript && (userTranscripts.length > 0 || aiTranscripts.length > 0 || aiTranscript) && (
        <div style={{
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '12px 20px',
          background: 'rgba(30, 41, 59, 0.8)',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>Transcripcion</span>
            <button onClick={() => setShowTranscript(false)} style={{
              background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '0.8rem'
            }}>Ocultar</button>
          </div>
          {userTranscripts.map((t, i) => (
            <p key={`u-${i}`} style={{ margin: '4px 0', fontSize: '0.85rem', color: '#22D3EE' }}>
              <strong>Tu:</strong> {t}
            </p>
          ))}
          {aiTranscripts.map((t, i) => (
            <p key={`a-${i}`} style={{ margin: '4px 0', fontSize: '0.85rem', color: '#94A3B8' }}>
              <strong>MentorIA:</strong> {t}
            </p>
          ))}
          {aiTranscript && (
            <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#94A3B8', fontStyle: 'italic' }}>
              <strong>MentorIA:</strong> {aiTranscript}...
            </p>
          )}
        </div>
      )}

      {/* Botón para mostrar transcripción si está oculta */}
      {!showTranscript && (userTranscripts.length > 0 || aiTranscripts.length > 0) && (
        <button onClick={() => setShowTranscript(true)} style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px', padding: '8px 16px', color: '#94A3B8',
          fontSize: '0.8rem', cursor: 'pointer'
        }}>
          Mostrar transcripcion
        </button>
      )}

      {/* Estilos de animación */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes soundWave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
};

export default RealtimePanel;
