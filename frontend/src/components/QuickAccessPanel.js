// QuickAccessPanel.js - Panel lateral derecho adaptable según modo
import React from 'react';
import styled from 'styled-components';
import QuickQuestions from './QuickQuestions';
import MentorProgressPanel from './MentorProgressPanel';
import EvaluationProgress from './EvaluationProgress';

const PanelContainer = styled.aside`
  position: fixed;
  top: 120px; /* Debajo del header AI */
  right: 0;
  width: 320px;
  height: calc(100vh - 240px); /* Altura disponible entre header y footer */
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  overflow-y: auto;
  z-index: 500;
  
  /* Scrollbar personalizada */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(74, 144, 226, 0.5);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 144, 226, 0.7);
  }
  
  /* Ocultar en móvil y tablet portrait - usar MobileSidebarDrawer */
  @media (max-width: 1023px) {
    display: none;
  }

  /* iPad horizontal - Sidebar compacto */
  @media (min-width: 1024px) and (max-width: 1199px) {
    width: 280px;
    padding: 16px;
  }
`;

const PanelTitle = styled.h3`
  color: #F1F5F9;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid rgba(74, 144, 226, 0.3);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const QuickAccessPanel = ({
  currentMode,
  documentId,
  sessionToken,
  userId,
  onQuestionClick,
  onLessonClick, // Callback para click en lecciones del modo mentor
  evaluationState, // Estado de la evaluación activa
  mentorProgressVersion
}) => {
  
  // Renderizar contenido según el modo activo
  const renderPanelContent = () => {
    switch(currentMode) {
      case 'consulta':
        return (
          <>
            <PanelTitle>
              ⚡ Preguntas Frecuentes
            </PanelTitle>
            <QuickQuestions 
              documentId={documentId}
              sessionToken={sessionToken}
              onQuestionClick={onQuestionClick}
            />
          </>
        );
      
      case 'mentor':
        return (
          <>
            <PanelTitle>
              🎓 Progreso del Programa
            </PanelTitle>
            <MentorProgressPanel
              documentId={documentId}
              userId={userId}
              refreshKey={mentorProgressVersion}
              onLessonClick={onLessonClick}
            />
          </>
        );
      
      case 'evaluacion':
        return (
          <>
            <PanelTitle>
              📊 Progreso de Evaluación
            </PanelTitle>
            <EvaluationProgress evaluationState={evaluationState} />
          </>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <PanelContainer>
      {renderPanelContent()}
    </PanelContainer>
  );
};

export default QuickAccessPanel;
