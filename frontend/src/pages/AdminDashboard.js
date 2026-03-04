// src/pages/AdminDashboard.js
// Fase 5: Panel Admin reestructurado — 5 tabs consolidados
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import styled from 'styled-components';

// Componentes del panel
import AdminDashboardStats from '../components/admin/AdminDashboardStats';
import AdminUserManagement from '../components/admin/AdminUserManagement';
import AdminGruposContenido from '../components/admin/AdminGruposContenido';
import AdminDocumentosPage from './admin/AdminDocumentosPage';
import AdminNotificaciones from '../components/admin/AdminNotificaciones';
import VoiceServiceAdmin from '../components/admin/VoiceServiceAdmin';
import AdminSeguimiento from '../components/admin/AdminSeguimiento';
import AdminProyectos from '../components/admin/AdminProyectos';
import AdminWhatsAppTraining from '../components/admin/AdminWhatsAppTraining';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const Title = styled.h1`
  color: #2b4361;
  margin: 0;
  font-size: 1.6rem;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tab = styled.div`
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  font-weight: ${props => props.$active ? '700' : '500'};
  color: ${props => props.$active ? '#0891B2' : '#6b7280'};
  border-bottom: ${props => props.$active ? '3px solid #0891B2' : '3px solid transparent'};
  white-space: nowrap;
  transition: all 0.2s;
  font-size: 0.95rem;

  &:hover {
    color: #0891B2;
    background: #f0fdfa;
  }
`;

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Usuarios' },
  { id: 'groups', label: 'Grupos de Contenido' },
  { id: 'documents', label: 'Documentos' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'wa-training', label: 'WA Training' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'config', label: 'Configuración' },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!user || user.role !== 'admin') {
    return <Navigate to="/documentos" />;
  }

  return (
    <Container>
      <Header>
        <Title>Panel de Administración</Title>
      </Header>

      <TabContainer>
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            $active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Tab>
        ))}
      </TabContainer>

      {activeTab === 'dashboard' && <AdminDashboardStats />}
      {activeTab === 'users' && <AdminUserManagement />}
      {activeTab === 'groups' && <AdminGruposContenido />}
      {activeTab === 'documents' && <AdminDocumentosPage embedded />}
      {activeTab === 'seguimiento' && <AdminSeguimiento />}
      {activeTab === 'proyectos' && <AdminProyectos />}
      {activeTab === 'wa-training' && <AdminWhatsAppTraining />}
      {activeTab === 'notificaciones' && <AdminNotificaciones />}
      {activeTab === 'config' && <VoiceServiceAdmin />}
    </Container>
  );
};

export default AdminDashboard;
