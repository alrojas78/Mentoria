// src/pages/ProgressPage.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { progressService, courseService, lessonService, evaluationService } from '../services/api';
import { useVoice } from '../contexts/VoiceContext';

const Container = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 1.5rem;
`;

const CourseHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 2rem;
`;

const CourseImage = styled.div`
  width: 120px;
  height: 120px;
  background-color: #e0e6ed;
  border-radius: 8px;
  margin-right: 1.5rem;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const CourseInfo = styled.div`
  flex: 1;
`;

const ProgressBar = styled.div`
  background-color: #e0e6ed;
  border-radius: 4px;
  height: 8px;
  margin: 1rem 0;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  background-color: #3498db;
  height: 100%;
  width: ${props => props.percentage}%;
  transition: width 0.3s ease;
`;

const ModuleContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
  overflow: hidden;
`;

const ModuleHeader = styled.div`
  background-color: #f8f9fa;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModuleContent = styled.div`
  padding: 1rem 1.5rem;
`;

const LessonList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const LessonItem = styled.li`
  padding: 1rem 0;
  border-bottom: 1px solid #e0e6ed;
  display: flex;
  align-items: center;
  
  &:last-child {
    border-bottom: none;
  }
`;

const LessonStatus = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${props => props.completed ? '#2ecc71' : '#e0e6ed'};
  margin-right: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: 12px;
`;

const LessonInfo = styled.div`
  flex: 1;
`;

const Button = styled(Link)`
  background-color: ${props => props.secondary ? '#95a5a6' : '#3498db'};
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  display: inline-block;
  
  &:hover {
    background-color: ${props => props.secondary ? '#7f8c8d' : '#2980b9'};
  }
`;

const EvaluationButton = styled(Button)`
  background-color: ${props => props.completed ? '#27ae60' : '#e74c3c'};
  
  &:hover {
    background-color: ${props => props.completed ? '#219d55' : '#c0392b'};
  }
`;

