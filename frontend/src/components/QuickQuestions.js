// QuickQuestions.js - Mini ranking de preguntas frecuentes como botones
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import analyticsService from '../services/analyticsService';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const QuestionButton = styled.button`
  width: 100%;
  padding: 12px 14px;
  background: rgba(74, 144, 226, 0.1);
  border: 1px solid rgba(74, 144, 226, 0.3);
  border-radius: 10px;
  color: #E2E8F0;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.85rem;
  line-height: 1.4;
  position: relative;
  overflow: hidden;
  
  &:hover {
    background: rgba(74, 144, 226, 0.2);
    border-color: rgba(74, 144, 226, 0.5);
    transform: translateX(-3px);
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const QuestionBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: #94A3B8;
`;

const FrequencyTag = styled.span`
  background: rgba(74, 144, 226, 0.3);
  color: #93C5FD;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.7rem;
`;

const PositionIndicator = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  color: white;
  
  ${props => {
    if (props.position === 1) return 'background: #FFD700;'; // Oro
    if (props.position === 2) return 'background: #C0C0C0;'; // Plata
    if (props.position === 3) return 'background: #CD7F32;'; // Bronce
    return 'background: #64748B;';
  }}
`;

const QuestionText = styled.div`
  font-size: 0.88rem;
  color: #F1F5F9;
  font-weight: 500;
  line-height: 1.3;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 20px;
  color: #94A3B8;
  font-size: 0.85rem;
  font-style: italic;
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 20px;
  color: #F87171;
  font-size: 0.85rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 30px 20px;
  color: #94A3B8;
  font-size: 0.85rem;
  line-height: 1.6;
`;

const QuickQuestions = ({ documentId, sessionToken, onQuestionClick }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (documentId) {
      loadQuickQuestions();
    }
  }, [documentId]);

  const loadQuickQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener solo las top 8 preguntas del modo consulta
      const data = await analyticsService.getQuestionRanking(documentId, 'consulta', 8);
      
      if (data && data.ranking) {
        setQuestions(data.ranking);
      } else {
        setQuestions([]);
      }
      
    } catch (err) {
      console.error('Error cargando preguntas rápidas:', err);
      setError('No se pudieron cargar las preguntas');
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionClick = (question) => {
    console.log('📌 Pregunta seleccionada:', question.pregunta);
    
    // Llamar al callback del componente padre con la pregunta
    if (onQuestionClick) {
      onQuestionClick(question.pregunta);
    }
  };

  if (loading) {
    return <LoadingState>Cargando preguntas frecuentes...</LoadingState>;
  }

  if (error) {
    return <ErrorState>{error}</ErrorState>;
  }

  if (questions.length === 0) {
    return (
      <EmptyState>
        Aún no hay preguntas frecuentes para este documento.
        <br />
        ¡Sé el primero en hacer consultas!
      </EmptyState>
    );
  }

  return (
    <Container>
      {questions.map((question) => (
        <QuestionButton 
          key={question.posicion}
          onClick={() => handleQuestionClick(question)}
          title={`Preguntada ${question.frecuencia} veces`}
        >
          <PositionIndicator position={question.posicion}>
            {question.posicion}
          </PositionIndicator>
          
          <QuestionBadge>
            <FrequencyTag>{question.frecuencia}x</FrequencyTag>
            <span>👥 {question.usuarios_diferentes}</span>
          </QuestionBadge>
          
          <QuestionText>
            {question.pregunta}
          </QuestionText>
        </QuestionButton>
      ))}
    </Container>
  );
};

export default QuickQuestions;
