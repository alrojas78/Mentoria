// src/pages/CourseProgressView.js
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { courseService } from '../services/api';
import styled from 'styled-components';
import LessonPage from './LessonPage';
import EvaluationPage from './EvaluationPage';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/api';
import { toast } from 'react-toastify';
import { useVoice } from '../contexts/VoiceContext';
import { completedCourseService } from '../services/api';
import Modal from 'react-modal';

Modal.setAppElement('#root');




const Layout = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  max-width: 1200px;
  margin: 2rem auto;
  gap: 2rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;


const Content = styled.div`
  flex: 2;
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);

  @media (max-width: 768px) {
    padding: 1.25rem;
  }
`;

const Sidebar = styled.div`
  flex: 1;
  background: #f4f6f8;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  font-size: 0.95rem;

  @media (max-width: 768px) {
    padding: 1.25rem;
  }
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  color: ${props => props.completed ? '#2ecc71' : '#374151'};
  background-color: ${props => props.active ? '#e0f2fe' : 'transparent'};
  cursor: pointer;

  &:hover {
    background-color: #f0f9ff;
  }
`;


 


const CourseProgressView = () => {
  const { id } = useParams();
  const [modules, setModules] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState(null);
  const [activeType, setActiveType] = useState('lesson');
  const { user } = useAuth();
  const navigate = useNavigate();

const [progress, setProgress] = useState([]);
const { speak } = useVoice();
const [showCompletionModal, setShowCompletionModal] = useState(false);

const isLessonCompleted = (lessonId) => {
    return progress.some(p => p.lesson_id === lessonId && p.completado === 1);
  };

  const reloadProgress = async () => {
    try {
      const progressRes = await progressService.getUserProgress(user.id);
      setProgress(progressRes.data || []);
    } catch (error) {
      console.error('Error al recargar el progreso:', error);
    }
  };
  

  const location = useLocation();
 

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const itemId = params.get('id');

  if (type && itemId) {
    setActiveType(type);
    setActiveItem(itemId);
  }
}, [location]);


