import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import analyticsService from '../../services/analyticsService';

const ProgressContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
  
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const FullWidthContainer = styled.div`
  grid-column: 1 / -1;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
`;

const CardTitle = styled.h3`
  margin: 0 0 20px 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
`;

const StatItem = styled.div`
  text-align: center;
  padding: 16px;
  background: ${props => props.background || '#f8fafc'};
  border-radius: 8px;
  border-left: 4px solid ${props => props.color || '#4f46e5'};
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 6px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: ${props => props.color || '#4f46e5'};
  border-radius: 4px;
  transition: width 0.3s ease;
  width: ${props => props.percentage || 0}%;
`;

const StudentList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  
  /* Scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #f1f5f9; 
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1; 
    border-radius: 3px;
  }
`;

const StudentItem = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.2s;
  
  &:hover {
    background: #f8fafc;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const StudentInfo = styled.div`
  flex: 1;
`;

const StudentName = styled.div`
  font-weight: 500;
  color: #1f2937;
  font-size: 14px;
`;

const StudentProgress = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
`;

const StatusBadge = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  margin-left: 12px;
  min-width: 70px;
  text-align: center;
  
  ${props => {
    switch (props.status) {
      case 'completado':
        return 'background: #dcfce7; color: #166534;';
      case 'activo':
        return 'background: #dbeafe; color: #1e40af;';
      case 'en_pausa':
        return 'background: #fef3c7; color: #92400e;';
      case 'inactivo':
        return 'background: #fee2e2; color: #991b1b;';
      default:
        return 'background: #f3f4f6; color: #374151;';
    }
  }}
`;

/* Nuevos estilos para la vista hibrida de modulos */
const ModuleGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  
  @media (min-width: 1200px) {
    grid-template-columns: 1fr; 
  }
`;

const ModuleListCompact = styled.div`
  margin-top: 16px;
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: #f1f5f9; 
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1; 
    border-radius: 3px;
  }
`;

const ModuleItemCompact = styled.div`
  padding: 8px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  border-bottom: 1px dashed #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
`;

const LoadingContainer = styled.div`
  padding: 40px;
  text-align: center;
  color: #6b7280;
`;

const ErrorContainer = styled.div`
  padding: 40px;
  text-align: center;
  color: #ef4444;
