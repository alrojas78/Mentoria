// src/components/SessionExpiredNotification.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.3s ease-in;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const Modal = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
  position: relative;

  @keyframes slideUp {
    from {
      transform: translateY(50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 1.2rem;
  transition: color 0.2s;

  &:hover {
    color: #1e293b;
  }
`;

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 70px;
  height: 70px;
  margin: 0 auto 1.5rem;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 50%;
  box-shadow: 0 10px 25px rgba(251, 191, 36, 0.3);
`;

const Icon = styled(FaExclamationTriangle)`
  font-size: 2rem;
  color: white;
`;

const Title = styled.h2`
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 1rem;
`;

const Message = styled.p`
  color: #64748b;
  font-size: 1rem;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 2rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
`;

const Button = styled.button`
  background: ${props => props.primary ? '#dc2626' : '#e2e8f0'};
  color: ${props => props.primary ? 'white' : '#475569'};
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;

  &:hover {
    background: ${props => props.primary ? '#b91c1c' : '#cbd5e1'};
    transform: translateY(-2px);
  }
`;

const CountdownText = styled.p`
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
  margin-top: 1rem;
`;

const SessionExpiredNotification = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const handleSessionExpired = (event) => {
      setMessage(event.detail.message || 'Tu sesión ha expirado');
      setIsVisible(true);
      setCountdown(5);
    };

    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleLoginRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible]);

  const handleLoginRedirect = () => {
    setIsVisible(false);
    window.location.href = '/login';
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <Overlay>
      <Modal>
        <CloseButton onClick={handleClose}>
          <FaTimes />
        </CloseButton>
        
        <IconContainer>
          <Icon />
        </IconContainer>
        
        <Title>Sesión Expirada</Title>
        
        <Message>{message}</Message>
        
        <ButtonContainer>
          <Button primary onClick={handleLoginRedirect}>
            Iniciar Sesión
          </Button>
          <Button onClick={handleClose}>
            Cancelar
          </Button>
        </ButtonContainer>
        
        <CountdownText>
          Redirigiendo automáticamente en {countdown} segundo{countdown !== 1 ? 's' : ''}...
        </CountdownText>
      </Modal>
    </Overlay>
  );
};

export default SessionExpiredNotification;
