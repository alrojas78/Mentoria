import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVoice } from '../contexts/VoiceContext';
import { useAuth } from '../contexts/AuthContext';
import { questionService, evaluationService, lessonService } from '../services/api';


import styled from 'styled-components';

const Container = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const Button = styled.button`
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  margin-top: 1rem;
  font-weight: 500;
  cursor: pointer;
  &:hover {
    background-color: #2980b9;
  }
  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 10px;
  margin-top: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const SpeakingIndicator = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  span {
    display: inline-block;
    width: 12px;
    height: 12px;
    background-color: #e74c3c;
    border-radius: 50%;
    margin-right: 8px;
  }
  p {
    margin: 0;
    color: #7f8c8d;
  }
`;

const EvaluationPage = ({ moduleId: moduleIdFromProps, onCompleted }) => {
  const params = useParams();
  const moduleId = params.moduleId || moduleIdFromProps;
  const evaluationId = params.id || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    speak,
    startListening,
    stopListening,
    stopSpeaking,
    isListening,
    isSpeaking,
    transcript,
    resetTranscript
  } = useVoice();

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [evaluationCompleted, setEvaluationCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [processingAnswer, setProcessingAnswer] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const response = await questionService.getQuestionsByModule(moduleId);
        if (response.data && response.data.length > 0) {
          const formattedQuestions = response.data.map(q => ({
            id: q.id,
            question: q.question,
            expectedAnswer: q.expectedAnswer,
            orden: q.orden
          }));
          setQuestions(formattedQuestions);
        } else {
          setError('No se encontraron preguntas para este módulo.');
        }
      } catch (err) {
        console.error('Error al cargar preguntas:', err);
        setError('Error al cargar las preguntas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    if (moduleId) {
      fetchQuestions();
    }
  }, [moduleId]);

  useEffect(() => {
    if (!loading && questions.length > 0 && currentIndex < questions.length) {
      const narrateQuestion = async () => {
        try {
          if (isSpeaking) stopSpeaking();
          await stopListening();
  
          // 🔐 Detenemos cualquier audio y limpiamos antes de seguir
          resetTranscript();
          setUserAnswer('');
          await speak(questions[currentIndex].question, () => {
            setTimeout(() => {
              resetTranscript(); // ✅ Reinicia todo antes de escuchar
              startListening();
            }, 500); // damos medio segundo de margen
          });
        } catch (error) {
          console.error("Error al narrar pregunta:", error);
        }
      };
      narrateQuestion();
    }
  }, [currentIndex, questions, loading]);

  useEffect(() => {
    if (
      transcript &&
      !isSpeaking &&
      isListening === false &&
      !loading &&
      questions.length > 0 &&
      !processingAnswer &&
      questions[currentIndex]
    ) {
      setProcessingAnswer(true);
      const currentTranscript = transcript.trim();
      resetTranscript(); // ✅ Evita duplicados
      setUserAnswer(currentTranscript);
  
      handleSubmitAnswer(currentTranscript)
        .finally(() => {
          setProcessingAnswer(false);
        });
    }
  }, [transcript, isListening, isSpeaking, loading, currentIndex, questions]);
  

