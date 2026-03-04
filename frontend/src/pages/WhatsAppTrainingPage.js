// src/pages/WhatsAppTrainingPage.js — Fase 11.8: Dashboard WA Training para clientes
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { waClientService, membershipService } from '../services/api';
import { toast } from 'react-toastify';

const META_APP_ID = '1235794175100517';
const META_CONFIG_ID = '802318412947494';

// ========== Styled Components ==========
const PageContainer = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;

const PageTitle = styled.h1`
  font-size: 1.8rem;
  color: #0f355b;
  margin-bottom: 0.5rem;
  font-weight: 700;
`;

const PageSubtitle = styled.p`
  color: #64748b;
  font-size: 0.95rem;
  margin-bottom: 2rem;
`;

const Section = styled.section`
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 8px rgba(15, 53, 91, 0.08);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.15rem;
  color: #0f355b;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const MetricCard = styled.div`
  background: linear-gradient(135deg, ${p => p.bg || '#f0f9ff'} 0%, #fff 100%);
  border: 1px solid ${p => p.border || '#e0f2fe'};
  border-radius: 10px;
  padding: 1.25rem;
  text-align: center;

  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    color: ${p => p.color || '#0f355b'};
    line-height: 1;
  }
  .metric-label {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

const ConnectionPanel = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${p => p.connected ? '#22c55e' : '#ef4444'};
    box-shadow: 0 0 6px ${p => p.connected ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'};
  }
  .status-text {
    font-weight: 600;
    color: ${p => p.connected ? '#16a34a' : '#dc2626'};
  }
  .status-detail {
    font-size: 0.85rem;
    color: #64748b;
  }
`;

const Btn = styled.button`
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const BtnPrimary = styled(Btn)`
  background: linear-gradient(135deg, #25d366, #128c7e);
  color: #fff;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
  }
`;

const BtnDanger = styled(Btn)`
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;

  &:hover:not(:disabled) {
    background: #fecaca;
  }
`;

const BtnSecondary = styled(Btn)`
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;

  &:hover:not(:disabled) {
    background: #e2e8f0;
  }
`;

const ProgramaCard = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.selected ? '#f0f9ff' : '#fff'};
  border-color: ${p => p.selected ? '#3b82f6' : '#e2e8f0'};

  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }
`;

const ProgramaHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
`;

const ProgramaName = styled.h3`
  font-size: 1.05rem;
  color: #0f355b;
  margin: 0;
`;

const Badge = styled.span`
  padding: 0.2rem 0.7rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  background: ${p => {
    switch (p.estado) {
      case 'activo': return '#dcfce7';
      case 'borrador': return '#fef9c3';
      case 'pausado': return '#fee2e2';
      case 'finalizado': return '#e2e8f0';
      default: return '#f1f5f9';
    }
  }};
  color: ${p => {
    switch (p.estado) {
      case 'activo': return '#16a34a';
      case 'borrador': return '#ca8a04';
      case 'pausado': return '#dc2626';
      case 'finalizado': return '#64748b';
      default: return '#475569';
    }
  }};
`;

const ProgressBar = styled.div`
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;

  .fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #14b6cb);
    border-radius: 3px;
    transition: width 0.4s ease;
  }
`;

const ProgramaStats = styled.div`
  display: flex;
  gap: 1.5rem;
  font-size: 0.85rem;
  color: #64748b;
  margin-top: 0.5rem;
  flex-wrap: wrap;

  span {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th, td {
    padding: 0.7rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.88rem;
  }
  th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  tr:hover td {
    background: #f8fafc;
  }
`;

const ScoreBadge = styled.span`
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${p => {
    if (!p.score && p.score !== 0) return '#f1f5f9';
    if (p.score >= 80) return '#dcfce7';
    if (p.score >= 60) return '#fef9c3';
    return '#fee2e2';
  }};
  color: ${p => {
    if (!p.score && p.score !== 0) return '#94a3b8';
    if (p.score >= 80) return '#16a34a';
    if (p.score >= 60) return '#ca8a04';
    return '#dc2626';
  }};
`;

const BackLink = styled.button`
  background: none;
  border: none;
  color: #3b82f6;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:hover { text-decoration: underline; }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.95rem;
`;