`;

const ProgressTracker = ({ documentId }) => {
  const [progressData, setProgressData] = useState(null);
  const [detailedProgress, setDetailedProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (documentId) {
      loadProgressData();
    }
  }, [documentId]);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos de progreso
      const [overview, detailed] = await Promise.all([
        analyticsService.getMentorProgress(documentId, 'overview'),
        analyticsService.getMentorProgress(documentId, 'detailed_progress')
      ]);

      setProgressData(overview);
      setDetailedProgress(detailed);
      
    } catch (err) {
      console.error('Error cargando datos de progreso:', err);
      setError('Error al cargar los datos de progreso');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      completado: 'Completado',
      activo: 'Activo',
      en_pausa: 'En Pausa',
      inactivo: 'Inactivo',
      iniciando: 'Iniciando'
    };
    return labels[status] || status;
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 60) return '#f59e0b';
    if (percentage >= 40) return '#ef4444';
    return '#6b7280';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Datos para gráficos
  const moduleDistributionData = progressData?.module_distribution?.map(item => ({
    modulo: `Mod ${item.modulo}`,
    nombreCompleto: `Módulo ${item.modulo}`,
    estudiantes: item.estudiantes,
    promedio: item.promedio_leccion,
    fullMark: 10 // Asumiendo que 10 es el maximo de lecciones o score
  })) || [];

  const weeklyProgressData = progressData?.weekly_progress?.map((item, index) => ({
    semana: `S${index + 1}`,
    estudiantes: item.estudiantes_activos,
    temas: item.temas_completados
  })) || [];

  if (loading) {
    return (
      <Card>
        <LoadingContainer>
          Cargando datos de progreso...
        </LoadingContainer>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorContainer>
          {error}
          <br />
          <button 
            onClick={loadProgressData}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
        </ErrorContainer>
      </Card>
    );
  }

  const overview = progressData?.overview || {};

  return (
    <>
      {/* Estadísticas generales */}
      <FullWidthContainer>
        <Card>
          <CardTitle>🎓 Resumen del Progreso Mentor</CardTitle>
          <StatsGrid>
            <StatItem color="#4f46e5" background="#f0f9ff">
              <StatValue>{overview.total_estudiantes || 0}</StatValue>
              <StatLabel>Total Estudiantes</StatLabel>
            </StatItem>
            <StatItem color="#10b981" background="#f0fdf4">
              <StatValue>{overview.estudiantes_activos || 0}</StatValue>
              <StatLabel>Activos</StatLabel>
            </StatItem>
            <StatItem color="#f59e0b" background="#fffbeb">
              <StatValue>{overview.completados || 0}</StatValue>
              <StatLabel>Completados</StatLabel>
            </StatItem>
            <StatItem color="#ef4444" background="#fef2f2">
              <StatValue>{overview.tasa_finalizacion || 0}%</StatValue>
              <StatLabel>Tasa Finalización</StatLabel>
            </StatItem>
            <StatItem color="#8b5cf6" background="#faf5ff">
              <StatValue>{overview.promedio_modulo || 0}</StatValue>
              <StatLabel>Módulo Promedio</StatLabel>
            </StatItem>
            <StatItem color="#06b6d4" background="#f0fdfa">
              <StatValue>{overview.promedio_leccion || 0}</StatValue>
              <StatLabel>Lección Promedio</StatLabel>
            </StatItem>
          </StatsGrid>
        </Card>
      </FullWidthContainer>

      <ProgressContainer>
        {/* Progreso Semanal (Line Chart) */}
        <Card>
          <CardTitle>📈 Tendencia Semanal</CardTitle>
          <div style={{ flex: 1, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="semana" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="estudiantes" 
                  stroke="#4f46e5" 
                  strokeWidth={2}
                  dot={{ fill: '#4f46e5', strokeWidth: 2, r: 4 }}
                  name="Estudiantes Activos"
                />
                <Line 
                  type="monotone" 
                  dataKey="temas" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Temas Completados"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Balance del Curso (Radar Chart + List) */}
        <Card>
          <CardTitle>🎯 Balance de Módulos (Radar)</CardTitle>
          <ModuleGrid>
            {/* Gráfico de Radar */}
            <div style={{ height: 220, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={moduleDistributionData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="modulo" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                  <Radar
                    name="Lección Promedio"
                    dataKey="promedio"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="#8b5cf6"
                    fillOpacity={0.4}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Lista Compacta de Detalles */}
            <ModuleListCompact>
              {moduleDistributionData.map((module, index) => (
                <ModuleItemCompact key={index}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 500, color: '#374151'}}>{module.nombreCompleto}</div>
                    <div style={{fontSize: 11, color: '#9ca3af'}}>{module.estudiantes} Estudiantes</div>
                  </div>
                  <div style={{textAlign: 'right', width: '35%'}}>
                    <div style={{fontSize: 12, fontWeight: 600, color: '#4f46e5'}}>
                      Avg: {module.promedio}
                    </div>
                    <ProgressBar style={{height: 4}}>
                       <ProgressFill 
                          percentage={(module.promedio / 10) * 100} 
                          color={getProgressColor((module.promedio / 10) * 100)} 
                       />
                    </ProgressBar>
                  </div>
                </ModuleItemCompact>
              ))}
            </ModuleListCompact>
          </ModuleGrid>
        </Card>
      </ProgressContainer>

      {/* Lista detallada de estudiantes */}
      <FullWidthContainer>
        <Card>
          <CardTitle>👥 Detalle de Estudiantes</CardTitle>
          <StudentList>
            {detailedProgress.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                No hay estudiantes en modo mentor registrados
              </div>
            ) : (
              detailedProgress.map((student, index) => (
                <StudentItem key={student.user_id}>
                  <StudentInfo>
                    <StudentName>{student.nombre}</StudentName>
                    <StudentProgress>
                      Módulo {student.modulo_actual} • Lección {student.leccion_actual}
                    </StudentProgress>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      Última actividad: {formatDate(student.ultima_actividad)}
                    </div>
                  </StudentInfo>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ minWidth: '80px', textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                        {student.progreso_porcentaje}%
                      </div>
                      <ProgressBar style={{ width: '60px', margin: '4px 0 4px auto' }}>
                        <ProgressFill 
                          percentage={student.progreso_porcentaje} 
                          color={getProgressColor(student.progreso_porcentaje)}
                        />
                      </ProgressBar>
                    </div>
                    <StatusBadge status={student.estado}>
                      {getStatusLabel(student.estado)}
                    </StatusBadge>
                  </div>
                </StudentItem>
              ))
            )}
          </StudentList>
        </Card>
      </FullWidthContainer>
    </>
  );
};

export default ProgressTracker;