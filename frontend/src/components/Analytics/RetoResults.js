// src/components/Analytics/RetoResults.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { retoService } from '../../services/api';

// Styled Components
const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
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

const TabContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 12px;
  flex-wrap: wrap;
`;

const Tab = styled.button`
  padding: 10px 20px;
  border: none;
  background: ${props => props.active ? '#8b5cf6' : '#f3f4f6'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.active ? '#7c3aed' : '#e5e7eb'};
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatItem = styled.div`
  text-align: center;
  padding: 16px;
  background: ${props => props.background || '#f8fafc'};
  border-radius: 8px;
  border-left: 4px solid ${props => props.color || '#8b5cf6'};
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

const RetoActualCard = styled.div`
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  border-radius: 12px;
  padding: 24px;
  color: white;
  margin-bottom: 24px;
`;

const RetoQuestion = styled.div`
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
`;

const RetoMeta = styled.div`
  display: flex;
  gap: 20px;
  font-size: 0.9rem;
  opacity: 0.9;
  flex-wrap: wrap;
`;

const HistorialList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HistorialItem = styled.div`
  background: ${props => props.selected ? '#f5f3ff' : '#f8fafc'};
  border: 2px solid ${props => props.selected ? '#8b5cf6' : 'transparent'};
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f5f3ff;
    border-color: #c4b5fd;
  }
`;

const HistorialHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
`;

const HistorialFecha = styled.span`
  font-weight: 600;
  color: #374151;
`;

const HistorialBadge = styled.span`
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: ${props => {
    if (props.type === 'actual') return '#dcfce7';
    if (props.type === 'activo') return '#dbeafe';
    return '#f3f4f6';
  }};
  color: ${props => {
    if (props.type === 'actual') return '#166534';
    if (props.type === 'activo') return '#1e40af';
    return '#6b7280';
  }};
`;

const HistorialPregunta = styled.div`
  color: #4b5563;
  font-size: 14px;
  margin-bottom: 8px;
  line-height: 1.4;
`;

const HistorialStats = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
`;

const RespuestasList = styled.div`
  max-height: 500px;
  overflow-y: auto;

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

const RespuestaItem = styled.div`
  background: #f8fafc;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid ${props => {
    const score = props.puntuacion;
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }};
`;

const RespuestaHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
`;

const UserInfo = styled.div`
  font-weight: 600;
  color: #374151;
`;

const PuntuacionBadge = styled.span`
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: ${props => {
    if (props.puntuacion >= 80) return '#dcfce7';
    if (props.puntuacion >= 60) return '#fef3c7';
    return '#fee2e2';
  }};
  color: ${props => {
    if (props.puntuacion >= 80) return '#166534';
    if (props.puntuacion >= 60) return '#92400e';
    return '#991b1b';
  }};
`;

const RespuestaTexto = styled.div`
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
`;

const RetroalimentacionTexto = styled.div`
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.5;
  padding: 12px;
  background: #e0e7ff;
  border-radius: 6px;
  font-style: italic;
`;

const FechaMeta = styled.div`
  font-size: 0.8rem;
  color: #9ca3af;
  margin-top: 8px;
`;

const RankingTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const RankingTh = styled.th`
  text-align: left;
  padding: 12px;
  background: #f8fafc;
  color: #374151;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 2px solid #e5e7eb;
`;

const RankingTd = styled.td`
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
  color: #4b5563;
`;

const RankingPosition = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: bold;
  font-size: 12px;
  color: white;
  background: ${props => {
    if (props.pos === 1) return '#ffd700';
    if (props.pos === 2) return '#c0c0c0';
    if (props.pos === 3) return '#cd7f32';
    return '#6b7280';
  }};
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

const NoDataMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 8px;
  border: 2px dashed #d1d5db;
`;

const GenerarButton = styled.button`
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
`;

const BackButton = styled.button`
  padding: 8px 16px;
  border: 2px solid #e5e7eb;
  background: white;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
  }
`;

