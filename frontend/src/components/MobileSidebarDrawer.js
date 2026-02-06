// MobileSidebarDrawer.js - Drawer deslizable para móviles y tablets
// Breakpoints adaptativos:
// < 1024px → Drawer deslizable
// >= 1024px → Sidebar fijo (manejado por QuickAccessPanel)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import './MobileSidebarDrawer.css';

// Iconos SVG
const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// Icono de flecha para la pestaña
const ArrowLeftIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
  </svg>
);

// Iconos para los modos
const getModeIcon = (mode) => {
  switch(mode) {
    case 'mentor':
      return '🎓';
    case 'evaluacion':
      return '📊';
    case 'consulta':
    default:
      return '⚡';
  }
};

const getModeLabel = (mode) => {
  switch(mode) {
    case 'mentor':
      return 'Progreso';
    case 'evaluacion':
      return 'Evaluación';
    case 'consulta':
    default:
      return 'Preguntas';
  }
};

const MobileSidebarDrawer = ({
  children,
  currentMode = 'consulta',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const drawerRef = useRef(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  // Cerrar drawer
  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setDragOffset(0);
  }, []);

  // Abrir drawer
  const openDrawer = useCallback(() => {
    setIsOpen(true);
    setDragOffset(0);
  }, []);

  // Toggle drawer
  const toggleDrawer = useCallback(() => {
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }, [isOpen, closeDrawer, openDrawer]);

  // Manejar inicio de touch/drag
  const handleTouchStart = useCallback((e) => {
    if (!isOpen) return;

    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    currentXRef.current = touch.clientX;
    setIsDragging(true);
  }, [isOpen]);

  // Manejar movimiento de touch/drag
  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !isOpen) return;

    const touch = e.touches[0];
    currentXRef.current = touch.clientX;

    const diff = currentXRef.current - startXRef.current;

    // Solo permitir arrastrar hacia la derecha (para cerrar)
    if (diff > 0) {
      setDragOffset(diff);
    }
  }, [isDragging, isOpen]);

  // Manejar fin de touch/drag
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Si arrastró más de 100px, cerrar el drawer
    if (dragOffset > 100) {
      closeDrawer();
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, closeDrawer]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeDrawer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDrawer]);

  // Prevenir scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Pestaña lateral sutil para abrir el drawer - Solo visible en móvil/tablet */}
      <button
        className={`mobile-sidebar-tab ${isOpen ? 'hidden' : ''}`}
        onClick={openDrawer}
        aria-label="Abrir panel lateral"
      >
        <ArrowLeftIcon />
      </button>

      {/* Overlay oscuro */}
      <div
        className={`mobile-sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className={`mobile-sidebar-drawer ${isOpen ? 'open' : ''} ${isDragging ? 'dragging' : ''} ${className}`}
        style={{
          transform: isOpen
            ? `translateX(${dragOffset}px)`
            : 'translateX(100%)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header del drawer */}
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-title">
            <span className="title-icon">{getModeIcon(currentMode)}</span>
            <span className="title-text">{getModeLabel(currentMode)}</span>
          </div>
          <button
            className="mobile-sidebar-close"
            onClick={closeDrawer}
            aria-label="Cerrar panel"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Indicador de swipe */}
        <div className="mobile-sidebar-swipe-hint">
          <div className="swipe-bar"></div>
        </div>

        {/* Contenido */}
        <div className="mobile-sidebar-content">
          {children}
        </div>
      </aside>
    </>
  );
};

export default MobileSidebarDrawer;
