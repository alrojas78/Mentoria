import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import analyticsService from '../../services/analyticsService';

/* Tooltip nativo en el Eje Y */
const CustomizedYAxisTick = (props) => {
  const { x, y, payload } = props;
  const fullText = payload.value;
  const truncatedText = fullText.length > 40 ? fullText.substring(0, 40) + '...' : fullText;
  
  return (
    <g transform={`translate(${x},${y})`} style={{cursor: 'help'}}>
      <title>{fullText}</title>
      <text x={0} y={0} dy={4} textAnchor="end" fill="#666" fontSize={12}>
        {truncatedText}
      </text>
    </g>
  );
};

const EvaluationContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
  @media (max-width: 768px) { grid-template-columns: 1fr; }
`;
const FullWidthContainer = styled.div` grid-column: 1 / -1; `;
const Card = styled.div` background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); margin-bottom: 24px; `;
const CardHeaderContainer = styled.div` display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; `;
const CardTitle = styled.h3` margin: 0; color: #1a1a1a; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; `;
const ExportButton = styled.button` background-color: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; &:hover { background-color: #e0f2fe; border-color: #7dd3fc; } `;
const StatsGrid = styled.div` display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 24px; `;
const StatItem = styled.div` text-align: center; padding: 16px; background: ${props => props.background || '#f8fafc'}; border-radius: 8px; border-left: 4px solid ${props => props.color || '#4f46e5'}; `;
const StatValue = styled.div` font-size: 24px; font-weight: bold; color: #1f2937; margin-bottom: 4px; `;
const StatLabel = styled.div` font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; `;
const ConfigSection = styled.div` background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; `;
const ConfigTitle = styled.div` font-weight: 600; color: #374151; margin-bottom: 12px; font-size: 14px; `;
const ConfigGrid = styled.div` display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; `;
const ConfigItem = styled.div` text-align: center; `;
const ConfigValue = styled.div` font-size: 18px; font-weight: bold; color: #4f46e5; `;
const ConfigLabel = styled.div` font-size: 11px; color: #6b7280; margin-top: 2px; `;
const TrendContainer = styled.div` margin-top: 20px; `;
const TrendHeader = styled.div` display: flex; justify-content: between; align-items: center; margin-bottom: 16px; `;
const TrendTitle = styled.div` font-weight: 500; color: #374151; `;
const TrendPeriod = styled.div` font-size: 12px; color: #6b7280; `;
const AttemptsList = styled.div` max-height: 200px; overflow-y: auto; `;
const AttemptItem = styled.div` display: flex; justify-content: between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; &:last-child { border-bottom: none; } `;
const AttemptNumber = styled.div` font-weight: 500; color: #374151; font-size: 14px; `;
const AttemptStats = styled.div` display: flex; gap: 16px; align-items: center; font-size: 12px; `;
const SuccessRate = styled.span` padding: 4px 8px; border-radius: 4px; font-weight: 500; ${props => { const rate = parseFloat(props.rate); if (rate >= 80) return 'background: #dcfce7; color: #166534;'; if (rate >= 60) return 'background: #fef3c7; color: #92400e;'; return 'background: #fee2e2; color: #991b1b;'; }} `;
const LoadingContainer = styled.div` padding: 40px; text-align: center; color: #6b7280; `;
const ErrorContainer = styled.div` padding: 40px; text-align: center; color: #ef4444; `;

