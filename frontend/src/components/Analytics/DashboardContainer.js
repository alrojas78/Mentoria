// src/components/Analytics/DashboardContainer.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import analyticsService from '../../services/analyticsService';
import MetricsCards from './MetricsCards';
import ActivityChart from './ActivityChart';
import UserRankingTable from './UserRankingTable';
import ProgressTracker from './ProgressTracker';
import EvaluationResults from './EvaluationResults';
import QuestionRanking from './QuestionRanking';
import RetoResults from './RetoResults';

// ==========================================
// STYLED COMPONENTS
// ==========================================

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f8fafc;
  min-height: 100vh;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
`;

const RefreshButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const TabContainer = styled.div`
  display: flex;
  background: white;
  border-radius: 12px;
  padding: 0.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-x: auto;

  @media (max-width: 768px) {
    flex-wrap: nowrap;
    gap: 0.5rem;
  }
`;

const Tab = styled.button`
  flex: 1;
  min-width: 120px;
  padding: 1rem 1.5rem;
  border: none;
  background: ${props => props.active ? '#667eea' : 'transparent'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  font-weight: ${props => props.active ? '600' : '500'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover {
    background: ${props => props.active ? '#667eea' : '#f3f4f6'};
    color: ${props => props.active ? 'white' : '#374151'};
  }

  @media (max-width: 768px) {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }
`;

const ContentArea = styled.div`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  font-size: 1.2rem;
  color: #6b7280;
`;

const ErrorContainer = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 1.5rem;
  border-radius: 12px;
  text-align: center;
  margin: 2rem 0;
`;

const LastUpdated = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
  
  @media (max-width: 768px) {
    justify-content: center;
  }
`;

const PlaceholderMessage = styled.div`
  text-align: center;
  padding: 3rem;
  color: #6b7280;
  font-size: 1.1rem;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px dashed #d1d5db;
`;

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

const DashboardContainer = () => {
  const { documentId } = useParams();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ==========================================
  // FUNCIONES DE CARGA DE DATOS
  // ==========================================

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Verificar si analytics están habilitados
      const analyticsEnabled = await analyticsService.checkAnalyticsEnabled(documentId);
      
      if (!analyticsEnabled) {
        setError('Las analíticas no están habilitadas para este documento.');
        return;
      }

      // Cargar datos del dashboard
      const data = await analyticsService.getDashboardSummary(documentId);
      setDashboardData(data);
      setLastUpdated(new Date());

      // Simular carga de información del documento (deberías obtener esto de tu API de documentos)
      setDocumentInfo({
        id: documentId,
        titulo: 'Documento Médico', // Esto debería venir de tu API
        descripcion: 'Análisis de interacciones y progreso'
      });

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setError('Error al cargar los datos del dashboard. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    if (documentId) {
      loadDashboardData();
    }
  }, [documentId, loadDashboardData]);

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        handleRefresh();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [loading, refreshing]);

  // ==========================================
  // FUNCIONES DE RENDERIZADO
  // ==========================================

  const renderTabContent = () => {
    if (!dashboardData) return null;

    switch (activeTab) {
case 'overview':
  return (
    <>
      <MetricsCards 
        metrics={dashboardData.metrics} 
        timelyTrends={dashboardData.timelyTrends}
      />
      <ActivityChart documentId={documentId} />
      <QuestionRanking documentId={documentId} />
    </>
  );
case 'users':
  return (
    <>
      <UserRankingTable documentId={documentId} />
    </>
  );
case 'progress':
  return (
    <>
      <ProgressTracker documentId={documentId} />
    </>
  );
case 'evaluations':
  return (
    <>
      <EvaluationResults documentId={documentId} />
    </>
  );
case 'retos':
  return (
    <>
      <RetoResults documentId={documentId} />
    </>
  );
      case 'temporal':
        return (
          <PlaceholderMessage>
            🕒 Las consultas a la IA se implementarán próximamente
          </PlaceholderMessage>
        );
      default:
        return null;
    }
  };

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          Cargando datos del dashboard...
        </LoadingContainer>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorContainer>
          {error}
        </ErrorContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <div>
          <Title>Dashboard de Analíticas</Title>
          <Subtitle>
            {documentInfo ? documentInfo.titulo : `Documento #${documentId}`}
          </Subtitle>
        </div>
        <div>
          <RefreshButton 
            onClick={handleRefresh} 
            disabled={refreshing}
          >
            {refreshing ? 'Actualizando...' : 'Actualizar Datos'}
          </RefreshButton>
          {lastUpdated && (
            <LastUpdated>
              🕒 Última actualización: {lastUpdated.toLocaleTimeString()}
            </LastUpdated>
          )}
        </div>
      </Header>

      <TabContainer>
        <Tab 
          active={activeTab === 'overview'} 
          onClick={() => setActiveTab('overview')}
        >
          📊 Resumen
        </Tab>
        <Tab 
          active={activeTab === 'users'} 
          onClick={() => setActiveTab('users')}
        >
          👥 Usuarios
        </Tab>
        <Tab 
          active={activeTab === 'progress'} 
          onClick={() => setActiveTab('progress')}
        >
          📈 Progreso
        </Tab>
        <Tab
          active={activeTab === 'evaluations'}
          onClick={() => setActiveTab('evaluations')}
        >
          🎯 Evaluaciones
        </Tab>
        <Tab
          active={activeTab === 'retos'}
          onClick={() => setActiveTab('retos')}
        >
          🏆 Retos
        </Tab>
        <Tab
          active={activeTab === 'temporal'}
          onClick={() => setActiveTab('temporal')}
        >
          🕒 Consultas IA
        </Tab>
      </TabContainer>

      <ContentArea>
        {renderTabContent()}
      </ContentArea>
    </Container>
  );
};

export default DashboardContainer;