const handleSubmitAnswer = async (answer) => {
    if (!answer.trim()) return;
    try {
      const currentQuestion = questions[currentIndex];
      const evaluationResult = await evaluationService.evaluateAnswer(
        currentQuestion.question,
        currentQuestion.expectedAnswer,
        answer
      );

      // --- Acceder a los datos correctos ---
      const backendData = evaluationResult.data.data; // <- Objeto con isCorrect y feedback
      const isCorrectFromBackend = backendData?.isCorrect; // Usar optional chaining por seguridad
      const feedbackFromBackend = backendData?.feedback ?? ''; // Usar optional chaining y valor por defecto

      const parsedCorrect = isCorrectFromBackend === true;

      console.log('Backend response data:', backendData);
      console.log('Value of isCorrect:', isCorrectFromBackend);
      console.log('Value of feedback:', feedbackFromBackend);
      console.log('parsedCorrect value:', parsedCorrect);


      // --- Guardar en el estado usando el feedback correcto ---
      const newAnswers = [...answers];
      newAnswers[currentIndex] = {
        question: currentQuestion.question,
        expectedAnswer: currentQuestion.expectedAnswer,
        userAnswer: answer,
        isCorrect: parsedCorrect,
        feedback: feedbackFromBackend // <- Usar la variable con el feedback correcto
      };
      setAnswers(newAnswers);
      setUserAnswer('');

      // --- Definición de saveEvaluationResults ---
  const saveEvaluationResults = async (answersData, finalScore) => {
    // Renombrado el parámetro 'answers' a 'answersData' para evitar sombrear el estado 'answers'
    try {
      if (!user || !user.id) {
          console.warn("Usuario no encontrado, no se puede guardar la evaluación.");
          return;
      };
      await evaluationService.submitEvaluation({
        user_id: user.id,
        module_id: moduleId,
        score: finalScore,
        answers: answersData // Usar el parámetro renombrado
      });
      console.log("Resultados de la evaluación guardados.");
    } catch (err) { // Renombrado 'error' a 'err' para evitar sombrear la variable de estado 'error'
      console.error("Error al guardar evaluación:", err);
      // Opcionalmente, podrías notificar al usuario aquí si falla el guardado
      // setError("Hubo un problema al guardar tu progreso.");
    }
  };
  
      // --- Usar el feedback correcto en la respuesta de voz ---
      await speak(parsedCorrect ? `Respuesta correcta. ${feedbackFromBackend}` : `Respuesta incorrecta. ${feedbackFromBackend}`); // <- Usar la variable con el feedback correcto

      // Resto de la lógica...
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prevIndex) => prevIndex + 1);
      } else {
        const correctAnswers = newAnswers.filter(a => a.isCorrect).length;
        const finalScore = Math.round((correctAnswers / questions.length) * 100);
        setScore(finalScore);
        await saveEvaluationResults(newAnswers, finalScore);
        setEvaluationCompleted(true);
        await speak(`Evaluación completada. Tu puntuación es ${finalScore}%. Has acertado ${correctAnswers} de ${questions.length} preguntas.`);

        if (finalScore >= 60) {
          const nextResponse = await lessonService.getNextActivity(moduleId, evaluationId);
          const next = nextResponse?.data;
        
          if (!next) {
            await speak('🎉 Felicidades. Has completado todo el curso. Ahora volverás al panel principal.');
          } else {
            await speak('Avanzando a la siguiente actividad.');
          }
        
          // Ya sea con o sin CourseProgressView
          if (onCompleted) {
            onCompleted(next);
          } else {
            if (next?.type === 'lesson') {
              navigate(`/lessons/${next.id}`);
            } else if (next?.type === 'evaluation') {
              navigate(`/evaluations/${next.module_id}`);
            } else {
              navigate('/dashboard');
            }
          }
        } else {
          await speak('Tu puntuación no fue suficiente para aprobar. Puedes intentarlo de nuevo más tarde.');
        }
             
      }
    } catch (error) {
      console.error("Error al procesar respuesta:", error);
      console.error("Error details:", error.response ? error.response.data : error.message);
      setError("Error al procesar tu respuesta. Por favor, intenta nuevamente.");
    }
  };

  const handleNextActivity = async () => {
    try {
      const response = await lessonService.getNextActivity(moduleId, evaluationId);
      const next = response?.data;
      if (onCompleted) {
        onCompleted(next); // <- esto es clave para avanzar desde CourseProgressView
      } else {
        if (next?.type === 'lesson') {
          navigate(`/lessons/${next.id}`);
        } else if (next?.type === 'evaluation') {
          navigate(`/evaluations/${next.module_id}`);
        } else {
          await speak('Has completado todo el curso. Felicitaciones.');
          navigate('/dashboard');
        }
      }
    } catch (e) {
      console.error('Error al obtener siguiente actividad:', e);
      await speak('No se pudo cargar la siguiente actividad. Intenta desde el dashboard.');
      navigate('/dashboard');
    }
  };
  
  

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleSubmitAnswer(userAnswer);
  };

  const handleReturnToCourse = () => {
    if (onCompleted) onCompleted();
    else navigate(`/courses`);
  };

  const handleRepeatQuestion = () => speak(questions[currentIndex]?.question);
  const handleRepeatFeedback = () => speak(answers[currentIndex]?.feedback);

  if (loading) return (<Container><Card><p>Cargando preguntas...</p></Card></Container>);
  if (error) return (<Container><Card><p>{error}</p></Card></Container>);

  if (evaluationCompleted) {
    return (
      <Container>
        <Card>
          <h1>Evaluación Completada</h1>
          <p>Tu puntuación: {score}%</p>
          {answers.map((answer, index) => {
            const esCorrecta = answer.isCorrect;
            return (
              <div key={index} style={{ borderLeft: `4px solid ${esCorrecta ? 'green' : 'red'}`, padding: '10px', marginBottom: '10px' }}>
                <p><strong>Pregunta {index + 1}:</strong> {answer.question}</p>
                <p><strong>Tu respuesta:</strong> {answer.userAnswer}</p>
                <p><strong>Respuesta esperada:</strong> {answer.expectedAnswer}</p>
                <p><strong>Resultado:</strong> {esCorrecta ? '✓ Correcta' : '✗ Incorrecta'}</p>
                <p><strong>Feedback:</strong> {answer.feedback}</p>
              </div>
            );
          })}
          <Button onClick={handleReturnToCourse}>Volver al curso</Button>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <h1>Evaluación del Módulo</h1>
      <p>Pregunta {currentIndex + 1} de {questions.length}</p>
      <Card>
        {isSpeaking && (
          <SpeakingIndicator>
            <span></span>
            <p>VoiceMed está hablando...</p>
          </SpeakingIndicator>
        )}
        <h2>{questions[currentIndex].question}</h2>
        <Button onClick={handleRepeatQuestion}>🔁 Repetir Pregunta</Button>
        <form onSubmit={handleManualSubmit}>
          <p>Ingresa tu respuesta:</p>
          <TextArea value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} />
          <Button type="submit" disabled={!userAnswer.trim()}>Enviar Respuesta</Button>
        </form>
        {isListening && <p>🎤 Escuchando tu respuesta...</p>}
        {transcript && !isListening && <p>📝 Respuesta detectada: {transcript}</p>}
        {answers[currentIndex]?.feedback && <Button onClick={handleRepeatFeedback}>🔁 Repetir Feedback</Button>}
      </Card>
    </Container>
  );
};

export default EvaluationPage;