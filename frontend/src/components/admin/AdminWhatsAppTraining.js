// AdminWhatsAppTraining.js — Fase 11.4: Gestión de Programas de Entrenamiento WhatsApp
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { waTrainingService, proyectoService } from '../../services/api';

// ============================================================
// STYLED COMPONENTS
// ============================================================

const Container = styled.div``;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const Title = styled.h2`
  margin: 0;
  color: #0f355b;
  font-size: 1.3rem;
`;

const SubTabContainer = styled.div`
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 4px;
  overflow-x: auto;
`;

const SubTab = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: ${p => p.$active ? '600' : '400'};
  font-size: 0.85rem;
  color: ${p => p.$active ? '#fff' : '#64748b'};
  background: ${p => p.$active ? '#25D366' : 'transparent'};
  white-space: nowrap;
  transition: all 0.2s;
  &:hover {
    color: ${p => p.$active ? '#fff' : '#25D366'};
    background: ${p => p.$active ? '#25D366' : '#e2e8f0'};
  }
`;

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  &:focus { outline: none; border-color: #25D366; }
`;

const Button = styled.button`
  background: ${p => p.$danger ? '#dc2626' : p.$secondary ? '#64748b' : '#25D366'};
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &:hover { opacity: 0.9; transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const SmallBtn = styled.button`
  background: ${p => p.$danger ? '#fee2e2' : p.$success ? '#d1fae5' : '#f1f5f9'};
  color: ${p => p.$danger ? '#dc2626' : p.$success ? '#059669' : '#475569'};
  border: 1px solid ${p => p.$danger ? '#fecaca' : p.$success ? '#a7f3d0' : '#e2e8f0'};
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 500;
  transition: all 0.2s;
  &:hover { opacity: 0.8; }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  th, td {
    padding: 0.65rem 0.8rem;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.85rem;
  }
  th { background: #f8fafc; color: #475569; font-weight: 600; font-size: 0.8rem; }
`;

const Badge = styled.span`
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${p => {
    switch(p.$type) {
      case 'activo': return '#d1fae5';
      case 'borrador': return '#fef3c7';
      case 'pausado': return '#fee2e2';
      case 'finalizado': return '#e2e8f0';
      case 'completado': return '#d1fae5';
      case 'abandonado': return '#fee2e2';
      case 'contenido': return '#dbeafe';
      case 'pregunta': return '#fef3c7';
      case 'retroalimentacion': return '#ede9fe';
      default: return '#f1f5f9';
    }
  }};
  color: ${p => {
    switch(p.$type) {
      case 'activo': return '#059669';
      case 'borrador': return '#d97706';
      case 'pausado': return '#dc2626';
      case 'finalizado': return '#64748b';
      case 'completado': return '#059669';
      case 'abandonado': return '#dc2626';
      case 'contenido': return '#2563eb';
      case 'pregunta': return '#d97706';
      case 'retroalimentacion': return '#7c3aed';
      default: return '#475569';
    }
  }};
`;

const Card = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  margin-bottom: 1rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.3rem;
  }
  input, textarea, select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9rem;
    &:focus { outline: none; border-color: #25D366; }
  }
  textarea { resize: vertical; min-height: 60px; }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: ${p => p.$cols || '1fr 1fr'};
  gap: 1rem;
  @media(max-width: 768px) { grid-template-columns: 1fr; }
`;

const Modal = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem;
  z-index: 1000;
  overflow-y: auto;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: ${p => p.$wide ? '800px' : '600px'};
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  margin: auto;
`;

const ModalTitle = styled.h3`
  margin: 0 0 1.25rem;
  color: #0f355b;
  font-size: 1.15rem;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  p { margin: 0.5rem 0; }
  span { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; }
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 2rem;
  &::before {
    content: '';
    position: absolute;
    left: 0.65rem;
    top: 0.5rem;
    bottom: 0.5rem;
    width: 2px;
    background: #e2e8f0;
  }
`;

const TimelineItem = styled.div`
  position: relative;
  padding: 0.75rem 0;
  padding-left: 1rem;
  &::before {
    content: '';
    position: absolute;
    left: -1.65rem;
    top: 1rem;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${p => p.$type === 'contenido' ? '#3b82f6' : p.$type === 'pregunta' ? '#f59e0b' : '#8b5cf6'};
    border: 2px solid white;
    box-shadow: 0 0 0 2px ${p => p.$type === 'contenido' ? '#93c5fd' : p.$type === 'pregunta' ? '#fcd34d' : '#c4b5fd'};
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 1px 6px rgba(0,0,0,0.06);
  text-align: center;
  .stat-value { font-size: 1.8rem; font-weight: 700; color: ${p => p.$color || '#0f355b'}; }
  .stat-label { font-size: 0.78rem; color: #94a3b8; margin-top: 2px; }
`;

// ============================================================
// MAIN COMPONENT
// ============================================================

const AdminWhatsAppTraining = () => {
  const [activeTab, setActiveTab] = useState('programas');
  const [proyectos, setProyectos] = useState([]);
  const [selectedProyecto, setSelectedProyecto] = useState('');
  const [loading, setLoading] = useState(false);

  // Programas
  const [programas, setProgramas] = useState([]);
  const [selectedPrograma, setSelectedPrograma] = useState(null);
  const [showProgramaModal, setShowProgramaModal] = useState(false);
  const [programaForm, setProgramaForm] = useState({ nombre: '', descripcion: '', documento_id: '', estado: 'borrador' });
  const [editingProgramaId, setEditingProgramaId] = useState(null);

  // Entregas
  const [entregas, setEntregas] = useState([]);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [entregaForm, setEntregaForm] = useState({
    tipo: 'contenido', titulo: '', texto: '', media_url: '', media_tipo: '',
    pregunta: '', respuesta_esperada: '', evaluacion_modo: 'ia_semantica',
    dias_despues: 0, hora_envio: '09:00', template_name: ''
  });
  const [editingEntregaId, setEditingEntregaId] = useState(null);

  // Inscripciones
  const [inscripciones, setInscripciones] = useState([]);
  const [showInscripcionModal, setShowInscripcionModal] = useState(false);
  const [inscripcionForm, setInscripcionForm] = useState({ telefono: '', nombre: '', email: '', fecha_inicio: '' });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Interacciones
  const [interacciones, setInteracciones] = useState([]);
  const [interPage, setInterPage] = useState(1);
  const [interTotal, setInterTotal] = useState(0);

  // Load proyectos
  useEffect(() => {
    proyectoService.list().then(r => {
      const list = r.data?.proyectos || [];
      setProyectos(list);
      if (list.length === 1) setSelectedProyecto(list[0].id.toString());
    }).catch(() => {});
  }, []);

  // Load programas when proyecto changes
  const loadProgramas = useCallback(async () => {
    if (!selectedProyecto) { setProgramas([]); return; }
    setLoading(true);
    try {
      const r = await waTrainingService.getProgramas(selectedProyecto);
      setProgramas(r.data?.programas || []);
    } catch { toast.error('Error cargando programas'); }
    setLoading(false);
  }, [selectedProyecto]);

  useEffect(() => { loadProgramas(); }, [loadProgramas]);

  // Load entregas when programa selected
  const loadEntregas = useCallback(async () => {
    if (!selectedPrograma) { setEntregas([]); return; }
    try {
      const r = await waTrainingService.getEntregas(selectedPrograma.id);
      setEntregas(r.data?.entregas || []);
    } catch { toast.error('Error cargando entregas'); }
  }, [selectedPrograma]);

  useEffect(() => { loadEntregas(); }, [loadEntregas]);

  // Load inscripciones
  const loadInscripciones = useCallback(async () => {
    if (!selectedPrograma) { setInscripciones([]); return; }
    try {
      const r = await waTrainingService.getInscripciones(selectedPrograma.id);
      setInscripciones(r.data?.inscripciones || []);
    } catch { toast.error('Error cargando inscripciones'); }
  }, [selectedPrograma]);

  useEffect(() => {
    if (activeTab === 'inscripciones') loadInscripciones();
  }, [activeTab, loadInscripciones]);

  // Load interacciones
  const loadInteracciones = useCallback(async (page = 1) => {
    if (!selectedPrograma) { setInteracciones([]); return; }
    try {
      const r = await waTrainingService.getInteracciones({ programa_id: selectedPrograma.id, page, per_page: 30 });
      setInteracciones(r.data?.interacciones || []);
      setInterTotal(r.data?.pagination?.total || 0);
      setInterPage(page);
    } catch { toast.error('Error cargando interacciones'); }
  }, [selectedPrograma]);

  useEffect(() => {
    if (activeTab === 'monitor') loadInteracciones(1);
  }, [activeTab, loadInteracciones]);

  // ============================================================
  // PROGRAMAS HANDLERS
  // ============================================================

  const openNewPrograma = () => {
    setProgramaForm({ nombre: '', descripcion: '', documento_id: '', estado: 'borrador' });
    setEditingProgramaId(null);
    setShowProgramaModal(true);
  };

  const openEditPrograma = (p) => {
    setProgramaForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      documento_id: p.documento_id || '',
      estado: p.estado
    });
    setEditingProgramaId(p.id);
    setShowProgramaModal(true);
  };

  const savePrograma = async () => {
    if (!programaForm.nombre.trim()) { toast.warning('Nombre requerido'); return; }
    try {
      if (editingProgramaId) {
        await waTrainingService.updatePrograma(editingProgramaId, programaForm);
        toast.success('Programa actualizado');
      } else {
        await waTrainingService.createPrograma({
          ...programaForm,
          proyecto_id: parseInt(selectedProyecto)
        });
        toast.success('Programa creado');
      }
      setShowProgramaModal(false);
      loadProgramas();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error guardando programa');
    }
  };

  const deletePrograma = async (id) => {
    if (!window.confirm('Eliminar este programa?')) return;
    try {
      await waTrainingService.deletePrograma(id, true);
      toast.success('Programa eliminado');
      if (selectedPrograma?.id === id) setSelectedPrograma(null);
      loadProgramas();
    } catch { toast.error('Error eliminando programa'); }
  };

  const selectPrograma = (p) => {
    setSelectedPrograma(p);
    setActiveTab('entregas');
  };

  // ============================================================
  // ENTREGAS HANDLERS
  // ============================================================

  const resetEntregaForm = () => ({
    tipo: 'contenido', titulo: '', texto: '', media_url: '', media_tipo: '',
    pregunta: '', respuesta_esperada: '', evaluacion_modo: 'ia_semantica',
    dias_despues: 0, hora_envio: '09:00', template_name: ''
  });

  const openNewEntrega = () => {
    setEntregaForm(resetEntregaForm());
    setEditingEntregaId(null);
    setShowEntregaModal(true);
  };

  const openEditEntrega = (e) => {
    setEntregaForm({
      tipo: e.tipo, titulo: e.titulo || '', texto: e.texto || '',
      media_url: e.media_url || '', media_tipo: e.media_tipo || '',
      pregunta: e.pregunta || '', respuesta_esperada: e.respuesta_esperada || '',
      evaluacion_modo: e.evaluacion_modo || 'ia_semantica',
      dias_despues: e.dias_despues || 0, hora_envio: e.hora_envio ? e.hora_envio.substring(0,5) : '09:00',
      template_name: e.template_name || ''
    });
    setEditingEntregaId(e.id);
    setShowEntregaModal(true);
  };

  const saveEntrega = async () => {
    if (!entregaForm.titulo?.trim() && !entregaForm.texto?.trim()) {
      toast.warning('Ingrese un título o texto'); return;
    }
    try {
      const data = { ...entregaForm, programa_id: selectedPrograma.id };
      if (editingEntregaId) {
        await waTrainingService.updateEntrega(editingEntregaId, data);
        toast.success('Entrega actualizada');
      } else {
        await waTrainingService.createEntrega(data);
        toast.success('Entrega creada');
      }
      setShowEntregaModal(false);
      loadEntregas();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error guardando entrega');
    }
  };

  const deleteEntrega = async (id) => {
    if (!window.confirm('Eliminar esta entrega?')) return;
    try {
      await waTrainingService.deleteEntrega(id);
      toast.success('Entrega eliminada');
      loadEntregas();
    } catch { toast.error('Error eliminando entrega'); }
  };

  const moveEntrega = async (index, direction) => {
    const items = [...entregas];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    const orden = items.map((item, i) => ({ id: item.id, orden: i }));
    try {
      await waTrainingService.reorderEntregas(selectedPrograma.id, orden);
      loadEntregas();
    } catch { toast.error('Error reordenando'); }
  };

  // ============================================================
  // INSCRIPCIONES HANDLERS
  // ============================================================

  const openNewInscripcion = () => {
    setInscripcionForm({ telefono: '', nombre: '', email: '', fecha_inicio: '' });
    setShowInscripcionModal(true);
  };

  const saveInscripcion = async () => {
    if (!inscripcionForm.telefono.trim()) { toast.warning('Teléfono requerido'); return; }
    try {
      await waTrainingService.createInscripcion({
        programa_id: selectedPrograma.id,
        ...inscripcionForm
      });
      toast.success('Estudiante inscrito');
      setShowInscripcionModal(false);
      loadInscripciones();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error inscribiendo');
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    if (!lines.length) { toast.warning('Ingrese al menos un contacto'); return; }
    const contactos = lines.map(line => {
      const parts = line.split(/[,;\t]+/).map(s => s.trim());
      return { telefono: parts[0], nombre: parts[1] || '', email: parts[2] || '' };
    }).filter(c => c.telefono);

    try {
      const r = await waTrainingService.importInscripciones(selectedPrograma.id, contactos);
      const data = r.data;
      toast.success(`Importados: ${data.insertados || 0}, Duplicados: ${data.duplicados || 0}`);
      setShowBulkModal(false);
      setBulkText('');
      loadInscripciones();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error importando');
    }
  };

  const updateInscripcionEstado = async (id, estado) => {
    try {
      await waTrainingService.updateInscripcion(id, { estado });
      toast.success(`Estado cambiado a ${estado}`);
      loadInscripciones();
    } catch { toast.error('Error actualizando estado'); }
  };

  const deleteInscripcion = async (id) => {
    if (!window.confirm('Eliminar inscripción?')) return;
    try {
      await waTrainingService.deleteInscripcion(id);
      toast.success('Inscripción eliminada');
      loadInscripciones();
    } catch { toast.error('Error eliminando'); }
  };

  // ============================================================
  // COMPUTE TIMELINE
  // ============================================================

  const getTimelineText = () => {
    if (!entregas.length) return null;
    let acum = 0;
    return entregas.map((e, i) => {
      acum += (e.dias_despues || 0);
      return { ...e, diaAcumulado: acum };
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  const tabs = [
    { id: 'programas', label: 'Programas' },
    { id: 'entregas', label: 'Entregas', disabled: !selectedPrograma },
    { id: 'inscripciones', label: 'Inscripciones', disabled: !selectedPrograma },
    { id: 'monitor', label: 'Monitor', disabled: !selectedPrograma },
  ];

  return (
    <Container>
      <TopBar>
        <Title>WhatsApp Training</Title>
        <Select value={selectedProyecto} onChange={e => { setSelectedProyecto(e.target.value); setSelectedPrograma(null); }}>
          <option value="">-- Seleccionar proyecto --</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </Select>
      </TopBar>

      {!selectedProyecto ? (
        <EmptyState>
          <span>📱</span>
          <p>Selecciona un proyecto para gestionar programas de entrenamiento WhatsApp</p>
        </EmptyState>
      ) : (
        <>
          {selectedPrograma && (
            <Card style={{ background: '#f0fdf4', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#166534' }}>Programa: {selectedPrograma.nombre}</strong>
                  <Badge $type={selectedPrograma.estado} style={{ marginLeft: 8 }}>{selectedPrograma.estado}</Badge>
                </div>
                <SmallBtn onClick={() => { setSelectedPrograma(null); setActiveTab('programas'); }}>
                  Volver a lista
                </SmallBtn>
              </div>
            </Card>
          )}

          <SubTabContainer>
            {tabs.map(tab => (
              <SubTab
                key={tab.id}
                $active={activeTab === tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                style={tab.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                {tab.label}
              </SubTab>
            ))}
          </SubTabContainer>

          {/* ===== PROGRAMAS TAB ===== */}
          {activeTab === 'programas' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <Button onClick={openNewPrograma}>+ Nuevo Programa</Button>
              </div>

              {loading ? (
                <p style={{ textAlign: 'center', color: '#94a3b8' }}>Cargando...</p>
              ) : programas.length === 0 ? (
                <EmptyState>
                  <span>📋</span>
                  <p>No hay programas de entrenamiento</p>
                  <p style={{ fontSize: '0.85rem' }}>Crea tu primer programa para empezar a enviar contenido por WhatsApp</p>
                </EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Estado</th>
                      <th>Entregas</th>
                      <th>Inscritos</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programas.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ cursor: 'pointer', color: '#25D366' }} onClick={() => selectPrograma(p)}>
                            {p.nombre}
                          </strong>
                          {p.descripcion && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{p.descripcion.substring(0, 80)}</div>}
                        </td>
                        <td><Badge $type={p.estado}>{p.estado}</Badge></td>
                        <td>{p.total_entregas || 0}</td>
                        <td>{p.inscripciones_activas || 0} / {p.total_inscripciones || 0}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <SmallBtn onClick={() => selectPrograma(p)}>Abrir</SmallBtn>
                            <SmallBtn onClick={() => openEditPrograma(p)}>Editar</SmallBtn>
                            <SmallBtn $danger onClick={() => deletePrograma(p.id)}>Eliminar</SmallBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}

          {/* ===== ENTREGAS TAB ===== */}
          {activeTab === 'entregas' && selectedPrograma && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {entregas.length} entrega{entregas.length !== 1 ? 's' : ''} programada{entregas.length !== 1 ? 's' : ''}
                </div>
                <Button onClick={openNewEntrega}>+ Nueva Entrega</Button>
              </div>

              {entregas.length === 0 ? (
                <EmptyState>
                  <span>📨</span>
                  <p>No hay entregas programadas</p>
                  <p style={{ fontSize: '0.85rem' }}>Agrega contenido, preguntas y retroalimentación para el programa</p>
                </EmptyState>
              ) : (
                <>
                  {/* Timeline preview */}
                  <Card style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 1rem', color: '#374151', fontSize: '0.95rem' }}>Timeline del Programa</h4>
                    <Timeline>
                      {(getTimelineText() || []).map((e, i) => (
                        <TimelineItem key={e.id} $type={e.tipo}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <Badge $type={e.tipo}>{e.tipo}</Badge>
                              <strong style={{ marginLeft: 8, fontSize: '0.9rem' }}>{e.titulo || e.texto?.substring(0, 50) || 'Sin título'}</strong>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              Día {e.diaAcumulado} · {e.hora_envio ? e.hora_envio.substring(0,5) : '09:00'}
                            </span>
                          </div>
                          {e.tipo === 'pregunta' && e.pregunta && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4, fontStyle: 'italic' }}>
                              "{e.pregunta.substring(0, 100)}"
                            </div>
                          )}
                        </TimelineItem>
                      ))}
                    </Timeline>
                  </Card>

                  {/* Table */}
                  <Table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Tipo</th>
                        <th>Título / Contenido</th>
                        <th>Día</th>
                        <th>Hora</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entregas.map((e, i) => (
                        <tr key={e.id}>
                          <td>{e.orden + 1}</td>
                          <td><Badge $type={e.tipo}>{e.tipo}</Badge></td>
                          <td>
                            <strong>{e.titulo || '-'}</strong>
                            {e.texto && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{e.texto.substring(0, 60)}</div>}
                            {e.media_url && <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>📎 {e.media_tipo || 'archivo'}</div>}
                          </td>
                          <td>+{e.dias_despues}d</td>
                          <td>{e.hora_envio ? e.hora_envio.substring(0,5) : '09:00'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 3 }}>
                              <SmallBtn onClick={() => moveEntrega(i, -1)} disabled={i === 0} title="Subir">↑</SmallBtn>
                              <SmallBtn onClick={() => moveEntrega(i, 1)} disabled={i === entregas.length - 1} title="Bajar">↓</SmallBtn>
                              <SmallBtn onClick={() => openEditEntrega(e)}>Editar</SmallBtn>
                              <SmallBtn $danger onClick={() => deleteEntrega(e.id)}>✕</SmallBtn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </>
          )}

          {/* ===== INSCRIPCIONES TAB ===== */}
          {activeTab === 'inscripciones' && selectedPrograma && (
            <>
              <StatsRow>
                <StatCard $color="#25D366">
                  <div className="stat-value">{inscripciones.length}</div>
                  <div className="stat-label">Total Inscritos</div>
                </StatCard>
                <StatCard $color="#059669">
                  <div className="stat-value">{inscripciones.filter(i => i.estado === 'activo').length}</div>
                  <div className="stat-label">Activos</div>
                </StatCard>
                <StatCard $color="#2563eb">
                  <div className="stat-value">{inscripciones.filter(i => i.estado === 'completado').length}</div>
                  <div className="stat-label">Completados</div>
                </StatCard>
                <StatCard $color="#dc2626">
                  <div className="stat-value">{inscripciones.filter(i => i.estado === 'abandonado').length}</div>
                  <div className="stat-label">Abandonados</div>
                </StatCard>
              </StatsRow>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: '1rem' }}>
                <Button $secondary onClick={() => setShowBulkModal(true)}>Importar CSV</Button>
                <Button onClick={openNewInscripcion}>+ Inscribir</Button>
              </div>

              {inscripciones.length === 0 ? (
                <EmptyState>
                  <span>👥</span>
                  <p>No hay estudiantes inscritos</p>
                </EmptyState>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Estado</th>
                      <th>Progreso</th>
                      <th>Score Prom.</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscripciones.map(ins => (
                      <tr key={ins.id}>
                        <td>
                          <strong>{ins.nombre || 'Sin nombre'}</strong>
                          {ins.email && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ins.email}</div>}
                        </td>
                        <td>{ins.telefono}</td>
                        <td><Badge $type={ins.estado}>{ins.estado}</Badge></td>
                        <td>
                          {ins.entregas_enviadas || 0}/{ins.total_entregas || entregas.length}
                        </td>
                        <td>
                          {ins.promedio_score != null ? `${(ins.promedio_score * 100).toFixed(0)}%` : '-'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {ins.estado === 'activo' && (
                              <SmallBtn onClick={() => updateInscripcionEstado(ins.id, 'pausado')}>Pausar</SmallBtn>
                            )}
                            {ins.estado === 'pausado' && (
                              <SmallBtn $success onClick={() => updateInscripcionEstado(ins.id, 'activo')}>Activar</SmallBtn>
                            )}
                            <SmallBtn $danger onClick={() => deleteInscripcion(ins.id)}>✕</SmallBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}

          {/* ===== MONITOR TAB ===== */}
          {activeTab === 'monitor' && selectedPrograma && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {interTotal} interacciones totales
                </div>
                <SmallBtn onClick={() => loadInteracciones(interPage)}>Refrescar</SmallBtn>
              </div>

              {interacciones.length === 0 ? (
                <EmptyState>
                  <span>📊</span>
                  <p>No hay interacciones registradas</p>
                  <p style={{ fontSize: '0.85rem' }}>Las interacciones aparecerán cuando el motor de envío comience a funcionar</p>
                </EmptyState>
              ) : (
                <>
                  <Table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Estudiante</th>
                        <th>Tipo</th>
                        <th>Contenido</th>
                        <th>Score</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interacciones.map(inter => (
                        <tr key={inter.id}>
                          <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            {inter.fecha_enviado || inter.created_at || '-'}
                          </td>
                          <td>
                            <strong>{inter.estudiante_nombre || inter.estudiante_telefono || '-'}</strong>
                          </td>
                          <td>
                            <Badge $type={
                              inter.tipo.includes('contenido') ? 'contenido' :
                              inter.tipo.includes('pregunta') ? 'pregunta' :
                              inter.tipo.includes('respuesta') ? 'activo' :
                              inter.tipo.includes('retro') ? 'retroalimentacion' : ''
                            }>
                              {inter.tipo.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td style={{ maxWidth: 300 }}>
                            <div style={{ fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {inter.contenido?.substring(0, 100) || '-'}
                            </div>
                          </td>
                          <td>
                            {inter.evaluacion_score != null ? (
                              <span style={{ color: inter.evaluacion_score >= 0.7 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                {(inter.evaluacion_score * 100).toFixed(0)}%
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <Badge $type={inter.estado_envio === 'enviado' || inter.estado_envio === 'entregado' || inter.estado_envio === 'leido' ? 'activo' : inter.estado_envio === 'fallido' ? 'pausado' : 'borrador'}>
                              {inter.estado_envio}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  {/* Pagination */}
                  {interTotal > 30 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '1rem' }}>
                      <SmallBtn onClick={() => loadInteracciones(interPage - 1)} disabled={interPage <= 1}>← Anterior</SmallBtn>
                      <span style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '2' }}>
                        Página {interPage} de {Math.ceil(interTotal / 30)}
                      </span>
                      <SmallBtn onClick={() => loadInteracciones(interPage + 1)} disabled={interPage >= Math.ceil(interTotal / 30)}>Siguiente →</SmallBtn>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ===== MODAL: PROGRAMA ===== */}
      {showProgramaModal && (
        <Modal onClick={() => setShowProgramaModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>{editingProgramaId ? 'Editar Programa' : 'Nuevo Programa'}</ModalTitle>
            <FormGroup>
              <label>Nombre del programa *</label>
              <input value={programaForm.nombre} onChange={e => setProgramaForm({...programaForm, nombre: e.target.value})} placeholder="Ej: Curso de Cardiología Básica" />
            </FormGroup>
            <FormGroup>
              <label>Descripción</label>
              <textarea value={programaForm.descripcion} onChange={e => setProgramaForm({...programaForm, descripcion: e.target.value})} placeholder="Descripción del programa..." />
            </FormGroup>
            <FormRow>
              <FormGroup>
                <label>Estado</label>
                <select value={programaForm.estado} onChange={e => setProgramaForm({...programaForm, estado: e.target.value})}>
                  <option value="borrador">Borrador</option>
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="finalizado">Finalizado</option>
                </select>
              </FormGroup>
              <FormGroup>
                <label>Documento base (opcional)</label>
                <input type="number" value={programaForm.documento_id} onChange={e => setProgramaForm({...programaForm, documento_id: e.target.value})} placeholder="ID del documento" />
              </FormGroup>
            </FormRow>
            <ModalActions>
              <Button $secondary onClick={() => setShowProgramaModal(false)}>Cancelar</Button>
              <Button onClick={savePrograma}>{editingProgramaId ? 'Guardar' : 'Crear'}</Button>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}

      {/* ===== MODAL: ENTREGA ===== */}
      {showEntregaModal && (
        <Modal onClick={() => setShowEntregaModal(false)}>
          <ModalContent $wide onClick={e => e.stopPropagation()}>
            <ModalTitle>{editingEntregaId ? 'Editar Entrega' : 'Nueva Entrega'}</ModalTitle>

            <FormRow $cols="1fr 1fr 1fr">
              <FormGroup>
                <label>Tipo *</label>
                <select value={entregaForm.tipo} onChange={e => setEntregaForm({...entregaForm, tipo: e.target.value})}>
                  <option value="contenido">Contenido</option>
                  <option value="pregunta">Pregunta</option>
                  <option value="retroalimentacion">Retroalimentación</option>
                </select>
              </FormGroup>
              <FormGroup>
                <label>Días después</label>
                <input type="number" min="0" value={entregaForm.dias_despues} onChange={e => setEntregaForm({...entregaForm, dias_despues: parseInt(e.target.value) || 0})} />
              </FormGroup>
              <FormGroup>
                <label>Hora de envío</label>
                <input type="time" value={entregaForm.hora_envio} onChange={e => setEntregaForm({...entregaForm, hora_envio: e.target.value})} />
              </FormGroup>
            </FormRow>

            <FormGroup>
              <label>Título</label>
              <input value={entregaForm.titulo} onChange={e => setEntregaForm({...entregaForm, titulo: e.target.value})} placeholder="Título de la entrega" />
            </FormGroup>

            <FormGroup>
              <label>Texto del mensaje</label>
              <textarea value={entregaForm.texto} onChange={e => setEntregaForm({...entregaForm, texto: e.target.value})} placeholder="Texto que se enviará por WhatsApp..." rows={3} />
            </FormGroup>

            <FormRow>
              <FormGroup>
                <label>URL de media (PDF, imagen, etc.)</label>
                <input value={entregaForm.media_url} onChange={e => setEntregaForm({...entregaForm, media_url: e.target.value})} placeholder="https://..." />
              </FormGroup>
              <FormGroup>
                <label>Tipo de media</label>
                <select value={entregaForm.media_tipo} onChange={e => setEntregaForm({...entregaForm, media_tipo: e.target.value})}>
                  <option value="">Ninguno</option>
                  <option value="pdf">PDF</option>
                  <option value="imagen">Imagen</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                  <option value="documento">Documento</option>
                </select>
              </FormGroup>
            </FormRow>

            {entregaForm.tipo === 'pregunta' && (
              <>
                <FormGroup>
                  <label>Pregunta</label>
                  <textarea value={entregaForm.pregunta} onChange={e => setEntregaForm({...entregaForm, pregunta: e.target.value})} placeholder="Pregunta a evaluar..." rows={2} />
                </FormGroup>
                <FormRow>
                  <FormGroup>
                    <label>Respuesta esperada / Criterios</label>
                    <textarea value={entregaForm.respuesta_esperada} onChange={e => setEntregaForm({...entregaForm, respuesta_esperada: e.target.value})} placeholder="Respuesta correcta o criterios para la IA..." rows={2} />
                  </FormGroup>
                  <FormGroup>
                    <label>Modo de evaluación</label>
                    <select value={entregaForm.evaluacion_modo} onChange={e => setEntregaForm({...entregaForm, evaluacion_modo: e.target.value})}>
                      <option value="ia_semantica">IA Semántica (GPT evalúa)</option>
                      <option value="exacta">Exacta (match textual)</option>
                      <option value="libre">Libre (solo registrar)</option>
                    </select>
                  </FormGroup>
                </FormRow>
              </>
            )}

            <FormGroup>
              <label>Template de Meta (opcional, para primer contacto)</label>
              <input value={entregaForm.template_name} onChange={e => setEntregaForm({...entregaForm, template_name: e.target.value})} placeholder="Nombre del template aprobado" />
            </FormGroup>

            <ModalActions>
              <Button $secondary onClick={() => setShowEntregaModal(false)}>Cancelar</Button>
              <Button onClick={saveEntrega}>{editingEntregaId ? 'Guardar' : 'Crear'}</Button>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}

      {/* ===== MODAL: INSCRIPCION ===== */}
      {showInscripcionModal && (
        <Modal onClick={() => setShowInscripcionModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>Inscribir Estudiante</ModalTitle>
            <FormGroup>
              <label>Teléfono WhatsApp *</label>
              <input value={inscripcionForm.telefono} onChange={e => setInscripcionForm({...inscripcionForm, telefono: e.target.value})} placeholder="+57 300 123 4567" />
            </FormGroup>
            <FormRow>
              <FormGroup>
                <label>Nombre</label>
                <input value={inscripcionForm.nombre} onChange={e => setInscripcionForm({...inscripcionForm, nombre: e.target.value})} placeholder="Nombre del estudiante" />
              </FormGroup>
              <FormGroup>
                <label>Email</label>
                <input value={inscripcionForm.email} onChange={e => setInscripcionForm({...inscripcionForm, email: e.target.value})} placeholder="correo@ejemplo.com" />
              </FormGroup>
            </FormRow>
            <FormGroup>
              <label>Fecha de inicio</label>
              <input type="date" value={inscripcionForm.fecha_inicio} onChange={e => setInscripcionForm({...inscripcionForm, fecha_inicio: e.target.value})} />
            </FormGroup>
            <ModalActions>
              <Button $secondary onClick={() => setShowInscripcionModal(false)}>Cancelar</Button>
              <Button onClick={saveInscripcion}>Inscribir</Button>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}

      {/* ===== MODAL: BULK IMPORT ===== */}
      {showBulkModal && (
        <Modal onClick={() => setShowBulkModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>Importar Estudiantes</ModalTitle>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Pega una lista de contactos. Formato por línea: <code>teléfono, nombre, email</code>
              <br />Separador: coma, punto y coma, o tab.
            </p>
            <FormGroup>
              <label>Lista de contactos</label>
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"+57 300 123 4567, Juan Pérez, juan@ejemplo.com\n+57 311 456 7890, María García"}
                rows={8}
              />
            </FormGroup>
            <ModalActions>
              <Button $secondary onClick={() => setShowBulkModal(false)}>Cancelar</Button>
              <Button onClick={handleBulkImport}>Importar</Button>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default AdminWhatsAppTraining;
