// src/components/SpeechProgressIndicator.js
import React from 'react';
import { useVoice } from '../contexts/VoiceContext';
import styled, { keyframes } from 'styled-components';

const pulseAnimation = keyframes`
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(43, 67, 97, 0.7);
  }
  
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(43, 67, 97, 0);
  }
  
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(43, 67, 97, 0);
  }
`;

const Container = styled.div`
  position: fixed;
  bottom: 100px;
  right: 20px;
  display: ${props => props.visible ? 'flex' : 'none'};
  align-items: center;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  pointer-events: none;
`;

const VoiceIndicator = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: #2b4361;
  margin-right: 12px;
  animation: ${pulseAnimation} 1.5s infinite;
`;

const StatusText = styled.div`
  font-size: 14px;
  color: #333;
  font-weight: 500;
`;

const SpeechProgressIndicator = () => {
  const { isSpeaking } = useVoice();
  
  return (
    <Container visible={isSpeaking}>
      <VoiceIndicator />
      <StatusText>Mentor está hablando...</StatusText>
    </Container>
  );
};

export default SpeechProgressIndicator;