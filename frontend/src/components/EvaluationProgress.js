// EvaluationProgress.js - Panel de progreso de evaluación
import React, { useEffect, useState } from 'react'; // 🆕 Agregar useEffect y useState
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ProgressCard = styled.div`
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
  border: 1px solid rgba(139, 92, 246, 0.4);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
    animation: pulse 3s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }
`;

const ProgressTitle = styled.div`
  color: #C4B5FD;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
`;

const QuestionCounter = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
`;

const CurrentQuestion = styled.div`
  color: #F1F5F9;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
`;

const TotalQuestions = styled.div`
  color: #94A3B8;
  font-size: 1.5rem;
  font-weight: 600;
`;

const QuestionLabel = styled.div`
  color: #94A3B8;
  font-size: 0.85rem;
  margin-top: 4px;
  position: relative;
  z-index: 1;
`;

// Barra de progreso circular
const CircularProgressContainer = styled.div`
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 20px;
`;

const CircularProgressSVG = styled.svg`
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
`;

const CircularProgressBackground = styled.circle`
  fill: none;
  stroke: rgba(100, 116, 139, 0.2);
  stroke-width: 8;
`;

const CircularProgressBar = styled.circle`
  fill: none;
  stroke: url(#gradient);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.5s ease;
`;

const ProgressPercentage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
`;

const PercentageValue = styled.div`
  color: #F1F5F9;
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
`;

const PercentageLabel = styled.div`
  color: #94A3B8;
  font-size: 0.7rem;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

// Stats Row
const StatsRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const StatCard = styled.div`
  flex: 1;
  background: rgba(30, 41, 59, 0.6);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  border: 1px solid rgba(139, 92, 246, 0.2);
`;

const StatValue = styled.div`
  color: ${props => {
    if (props.type === 'correct') return '#6EE7B7';
    if (props.type === 'incorrect') return '#F87171';
    return '#93C5FD';
  }};
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1;
`;

const StatLabel = styled.div`
  color: #94A3B8;
  font-size: 0.7rem;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

// Timeline de preguntas
const QuestionTimeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const TimelineTitle = styled.div`
  color: #C4B5FD;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const QuestionDot = styled.div`
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: ${props => {
    if (props.status === 'correct') return 'linear-gradient(90deg, #10B981 0%, #6EE7B7 100%)';
    if (props.status === 'incorrect') return 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)';
    if (props.status === 'current') return 'linear-gradient(90deg, #8B5CF6 0%, #C4B5FD 100%)';
    return 'rgba(100, 116, 139, 0.3)';
  }};
  position: relative;
  transition: all 0.3s ease;
  
  ${props => props.status === 'current' && `
    animation: glow 1.5s ease-in-out infinite;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
  `}
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.5); }
    50% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.8); }
  }
`;

const QuestionNumber = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

// Estado de tiempo
const TimeCard = styled.div`
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  margin-top: 16px;
`;

const TimeValue = styled.div`
  color: #F1F5F9;
  font-size: 1.5rem;
  font-weight: 700;
  font-family: 'Courier New', monospace;
`;

const TimeLabel = styled.div`
  color: #94A3B8;
  font-size: 0.7rem;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
  color: #94A3B8;
  font-size: 0.85rem;
  line-height: 1.6;
`;

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.5;
`;

const EvaluationProgress = ({ evaluationState }) => {
  // 🆕 Estado local para forzar re-render
  const [localState, setLocalState] = useState(null);
  
  // 🆕 useEffect para actualizar cuando cambie evaluationState
  useEffect(() => {
    if (evaluationState) {
      console.log('📊 EvaluationProgress - Estado recibido:', evaluationState);
      setLocalState(evaluationState);
    }
  }, [evaluationState]);
  
  // 🆕 Usar localState en lugar de evaluationState directamente
  const stateToUse = localState || evaluationState;
  
  // Si no hay evaluación activa
  if (!stateToUse || !stateToUse.isActive) {
    return (
      <EmptyState>
        <EmptyIcon>📝</EmptyIcon>
        <div>
          No hay una evaluación en curso.
          <br />
          Inicia una evaluación para ver tu progreso aquí.
        </div>
      </EmptyState>
    );
  }

  // 🆕 EXTRAER datos SIN valores por defecto primero
  const {
    currentQuestion,
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    questionsAnswered,
    timeElapsed,
  } = stateToUse;

  // Preguntas RESPONDIDAS (no la actual)
  const answeredCount = questionsAnswered?.length || 0;

  console.log('📊 Renderizando progreso:', {
    currentQuestion,
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    answeredCount
  });

  // Porcentaje basado en RESPUESTAS (no en la pregunta actual)
  const percentage = totalQuestions > 0
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;

  
  // Calcular circunferencia para el progreso circular
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Formatear tiempo
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Container>
      {/* Tarjeta principal con contador de preguntas */}
      <ProgressCard>
        <ProgressTitle>📊 Progreso de Evaluación</ProgressTitle>
        
        {/* Progreso circular */}
        <CircularProgressContainer>
          <CircularProgressSVG viewBox="0 0 120 120">
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
            <CircularProgressBackground
              cx="60"
              cy="60"
              r={radius}
            />
            <CircularProgressBar
              cx="60"
              cy="60"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </CircularProgressSVG>
          <ProgressPercentage>
            <PercentageValue>{percentage}%</PercentageValue>
            <PercentageLabel>Avance</PercentageLabel>
          </ProgressPercentage>
        </CircularProgressContainer>

        <QuestionCounter>
          <CurrentQuestion>{answeredCount}</CurrentQuestion>
          <TotalQuestions>/ {totalQuestions}</TotalQuestions>
        </QuestionCounter>
        <QuestionLabel>Preguntas respondidas</QuestionLabel>

      </ProgressCard>

      {/* Stats de respuestas */}
      <StatsRow>
        <StatCard>
          <StatValue type="correct">{correctAnswers}</StatValue>
          <StatLabel>Correctas</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue type="incorrect">{incorrectAnswers}</StatValue>
          <StatLabel>Incorrectas</StatLabel>
        </StatCard>
      </StatsRow>

      {/* Timeline de preguntas */}
      <div>
        <TimelineTitle>🎯 Todas las Preguntas</TimelineTitle>
        <QuestionTimeline>
          {Array.from({ length: totalQuestions }, (_, index) => {
            const questionNum = index + 1;
            const answered = questionsAnswered?.find(q => q.number === questionNum);
            
            let status = 'pending';
            if (questionNum === currentQuestion) {
              status = 'current';
            } else if (answered) {
              status = answered.isCorrect ? 'correct' : 'incorrect';
            }

            return (
              <QuestionDot key={questionNum} status={status}>
                <QuestionNumber>
                  {questionNum}
                </QuestionNumber>
              </QuestionDot>
            );
          })}
        </QuestionTimeline>
      </div>

      {/* Tiempo transcurrido */}
      {timeElapsed > 0 && (
        <TimeCard>
          <TimeValue>{formatTime(timeElapsed)}</TimeValue>
          <TimeLabel>Tiempo transcurrido</TimeLabel>
        </TimeCard>
      )}
    </Container>
  );
};

export default EvaluationProgress;
