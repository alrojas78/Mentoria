import React, { useState, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import styled from 'styled-components';
import analyticsService from '../../services/analyticsService';

const ChartContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
`;

const ChartTitle = styled.h3`
  margin: 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 600;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const FilterButton = styled.button`
  padding: 8px 16px;
  border: 2px solid ${props => props.active ? '#4f46e5' : '#e5e7eb'};
  background: ${props => props.active ? '#4f46e5' : 'white'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    border-color: #4f46e5;
    background: ${props => props.active ? '#4338ca' : '#f8fafc'};
  }
`;

const ChartTypeSelector = styled.select`
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #4f46e5;
  }
`;

const LoadingContainer = styled.div`
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 16px;
`;

const ErrorContainer = styled.div`
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  font-size: 16px;
  text-align: center;
`;

/* ESTILOS PARA HEATMAP */
const HeatmapGrid = styled.div`
  display: grid;
  grid-template-columns: 40px repeat(24, 1fr);
  gap: 2px;
  overflow-x: auto;
  padding-bottom: 10px;
`;

const HeatmapCell = styled.div`
  background-color: ${props => props.color};
  height: 30px;
  border-radius: 2px;
  position: relative;
  
  &:hover::after {
    content: '${props => props.tooltip}';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    z-index: 10;
    pointer-events: none;
  }
`;

const HeatmapLabel = styled.div`
  font-size: 11px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-weight: 500;
`;

const HeatmapHeader = styled.div`
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
  margin-bottom: 4px;
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
`;

const StatItem = styled.div`
  text-align: center;
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

const DownloadButton = styled.button`
  padding: 8px 16px;
  border: 2px solid #10b981;
  background: white;
  color: #10b981;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: #10b981;
    color: white;
  }

  &:disabled {
    border-color: #d1d5db;
    color: #9ca3af;
    cursor: not-allowed;

    &:hover {
      background: white;
      color: #9ca3af;
    }
  }