const RetoResults = ({ documentId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [activeTab, setActiveTab] = useState('actual');
  const [selectedReto, setSelectedReto] = useState(null);
  const [detalleReto, setDetalleReto] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    if (documentId) {
      loadRetoData();
    }
  }, [documentId]);

  const loadRetoData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await retoService.obtenerEstadisticasAdmin(documentId);
      setData(response.data);
    } catch (err) {
      console.error('Error cargando datos de retos:', err);
      setError('Error al cargar los datos de retos');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarReto = async () => {
    try {
      setGenerando(true);
      await retoService.generarReto(documentId);
      await loadRetoData();
    } catch (err) {
      console.error('Error generando reto:', err);
      alert('Error al generar el reto: ' + (err.response?.data?.error || err.message));
    } finally {
      setGenerando(false);
    }
  };

  const handleVerDetalleReto = async (retoId) => {
    try {
      setLoadingDetalle(true);
      setSelectedReto(retoId);
      const response = await retoService.obtenerDetalleReto(retoId);
      setDetalleReto(response.data);
    } catch (err) {
      console.error('Error cargando detalle del reto:', err);
      setDetalleReto({ error: true, message: 'Error al cargar el detalle' });
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleVolverHistorial = () => {
    setSelectedReto(null);
    setDetalleReto(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return <Card><LoadingContainer>Cargando datos de retos...</LoadingContainer></Card>;
  }

  if (error) {
    return (
      <Card>
        <ErrorContainer>
          {error}
          <br />
          <button
            onClick={loadRetoData}
            style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </ErrorContainer>
      </Card>
    );
  }

  const stats = data?.estadisticas || {};
  const retoActual = data?.reto_actual;
  const respuestasActual = data?.respuestas_reto_actual || [];
  const historialRetos = data?.historial_retos || [];
  const rankingUsuarios = data?.ranking_usuarios || [];

  // Si hay un reto seleccionado, mostrar su detalle
  if (selectedReto && detalleReto) {
    return (
      <Card>
        <ActionBar>
          <BackButton onClick={handleVolverHistorial}>
            ← Volver al Historial
          </BackButton>
        </ActionBar>

        {loadingDetalle ? (
          <LoadingContainer>Cargando detalle del reto...</LoadingContainer>
        ) : detalleReto.error ? (
          <ErrorContainer>{detalleReto.message}</ErrorContainer>
        ) : (
          <>
            <RetoActualCard style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
              <CardTitle style={{ color: 'white', marginBottom: '16px' }}>
                Reto del {formatDateShort(detalleReto.reto?.fecha_disponible)}
              </CardTitle>
              <RetoQuestion>
                <strong>Pregunta:</strong> {detalleReto.reto?.pregunta}
              </RetoQuestion>
              <RetoMeta>
                <span>📅 {detalleReto.reto?.dia_semana}</span>
                <span>📊 Promedio: {detalleReto.estadisticas?.promedio_puntuacion}%</span>
                <span>🏆 Mejor: {detalleReto.estadisticas?.mejor_puntuacion}%</span>
                <span>👥 {detalleReto.estadisticas?.total_respuestas} respuestas</span>
              </RetoMeta>
            </RetoActualCard>

            <CardTitle>Respuestas ({detalleReto.respuestas?.length || 0})</CardTitle>
            {detalleReto.respuestas?.length === 0 ? (
              <NoDataMessage>No hay respuestas para este reto</NoDataMessage>
            ) : (
              <RespuestasList>
                {detalleReto.respuestas?.map((resp, index) => (
                  <RespuestaItem key={index} puntuacion={Math.round(resp.puntuacion * 100)}>
                    <RespuestaHeader>
                      <UserInfo>
                        {index === 0 && '🥇 '}
                        {index === 1 && '🥈 '}
                        {index === 2 && '🥉 '}
                        {resp.nombre || resp.email}
                      </UserInfo>
                      <PuntuacionBadge puntuacion={Math.round(resp.puntuacion * 100)}>
                        {Math.round(resp.puntuacion * 100)}%
                      </PuntuacionBadge>
                    </RespuestaHeader>

                    <RespuestaTexto>
                      <strong>Respuesta:</strong> {resp.respuesta_usuario}
                    </RespuestaTexto>

                    {resp.retroalimentacion && (
                      <RetroalimentacionTexto>
                        <strong>Retroalimentación IA:</strong> {resp.retroalimentacion}
                      </RetroalimentacionTexto>
                    )}

                    <FechaMeta>
                      Respondido: {formatDate(resp.fecha_respuesta)}
                    </FechaMeta>
                  </RespuestaItem>
                ))}
              </RespuestasList>
            )}
          </>
        )}
      </Card>
    );
  }

  return (
    <>
      {/* Estadísticas Generales */}
      <Card>
        <ActionBar>
          <CardTitle>Estadisticas de Retos Semanales</CardTitle>
          <GenerarButton onClick={handleGenerarReto} disabled={generando}>
            {generando ? 'Generando...' : 'Generar Nuevo Reto'}
          </GenerarButton>
        </ActionBar>

        <StatsGrid>
          <StatItem color="#8b5cf6" background="#faf5ff">
            <StatValue>{stats.total_retos || 0}</StatValue>
            <StatLabel>Total Retos</StatLabel>
          </StatItem>
          <StatItem color="#10b981" background="#f0fdf4">
            <StatValue>{stats.total_respuestas || 0}</StatValue>
            <StatLabel>Respuestas Totales</StatLabel>
          </StatItem>
          <StatItem color="#f59e0b" background="#fffbeb">
            <StatValue>{Math.round((stats.promedio_general || 0) * 100)}%</StatValue>
            <StatLabel>Promedio General</StatLabel>
          </StatItem>
          <StatItem color="#06b6d4" background="#f0fdfa">
            <StatValue>{Math.round((stats.mejor_puntuacion || 0) * 100)}%</StatValue>
            <StatLabel>Mejor Puntuacion</StatLabel>
          </StatItem>
        </StatsGrid>

        {/* Tabs */}
        <TabContainer>
          <Tab active={activeTab === 'actual'} onClick={() => setActiveTab('actual')}>
            Reto Actual
          </Tab>
          <Tab active={activeTab === 'historial'} onClick={() => setActiveTab('historial')}>
            Historial ({historialRetos.length})
          </Tab>
          <Tab active={activeTab === 'ranking'} onClick={() => setActiveTab('ranking')}>
            Ranking Usuarios
          </Tab>
        </TabContainer>

        {/* Contenido por Tab */}
        {activeTab === 'actual' && (
          <>
            {retoActual ? (
              <>
                <RetoActualCard>
                  <CardTitle style={{ color: 'white', marginBottom: '16px' }}>
                    Reto Actual
                  </CardTitle>
                  <RetoQuestion>
                    <strong>Pregunta:</strong> {retoActual.pregunta}
                  </RetoQuestion>
                  <RetoMeta>
                    <span>Disponible: {formatDate(retoActual.fecha_disponible)}</span>
                    <span>Respuestas: {retoActual.total_respuestas || 0}</span>
                    <span>Promedio: {Math.round((retoActual.promedio_puntuacion || 0) * 100)}%</span>
                  </RetoMeta>
                </RetoActualCard>

                <CardTitle>Respuestas del Reto Actual</CardTitle>
                {respuestasActual.length === 0 ? (
                  <NoDataMessage>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Sin respuestas</div>
                    Aun no hay respuestas para este reto
                  </NoDataMessage>
                ) : (
                  <RespuestasList>
                    {respuestasActual.map((resp, index) => (
                      <RespuestaItem key={index} puntuacion={Math.round(resp.puntuacion * 100)}>
                        <RespuestaHeader>
                          <UserInfo>
                            {resp.nombre || resp.email}
                          </UserInfo>
                          <PuntuacionBadge puntuacion={Math.round(resp.puntuacion * 100)}>
                            {Math.round(resp.puntuacion * 100)}%
                          </PuntuacionBadge>
                        </RespuestaHeader>

                        <RespuestaTexto>
                          <strong>Respuesta:</strong> {resp.respuesta_usuario}
                        </RespuestaTexto>

                        {resp.retroalimentacion && (
                          <RetroalimentacionTexto>
                            <strong>Retroalimentacion IA:</strong> {resp.retroalimentacion}
                          </RetroalimentacionTexto>
                        )}

                        <FechaMeta>
                          {formatDate(resp.fecha_respuesta)}
                          {resp.tiempo_respuesta_segundos && (
                            <span> - {Math.round(resp.tiempo_respuesta_segundos / 60)} min</span>
                          )}
                        </FechaMeta>
                      </RespuestaItem>
                    ))}
                  </RespuestasList>
                )}
              </>
            ) : (
              <NoDataMessage>
                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>Sin reto</div>
                <div style={{ fontWeight: '600', marginBottom: '8px' }}>No hay reto activo</div>
                <div>Genera un nuevo reto para que los usuarios puedan participar</div>
              </NoDataMessage>
            )}
          </>
        )}

        {activeTab === 'historial' && (
          <>
            <CardTitle>Historial de Retos</CardTitle>
            {historialRetos.length === 0 ? (
              <NoDataMessage>No hay retos anteriores</NoDataMessage>
            ) : (
              <HistorialList>
                {historialRetos.map((reto, index) => (
                  <HistorialItem
                    key={reto.id}
                    onClick={() => handleVerDetalleReto(reto.id)}
                    selected={selectedReto === reto.id}
                  >
                    <HistorialHeader>
                      <HistorialFecha>
                        {formatDateShort(reto.fecha_disponible)} - {reto.dia_semana}
                      </HistorialFecha>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {index === 0 && reto.activo && (
                          <HistorialBadge type="actual">Actual</HistorialBadge>
                        )}
                        {reto.total_respuestas > 0 && (
                          <PuntuacionBadge puntuacion={Math.round((reto.promedio_puntuacion || 0) * 100)}>
                            Prom: {Math.round((reto.promedio_puntuacion || 0) * 100)}%
                          </PuntuacionBadge>
                        )}
                      </div>
                    </HistorialHeader>
                    <HistorialPregunta>
                      {reto.pregunta.length > 150 ? reto.pregunta.substring(0, 150) + '...' : reto.pregunta}
                    </HistorialPregunta>
                    <HistorialStats>
                      <span>Respuestas: {reto.total_respuestas || 0}</span>
                      {reto.mejor_puntuacion && (
                        <span>Mejor: {Math.round(reto.mejor_puntuacion * 100)}%</span>
                      )}
                      {reto.respuestas_correctas > 0 && (
                        <span>Correctas: {reto.respuestas_correctas}</span>
                      )}
                      <span style={{ color: '#8b5cf6' }}>Click para ver detalle</span>
                    </HistorialStats>
                  </HistorialItem>
                ))}
              </HistorialList>
            )}
          </>
        )}

        {activeTab === 'ranking' && (
          <>
            <CardTitle>Ranking de Usuarios</CardTitle>
            {rankingUsuarios.length === 0 ? (
              <NoDataMessage>No hay datos de ranking disponibles</NoDataMessage>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <RankingTable>
                  <thead>
                    <tr>
                      <RankingTh>#</RankingTh>
                      <RankingTh>Usuario</RankingTh>
                      <RankingTh>Retos</RankingTh>
                      <RankingTh>Promedio</RankingTh>
                      <RankingTh>Mejor</RankingTh>
                      <RankingTh>Correctas</RankingTh>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingUsuarios.map((user, index) => (
                      <tr key={user.id}>
                        <RankingTd>
                          <RankingPosition pos={index + 1}>{index + 1}</RankingPosition>
                        </RankingTd>
                        <RankingTd>
                          <div style={{ fontWeight: '500' }}>{user.nombre}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{user.email}</div>
                        </RankingTd>
                        <RankingTd>{user.retos_completados}</RankingTd>
                        <RankingTd>
                          <PuntuacionBadge puntuacion={Math.round((user.promedio_puntuacion || 0) * 100)}>
                            {Math.round((user.promedio_puntuacion || 0) * 100)}%
                          </PuntuacionBadge>
                        </RankingTd>
                        <RankingTd>{Math.round((user.mejor_puntuacion || 0) * 100)}%</RankingTd>
                        <RankingTd>{user.respuestas_correctas}</RankingTd>
                      </tr>
                    ))}
                  </tbody>
                </RankingTable>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
};

export default RetoResults;
