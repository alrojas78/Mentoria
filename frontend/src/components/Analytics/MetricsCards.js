// src/components/Analytics/MetricsCards.js
import React from 'react';
import styled from 'styled-components';

// ==========================================
// STYLED COMPONENTS
// ==========================================

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const Card = styled.div`
  background: ${props => props.gradient};
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
  color: white;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
`;

const CardTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
`;

const CardIcon = styled.div`
  font-size: 2rem;
  opacity: 0.8;
`;

const CardValue = styled.div`
  font-size: 32px;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
  position: relative;
  z-index: 1;
`;

const CardChange = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 0.9;
`;

const ChangeIcon = styled.span`
  font-size: 0.8rem;
`;

const CardFooter = styled.div`
  margin-top: 1rem;
  font-size: 0.85rem;
  opacity: 0.8;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 1rem;
`;

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

const MetricsCards = ({ metrics, timelyTrends }) => {
  // Función para calcular cambios porcentuales
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isPositive: change >= 0
    };
  };

  // Función para formatear números grandes
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  // Función para formatear tiempo
  const formatTime = (minutes) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  // Obtener datos de tendencias para comparación (último vs anterior)
  const getTrendComparison = (metricKey) => {
    if (!timelyTrends || timelyTrends.length < 2) {
      return { value: 0, isPositive: true };
    }
    
    const latest = timelyTrends[timelyTrends.length - 1];
    const previous = timelyTrends[timelyTrends.length - 2];
    
    return calculateChange(latest[metricKey] || 0, previous[metricKey] || 0);
  };

  // Validar que metrics existe
  if (!metrics) {
    return (
      <Grid>
        <Card gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
          <CardHeader>
            <CardTitle>Cargando Métricas...</CardTitle>
            <CardIcon>📊</CardIcon>
          </CardHeader>
          <CardValue>---</CardValue>
        </Card>
      </Grid>
    );
  }

  // Datos para las tarjetas de métricas
  const metricsData = [
    {
      title: 'Usuarios Únicos',
      icon: '👥',
      value: formatNumber(metrics.usuarios_unicos || 0),
      change: getTrendComparison('usuarios_unicos'),
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      footer: 'Total de usuarios que han interactuado'
    },
    {
      title: 'Sesiones Activas',
      icon: '💬',
      value: formatNumber(metrics.sesiones_totales || 0),
      change: getTrendComparison('sesiones_totales'),
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      footer: 'Conversaciones iniciadas'
    },
    {
      title: 'Preguntas Realizadas',
      icon: '❓',
      value: formatNumber(metrics.total_preguntas || 0),
      change: getTrendComparison('total_preguntas'),
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      footer: 'Preguntas formuladas por usuarios'
    },
    {
      title: 'Tiempo Promedio',
      icon: '⏱️',
      value: formatTime(metrics.tiempo_promedio_sesion || 0),
      change: getTrendComparison('tiempo_promedio_sesion'),
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      footer: 'Duración promedio por sesión'
    },
    {
      title: 'Modo Mentor',
      icon: '🎓',
      value: formatNumber(metrics.usuarios_modo_mentor || 0),
      change: getTrendComparison('usuarios_modo_mentor'),
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      footer: 'Usuarios que han usado modo mentor'
    },
    {
      title: 'Evaluaciones',
      icon: '📝',
      value: formatNumber(metrics.total_evaluaciones || 0),
      change: getTrendComparison('total_evaluaciones'),
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      footer: 'Evaluaciones completadas'
    },
    {
      title: 'Tasa de Aprobación',
      icon: '✅',
      value: `${(metrics.tasa_aprobacion || 0).toFixed(1)}%`,
      change: getTrendComparison('tasa_aprobacion'),
      gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      footer: 'Porcentaje de evaluaciones aprobadas'
    },
    {
      title: 'Puntuación Promedio',
      icon: '⭐',
      value: `${(metrics.puntuacion_promedio || 0).toFixed(1)}`,
      change: getTrendComparison('puntuacion_promedio'),
      gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      footer: 'Calificación promedio en evaluaciones'
    }
  ];

  return (
    <Grid>
      {metricsData.map((metric, index) => (
        <Card key={index} gradient={metric.gradient}>
          <CardHeader>
            <CardTitle>{metric.title}</CardTitle>
            <CardIcon>{metric.icon}</CardIcon>
          </CardHeader>
          
          <CardValue>{metric.value}</CardValue>
          
          <CardChange>
            <ChangeIcon>
              {metric.change.isPositive ? '📈' : '📉'}
            </ChangeIcon>
            <span>
              {metric.change.isPositive ? '+' : '-'}{metric.change.value}%
            </span>
            <span>vs período anterior</span>
          </CardChange>
          
          <CardFooter>
            {metric.footer}
          </CardFooter>
        </Card>
      ))}
    </Grid>
  );
};

export default MetricsCards;