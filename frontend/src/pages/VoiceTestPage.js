import React, { useState, useEffect } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
`;

const Title = styled.h1`
  margin-bottom: 1.5rem;
  color: #2c3e50;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h2`
  margin-bottom: 1rem;
  color: #3498db;
`;

const Button = styled.button`
  background-color: ${props => props.active ? '#e74c3c' : '#3498db'};
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  margin-right: 1rem;
  margin-bottom: 1rem;
  font-weight: 500;
  cursor: pointer;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-family: inherit;
  font-size: 1rem;
`;

const TextDisplay = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  min-height: 100px;
`;

const Status = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
`;

const StatusIndicator = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${props => props.active ? '#2ecc71' : '#95a5a6'};
  margin-right: 0.5rem;
`;

const StatusText = styled.span`
  font-size: 0.9rem;
  color: #7f8c8d;
`;

const LogContainer = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.75rem;
  background-color: #f8f9fa;
  margin-top: 1rem;
`;

const LogEntry = styled.div`
  font-family: monospace;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #eee;
`;

const ErrorMessage = styled.div`
  color: #e74c3c;
  margin-bottom: 1rem;
`;

const VoiceTestPage = () => {
    const {
        isListening,
        isSpeaking,
        transcript,
        error,
        startListening,
        stopListening,
        speak,
        interpretCommand,
        stopSpeaking,
        cleanup
    } = useVoice();
    
    const [textToSpeak, setTextToSpeak] = useState('Hola, soy el asistente de voz de VoiceMed.');
    const [logs, setLogs] = useState([]);
    const [commandResult, setCommandResult] = useState(null);
    
    // Función para añadir logs
    const addLog = (message) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
    };
    
    // Manejar el inicio del reconocimiento
    const handleStartListening = () => {
        addLog('Iniciando reconocimiento de voz...');
        startListening((text) => {
            addLog(`Texto reconocido: "${text}"`);
            // Aquí puedes procesar el comando si quieres
        });
    };
    
    // Manejar la ejecución de comandos
    const handleExecuteCommand = async () => {
        if (!transcript) {
            addLog('No hay texto para ejecutar');
            return;
        }
        
        addLog(`Interpretando comando: "${transcript}"`);
        
        try {
            const command = await interpretCommand(transcript);
            setCommandResult(command);
            
            if (command) {
                addLog(`Comando interpretado: ${JSON.stringify(command)}`);
                
                // Generar respuesta basada en el comando
                let response;
                
                switch (command.action) {
                    case 'navigate':
                        response = `Navegando a ${command.destination || 'la página solicitada'}`;
                        break;
                    case 'start_narration':
                        response = 'Iniciando narración de la lección';
                        break;
                    case 'stop_narration':
                        response = 'Deteniendo narración';
                        break;
                    case 'help':
                        response = 'Puedo ayudarte a navegar por los cursos, reproducir lecciones o responder preguntas.';
                        break;
                    default:
                        response = 'Comando no reconocido. Puedes decir "ayuda" para ver las opciones disponibles.';
                        break;
                }
                
                addLog(`Respuesta: "${response}"`);
                await speak(response);
            } else {
                addLog('No se pudo interpretar el comando');
            }
        } catch (err) {
            addLog(`Error al interpretar: ${err.message}`);
        }
    };
    
    // Manejar botón de hablar
// Modificar la función handleSpeak
const handleSpeak = async () => {
    if (!textToSpeak.trim()) return;
    
    addLog(`Hablando: "${textToSpeak}"`);
    
    try {
      // Usar la configuración por defecto del sistema
      await speak(textToSpeak);
      addLog('Reproducción finalizada');
    } catch (err) {
      addLog(`Error al hablar: ${err.message}`);
    }
  };
    
    // Manejar errores
    useEffect(() => {
        if (error) {
            addLog(`Error: ${error}`);
        }
    }, [error]);
    
    // Limpiar al desmontar
    useEffect(() => {
        addLog('Página de prueba de voz cargada');
        
        return () => {
            cleanup();
        };
    }, [cleanup]);
    
    return (
        <Container>
            <Title>Prueba de Reconocimiento y Síntesis de Voz</Title>
            
            <Card>
                <CardTitle>Reconocimiento de Voz</CardTitle>
                <Status>
                    <StatusIndicator active={isListening} />
                    <StatusText>{isListening ? 'Escuchando...' : 'Inactivo'}</StatusText>
                </Status>
                
                <Button onClick={handleStartListening} disabled={isListening}>
                    Iniciar Reconocimiento
                </Button>
                <Button onClick={stopListening} disabled={!isListening}>
                    Detener
                </Button>
                
                <h3>Texto reconocido:</h3>
                <TextDisplay>
                    {transcript || 'Aquí aparecerá el texto reconocido...'}
                </TextDisplay>
                
                <Button onClick={handleExecuteCommand} disabled={!transcript || isListening || isSpeaking}>
                    Ejecutar como Comando
                </Button>
                
                {error && <ErrorMessage>{error}</ErrorMessage>}
            </Card>
            
            <Card>
                <CardTitle>Resultado del Comando</CardTitle>
                <TextDisplay>
                    {commandResult ? (
                        <pre>{JSON.stringify(commandResult, null, 2)}</pre>
                    ) : (
                        'Aquí aparecerá el resultado del comando...'
                    )}
                </TextDisplay>
            </Card>
            
            <Card>
                <CardTitle>Síntesis de Voz</CardTitle>
                <Status>
                    <StatusIndicator active={isSpeaking} />
                    <StatusText>{isSpeaking ? 'Hablando...' : 'Inactivo'}</StatusText>
                </Status>
                
                <TextArea
                    value={textToSpeak}
                    onChange={e => setTextToSpeak(e.target.value)}
                    placeholder="Escribe algo para sintetizar..."
                    disabled={isSpeaking}
                />
                
                <Button onClick={handleSpeak} disabled={isSpeaking || !textToSpeak.trim()}>
                    Hablar
                </Button>
                <Button onClick={stopSpeaking} disabled={!isSpeaking}>
                    Detener
                </Button>
            </Card>
            
            <Card>
                <CardTitle>Registro de Actividad</CardTitle>
                <LogContainer>
                    {logs.map((log, index) => (
                        <LogEntry key={index}>{log}</LogEntry>
                    ))}
                </LogContainer>
            </Card>
        </Container>
    );
};

export default VoiceTestPage;