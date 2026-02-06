import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import { progressService } from '../services/api';

const ActivityRedirect = () => {
  const { user } = useAuth();
  const { speak } = useVoice();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const redirectToFirstPendingActivity = async () => {
      if (!user || !user.id) {
        setLoading(false);
        return;
      }

      try {
        const response = await progressService.getLastActivity(user.id);

        if (response.data && response.data.course_id) {
          const { course_id, course_title, lesson_id, lesson_title, module_id, is_evaluation } = response.data;

          if (lesson_id && !is_evaluation) {
            await speak(`Bienvenido de nuevo a ${course_title}. Te estamos llevando a tu última actividad: ${lesson_title}.`);
            navigate(`/courses/${course_id}?type=lesson&id=${lesson_id}`);
          } else if (is_evaluation && module_id) {
            await speak(`Bienvenido de nuevo a ${course_title}. Te estamos llevando a tu última evaluación.`);
            navigate(`/courses/${course_id}?type=evaluation&id=${module_id}`);
          } else {
            navigate('/dashboard');
          }
        } else {
          navigate('/documentos');
        }
      } catch (error) {
        console.error('Error al redirigir a última actividad:', error);
        navigate('/documentos');
      } finally {
        setLoading(false);
      }
    };

    redirectToFirstPendingActivity();
  }, [user, navigate, speak]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Cargando tu última actividad...</div>
      </div>
    );
  }

  return null;
};

export default ActivityRedirect;
