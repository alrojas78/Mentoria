// Actualizar VoiceAssistantToggle.js
import React, { useEffect } from 'react';
import { useVoice } from '../contexts/VoiceContext';
import { useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { FaMicrophoneAlt, FaVolumeUp } from 'react-icons/fa';

const pulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(43, 67, 97, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(43, 67, 97, 0);
  }
`;

const ToggleButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #2b4361;
  color: white;
  border: none;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
  animation: ${props => props.speaking ? pulse : 'none'} 1.8s infinite;
`;

const MicIcon = styled.span`
  font-size: 24px;
`;

const VoiceAssistantToggle = () => {
  const {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    transcript
  } = useVoice();

  const location = useLocation();

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        console.log("API de reconocimiento de voz disponible");
        startListening((text) => {
          const event = new CustomEvent('voiceCommand', {
            detail: { transcript: text }
          });
          window.dispatchEvent(event);
        });
      } else {
        alert("Este navegador no soporta reconocimiento de voz o necesita permisos. Por favor, actívalos en los ajustes del navegador.");
      }
    }
  };
  

  useEffect(() => {
    if (transcript && !isListening) {
      console.log("Comando de voz detectado:", transcript);
    }
  }, [transcript, isListening]);

  return (
    <ToggleButton onClick={handleToggle} speaking={isSpeaking}>
      <MicIcon>{isSpeaking ? <FaVolumeUp /> : <FaMicrophoneAlt />}</MicIcon>
    </ToggleButton>
  );
};

export default VoiceAssistantToggle;
