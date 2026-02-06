// src/components/admin/AdminAnalytics.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { progressService, evaluationService, courseService } from '../../services/api';

const Container = styled.div`
  margin-bottom: 2rem;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background-color: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 2.2rem;
  font-weight: bold;
  color: #2b4361;
  margin: 0.5rem 0;
`;

const StatLabel = styled.div`
  color: #6b7280;
  font-size: 0.95rem;
`;

const ChartContainer = styled.div`
  background-color: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  margin-bottom: 1.5rem;
`;

const ChartTitle = styled.h3`
  color: #2b4361;
  margin-top: 0;
  margin-bottom: 1.5rem;
`;

const ChartsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
`;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const AdminAnalytics = ({ stats }) => {
  const [activityData, setActivityData] = useState([]);
  const [courseCompletionData, setCourseCompletionData] = useState([]);
  const [evaluationScoresData, setEvaluationScoresData] = useState([]);
  const [userRegistrationData, setUserRegistrationData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        
        // Obtener datos de actividad por día
        const activityResponse = await progressService.getActivityByDay();
        setActivityData(activityResponse.data || []);
        
        // Obtener datos de completitud por curso
        const coursesResponse = await courseService.getAllCourses();
        const coursesWithCompletion = await Promise.all(
          coursesResponse.data.map(async course => {
            const completionData = await progressService.getCourseCompletion(course.id);
            return {
              name: course.titulo,
              completionRate: completionData.data.completionRate || 0,
              studentCount: completionData.data.studentCount || 0
            };
          })
        );
        setCourseCompletionData(coursesWithCompletion);
        
        // Obtener datos de evaluaciones
        const evaluationsResponse = await evaluationService.getScoreDistribution();
        setEvaluationScoresData(evaluationsResponse.data || []);
        
        // Obtener registros de usuarios por fecha
        const registrationsResponse = await progressService.getUserRegistrationsByDate();
        setUserRegistrationData(registrationsResponse.data || []);
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos analíticos:', error);
        setLoading(false);
      }
    };
    
    // Para el propósito de este ejemplo, generaremos datos de muestra en lugar de llamar a la API
    const generateSampleData = () => {
      // Actividad por día (últimos 7 días)
      const activity = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
          lecciones: Math.floor(Math.random() * 50) + 10,
          evaluaciones: Math.floor(Math.random() * 20) + 5
        };
      });
      setActivityData(activity);
      
      // Completitud por curso
      const courses = [
        { name: "Introducción a Vilzermet", completionRate: 68, studentCount: 45 },
        { name: "Técnicas de Presentación", completionRate: 42, studentCount: 37 },
        { name: "Farmacología Básica", completionRate: 85, studentCount: 28 },
        { name: "Estrategias de Ventas", completionRate: 56, studentCount: 52 }
      ];
      setCourseCompletionData(courses);
      
      // Distribución de calificaciones
      const scores = [
        { range: "0-20", count: 5 },
        { range: "21-40", count: 12 },
        { range: "41-60", count: 25 },
        { range: "61-80", count: 48 },
        { range: "81-100", count: 32 }
      ];
      setEvaluationScoresData(scores);
      
      // Registros por fecha (últimos 6 meses)
      const registrations = [];
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
        registrations.push({
          month: date.toLocaleDateString('es-ES', { month: 'short' }),
          usuarios: Math.floor(Math.random() * 15) + 5
        });
      }
      setUserRegistrationData(registrations);
      
      setLoading(false);
    };
    
    generateSampleData();
    // Si la API estuviera lista, usaríamos:
    // fetchAnalyticsData();
  }, []);

  if (loading) {
    return <div>Cargando datos analíticos...</div>;
  }

  return (
    <Container>
      <StatsGrid>
        <StatCard>
          <StatValue>{stats.totalUsers}</StatValue>
          <StatLabel>Usuarios Totales</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.totalCourses}</StatValue>
          <StatLabel>Cursos</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.totalLessons}</StatValue>
          <StatLabel>Lecciones</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.activeUsers}</StatValue>
          <StatLabel>Usuarios Activos</StatLabel>
        </StatCard>
        <StatCard>
          <StatValue>{stats.completedCourses}</StatValue>
          <StatLabel>Cursos Completados</StatLabel>
        </StatCard>
      </StatsGrid>

      <ChartsRow>
        <ChartContainer>
          <ChartTitle>Actividad Diaria</ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={activityData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="lecciones" stroke="#8884d8" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="evaluaciones" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Registros de Usuarios</ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={userRegistrationData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="usuarios" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </ChartsRow>

      <ChartsRow>
        <ChartContainer>
          <ChartTitle>Tasa de Completitud por Curso</ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={courseCompletionData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis dataKey="name" type="category" width={80} />
              <Tooltip formatter={(value) => [`${value}%`, 'Completado']} />
              <Legend />
              <Bar dataKey="completionRate" fill="#0088FE" name="Tasa de Completitud (%)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>Distribución de Calificaciones</ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={evaluationScoresData}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="range"
                label={({range, count}) => `${range}: ${count}`}
              >
                {evaluationScoresData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </ChartsRow>
    </Container>
  );
};

export default AdminAnalytics;