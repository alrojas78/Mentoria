// src/pages/VoiceTestiPhone.js
// Página de Testing AISLADA para reconocimiento de voz en iPhone

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './VoiceTestiPhone.css';

// Detector de dispositivo simple (sin dependencias)
const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  return isIOS && isSafari;
};

const VoiceTestiPhone = () => {
  const navigate = useNavigate();
  
  // Estados
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState({});
  
  // Referencias
  const recognitionRef = useRef(null);
  const logsEndRef = useRef(null);
  
  // Agregar log
  const addLog = (type, message, data = {}) => {
    const timestamp = new Date().toLocaleTimeString('es-ES', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const logEntry = {
      timestamp,
      type,
      message,
      data,
      id: Date.now() + Math.random()
    };
    
    setLogs(prev => [logEntry, ...prev]);
    console.log(`[${timestamp}] ${type}: ${message}`, data);
  };
  
  // Auto-scroll de logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = 0;
    }
  }, [logs]);
  
  // Detectar dispositivo al cargar
  useEffect(() => {
    const info = {
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
      isIOSSafari: isIOSSafari(),
      platform: navigator.platform,
      userAgent: navigator.userAgent
    };
    setDeviceInfo(info);
    addLog('INFO', 'Página cargada', info);
    
    // Verificar soporte
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addLog('ERROR', 'SpeechRecognition NO disponible en este navegador');
    } else {
      addLog('SUCCESS', 'SpeechRecognition disponible ✅');
    }
  }, []);
  
  // Función para iniciar reconocimiento
  const startListening = () => {
    if (isListening) {
      addLog('WARNING', 'Ya está escuchando');
      return;
    }
    
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      const isIOS = isIOSSafari();
      
      // Configuración adaptativa
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = isIOS ? true : false; // iOS necesita true
      recognition.maxAlternatives = isIOS ? 1 : 3;
      
      addLog('CONFIG', 'Configuración aplicada', {
        lang: 'es-ES',
        continuous: false,
        interimResults: recognition.interimResults,
        maxAlternatives: recognition.maxAlternatives,
        isIOSSafari: isIOS
      });
      
      // Variable para acumular en iOS
      let accumulatedTranscript = '';
      let lastFinalTranscript = '';
      
      // Event: onstart
      recognition.onstart = () => {
        addLog('START', 'Reconocimiento INICIADO ✅');
        setIsListening(true);
        accumulatedTranscript = '';
        lastFinalTranscript = '';
      };
      
      // Event: onresult
      recognition.onresult = (event) => {
        if (event.results && event.results[0]) {
          const result = event.results[0];
          const text = result[0].transcript;
          const confidence = result[0].confidence;
          const isFinal = result.isFinal;
          
          addLog(
            isFinal ? 'FINAL' : 'PARTIAL',
            isFinal ? 'Texto FINAL reconocido' : 'Texto PARCIAL reconocido',
            {
              text,
              confidence: (confidence * 100).toFixed(1) + '%',
              isFinal,
              alternatives: result.length,
              isIOSSafari: isIOS
            }
          );
          
          if (isIOS) {
            // iOS: Acumular resultados
            if (isFinal) {
              if (text.trim() && text !== lastFinalTranscript) {
                accumulatedTranscript = accumulatedTranscript 
                  ? accumulatedTranscript + ' ' + text.trim() 
                  : text.trim();
                lastFinalTranscript = text;
                
                addLog('INFO', '🍎 iOS - Texto acumulado', {
                  accumulated: accumulatedTranscript,
                  newText: text
                });
              }
              
              // Actualizar con lo acumulado
              setTranscript(accumulatedTranscript || text);
              
              // Agregar a lista de finales
              setFinalTranscripts(prev => [{
                text: accumulatedTranscript || text,
                confidence,
                timestamp: new Date().toLocaleTimeString()
              }, ...prev]);
            }
          } else {
            // Android/PC: Normal
            setTranscript(text);
            
            if (isFinal) {
              setFinalTranscripts(prev => [{
                text,
                confidence,
                timestamp: new Date().toLocaleTimeString()
              }, ...prev]);
            }
          }
        }
      };
      
      // Event: onerror
      recognition.onerror = (event) => {
        addLog('ERROR', 'Error en reconocimiento', {
          error: event.error,
          message: event.message
        });
        
        setIsListening(false);
      };
      
      // Event: onend
      recognition.onend = () => {
        addLog('END', 'Reconocimiento FINALIZADO', {
          isIOSSafari: isIOS,
          hadAccumulatedText: !!accumulatedTranscript
        });
        
        // iOS: Procesar texto acumulado
        if (isIOS && accumulatedTranscript) {
          addLog('INFO', '🍎 iOS - Procesando texto acumulado al finalizar', {
            text: accumulatedTranscript
          });
        }
        
        setIsListening(false);
        recognitionRef.current = null;
      };
      
      // Iniciar
      addLog('ACTION', 'Llamando a recognition.start()');
      recognition.start();
      recognitionRef.current = recognition;
      
    } catch (error) {
      addLog('ERROR', 'Error al iniciar reconocimiento', {
        error: error.message
      });
    }
  };
  
  // Función para detener reconocimiento
  const stopListening = () => {
    if (recognitionRef.current) {
      addLog('ACTION', 'Deteniendo reconocimiento manualmente');
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };
  
  // Función para limpiar todo
  const clearAll = () => {
    setTranscript('');
    setFinalTranscripts([]);
    setLogs([]);
    addLog('ACTION', 'Todo limpiado');
  };
  
  // Función para exportar logs
  const exportLogs = () => {
    const logData = {
      deviceInfo,
      timestamp: new Date().toISOString(),
      logs: logs.reverse(),
      finalTranscripts
    };
    
    const dataStr = JSON.stringify(logData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voice-test-iphone-${Date.now()}.json`;
    link.click();
    
    addLog('SUCCESS', 'Logs exportados exitosamente');
  };
  
  return (
    <div className="voice-test-container">
      {/* Header */}
      <div className="test-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Volver
        </button>
        <h1>🎤 Test de Voz iPhone</h1>
        <button onClick={exportLogs} className="export-button">
          💾 Exportar
        </button>
      </div>
      
      {/* Device Info */}
      <div className="device-info-card">
        <h3>📱 Información del Dispositivo</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">iOS:</span>
            <span className={deviceInfo.isIOS ? 'badge-success' : 'badge-error'}>
              {deviceInfo.isIOS ? '✅ Sí' : '❌ No'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Safari:</span>
            <span className={deviceInfo.isSafari ? 'badge-success' : 'badge-error'}>
              {deviceInfo.isSafari ? '✅ Sí' : '❌ No'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">iOS Safari:</span>
            <span className={deviceInfo.isIOSSafari ? 'badge-success' : 'badge-error'}>
              {deviceInfo.isIOSSafari ? '✅ Sí' : '❌ No'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="test-content">
        
        {/* Panel Izquierdo: Transcripción */}
        <div className="transcript-panel">
          <div className="panel-header">
            <h3>📝 Transcripción en Tiempo Real</h3>
            <div className="status-indicator">
              <div className={`status-dot ${isListening ? 'listening' : ''}`}></div>
              <span>{isListening ? 'Escuchando...' : 'Inactivo'}</span>
            </div>
          </div>
          
          {/* Botones de Control */}
          <div className="control-buttons">
            <button 
              onClick={startListening} 
              disabled={isListening}
              className="btn-start"
            >
              🎤 Empezar a Escuchar
            </button>
            <button 
              onClick={stopListening} 
              disabled={!isListening}
              className="btn-stop"
            >
              ⏹️ Detener
            </button>
            <button 
              onClick={clearAll}
              className="btn-clear"
            >
              🗑️ Limpiar
            </button>
          </div>
          
          {/* Transcript Actual */}
          <div className="current-transcript">
            <h4>Texto Actual:</h4>
            <div className="transcript-box">
              {transcript || 'Presiona "Empezar a Escuchar" y habla...'}
            </div>
          </div>
          
          {/* Transcripts Finales */}
          <div className="final-transcripts">
            <h4>Textos Finalizados ({finalTranscripts.length}):</h4>
            <div className="transcripts-list">
              {finalTranscripts.length === 0 ? (
                <div className="empty-message">
                  Aún no hay transcripciones finalizadas
                </div>
              ) : (
                finalTranscripts.map((item, index) => (
                  <div key={index} className="transcript-item">
                    <div className="transcript-header">
                      <span className="transcript-time">{item.timestamp}</span>
                      <span className="transcript-confidence">
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="transcript-text">{item.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Panel Derecho: Logs */}
        <div className="logs-panel">
          <div className="panel-header">
            <h3>📋 Logs en Tiempo Real</h3>
            <span className="log-count">{logs.length} eventos</span>
          </div>
          
          <div className="logs-container" ref={logsEndRef}>
            {logs.map((log) => (
              <div key={log.id} className={`log-entry log-${log.type.toLowerCase()}`}>
                <div className="log-header">
                  <span className="log-time">{log.timestamp}</span>
                  <span className={`log-type badge-${log.type.toLowerCase()}`}>
                    {log.type}
                  </span>
                </div>
                <div className="log-message">{log.message}</div>
                {Object.keys(log.data).length > 0 && (
                  <div className="log-data">
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
      </div>
      
      {/* Footer Instructions */}
      <div className="instructions-footer">
        <h4>📌 Instrucciones:</h4>
        <ol>
          <li>Presiona "Empezar a Escuchar" 🎤</li>
          <li>Habla claramente en español 🗣️</li>
          <li>Observa la transcripción en tiempo real 👀</li>
          <li>Repite VARIAS VECES (3-5 veces) para ver el patrón 🔄</li>
          <li>Exporta los logs y compártelos 💾</li>
        </ol>
      </div>
    </div>
  );
};

export default VoiceTestiPhone;