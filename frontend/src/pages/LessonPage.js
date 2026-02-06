// src/pages/LessonPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useVoice } from '../contexts/VoiceContext';
import { useAuth } from '../contexts/AuthContext';
import { lessonService } from '../services/api';

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

const LessonPage = ({ embeddedId, onNext }) => {
  const routeParams = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    speak, startListening, stopListening, stopSpeaking,
    isListening, isSpeaking, transcript
  } = useVoice();

  // Añadir el estado verifiedUser
  const [verifiedUser, setVerifiedUser] = useState(null);
  
  const lessonId = embeddedId || routeParams.id;

  const [lesson, setLesson] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('intro');

  useEffect(() => {
    // Intentar obtener usuario válido
    if (user && user.id) {
      console.log("Usuario disponible desde contexto:", user);
      setVerifiedUser(user);
    } else {
      // Intentar recuperar desde localStorage
      try {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser && storedUser.id) {
          console.log("Usuario recuperado desde localStorage:", storedUser);
          setVerifiedUser(storedUser);
        } else {
          console.error("No se pudo obtener un usuario válido");
        }
      } catch (e) {
        console.error("Error al recuperar usuario de localStorage:", e);
      }
    }
  }, [user]);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const response = await lessonService.getLessonById(lessonId);
        if (response.data) {
          setLesson(response.data);
          const p = response.data.contenido.split('\n').filter(par => par.trim() !== '');
          setParagraphs(p);
          setStep('intro');
        }
      } catch (err) {
        console.error('Error al cargar la lección:', err);
        setError('No se pudo cargar la lección.');
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [lessonId]);

  useEffect(() => {
    if (step === 'intro' && lesson) {
      (async () => {
        await speak(`Lección: ${lesson.titulo}`);
        await speak('¿Estás listo para comenzar?', () => startListening());
      })();
    }
  }, [step, lesson]);

  useEffect(() => {
    const narrate = async () => {
      if (!paragraphs.length || currentIndex >= paragraphs.length) return;
      try {
        if (isSpeaking) stopSpeaking();
        if (isListening) stopListening();

        await speak(paragraphs[currentIndex]);

        if (currentIndex < paragraphs.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setStep('ask_understanding');
          await speak('¿Has entendido la lección?', () => startListening());
        }
      } catch (err) {
        console.error('Error al narrar el párrafo:', err);
      }
    };

    if (!loading && lesson && step === 'narrating') {
      narrate();
    }
  }, [currentIndex, paragraphs, lesson, step]);

  useEffect(() => {
    const lower = transcript?.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    if (!transcript || !lower || isSpeaking || loading || !lesson) return;

    stopListening();

    const isYes = /si|claro|ok|entendi|entiendo|comprendi/.test(lower);
    const isNo = /no|repite|duda|pregunta/.test(lower);

    const handleTranscript = async () => {
      if (step === 'intro') {
        if (isYes) {
          setStep('narrating');
          setCurrentIndex(0);
        } else {
          await speak('Cuando estés listo, dime sí para comenzar.', () => startListening());
        }
        return;
      }

      if (step === 'ask_understanding') {
        if (isYes) {
          try {
            // Usar verifiedUser o user
            const userId = verifiedUser?.id || user?.id;
            
            if (!userId) {
              console.error('ID de usuario no disponible para marcar lección como completada');
              
              // Intentar obtener desde localStorage directamente
              try {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                if (storedUser && storedUser.id) {
                  console.log('Usuario recuperado de localStorage en el momento crítico:', storedUser);
                  
                  const dataToSend = {
                    user_id: parseInt(storedUser.id, 10),
                    lesson_id: parseInt(lesson.id, 10),
                    completado: 1
                  };
                  
                  console.log('Enviando datos a progress.php:', dataToSend);
                  await lessonService.markLessonCompleted(dataToSend);
                  
                  setStep('ask_continue');
                  await speak('¿Quieres continuar con la siguiente actividad?', () => {
                    setTimeout(() => {
                      startListening();
                    }, 200);
                  });
                  return;
                }
              } catch (e) {
                console.error('Error al recuperar usuario en el momento crítico:', e);
              }
              
              // Si todo falla, informar al usuario
              await speak('Ha ocurrido un problema con tu sesión. Intentaremos continuar de todas formas.');
              
              // Intentar continuar a pesar del error
              setStep('ask_continue');
              await speak('¿Quieres continuar con la siguiente actividad?', () => {
                setTimeout(() => {
                  startListening();
                }, 200);
              });
              return;
            }
  
            const dataToSend = {
              user_id: userId ? parseInt(userId, 10) : null,
              lesson_id: parseInt(lesson.id, 10),
              completado: 1
            };
  
            console.log('Enviando datos a progress.php:', dataToSend);
            await lessonService.markLessonCompleted(dataToSend);
  
            setStep('ask_continue');
            await speak('¿Quieres continuar con la siguiente actividad?', () => {
              setTimeout(() => {
                startListening();
              }, 200);
            });
          } catch (e) {
            console.error('Error al marcar completado:', e);
            
            // Continuar a pesar del error
            setStep('ask_continue');
            await speak('Hubo un problema al guardar tu progreso, pero puedes continuar. ¿Quieres continuar con la siguiente actividad?', () => {
              setTimeout(() => {
                startListening();
              }, 200);
            });
          }
        } else if (isNo) {
          // Tu código existente para cuando el usuario dice "no"...
          setCurrentIndex(0);
          setStep('narrating');
        } else {
          await speak('Responde sí si entendiste, o no si necesitas que repita.', () => startListening());
        }
      }
      else if (step === 'ask_continue') {
        if (isYes) {
          try {
            const response = await lessonService.getNextActivity(lesson.module_id, lesson.id);
            const next = response?.data;
        
            if (!next) {
              await speak('🎉 Felicidades. Has completado todo el curso. Ahora volverás al panel principal.');
            } else {
              await speak('Cargando la siguiente actividad...');
            }
        
            setStep('done');
        
            if (onNext) {
              onNext(next); // esto lo manejará CourseProgressView.js
            } else {
              if (next?.type === 'lesson') {
                navigate(`/lessons/${next.id}`);
              } else if (next?.type === 'evaluation') {
                navigate(`/evaluations/${next.module_id}`);
              } else {
                await speak('No hay más actividades. Volviendo al dashboard.');
                navigate('/dashboard');
              }
            }
          } catch (e) {
            console.error('Error al cargar la siguiente actividad:', e);
            await speak('Ocurrió un error. Volviendo al dashboard.');
            navigate('/dashboard');
          }
                
        } else if (isNo) {
          setStep('done');
          await speak('De acuerdo, puedes volver al dashboard cuando lo desees.', () => startListening());
        } else {
          await speak('No entendí tu respuesta. ¿Quieres continuar con la siguiente actividad o volver al dashboard?', () => {
            setTimeout(() => {
              startListening();
            }, 200);
          });
        }
      }
      
    };

    handleTranscript();
  }, [transcript]);

  useEffect(() => {
    if (step === 'ask_continue' && !isListening && !isSpeaking) {
      startListening();
    }
  }, [step, isListening, isSpeaking]);

  if (loading) return <Container><Card><p>Cargando lección...</p></Card></Container>;
  if (error) return <Container><Card><p>{error}</p></Card></Container>;
  if (!lesson) return <Container><Card><p>Lección no encontrada.</p></Card></Container>;

  return (
    <Container>
      <Card>
        <h1>{lesson.titulo}</h1>
        {paragraphs.length > 0 && currentIndex < paragraphs.length && (
          <p>{paragraphs[currentIndex]}</p>
        )}
        {step === 'ask_understanding' && <p>¿Has entendido la lección?</p>}
        {step === 'ask_continue' && <p>¿Deseas continuar con la siguiente actividad?</p>}
        {isListening && <p>🎤 Escuchando tu respuesta...</p>}
        {isSpeaking && <p>🗣️ VoiceMed está hablando...</p>}
      </Card>
    </Container>
  );
};

export default LessonPage;