/* ESTILOS PARA OBSERVACIONES */
const ObservationsList = styled.div` max-height: 600px; overflow-y: auto; margin-top: 10px; padding-right: 4px; &::-webkit-scrollbar { width: 6px; } &::-webkit-scrollbar-track { background: #f1f5f9; } &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; } `;
const ObservationItem = styled.div` background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; overflow: hidden; transition: all 0.2s ease; &:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); } `;
const ObservationHeader = styled.div` display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: ${props => props.expanded ? '#f8fafc' : 'white'}; cursor: pointer; border-left: 4px solid ${props => props.approved ? '#10b981' : '#ef4444'}; `;
const HeaderInfo = styled.div` display: flex; align-items: center; gap: 16px; flex: 1; @media (max-width: 640px) { flex-direction: column; align-items: flex-start; gap: 4px; } `;
const UserName = styled.div` font-weight: 600; color: #374151; font-size: 14px; `;
const MetaInfo = styled.div` display: flex; align-items: center; gap: 12px; font-size: 13px; color: #6b7280; `;
const StatusBadge = styled.span` padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${props => props.approved ? '#dcfce7' : '#fee2e2'}; color: ${props => props.approved ? '#166534' : '#991b1b'}; `;
const AttemptsBadge = styled.span` background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; `;
const ToggleButton = styled.button` background: none; border: none; cursor: pointer; padding: 4px; color: #64748b; display: flex; align-items: center; justify-content: center; transition: color 0.2s; &:hover { color: #4f46e5; background-color: #f1f5f9; border-radius: 4px; } `;
const ObservationContent = styled.div` padding: 0; background: #f8fafc; border-top: 1px solid #e2e8f0; animation: fadeIn 0.3s ease-in-out; @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } `;

/* NUEVOS ESTILOS PARA HISTORIAL DE INTENTOS */
const AttemptBlock = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  &:last-child { border-bottom: none; }
`;
const AttemptHeaderLine = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;
const AttemptTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const AttemptText = styled.div`
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
  font-style: italic;
  background: white;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #f1f5f9;