const TabBar = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0;
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: ${p => p.active ? '#0f355b' : '#94a3b8'};
  border-bottom: 2px solid ${p => p.active ? '#3b82f6' : 'transparent'};
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { color: #0f355b; }
`;

const AdminSelect = styled.select`
  padding: 0.5rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #0f355b;
  background: #f8fafc;
  margin-bottom: 1.5rem;
`;

const LoadingText = styled.p`
  text-align: center;
  color: #64748b;
  padding: 2rem;
`;

// ========== Component ==========
const WhatsAppTrainingPage = () => {
  const { user } = useAuth();
  const { proyecto } = useProject();
  const isAdmin = user?.role === 'admin';

  // State
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [programas, setProgramas] = useState([]);
  const [selectedPrograma, setSelectedPrograma] = useState(null);
  const [inscripciones, setInscripciones] = useState([]);
  const [interacciones, setInteracciones] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [detailTab, setDetailTab] = useState('estudiantes');
  const [connecting, setConnecting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [canManage, setCanManage] = useState(false);

  // Project selection (admin + non-admin with multiple memberships)
  const [projectOptions, setProjectOptions] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState(null);

  const getProyectoId = useCallback(() => {
    if (selectedProyectoId) return selectedProyectoId;
    if (isAdmin) return null;
    return proyecto?.id || null;
  }, [isAdmin, selectedProyectoId, proyecto]);

  // Load project options based on role
  useEffect(() => {
    const loadProjectOptions = async () => {
      try {
        if (isAdmin) {
          const { proyectoService } = await import('../services/api');
          const res = await proyectoService.list();
          const lista = res.data?.proyectos || [];
          setProjectOptions(lista.map(p => ({ id: p.id, nombre: p.nombre })));
          if (lista.length > 0 && !selectedProyectoId) {
            setSelectedProyectoId(lista[0].id);
          }
        } else {
          const res = await membershipService.getMisProyectos();
          const memberships = res.data?.memberships || [];
          setProjectOptions(memberships.map(m => ({ id: m.proyecto_id, nombre: m.nombre })));
          if (memberships.length === 1) {
            setSelectedProyectoId(memberships[0].proyecto_id);
          } else if (memberships.length > 1 && !selectedProyectoId) {
            setSelectedProyectoId(memberships[0].proyecto_id);
          }
        }
      } catch (err) {
        console.error('Error cargando proyectos', err);
      }
    };
    loadProjectOptions();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    const pid = getProyectoId();
    if (!pid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [statusRes, metricasRes, programasRes] = await Promise.all([
        waClientService.getStatus(pid),
        waClientService.getMetricas(pid),
        waClientService.getProgramas(pid),
      ]);
      setWaStatus(statusRes.data?.status || { connected: false });
      setCanManage(statusRes.data?.can_manage === true);
      setMetricas(metricasRes.data?.metricas || null);
      setProgramas(programasRes.data?.programas || []);
    } catch (err) {
      console.error('Error cargando dashboard WA', err);
      toast.error('Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [getProyectoId]);

  useEffect(() => {
    const pid = getProyectoId();
    if (pid) {
      loadDashboard();
    } else if (!isAdmin) {
      setLoading(false);
    }
  }, [getProyectoId, loadDashboard, isAdmin]);

  // Load program detail
  const openProgramaDetail = async (programa) => {
    setSelectedPrograma(programa);
    setDetailTab('estudiantes');
    setLoadingDetail(true);
    try {
      const pid = getProyectoId();
      const [inscRes, intRes] = await Promise.all([
        waClientService.getInscripciones(programa.id, pid),
        waClientService.getInteracciones({ programa_id: programa.id, proyecto_id: pid, per_page: 20 }),
      ]);
      setInscripciones(inscRes.data?.inscripciones || []);
      setInteracciones(intRes.data?.interacciones || []);
      setPagination(intRes.data?.pagination || null);
    } catch (err) {
      toast.error('Error cargando detalle del programa');
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadMoreInteracciones = async (page) => {
    if (!selectedPrograma) return;
    try {
      const pid = getProyectoId();
      const res = await waClientService.getInteracciones({
        programa_id: selectedPrograma.id, proyecto_id: pid, page, per_page: 20
      });
      setInteracciones(res.data?.interacciones || []);
      setPagination(res.data?.pagination || null);
    } catch (err) {
      toast.error('Error cargando interacciones');
    }
  };

  // === WA Connection ===
  const loadFBSDK = () => {
    return new Promise((resolve) => {
      if (window.FB) { resolve(); return; }
      window.fbAsyncInit = function() {
        window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v21.0' });
        resolve();
      };
      if (!document.getElementById('facebook-jssdk')) {
        const js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = 'https://connect.facebook.net/en_US/sdk.js';
        document.body.appendChild(js);
      }
    });
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await loadFBSDK();
      window.FB.login(function(response) {
        if (response.authResponse && response.authResponse.code) {
          processCode(response.authResponse.code);
        } else {
          toast.error('Proceso cancelado');
          setConnecting(false);
        }
      }, {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' }
      });
    } catch (err) {
      toast.error('Error cargando servicio de conexión');
      setConnecting(false);
    }
  };

  const processCode = async (code) => {
    try {
      const pid = getProyectoId();
      const res = await waClientService.connectWhatsApp(code, pid);
      if (res.data?.success) {
        toast.success('WhatsApp Business conectado exitosamente');
        setWaStatus(res.data.whatsapp);
        loadDashboard();
      } else {
        toast.error(res.data?.error || 'Error al conectar');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al conectar WhatsApp');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar WhatsApp Business? Los programas activos dejarán de enviar mensajes.')) return;
    try {
      const pid = getProyectoId();
      await waClientService.disconnectWhatsApp(pid);
      toast.success('WhatsApp Business desconectado');
      setWaStatus({ connected: false });
      loadDashboard();
    } catch (err) {
      toast.error('Error al desconectar');
    }
  };

  // === Render helpers ===
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const tipoLabel = (tipo) => {
    switch (tipo) {
      case 'envio_contenido': return 'Contenido enviado';
      case 'envio_pregunta': return 'Pregunta enviada';
      case 'respuesta_estudiante': return 'Respuesta recibida';
      default: return tipo;
    }
  };

  const estadoEnvioLabel = (estado) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente';
      case 'enviado': return 'Enviado';
      case 'entregado': return 'Entregado';
      case 'leido': return 'Leido';
      case 'error': return 'Error';
      default: return estado;
    }
  };

  // ========== RENDER ==========
  if (loading && !isAdmin) {
    return <PageContainer><LoadingText>Cargando...</LoadingText></PageContainer>;
  }

  // Detail view
  if (selectedPrograma) {
    const prog = selectedPrograma;
    const totalIns = parseInt(prog.total_inscripciones) || 0;
    const completados = parseInt(prog.inscripciones_completadas) || 0;
    const tasaComp = totalIns > 0 ? Math.round((completados / totalIns) * 100) : 0;

    return (
      <PageContainer>
        <BackLink onClick={() => setSelectedPrograma(null)}>
          ← Volver a programas
        </BackLink>

        <Section>
          <ProgramaHeader>
            <div>
              <ProgramaName style={{ fontSize: '1.3rem' }}>{prog.nombre}</ProgramaName>
              {prog.descripcion && <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.3rem 0 0' }}>{prog.descripcion}</p>}
            </div>
            <Badge estado={prog.estado}>{prog.estado}</Badge>
          </ProgramaHeader>

          <MetricsGrid>
            <MetricCard bg="#f0f9ff" border="#bae6fd" color="#0369a1">
              <div className="metric-value">{prog.total_inscripciones || 0}</div>
              <div className="metric-label">Estudiantes</div>
            </MetricCard>
            <MetricCard bg="#f0fdf4" border="#bbf7d0" color="#16a34a">
              <div className="metric-value">{prog.inscripciones_completadas || 0}</div>
              <div className="metric-label">Completados</div>
            </MetricCard>
            <MetricCard bg="#fefce8" border="#fef08a" color="#ca8a04">
              <div className="metric-value">{tasaComp}%</div>
              <div className="metric-label">Tasa Completado</div>
            </MetricCard>
            <MetricCard bg="#faf5ff" border="#e9d5ff" color="#7c3aed">
              <div className="metric-value">{prog.promedio_score ?? '—'}</div>
              <div className="metric-label">Score Promedio</div>
            </MetricCard>
          </MetricsGrid>
        </Section>

        <Section>
          <TabBar>
            <Tab active={detailTab === 'estudiantes'} onClick={() => setDetailTab('estudiantes')}>
              Estudiantes ({inscripciones.length})
            </Tab>
            <Tab active={detailTab === 'interacciones'} onClick={() => setDetailTab('interacciones')}>
              Interacciones {pagination ? `(${pagination.total})` : ''}
            </Tab>
          </TabBar>

          {loadingDetail ? (
            <LoadingText>Cargando...</LoadingText>
          ) : detailTab === 'estudiantes' ? (
            inscripciones.length === 0 ? (
              <EmptyState>No hay estudiantes inscritos en este programa.</EmptyState>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Telefono</th>
                      <th>Estado</th>
                      <th>Progreso</th>
                      <th>Score</th>
                      <th>Inscrito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscripciones.map(ins => {
                      const totalE = parseInt(ins.total_entregas) || 0;
                      const enviadas = parseInt(ins.entregas_enviadas) || 0;
                      const respondidas = parseInt(ins.entregas_respondidas) || 0;
                      const pctProgreso = totalE > 0 ? Math.round((respondidas / totalE) * 100) : 0;

                      return (
                        <tr key={ins.id}>
                          <td style={{ fontWeight: 600 }}>{ins.nombre || '—'}</td>
                          <td>{ins.telefono}</td>
                          <td><Badge estado={ins.estado}>{ins.estado}</Badge></td>
                          <td style={{ minWidth: 120 }}>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 2 }}>
                              {respondidas}/{totalE} entregas ({enviadas} enviadas)
                            </div>
                            <ProgressBar>
                              <div className="fill" style={{ width: `${pctProgreso}%` }} />
                            </ProgressBar>
                          </td>
                          <td>
                            <ScoreBadge score={ins.promedio_score}>
                              {ins.promedio_score != null ? ins.promedio_score : '—'}
                            </ScoreBadge>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatDate(ins.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )
          ) : (
            // Interacciones tab
            interacciones.length === 0 ? (
              <EmptyState>No hay interacciones registradas.</EmptyState>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <Table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Estudiante</th>
                        <th>Entrega</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interacciones.map(int => (
                        <tr key={int.id}>
                          <td style={{ fontSize: '0.83rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDateTime(int.created_at)}
                          </td>
                          <td style={{ fontWeight: 500 }}>{int.inscripcion_nombre || int.inscripcion_telefono || '—'}</td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {int.entrega_titulo ? `#${int.entrega_orden} ${int.entrega_titulo}` : '—'}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{tipoLabel(int.tipo)}</td>
                          <td style={{ fontSize: '0.85rem' }}>{estadoEnvioLabel(int.estado_envio)}</td>
                          <td>
                            <ScoreBadge score={int.evaluacion_score}>
                              {int.evaluacion_score != null ? int.evaluacion_score : '—'}
                            </ScoreBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
                {pagination && pagination.total_pages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <BtnSecondary
                      disabled={!pagination.has_prev}
                      onClick={() => loadMoreInteracciones(pagination.page - 1)}
                    >
                      Anterior
                    </BtnSecondary>
                    <span style={{ padding: '0.6rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>
                      Pagina {pagination.page} de {pagination.total_pages}
                    </span>
                    <BtnSecondary
                      disabled={!pagination.has_next}
                      onClick={() => loadMoreInteracciones(pagination.page + 1)}
                    >
                      Siguiente
                    </BtnSecondary>
                  </div>
                )}
              </>
            )
          )}
        </Section>
      </PageContainer>
    );
  }

  // === Main dashboard view ===
  return (
    <PageContainer>
      <PageTitle>Entrenamiento WhatsApp</PageTitle>
      <PageSubtitle>Gestiona la conexion de tu WhatsApp Business y visualiza el progreso de tus programas de entrenamiento.</PageSubtitle>

      {/* Project selector (admin or users with multiple memberships) */}
      {projectOptions.length > 1 && (
        <AdminSelect
          value={selectedProyectoId || ''}
          onChange={e => setSelectedProyectoId(parseInt(e.target.value))}
        >
          {projectOptions.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </AdminSelect>
      )}

      {loading ? (
        <LoadingText>Cargando datos del proyecto...</LoadingText>
      ) : (
        <>
          {/* Connection panel */}
          <Section>
            <SectionTitle>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
              WhatsApp Business
            </SectionTitle>
            <ConnectionPanel>
              <ConnectionStatus connected={waStatus?.connected}>
                <div className="status-dot" />
                <div>
                  <div className="status-text">
                    {waStatus?.connected ? 'Conectado' : 'No conectado'}
                  </div>
                  {waStatus?.connected && (
                    <div className="status-detail">
                      {waStatus.display_name || waStatus.business_name || ''} {waStatus.phone_number ? `(${waStatus.phone_number})` : ''}
                      {waStatus.connected_at && <> — desde {formatDate(waStatus.connected_at)}</>}
                    </div>
                  )}
                </div>
              </ConnectionStatus>
              {canManage && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {waStatus?.connected ? (
                    <BtnDanger onClick={handleDisconnect}>Desconectar</BtnDanger>
                  ) : (
                    <BtnPrimary onClick={handleConnect} disabled={connecting}>
                      {connecting ? 'Conectando...' : 'Conectar WhatsApp Business'}
                    </BtnPrimary>
                  )}
                </div>
              )}
            </ConnectionPanel>
          </Section>

          {/* Metrics */}
          {metricas && (
            <MetricsGrid>
              <MetricCard bg="#f0f9ff" border="#bae6fd" color="#0369a1">
                <div className="metric-value">{metricas.programas_activos || 0}</div>
                <div className="metric-label">Programas Activos</div>
              </MetricCard>
              <MetricCard bg="#f0fdf4" border="#bbf7d0" color="#16a34a">
                <div className="metric-value">{metricas.total_estudiantes || 0}</div>
                <div className="metric-label">Total Estudiantes</div>
              </MetricCard>
              <MetricCard bg="#fefce8" border="#fef08a" color="#ca8a04">
                <div className="metric-value">{metricas.tasa_completados || 0}%</div>
                <div className="metric-label">Tasa Completados</div>
              </MetricCard>
              <MetricCard bg="#faf5ff" border="#e9d5ff" color="#7c3aed">
                <div className="metric-value">{metricas.promedio_score_global ?? '—'}</div>
                <div className="metric-label">Score Promedio</div>
              </MetricCard>
            </MetricsGrid>
          )}

          {/* Programs list */}
          <Section>
            <SectionTitle>Programas de Entrenamiento</SectionTitle>
            {programas.length === 0 ? (
              <EmptyState>
                No hay programas de entrenamiento creados.
                {isAdmin && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Crea programas desde el Panel Admin → WA Training.</div>}
              </EmptyState>
            ) : (
              programas.map(prog => {
                const totalIns = parseInt(prog.total_inscripciones) || 0;
                const completados = parseInt(prog.inscripciones_completadas) || 0;
                const tasaComp = totalIns > 0 ? Math.round((completados / totalIns) * 100) : 0;

                return (
                  <ProgramaCard key={prog.id} onClick={() => openProgramaDetail(prog)}>
                    <ProgramaHeader>
                      <ProgramaName>{prog.nombre}</ProgramaName>
                      <Badge estado={prog.estado}>{prog.estado}</Badge>
                    </ProgramaHeader>
                    {prog.descripcion && (
                      <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 0.5rem' }}>{prog.descripcion}</p>
                    )}
                    <ProgramaStats>
                      <span>{prog.total_entregas || 0} entregas</span>
                      <span>{totalIns} inscritos</span>
                      <span>{prog.inscripciones_activas || 0} activos</span>
                      <span>{completados} completados</span>
                      {prog.promedio_score && <span>Score: {prog.promedio_score}</span>}
                    </ProgramaStats>
                    <ProgressBar>
                      <div className="fill" style={{ width: `${tasaComp}%` }} />
                    </ProgressBar>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.3rem', textAlign: 'right' }}>
                      {tasaComp}% completado
                    </div>
                  </ProgramaCard>
                );
              })
            )}
          </Section>
        </>
      )}
    </PageContainer>
  );
};

export default WhatsAppTrainingPage;