const LoadingSpinner = styled.div`
  text-align: center;
  padding: 2rem;
  
  &:after {
    content: " ";
    display: block;
    width: 64px;
    height: 64px;
    margin: 8px auto;
    border-radius: 50%;
    border: 6px solid #3498db;
    border-color: #3498db transparent #3498db transparent;
    animation: lds-dual-ring 1.2s linear infinite;
  }
  
  @keyframes lds-dual-ring {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const ProgressPage = () => {
  const { user } = useAuth();
  const { speak } = useVoice();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  
  useEffect(() => {
    // Cargar curso activo del estudiante y su progreso
    const loadStudentProgress = async () => {
      if (!user || !user.id) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        
        // 1. Obtener el último progreso/actividad del usuario
        const progressResponse = await progressService.getUserProgress(user.id);
        
        if (progressResponse.data && progressResponse.data.length > 0) {
          setProgress(progressResponse.data);
          
          // 2. Obtener información del curso activo
          // Asumimos que el primer curso en la lista es el curso activo
          const activeLessonId = progressResponse.data[0].lesson_id;
          const lessonResponse = await lessonService.getLessonById(activeLessonId);
          
          if (lessonResponse.data) {
            const courseId = lessonResponse.data.curso_id;
            const courseResponse = await courseService.getCourseById(courseId);
            
            if (courseResponse.data) {
              setCourse(courseResponse.data);
              
              // 3. Obtener módulos del curso
              const modulesResponse = await courseService.getModulesByCourse(courseId);
              
              if (modulesResponse.data) {
                setModules(modulesResponse.data);
                
                // 4. Obtener evaluaciones del usuario
                const evaluationsResponse = await evaluationService.getUserEvaluations(user.id);
                setEvaluations(evaluationsResponse.data || []);
                
                // 5. Anunciar curso y actividad actual (solo la primera vez)
                const activeLesson = lessonResponse.data;
                const activeModule = modulesResponse.data.find(m => 
                  m.lessons.some(l => l.id === activeLesson.id)
                );
                
                if (activeModule) {
                  speak(`Bienvenido al curso ${courseResponse.data.titulo}. Estás en el módulo ${activeModule.title}, lección ${activeLesson.titulo}.`);
                }
              }
            }
          }
        } else {
          // Si no hay progreso, cargar el primer curso disponible
          const coursesResponse = await courseService.getAllCourses();
          
          if (coursesResponse.data && coursesResponse.data.length > 0) {
            const firstCourse = coursesResponse.data[0];
            setCourse(firstCourse);
            
            // Obtener módulos del primer curso
            const modulesResponse = await courseService.getModulesByCourse(firstCourse.id);
            
            if (modulesResponse.data) {
              setModules(modulesResponse.data);
              speak(`Bienvenido al curso ${firstCourse.titulo}. Es tu primera vez aquí, comienza con la primera lección.`);
            }
          } else {
            setError('No se encontraron cursos disponibles');
          }
        }
      } catch (err) {
        console.error('Error al cargar progreso:', err);
        setError('Error al cargar tu progreso. Por favor, intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    
    loadStudentProgress();
  }, [user, navigate, speak]);
  
  // Calcular porcentaje de progreso
  const calculateProgress = () => {
    if (!progress || !modules || modules.length === 0) return 0;
    
    const totalLessons = modules.reduce((total, module) => 
      total + (module.lessons ? module.lessons.length : 0), 0);
    
    const completedLessons = progress.filter(p => p.completado === 1).length;
    
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  };
  
  // Verificar si una lección está completada
  const isLessonCompleted = (lessonId) => {
    if (!progress) return false;
    const lessonProgress = progress.find(p => p.lesson_id === lessonId);
    return lessonProgress && lessonProgress.completado === 1;
  };
  
  // Verificar si un módulo está completado
  const isModuleCompleted = (moduleId) => {
    if (!progress || !modules) return false;
    
    const module = modules.find(m => m.id === moduleId);
    if (!module || !module.lessons || module.lessons.length === 0) return false;
    
    // Un módulo está completo si todas sus lecciones están completadas
    return module.lessons.every(lesson => isLessonCompleted(lesson.id));
  };
  
// Verificar si una evaluación está completada
const isEvaluationCompleted = (moduleId) => {
    if (!evaluations || evaluations.length === 0) return false;
    return evaluations.some(evaluation => evaluation.module_id === moduleId);
  };
  
  // Obtener puntuación de evaluación
  const getEvaluationScore = (moduleId) => {
    if (!evaluations || evaluations.length === 0) return null;
    const evaluation = evaluations.find(evaluation => evaluation.module_id === moduleId);
    return evaluation ? evaluation.score : null;
  };
  
  if (loading) {
    return (
      <Container>
        <LoadingSpinner />
        <p style={{ textAlign: 'center' }}>Cargando tu progreso...</p>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <p>{error}</p>
        </div>
        <Button to="/dashboard">Volver al dashboard</Button>
      </Container>
    );
  }
  
  if (!course) {
    return (
      <Container>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <p>No se encontró un curso activo. Por favor, selecciona un curso para comenzar.</p>
        </div>
        <Button to="/courses">Ver cursos disponibles</Button>
      </Container>
    );
  }
  
  const progressPercentage = calculateProgress();
  
  return (
    <Container>
      <CourseHeader>
        <CourseImage>
          {course.imagen && <img src={course.imagen} alt={course.titulo} />}
        </CourseImage>
        
        <CourseInfo>
          <h1>{course.titulo}</h1>
          <p>{course.descripcion}</p>
          <p>{progressPercentage}% completado</p>
          <ProgressBar>
            <ProgressFill percentage={progressPercentage} />
          </ProgressBar>
        </CourseInfo>
      </CourseHeader>
      
      {modules.map(module => (
        <ModuleContainer key={module.id}>
          <ModuleHeader>
            <div>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
            
            <EvaluationButton 
              to={`/evaluations/${module.id}`}
              completed={isEvaluationCompleted(module.id)}
            >
              {isEvaluationCompleted(module.id) 
                ? `Evaluación Completada (${getEvaluationScore(module.id)}%)` 
                : 'Iniciar Evaluación'}
            </EvaluationButton>
          </ModuleHeader>
          
          <ModuleContent>
            <LessonList>
              {module.lessons && module.lessons.map(lesson => (
                <LessonItem key={lesson.id}>
                  <LessonStatus completed={isLessonCompleted(lesson.id)}>
                    {isLessonCompleted(lesson.id) && '✓'}
                  </LessonStatus>
                  
                  <LessonInfo>
                    <h3>{lesson.titulo}</h3>
                    <p>{lesson.descripcion || 'Sin descripción'}</p>
                  </LessonInfo>
                  
                  <Button to={`/lessons/${lesson.id}`}>
                    {isLessonCompleted(lesson.id) ? 'Repasar' : 'Comenzar'}
                  </Button>
                </LessonItem>
              ))}
            </LessonList>
          </ModuleContent>
        </ModuleContainer>
      ))}
    </Container>
  );
};

export default ProgressPage;