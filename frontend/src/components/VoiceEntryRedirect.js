// src/components/VoiceEntryRedirect.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import axios from 'axios';

const VoiceEntryRedirect = () => {
  const { user } = useAuth();
  const { speak, startListening, stopListening, transcript, isSpeaking } = useVoice();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.id) return;

    const checkNextPending = async () => {
      try {
        const response = await axios.get(
          `https://voicemed.ateneo.co/backend/api/next-pending.php?user_id=${user.id}`
        );

        if (response.data && response.data.success && response.data.next) {
          const { course_title, title } = response.data.next;

          await speak(
            `Bienvenido de nuevo. Tienes una actividad pendiente del curso ${course_title}. Título: ${title}. ¿Quieres continuar con esa actividad?`,
            () => startListening()
          );
        } else {
          await speak(
            'No tienes actividades pendientes. ¿Quieres iniciar un nuevo curso? Dime el nombre del curso que deseas.',
            () => startListening()
          );
        }
      } catch (err) {
        console.error('Error consultando próxima actividad pendiente:', err);
      }
    };

    checkNextPending();
  }, [user]);

  useEffect(() => {
    const cleanText = transcript?.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!transcript || !cleanText || isSpeaking) return;

    stopListening();

    if (/si|claro|vamos|continuar|ok/.test(cleanText)) {
      axios
        .get(
          `https://voicemed.ateneo.co/backend/api/next-pending.php?user_id=${user.id}`
        )
        .then((res) => {
          if (res.data && res.data.success && res.data.next) {
            const { type, id, module_id } = res.data.next;
            if (type === 'lesson') {
              navigate(`/lessons/${id}`);
            } else if (type === 'evaluation') {
              navigate(`/evaluations/${module_id}`);
            }
          }
        })
        .catch((err) => {
          console.error('Error redirigiendo a la actividad:', err);
        });
    } else if (/curso|empezar|presentacion|vilzermet|diabetes|técnicas/i.test(cleanText)) {
      // Si el usuario dice el nombre de un curso, redirigir al listado para buscarlo
      navigate('/courses');
    }
  }, [transcript]);

  return null;
};

export default VoiceEntryRedirect;