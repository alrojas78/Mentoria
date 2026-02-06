import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { courseService, lessonService } from '../services/api';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
`;

const CourseHeader = styled.div`
  margin-bottom: 2rem;
`;

const ModuleCard = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const LessonList = styled.ul`
  list-style: none;
  padding: 0;
`;

const LessonItem = styled.li`
  padding: 0.75rem 0;
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
  }
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
`;

const CourseDetailPage = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        const courseResponse = await courseService.getCourseById(id);
        setCourse(courseResponse.data);
  
        const modulesResponse = await courseService.getModulesByCourse(id);
        setModules(modulesResponse.data); // <-- aquí vienen también las lecciones
  
        setLoading(false);
      } catch (err) {
        setError('Error al cargar los datos del curso');
        setLoading(false);
      }
    };
  
    fetchCourseData();
  }, [id]);
  

  if (loading) return <Container>Cargando...</Container>;
  if (error) return <Container>Error: {error}</Container>;

  return (
    <Container>
      <CourseHeader>
        <h1>{course?.titulo}</h1>
        <p>{course?.descripcion}</p>
      </CourseHeader>

      {Array.isArray(modules) && modules.map(module => (
        <ModuleCard key={module.id}>
          <h2>{module.title}</h2>

          <LessonList>
  {module.lessons?.map(lesson => (
    <LessonItem key={lesson.id}>
      <Link to={`/lessons/${lesson.id}`}>
        {lesson.titulo}
      </Link>
    </LessonItem>
  ))}
</LessonList>

          <Link to={`/evaluations/${module.id}`}>
            <Button>Realizar Evaluación del Módulo</Button>
          </Link>
        </ModuleCard>
      ))}
    </Container>
  );
};

export default CourseDetailPage;
