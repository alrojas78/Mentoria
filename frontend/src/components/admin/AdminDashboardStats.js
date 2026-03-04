import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../../services/api';

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-left: 4px solid ${props => props.color || '#0891B2'};
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: #2b4361;
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 0.25rem;
`;

const StatSub = styled.div`
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.5rem;
`;

const Section = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h3`
  color: #2b4361;
  margin: 0 0 1rem 0;
  font-size: 1rem;
`;

const RoleBar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
  gap: 0.75rem;
`;

const RoleName = styled.span`
  min-width: 120px;
  font-size: 0.9rem;
  color: #374151;
  text-transform: capitalize;
`;

const RoleBarFill = styled.div`
  flex: 1;
  height: 24px;
  background: #f3f4f6;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
`;

const RoleFill = styled.div`
  height: 100%;
  background: ${props => props.color || '#0891B2'};
  border-radius: 12px;
  width: ${props => props.percent}%;
  transition: width 0.5s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  min-width: ${props => props.percent > 0 ? '30px' : '0'};
`;

const RoleCount = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
`;

const roleColors = {
  admin: '#dc2626',
  mentor: '#7c3aed',
  estudiante: '#0891B2',
  coordinador: '#059669',
  default: '#6366f1'
};

const AdminDashboardStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/admin/dashboard-stats.php`);
        if (res.data?.success) {
          setStats(res.data);
        }
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando estadísticas...</div>;
  if (!stats) return <div style={{ padding: '2rem', color: '#dc2626' }}>Error cargando datos</div>;

  const maxCount = Math.max(...(stats.role_distribution || []).map(r => r.count), 1);

  return (
    <div>
      <StatsGrid>
        <StatCard color="#0891B2">
          <StatValue>{stats.total_users}</StatValue>
          <StatLabel>Usuarios Registrados</StatLabel>
          <StatSub>Total en la plataforma</StatSub>
        </StatCard>

        <StatCard color="#059669">
          <StatValue>{stats.active_users}</StatValue>
          <StatLabel>Usuarios Activos</StatLabel>
          <StatSub>{stats.active_rate}% de tasa de actividad (7 días)</StatSub>
        </StatCard>

        <StatCard color="#7c3aed">
          <StatValue>{stats.total_documents}</StatValue>
          <StatLabel>Documentos</StatLabel>
          <StatSub>Contenidos disponibles</StatSub>
        </StatCard>
      </StatsGrid>

      <Section>
        <SectionTitle>Distribución por Grupo / Rol</SectionTitle>
        {(stats.role_distribution || []).map((role, i) => (
          <RoleBar key={i}>
            <RoleName>{role.role}</RoleName>
            <RoleBarFill>
              <RoleFill
                percent={(role.count / maxCount) * 100}
                color={roleColors[role.role] || roleColors.default}
              >
                <RoleCount>{role.count}</RoleCount>
              </RoleFill>
            </RoleBarFill>
          </RoleBar>
        ))}
      </Section>
    </div>
  );
};

export default AdminDashboardStats;