`;

const EvaluationResults = ({ documentId }) => {
  const [evaluationData, setEvaluationData] = useState(null);
  const [scoreDistribution, setScoreDistribution] = useState(null);
  const [performanceTrends, setPerformanceTrends] = useState([]);
  const [attemptsAnalysis, setAttemptsAnalysis] = useState(null);
  const [timeAnalysis, setTimeAnalysis] = useState([]);
  const [itemAnalysis, setItemAnalysis] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (documentId) {
      loadEvaluationData();
    }
  }, [documentId]);

  const loadEvaluationData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overview, distribution, trends, attempts, timeData, items] = await Promise.all([
        analyticsService.getEvaluationAnalytics(documentId, 'overview'),
        analyticsService.getEvaluationAnalytics(documentId, 'score_distribution'),
        analyticsService.getEvaluationAnalytics(documentId, 'performance_trends'),
        analyticsService.getEvaluationAnalytics(documentId, 'attempts_analysis'),
        analyticsService.getEvaluationAnalytics(documentId, 'time_analysis'),
        analyticsService.getEvaluationAnalytics(documentId, 'item_analysis')
      ]);

      setEvaluationData(overview);
      setScoreDistribution(distribution);
      setPerformanceTrends(trends);
      setAttemptsAnalysis(attempts);
      setTimeAnalysis(timeData);
      setItemAnalysis(items);
      
    } catch (err) {
      console.error('Error cargando datos de evaluación:', err);
      setError('Error al cargar los datos de evaluación');
    } finally {
      setLoading(false);
    }
  };

  const toggleObservation = (index) => {
    if (expandedId === index) {
      setExpandedId(null);
    } else {
      setExpandedId(index);
    }
  };

  // Agrupar observaciones por usuario
  const groupedObservations = useMemo(() => {
    const rawData = evaluationData?.overview?.observaciones_ia || [];
    const groups = {};

    rawData.forEach(obs => {
      if (!groups[obs.usuario]) {
        groups[obs.usuario] = {
          usuario: obs.usuario,
          intentos: []
        };
      }
      groups[obs.usuario].intentos.push(obs);
    });

    // Convertir a array y ordenar cada grupo de intentos por fecha (más reciente primero)
    return Object.values(groups).map(group => {
      // Ordenar intentos: más reciente al principio
      group.intentos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      // Datos para la cabecera (usamos el intento más reciente)
      group.ultimo_intento = group.intentos[0];
      return group;
    });
  }, [evaluationData]);

  const exportToCSV = () => {
     const data = evaluationData?.overview?.observaciones_ia || [];
     if (data.length === 0) return;
     const headers = ['Usuario', 'Fecha', 'Calificación', 'Estado', 'Observación'];
     const csvContent = [
       headers.join(','),
       ...data.map(item => {
         const safeObservation = `"${item.observacion.replace(/"/g, '""')}"`;
         const safeUser = `"${item.usuario}"`;
         const status = item.aprobado ? 'Aprobado' : 'Reprobado';
         return [safeUser, new Date(item.fecha).toLocaleDateString('es-ES'), item.calificacion, status, safeObservation].join(',');
       })
     ].join('\n');
     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement('a');
     if (link.download !== undefined) {
       const url = URL.createObjectURL(blob);
       link.setAttribute('href', url);
       link.setAttribute('download', `evaluaciones_${documentId}.csv`);
       document.body.appendChild(link); link.click(); document.body.removeChild(link);
     }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric' // Agregué el año para mejor contexto en el historial
    });
  };

  // Datos para gráficos
  const scoreRangesData = scoreDistribution?.score_ranges?.map(item => ({
    rango: item.rango,
    cantidad: item.cantidad,
    promedio: item.promedio
  })) || [];

  const passFailData = scoreDistribution?.pass_fail?.map(item => ({
    name: item.estado,
    value: item.cantidad,
    promedio: item.promedio
  })) || [];

  const trendsData = performanceTrends?.map(item => ({
    fecha: formatDate(item.fecha),
    evaluaciones: item.total_evaluaciones,
    tasa_aprobacion: item.tasa_aprobacion,
    promedio: item.promedio_dia,
    duracion: item.duracion_promedio
  })) || [];

  const attemptsDistributionData = attemptsAnalysis?.attempts_distribution?.map(item => ({
    intento: `Intento ${item.intento}`,
    cantidad: item.cantidad,
    tasa_aprobacion: item.tasa_aprobacion,
    promedio: item.promedio_calificacion
  })) || [];

  const timeRangesData = timeAnalysis?.map(item => ({
    rango: item.rango_tiempo,
    cantidad: item.cantidad,
    promedio: item.promedio_calificacion,
    tasa_aprobacion: item.tasa_aprobacion
  })) || [];

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  if (loading) {
    return <Card><LoadingContainer>Cargando análisis...</LoadingContainer></Card>;
  }

  if (error) {
    return (
      <Card>
        <ErrorContainer>
          {error}
          <br />
          <button 
            onClick={loadEvaluationData}
            style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </ErrorContainer>
      </Card>
    );
  }

  const overview = evaluationData?.overview || {};
  const config = evaluationData?.configuracion || {};

  return (
    <>
      {/* 1. CONFIGURACIÓN Y ESTADÍSTICAS */}
      <FullWidthContainer>
        <Card>
          <CardTitle>🎯 Resumen de Evaluaciones</CardTitle>
          
          <ConfigSection>
            <ConfigTitle>⚙️ Configuración de Evaluaciones</ConfigTitle>
            <ConfigGrid>
              <ConfigItem>
                <ConfigValue>{config.preguntas_por_evaluacion || 10}</ConfigValue>
                <ConfigLabel>Preguntas</ConfigLabel>
              </ConfigItem>
              <ConfigItem>
                <ConfigValue>{config.porcentaje_aprobacion || 60}%</ConfigValue>
                <ConfigLabel>% Aprobación</ConfigLabel>
              </ConfigItem>
              <ConfigItem>
                <ConfigValue>{config.max_intentos || 3}</ConfigValue>
                <ConfigLabel>Max Intentos</ConfigLabel>
              </ConfigItem>
              <ConfigItem>
                <ConfigValue>{config.tiene_certificado ? 'Sí' : 'No'}</ConfigValue>
                <ConfigLabel>Certificado</ConfigLabel>
              </ConfigItem>
            </ConfigGrid>
          </ConfigSection>

          <StatsGrid>
            <StatItem color="#4f46e5" background="#f0f9ff">
              <StatValue>{overview.total_evaluaciones || 0}</StatValue>
              <StatLabel>Total Evaluaciones</StatLabel>
            </StatItem>
            <StatItem color="#10b981" background="#f0fdf4">
              <StatValue>{overview.usuarios_evaluados || 0}</StatValue>
              <StatLabel>Usuarios Evaluados</StatLabel>
            </StatItem>
            <StatItem color="#f59e0b" background="#fffbeb">
              <StatValue>{overview.tasa_aprobacion || 0}%</StatValue>
              <StatLabel>Tasa Aprobación</StatLabel>
            </StatItem>
            <StatItem color="#ef4444" background="#fef2f2">
              <StatValue>{overview.promedio_general || 0}%</StatValue>
              <StatLabel>Promedio General</StatLabel>
            </StatItem>
            <StatItem color="#8b5cf6" background="#faf5ff">
              <StatValue>{overview.promedio_intentos || 0}</StatValue>
              <StatLabel>Intentos Promedio</StatLabel>
            </StatItem>
            <StatItem color="#06b6d4" background="#f0fdfa">
              <StatValue>{overview.duracion_promedio || 0}m</StatValue>
              <StatLabel>Duración Promedio</StatLabel>
            </StatItem>
          </StatsGrid>
        </Card>
      </FullWidthContainer>

      {/* 2. OBSERVACIONES DE IA AGRUPADAS POR USUARIO */}
      <FullWidthContainer>
        <Card>
          <CardHeaderContainer>
            <CardTitle>🤖 Observaciones de IA</CardTitle>
            <ExportButton onClick={exportToCSV}>
              <span>📥</span> Exportar CSV
            </ExportButton>
          </CardHeaderContainer>
          
          <ObservationsList>
            {groupedObservations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                No hay observaciones de IA registradas
              </div>
            ) : (
              groupedObservations.map((group, index) => (
                <ObservationItem key={index}>
                  {/* Cabecera del Usuario */}
                  <ObservationHeader 
                    approved={group.ultimo_intento.aprobado}
                    expanded={expandedId === index}
                    onClick={() => toggleObservation(index)}
                  >
                    <HeaderInfo>
                      <UserName>{group.usuario}</UserName>
                      <MetaInfo>
                        <AttemptsBadge>
                          {group.intentos.length} {group.intentos.length === 1 ? 'intento' : 'intentos'}
                        </AttemptsBadge>
                        <span style={{color: '#9ca3af'}}>•</span>
                        <span>Último: {formatDate(group.ultimo_intento.fecha)}</span>
                        <StatusBadge approved={group.ultimo_intento.aprobado}>
                          {group.ultimo_intento.aprobado ? 'Aprobado' : 'Reprobado'}
                        </StatusBadge>
                      </MetaInfo>
                    </HeaderInfo>
                    
                    <ToggleButton>
                      {expandedId === index ? '🔼 Ocultar' : '🔽 Ver Historial'}
                    </ToggleButton>
                  </ObservationHeader>
                  
                  {/* Lista de Intentos Desplegable */}
                  {expandedId === index && (
                    <ObservationContent>
                      {group.intentos.map((intento, i) => (
                        <AttemptBlock key={i}>
                          <AttemptHeaderLine>
                            <AttemptTitle>
                              📅 {formatDate(intento.fecha)}
                              <span style={{fontSize: '11px', color: '#6b7280', fontWeight: 'normal'}}>
                                (Intento {group.intentos.length - i})
                              </span>
                            </AttemptTitle>
                            <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                              <span style={{fontWeight: '600', color: intento.aprobado ? '#059669' : '#dc2626'}}>
                                {intento.calificacion}%
                              </span>
                              <StatusBadge approved={intento.aprobado}>
                                {intento.aprobado ? 'Aprobado' : 'Reprobado'}
                              </StatusBadge>
                            </div>
                          </AttemptHeaderLine>
                          <AttemptText>
                            "{intento.observacion}"
                          </AttemptText>
                        </AttemptBlock>
                      ))}
                    </ObservationContent>
                  )}
                </ObservationItem>
              ))
            )}
          </ObservationsList>
        </Card>
      </FullWidthContainer>

      {/* 3. PREGUNTAS CON MAYOR DIFICULTAD */}
      <FullWidthContainer>
        <Card>
          <CardTitle>⚠️ Preguntas con Mayor Dificultad (Top 10)</CardTitle>
          {(!itemAnalysis || itemAnalysis.length === 0) ? (
            <div style={{textAlign: 'center', padding: '20px', color: '#9ca3af'}}>
              No hay datos suficientes para analizar la dificultad.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart layout="vertical" data={itemAnalysis} margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} unit="%" />
                <YAxis 
                  type="category" 
                  dataKey="pregunta" 
                  stroke="#64748b" 
                  fontSize={12} 
                  width={220}
                  tick={<CustomizedYAxisTick />} 
                />
                <Tooltip 
                  cursor={{fill: '#f3f4f6'}}
                  contentStyle={{borderRadius: '8px'}}
                  formatter={(value) => [`${value}% Error`, 'Tasa de Error']}
                />
                <Bar dataKey="tasa_error" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} name="Tasa de Error" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </FullWidthContainer>

      {/* 4. RESTO DE GRÁFICOS */}
      <EvaluationContainer>
        <Card>
          <CardTitle>📊 Distribución de Calificaciones</CardTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreRangesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="rango" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar dataKey="cantidad" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardTitle>✅ Aprobados vs Reprobados</CardTitle>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={passFailData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {passFailData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} evaluaciones`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </EvaluationContainer>

      <EvaluationContainer>
        <Card>
          <CardTitle>📈 Tendencias de Rendimiento</CardTitle>
          <TrendContainer>
            <TrendHeader>
              <TrendTitle>Últimos 30 días</TrendTitle>
              <TrendPeriod>Tasa de aprobación y promedio diario</TrendPeriod>
            </TrendHeader>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha" stroke="#64748b" fontSize={12} />
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
                <Area
                  type="monotone"
                  dataKey="tasa_aprobacion"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                  name="Tasa Aprobación (%)"
                />
                <Area
                  type="monotone"
                  dataKey="promedio"
                  stackId="2"
                  stroke="#4f46e5"
                  fill="#4f46e5"
                  fillOpacity={0.4}
                  name="Promedio (%)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </TrendContainer>
        </Card>

        <Card>
          <CardTitle>🔄 Análisis de Intentos</CardTitle>
          <AttemptsList>
            {attemptsAnalysis?.attempts_distribution?.map((attempt, index) => (
              <AttemptItem key={index}>
                <AttemptNumber>Intento {attempt.intento}</AttemptNumber>
                <AttemptStats>
                  <span>{attempt.cantidad} evaluaciones</span>
                  <SuccessRate rate={attempt.tasa_aprobacion}>
                    {attempt.tasa_aprobacion}% éxito
                  </SuccessRate>
                  <span>Promedio: {attempt.promedio_calificacion}%</span>
                </AttemptStats>
              </AttemptItem>
            ))}
          </AttemptsList>
          
          <ResponsiveContainer width="100%" height={200} style={{ marginTop: '20px' }}>
            <LineChart data={attemptsDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="intento" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="tasa_aprobacion" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                name="Tasa Aprobación (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </EvaluationContainer>

      <FullWidthContainer>
        <Card>
          <CardTitle>⏱️ Análisis por Tiempo de Duración</CardTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeRangesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="rango" stroke="#64748b" fontSize={12} />
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
              <Bar dataKey="cantidad" fill="#4f46e5" name="Cantidad de Evaluaciones" />
              <Bar dataKey="promedio" fill="#10b981" name="Promedio de Calificación" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </FullWidthContainer>
    </>
  );
};

export default EvaluationResults;