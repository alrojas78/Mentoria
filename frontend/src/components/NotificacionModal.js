import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { notificacionService } from '../services/api';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  overflow-y: auto;
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalBox = styled.div`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  max-width: 440px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  margin: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: slideUp 0.3s ease;
  text-align: center;

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const IconCircle = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
  background: ${props => {
    if (props.tipo === 'warning') return '#fef3c7';
    if (props.tipo === 'success') return '#d1fae5';
    return '#dbeafe';
  }};
`;

const Title = styled.h3`
  color: #1f2937;
  margin: 0 0 0.75rem 0;
  font-size: 1.2rem;
`;

const Message = styled.p`
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0 0 1.5rem 0;
  white-space: pre-wrap;
`;

const Counter = styled.span`
  color: #9ca3af;
  font-size: 0.8rem;
  display: block;
  margin-bottom: 1rem;
`;

const DismissBtn = styled.button`
  background: ${props => {
    if (props.tipo === 'warning') return '#f59e0b';
    if (props.tipo === 'success') return '#10b981';
    return '#3b82f6';
  }};
  color: white;
  border: none;
  padding: 0.7rem 2rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
`;

const icons = {
  info: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  warning: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  success: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
};

const NotificacionModal = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchPendientes = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await notificacionService.getPendientes();
      if (res.data?.success && res.data.notificaciones?.length > 0) {
        setNotificaciones(res.data.notificaciones);
        setCurrentIndex(0);
      }
    } catch (err) {
      // Silencioso — no bloquear la app si falla
      console.error('Error cargando notificaciones pendientes:', err);
    }
  }, []);

  useEffect(() => {
    fetchPendientes();
  }, [fetchPendientes]);

  const handleDismiss = async () => {
    const current = notificaciones[currentIndex];
    if (!current) return;

    try {
      await notificacionService.marcarLeida(current.id);
    } catch (err) {
      console.error('Error marcando notificacion como leida:', err);
    }

    if (currentIndex < notificaciones.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setNotificaciones([]);
    }
  };

  if (notificaciones.length === 0) return null;

  const current = notificaciones[currentIndex];
  if (!current) return null;

  return (
    <Overlay>
      <ModalBox>
        <IconCircle tipo={current.tipo}>
          {icons[current.tipo] || icons.info}
        </IconCircle>
        <Title>{current.titulo}</Title>
        <Message>{current.mensaje}</Message>
        {notificaciones.length > 1 && (
          <Counter>{currentIndex + 1} de {notificaciones.length}</Counter>
        )}
        <DismissBtn tipo={current.tipo} onClick={handleDismiss}>
          Entendido
        </DismissBtn>
      </ModalBox>
    </Overlay>
  );
};

export default NotificacionModal;