`;

const ActivityChart = ({ documentId }) => {
  const [chartData, setChartData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('7days');
  const [chartType, setChartType] = useState('line'); // line, area, heatmap
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMessages: 0,
    avgDuration: 0,
    peakHour: 'N/A'
  });

  const filterOptions = [
    { key: '24h', label: '24 Horas' },
    { key: '7days', label: '7 Días' },
    { key: '30days', label: '30 Días' },
    { key: '90days', label: '90 Días' }
  ];

  useEffect(() => {
    if (documentId) {
      loadActivityData();
    }
  }, [documentId, activeFilter, chartType]);

  const loadActivityData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (chartType === 'heatmap') {
        // Cargar datos específicos del heatmap
        // Asegúrate que tu servicio soporte el type 'heatmap' en getActivityData o similar
        const data = await analyticsService.getActivityData(documentId, 'heatmap'); // Llamada al nuevo endpoint
        setHeatmapData(data);
      } else {
        // Cargar datos normales
        const data = await analyticsService.getActivityData(documentId, activeFilter);
        setChartData(data);
        calculateStats(data);
      }
      
    } catch (err) {
      console.error('Error cargando datos de actividad:', err);
      setError('Error al cargar los datos de actividad');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    if (!data || data.length === 0) return;

    const totalSessions = data.reduce((sum, item) => sum + (item.sesiones || 0), 0);
    const totalMessages = data.reduce((sum, item) => sum + (item.mensajes || 0), 0);
    const avgDuration = Math.round(
      data.reduce((sum, item) => sum + (item.duracion_promedio || 0), 0) / data.length
    );

    const peakItem = data.reduce((max, item) => 
      (item.sesiones || 0) > (max.sesiones || 0) ? item : max
    , data[0]);

    setStats({
      totalSessions,
      totalMessages,
      avgDuration,
      peakHour: peakItem?.time || 'N/A'
    });
  };

  // Función para generar y descargar CSV
  const downloadCSV = () => {
    let csvContent = '';
    let filename = '';

    if (chartType === 'heatmap') {
      // CSV para heatmap
      csvContent = 'Dia,Hora,Sesiones\n';
      heatmapData.forEach(item => {
        csvContent += `${item.dia},${item.hora}:00,${item.valor}\n`;
      });
      filename = `actividad_heatmap_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      // CSV para datos de línea/área
      csvContent = 'Periodo,Sesiones,Usuarios,Mensajes,Duracion Promedio (min)\n';
      chartData.forEach(item => {
        csvContent += `${item.time},${item.sesiones || 0},${item.usuarios || 0},${item.mensajes || 0},${item.duracion_promedio || 0}\n`;
      });
      filename = `actividad_${activeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    }

    // Crear y descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderHeatmap = () => {
    if (!heatmapData || heatmapData.length === 0) return <div>No hay datos suficientes para el mapa de calor.</div>;

    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    // Encontrar valor máximo para la escala de color
    const maxVal = Math.max(...heatmapData.map(d => d.valor));

    return (
      <div style={{ overflowX: 'auto' }}>
        <HeatmapGrid>
          {/* Header de horas */}
          <div /> 
          {hours.map(h => (
            <HeatmapHeader key={h}>{h}</HeatmapHeader>
          ))}

          {/* Filas por día */}
          {days.map(day => (
            <React.Fragment key={day}>
              <HeatmapLabel>{day}</HeatmapLabel>
              {hours.map(hour => {
                const dataPoint = heatmapData.find(d => d.dia === day && d.hora === hour);
                const value = dataPoint ? dataPoint.valor : 0;
                const opacity = maxVal > 0 ? (value / maxVal) : 0;
                // Color base: Indigo 600 (#4f46e5) -> rgba(79, 70, 229, opacity)
                // Usamos un mínimo de opacidad 0.05 para celdas vacías para mantener la grilla visual
                const bgColor = value > 0 
                  ? `rgba(79, 70, 229, ${0.2 + (opacity * 0.8)})` 
                  : '#f3f4f6';
                
                return (
                  <HeatmapCell 
                    key={`${day}-${hour}`} 
                    color={bgColor}
                    tooltip={`${day} ${hour}:00 - ${value} sesiones`}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </HeatmapGrid>
        <div style={{textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '10px'}}>
          Intensidad de uso: Últimos 30 días
        </div>
      </div>
    );
  };

  const renderChart = () => {
    if (chartType === 'heatmap') {
      return renderHeatmap();
    }

    const Component = chartType === 'area' ? AreaChart : LineChart;
    const DataComponent = chartType === 'area' ? Area : Line;

    return (
      <ResponsiveContainer width="100%" height={300}>
        <Component data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
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
          <DataComponent
            type="monotone"
            dataKey="sesiones"
            stroke="#4f46e5"
            fill={chartType === 'area' ? "#4f46e5" : undefined}
            fillOpacity={0.6}
            strokeWidth={2}
            name="Sesiones"
            dot={chartType === 'line' ? { r: 4 } : false}
          />
          {chartType === 'line' && (
            <DataComponent
              type="monotone"
              dataKey="mensajes"
              stroke="#10b981"
              strokeWidth={2}
              name="Mensajes"
              dot={{ r: 4 }}
            />
          )}
        </Component>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return (
      <ChartContainer>
        <LoadingContainer>Cargando actividad...</LoadingContainer>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer>
        <ErrorContainer>{error}</ErrorContainer>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <ChartHeader>
        <ChartTitle>📊 Actividad y Patrones</ChartTitle>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <ChartTypeSelector
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
          >
            <option value="line">Tendencia (Líneas)</option>
            <option value="area">Volumen (Áreas)</option>
            <option value="heatmap">Mapa de Calor (Horarios)</option>
          </ChartTypeSelector>

          {chartType !== 'heatmap' && (
            <FilterContainer>
              {filterOptions.map(option => (
                <FilterButton
                  key={option.key}
                  active={activeFilter === option.key}
                  onClick={() => setActiveFilter(option.key)}
                >
                  {option.label}
                </FilterButton>
              ))}
            </FilterContainer>
          )}

          <DownloadButton
            onClick={downloadCSV}
            disabled={chartType === 'heatmap' ? heatmapData.length === 0 : chartData.length === 0}
            title="Descargar datos en formato CSV"
          >
            <span>⬇</span> CSV
          </DownloadButton>
        </div>
      </ChartHeader>

      {chartType !== 'heatmap' && (
        <StatsRow>
          <StatItem>
            <StatValue>{stats.totalSessions}</StatValue>
            <StatLabel>Total Sesiones</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.totalMessages}</StatValue>
            <StatLabel>Total Mensajes</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.avgDuration}m</StatValue>
            <StatLabel>Duración Promedio</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.peakHour}</StatValue>
            <StatLabel>Pico de Actividad</StatLabel>
          </StatItem>
        </StatsRow>
      )}

      {renderChart()}
    </ChartContainer>
  );
};

export default ActivityChart;