useEffect(() => {
 
    const fetchData = async () => {
      try {
        const courseRes = await courseService.getCourseById(id);
        const modulesRes = await courseService.getModulesByCourse(id);
        const progressRes = await progressService.getUserProgress(user.id);
        
  
        setCourse(courseRes.data);
        setModules(modulesRes.data);
        setProgress(progressRes.data || []);
      
        setLoading(false);
        
      } catch (error) {
        console.error('Error al cargar curso:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);
  
 

  const registrarCursoCompletado = async () => {
    try {
      await completedCourseService.saveCompletedCourse(user.id, course.id);
      console.log('✅ Curso registrado como completado');
    } catch (error) {
      console.error('❌ Error al registrar curso completado:', error);
    }
  };
  

  if (loading) return <Layout><Content>Cargando...</Content></Layout>;
  if (!course) return <Layout><Content>Error al cargar el curso</Content></Layout>;

  const handleNextActividad = async (next) => {
    await reloadProgress();
    toast.success('✅ ¡Actividad completada!');
  
    // ✅ 1. Si next es null, significa que terminó todo
    if (!next) {
      toast.success('🎉 ¡Has completado todo el curso!');
      try {
        await speak('🎉 Felicidades. Has completado todo el curso. Puedes descargar tu certificado.');
        await registrarCursoCompletado(); // guardar en backend
        setShowCompletionModal(true); // mostrar el modal sin redirigir
      } catch (e) {
        console.error('Error al hablar o guardar finalización:', e);
      }
      return; // ❌ No redirigimos aquí para que el modal aparezca
    }
  
    // ✅ 2. Validar si la actividad ya está completada
    const yaCompletada = progress.some(p => p.lesson_id === next.id && p.completado === 1);
    if (yaCompletada) {
      toast.success('🎉 ¡Has completado todo el curso!');
      try {
        await speak('🎉 Felicidades. Has completado todo el curso. Ahora volverás al panel principal.');
        await registrarCursoCompletado();
        setShowCompletionModal(true); // También mostramos modal si entra por este flujo
      } catch (e) {
        console.error('Error al hablar o guardar finalización:', e);
      }
      return;
    }
  
    // ✅ 3. Si aún hay actividades pendientes, cargarlas
    if (next.type === 'lesson') {
      setActiveItem(next.id);
      setActiveType('lesson');
    } else if (next.type === 'evaluation') {
      setActiveItem(next.module_id);
      setActiveType('evaluation');
    }
  };
 
  const calculateProgress = () => {
    if (!progress || !modules || modules.length === 0) return 0;
  
    const totalLessons = modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0);
    const completedLessons = progress.filter(p => p.completado === 1).length;
  
    return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  };
  
  
  const totalLessons = modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0);
const completedLessons = progress.filter(p => p.completado === 1).length;
const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

return (
    <Layout>
  <Content>
    {activeItem && activeType === 'lesson' && (
      <LessonPage embeddedId={activeItem} onNext={handleNextActividad} />
    )}
    {activeItem && activeType === 'evaluation' && (
      <EvaluationPage moduleId={activeItem} onCompleted={handleNextActividad} />
    )}
  </Content>

  <Sidebar style={{ fontFamily: '"Helvetica Neue", "Roboto Condensed", sans-serif', textAlign: 'left'}}>
  {/* Encabezado con imagen, título y progreso */}
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
    {course.imagen && (
      <div style={{
        width: '80px',
        height: '80px',
        marginRight: '1rem',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#e0e6ed',
        flexShrink: 0
      }}>
        <img src={`https://voicemed.edtechsm.com/backend${course.imagen}`} alt={course.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}
    <div style={{ flex: 1 }}>
      <h3 style={{
        fontSize: '1.1rem',
        fontWeight: 600,
        margin: 0,
        textAlign: 'left'  // <-- izquierda
      }}>{course.titulo}</h3>
      <p style={{
        fontSize: '0.85rem',
        color: '#6b7280',
        margin: 0,
        textAlign: 'left'  // <-- izquierda
      }}>{course.descripcion}</p>
    </div>
  </div>

  {/* Barra de progreso */}
  <div style={{ marginBottom: '1rem' }}>
    <div style={{
      height: '6px',
      backgroundColor: '#e5e7eb',
      borderRadius: '9999px',
      overflow: 'hidden'
    }}>
      <div style={{
  width: `${progressPercentage}%`,
  backgroundColor: '#2b4361',
  height: '100%',
  transition: 'width 0.6s ease',
  boxShadow: '0 0 6px rgba(43, 67, 97, 0.6)'
}} />

    </div>
    <p style={{
      fontSize: '0.8rem',
      color: '#374151',
      marginTop: '0.25rem',
      textAlign: 'left'  // <-- izquierda
    }}>
      {progressPercentage}% completado
    </p>
  </div>

  {/* Lista de módulos y lecciones */}
  {modules.map(module => (
    <div key={module.id} style={{
      marginBottom: '1.5rem',
      backgroundColor: '#fff',
      borderRadius: '12px',
      border: '1px solid #e0e0e0',
      padding: '1rem'
    }}>
      <h4 style={{
        fontWeight: 600,
        fontSize: '0.95rem',
        marginBottom: '0.3rem',
        textAlign: 'left'  // <-- izquierda
      }}>{module.title}</h4>
      <p style={{
        fontSize: '0.82rem',
        color: '#6b7280',
        marginBottom: '0.75rem',
        textAlign: 'left'  // <-- izquierda
      }}>{module.description}</p>

      {module.lessons?.map(lesson => {
        const isCompleted = progress.some(p => p.lesson_id === lesson.id && p.completado === 1);
        return (
          <div
            key={lesson.id}
            onClick={() => { setActiveItem(lesson.id); setActiveType('lesson'); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0',
              cursor: 'pointer',
              borderBottom: '1px solid #e5e7eb'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
  display: 'inline-flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '16px',
  height: '16px',
  borderRadius: '50%',
  border: '2px solid #2a4360',
  backgroundColor: isCompleted ? '#2b4361' : 'transparent',
  color: 'white',
  fontSize: '0.75rem',
  fontWeight: 'bold',
  transition: 'all 0.3s ease'
}}>
  {isCompleted ? '✓' : ''}
</span>


              <span style={{
                fontSize: '0.88rem',
                textAlign: 'left'
              }}>{lesson.titulo}</span>
            </div>
            {isCompleted && (
              <span style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                textAlign: 'left'
              }}>Completado</span>
            )}
          </div>
        );
      })}

      {/* Evaluación del módulo */}
      <div
        onClick={() => { setActiveItem(module.id); setActiveType('evaluation'); }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '0.75rem'
        }}
      >
        <span style={{ fontSize: '0.88rem', textAlign: 'left' }}>Evaluación del módulo</span>
        <button style={{
          backgroundColor: '#1e3a8a',
          color: '#fff',
          padding: '0.25rem 0.75rem',
          fontSize: '0.75rem',
          borderRadius: '6px',
          border: 'none',
          fontWeight: 500
        }}>
          Iniciar evaluación
        </button>
      </div>
    </div>
  ))}
</Sidebar>
<Modal
  isOpen={showCompletionModal}
  onRequestClose={() => setShowCompletionModal(false)}
  style={{
    content: {
      maxWidth: '500px',
      margin: 'auto',
      padding: '2rem',
      textAlign: 'center',
      borderRadius: '12px'
    }
  }}
>
  <h2>🎉 ¡Curso Completado!</h2>
  <p>Felicidades por finalizar el curso <strong>{course?.titulo}</strong>.</p>
  <button
    style={{
      marginTop: '1rem',
      backgroundColor: '#2b4361',
      color: '#fff',
      padding: '0.6rem 1.2rem',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 500
    }}
    onClick={() => {
      window.open(`https://voicemed.edtechsm.com/backend/certificado.php?user_id=${user.id}&course_id=${course?.id}`, '_blank');
    }}
  >
    Descargar certificado
  </button>
  <br />
  <button
    onClick={() => navigate('/dashboard')}
    style={{
      marginTop: '1rem',
      backgroundColor: '#6c757d',
      color: '#fff',
      padding: '0.5rem 1rem',
      borderRadius: '8px',
      border: 'none'
    }}
  >
    Volver al dashboard
  </button>
</Modal>


</Layout>

  );
  

};

export default CourseProgressView;
