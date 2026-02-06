import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import { courseService, progressService, evaluationService } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';

// Estilos
const Container = styled.div`
  max-width: 1200px;
  margin: 2rem auto;
  padding: 2rem;
  font-family: 'Segoe UI', sans-serif;
`;

const Title = styled.h1`
  color: #2b4361;
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const SubText = styled.p`
  color: #6b7280;
  font-size: 1rem;
  margin-bottom: 2rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);

  h2 {
    font-size: 2rem;
    color: #2b4361;
    margin: 0.5rem 0;
  }

  p {
    color: #6b7280;
    margin: 0;
  }
`;

const CoursesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
`;

const CourseCard = styled.div`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
`;

const CourseHeader = styled.div`
  background-color: #2b4361;
  color: white;
  padding: 1rem 1.5rem;
  font-weight: bold;
  font-size: 1.1rem;
`;

const CourseBody = styled.div`
  padding: 1.5rem;
`;

const ProgressTrack = styled.div`
  background-color: #e5e7eb;
  border-radius: 8px;
  height: 8px;
  overflow: hidden;
  margin: 0.5rem 0 1rem 0;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${props => props.percentage}%;
  background-color: #2b4361;
  transition: width 0.3s ease-in-out;
`;

const ActionButton = styled.button`
  background-color: #2b4361;
  color: white;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;

  &:hover {
    background-color: #1e2e45;
  }
`;

const CertButton = styled(Link)`
  display: inline-block;
  margin-top: 2rem;
  background-color: #2b4361;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  text-align: center;

  &:hover {
    background-color: #1e2e45;
  }
`;

// Componente principal
const DashboardPage = () => {
  const { user } = useAuth();
  const { speak } = useVoice();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [progressData, setProgressData] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [stats, setStats] = useState({ totalLessonsCompleted: 0, totalCourses: 0, activeCourses: 0, completedCourses: 0 });

  // Cargar datos
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const coursesRes = await courseService.getAllCourses({ includeModules: true });
        const progressRes = await progressService.getUserProgress(user.id);
        const evalsRes = await evaluationService.getUserEvaluations(user.id);

        const courses = coursesRes.data || [];
        const progress = progressRes.data || [];
        const evals = evalsRes.data || [];

        const completedLessons = progress.filter(p => p.completado === 1).length;
        const activeCourseIds = new Set();
        const completedCourseIds = new Set();

        courses.forEach(course => {
          const lessons = course.modules?.flatMap(m => m.lessons || []) || [];
          const completed = lessons.filter(lesson => progress.some(p => Number(p.lesson_id) === Number(lesson.id) && p.completado === 1)).length;

          if (completed > 0) activeCourseIds.add(course.id);
          if (lessons.length > 0 && completed === lessons.length) completedCourseIds.add(course.id);
        });

        setStats({
          totalLessonsCompleted: completedLessons,
          totalCourses: courses.length,
          activeCourses: activeCourseIds.size,
          completedCourses: completedCourseIds.size
        });

        setCourses(courses);
        setProgressData(progress);
        setEvaluations(evals);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  // Control de reproducción de bienvenida solo una vez por día
  useEffect(() => {
    if (!loading && user && user.nombre) {
      const welcomeKey = `welcome_played_${user.id}_${new Date().toDateString()}`;
      const alreadyWelcomed = localStorage.getItem(welcomeKey);

      if (!alreadyWelcomed) {
        setTimeout(() => {
          speak(`Bienvenido de nuevo, ${user.nombre}. Has completado ${stats.totalLessonsCompleted} lecciones hasta ahora.`, () => {
            localStorage.setItem(welcomeKey, 'true');
          });
        }, 1000);
      }
    }
  }, [loading, user, stats.totalLessonsCompleted, speak]);

  const getFirstPendingActivity = (course) => {
    for (const module of course.modules || []) {
      for (const lesson of module.lessons || []) {
        const isCompleted = progressData.some(p => Number(p.lesson_id) === Number(lesson.id) && p.completado === 1);
        if (!isCompleted) return { type: 'lesson', id: lesson.id };
      }
      const hasCompletedEval = evaluations.some(e => Number(e.module_id) === Number(module.id));
      if (!hasCompletedEval) return { type: 'evaluation', id: module.id };
    }
    return null;
  };

  const calculateProgress = (course) => {
    const allLessons = course.modules?.flatMap(m => m.lessons || []) || [];
    const completed = allLessons.filter(lesson => progressData.some(p => Number(p.lesson_id) === Number(lesson.id) && p.completado === 1)).length;
    return allLessons.length ? Math.round((completed / allLessons.length) * 100) : 0;
  };

  if (loading) return <Container><p>Cargando...</p></Container>;

  return (
    <Container>
      <Title>Bienvenido, {user?.nombre}</Title>
      <SubText>Resumen de tu progreso y actividades recientes.</SubText>

      <StatsGrid>
        <StatCard><p>Lecciones Completadas</p><h2>{stats.totalLessonsCompleted}</h2></StatCard>
        <StatCard><p>Cursos Activos</p><h2>{stats.activeCourses} / {stats.totalCourses}</h2></StatCard>
        <StatCard><p>Cursos Completados</p><h2>{stats.completedCourses}</h2></StatCard>
      </StatsGrid>

      <h2 style={{ color: '#2b4361' }}>Tus Cursos</h2>
      <CoursesGrid>
        {courses.map(course => {
          const percentage = calculateProgress(course);
          const next = getFirstPendingActivity(course);

          return (
            <CourseCard key={course.id}>
              <CourseHeader>{course.titulo}</CourseHeader>
              <CourseBody>
                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Progreso: {percentage}%</p>
                <ProgressTrack>
                  <ProgressFill percentage={percentage} />
                </ProgressTrack>
                <ActionButton onClick={() => {
                  if (next) {
                    navigate(`/courses/${course.id}?type=${next.type}&id=${next.id}`);
                  } else {
                    navigate(`/courses/${course.id}`);
                  }
                }}>
                  {percentage > 0 ? 'Continuar' : 'Comenzar'}
                </ActionButton>
              </CourseBody>
            </CourseCard>
          );
        })}
      </CoursesGrid>

      <CertButton to="/certificados">📄 Ver Certificados</CertButton>
    </Container>
  );
};

export default DashboardPage;
