// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom'; // Añadir Link aquí
import styled from 'styled-components';

// Importar componentes
import AdminUserManagement from '../components/admin/AdminUserManagement';
import AdminCourseManagement from '../components/admin/AdminCourseManagement';
import AdminEvaluationManagement from '../components/admin/AdminEvaluationManagement';
import AdminAnalytics from '../components/admin/AdminAnalytics';

// Servicios
import { userService, courseService, progressService, evaluationService } from '../services/api';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  color: #2b4361;
  margin: 0;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 2rem;
`;

const Tab = styled.div`
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  color: ${props => props.active ? '#2b4361' : '#6b7280'};
  border-bottom: ${props => props.active ? '2px solid #2b4361' : 'none'};
  
  &:hover {
    color: #2b4361;
  }
`;

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalLessons: 0,
    activeUsers: 0,
    completedCourses: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch summary statistics
        const usersRes = await userService.getAll();
        const coursesRes = await courseService.getAllCourses();
        const progress = await progressService.getSystemProgress();
        const evaluations = await evaluationService.getAllEvaluations();
        
        setStats({
          totalUsers: usersRes.data.length,
          totalCourses: coursesRes.data.length,
          totalLessons: coursesRes.data.reduce((acc, course) => {
            return acc + course.modules?.reduce((mAcc, module) => 
              mAcc + (module.lessons?.length || 0), 0) || 0;
          }, 0),
          activeUsers: progress.data.activeUsers || 0,
          completedCourses: progress.data.completedCourses || 0,
          totalEvaluations: evaluations.data.length || 0
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos del dashboard:', error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Redirige si no es admin
  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin-panel" />;
  }

  return (
    <Container>
      <Header>
        <Title>Panel de Administración</Title>
      </Header>
      
      <div className="list-group mb-4">
        <h3>Configuración del Sistema</h3>
        <Link to="/admin/voice-service" className="list-group-item list-group-item-action">
          Configurar Servicio de Voz
        </Link>
<Link to="/admin/documentos" className="list-group-item list-group-item-action">
</Link>
  
        {/* otros enlaces */}
      </div> 
      
      <TabContainer>
        <Tab 
          active={activeTab === 'analytics'} 
          onClick={() => setActiveTab('analytics')}
        >
          Analíticas
        </Tab>
        <Tab 
          active={activeTab === 'users'} 
          onClick={() => setActiveTab('users')}
        >
          Usuarios
        </Tab>
        <Tab 
          active={activeTab === 'courses'} 
          onClick={() => setActiveTab('courses')}
        >
          Cursos
        </Tab>
        <Tab 
          active={activeTab === 'evaluations'} 
          onClick={() => setActiveTab('evaluations')}
        >
          Evaluaciones
        </Tab>
      </TabContainer>

      {loading ? (
        <div>Cargando datos...</div>
      ) : (
        <>
          {activeTab === 'analytics' && <AdminAnalytics stats={stats} />}
          {activeTab === 'users' && <AdminUserManagement />}
          {activeTab === 'courses' && <AdminCourseManagement />}
          {activeTab === 'evaluations' && <AdminEvaluationManagement />}
        </>
      )}
    </Container>
  );
};

export default AdminDashboard;