import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { seguimientoService, API_BASE_URL } from '../../services/api';
import axios from 'axios';

// ============================================================
// STYLED COMPONENTS
// ============================================================

const Container = styled.div``;

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
  background: ${p => p.$active ? '#0891B2' : 'transparent'};
  white-space: nowrap;
  transition: all 0.2s;

  &:hover {
    color: ${p => p.$active ? '#fff' : '#0891B2'};
    background: ${p => p.$active ? '#0891B2' : '#e2e8f0'};
  }
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const SearchInput = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 260px;
  &:focus { outline: none; border-color: #0891B2; }
`;

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  &:focus { outline: none; border-color: #0891B2; }
`;

const Button = styled.button`
  background: ${p => p.$danger ? '#dc2626' : p.$secondary ? '#64748b' : '#0891B2'};
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

const SmallButton = styled(Button)`
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
`;

const Th = styled.th`
  text-align: left;
  padding: 0.65rem 0.75rem;
  background: #f8fafc;
  color: #2b4361;
  font-weight: 600;
  font-size: 0.8rem;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.85rem;
  color: #374151;
`;

const Badge = styled.span`
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 600;
  display: inline-block;
  background: ${p => {
    switch(p.$type) {
      case 'invitado': return '#dbeafe';
      case 'registrado': return '#fef3c7';
      case 'activo': case 'activa': return '#d1fae5';
      case 'completado': case 'finalizada': return '#c4b5fd';
      case 'pausado': case 'pausada': return '#fed7aa';
      case 'suspendido': case 'cancelada': return '#fecaca';
      case 'excluido': return '#e5e7eb';
      case 'planificada': return '#e0f2fe';
      default: return '#f3f4f6';
    }
  }};
  color: ${p => {
    switch(p.$type) {
      case 'invitado': return '#1d4ed8';
      case 'registrado': return '#92400e';
      case 'activo': case 'activa': return '#065f46';
      case 'completado': case 'finalizada': return '#5b21b6';
      case 'pausado': case 'pausada': return '#c2410c';
      case 'suspendido': case 'cancelada': return '#dc2626';
      case 'excluido': return '#6b7280';
      case 'planificada': return '#0284c7';
      default: return '#374151';
    }
  }};
`;

const Modal = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: ${p => p.$wide ? '700px' : '500px'};
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
`;

const ModalTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #1e293b;
  font-size: 1.1rem;
`;

const FormGroup = styled.div`
  margin-bottom: 0.75rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
  &:focus { outline: none; border-color: #0891B2; }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  min-height: 100px;
  box-sizing: border-box;
  resize: vertical;
  &:focus { outline: none; border-color: #0891B2; }
`;

const FormSelect = styled(Select)`
  width: 100%;
  box-sizing: border-box;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-size: 0.95rem;
`;

const StatCards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 10px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border-left: 4px solid ${p => p.$color || '#0891B2'};
`;

const StatValue = styled.div`
  font-size: 1.8rem;
  font-weight: 800;
  color: #1e293b;
`;

const StatLabel = styled.div`
  font-size: 0.78rem;
  color: #64748b;
  margin-top: 2px;
`;

const RowFlex = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #64748b;
`;

const FileInput = styled.input`
  display: none;
`;

const DropZone = styled.div`
  border: 2px dashed ${p => p.$active ? '#0891B2' : '#d1d5db'};
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => p.$active ? '#f0fdfa' : '#fafafa'};
  color: #64748b;
  font-size: 0.9rem;

  &:hover {
    border-color: #0891B2;
    background: #f0fdfa;
  }
`;

const ActivityItem = styled.div`
  display: flex;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.85rem;
  &:last-child { border-bottom: none; }
`;

const ActivityDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
  background: ${p => {
    switch(p.$type) {
      case 'invitacion_enviada': return '#3b82f6';
      case 'recordatorio_enviado': return '#f59e0b';
      case 'registro_detectado': return '#10b981';
      case 'avance_modulo': return '#8b5cf6';
      case 'completado_programa': return '#06b6d4';
      case 'suspension': return '#ef4444';
      default: return '#94a3b8';
    }
  }};
`;

// ============================================================
// SUB-COMPONENTES
// ============================================================

// ---------- DASHBOARD / OVERVIEW ----------
const DashboardView = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seguimientoService.getStats()
      .then(r => setStats(r.data))
      .catch(() => toast.error('Error cargando estadísticas'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState>Cargando estadísticas...</EmptyState>;
  if (!stats) return <EmptyState>Error al cargar</EmptyState>;

  const { funnel = {}, cohortes = [], actividad_reciente = [], total_recordatorios = 0 } = stats;
  const totalMatriculas = Object.values(funnel).reduce((a, b) => a + b, 0);

  return (
    <>
      <StatCards>
        <StatCard $color="#3b82f6">
          <StatValue>{totalMatriculas}</StatValue>
          <StatLabel>Total Matrículas</StatLabel>
        </StatCard>
        <StatCard $color="#f59e0b">
          <StatValue>{funnel.invitado || 0}</StatValue>
          <StatLabel>Invitados</StatLabel>
        </StatCard>
        <StatCard $color="#10b981">
          <StatValue>{(funnel.registrado || 0) + (funnel.activo || 0)}</StatValue>
          <StatLabel>Activos</StatLabel>
        </StatCard>
        <StatCard $color="#8b5cf6">
          <StatValue>{funnel.completado || 0}</StatValue>
          <StatLabel>Completados</StatLabel>
        </StatCard>
        <StatCard $color="#ef4444">
          <StatValue>{funnel.suspendido || 0}</StatValue>
          <StatLabel>Suspendidos</StatLabel>
        </StatCard>
        <StatCard $color="#06b6d4">
          <StatValue>{total_recordatorios}</StatValue>
          <StatLabel>Recordatorios Enviados</StatLabel>
        </StatCard>
      </StatCards>

      {cohortes.length > 0 && (
        <>
          <h4 style={{ color: '#1e293b', marginBottom: '0.75rem' }}>Cohortes</h4>
          <Table>
            <thead>
              <tr>
                <Th>Cohorte</Th>
                <Th>Documento</Th>
                <Th>Estado</Th>
                <Th>Total</Th>
                <Th>Invitados</Th>
                <Th>Activos</Th>
                <Th>Completados</Th>
                <Th>Suspendidos</Th>
              </tr>
            </thead>
            <tbody>
              {cohortes.map(c => (
                <tr key={c.id}>
                  <Td style={{ fontWeight: 600 }}>{c.nombre}</Td>
                  <Td>{c.documento_titulo || '-'}</Td>
                  <Td><Badge $type={c.estado}>{c.estado}</Badge></Td>
                  <Td>{c.total}</Td>
                  <Td>{c.invitados}</Td>
                  <Td>{c.activos}</Td>
                  <Td>{c.completados}</Td>
                  <Td>{c.suspendidos}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {actividad_reciente.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ color: '#1e293b', marginBottom: '0.75rem' }}>Actividad Reciente</h4>
          <div style={{ background: 'white', borderRadius: 8, padding: '0.75rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            {actividad_reciente.map(a => (
              <ActivityItem key={a.id}>
                <ActivityDot $type={a.tipo_evento} />
                <div>
                  <strong>{a.contacto_nombre}</strong> — {a.tipo_evento.replace(/_/g, ' ')}
                  {a.detalle && <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{a.detalle}</div>}
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{new Date(a.fecha).toLocaleString('es')}</div>
                </div>
              </ActivityItem>
            ))}
          </div>
        </div>
      )}

      {totalMatriculas === 0 && cohortes.length === 0 && (
        <EmptyState>
          No hay datos aún. Crea una cohorte e importa contactos para comenzar.
        </EmptyState>
      )}
    </>
  );
};

// ---------- COHORTES ----------
const CohortesView = () => {
  const [cohortes, setCohortes] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: '', documento_id: '', rol_asignar: '', descripcion: '', fecha_inicio: '', fecha_fin: '', estado: 'planificada' });

  const cargar = useCallback(() => {
    setLoading(true);
    Promise.all([
      seguimientoService.getCohortes(),
      seguimientoService.getDocumentos()
    ])
      .then(([cRes, dRes]) => {
        setCohortes(cRes.data.cohortes || []);
        const docs = dRes.data.documentos || dRes.data || [];
        setDocumentos(Array.isArray(docs) ? docs : []);
      })
      .catch(() => toast.error('Error cargando cohortes'))
      .finally(() => setLoading(false));
  }, []);

  // Cargar roles/content_groups disponibles
  useEffect(() => {
    axios.get(`${API_BASE_URL}/admin/content-groups.php`)
      .then(r => {
        const groups = r.data.groups || r.data || [];
        setRoles(Array.isArray(groups) ? groups : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSubmit = async () => {
    if (!form.nombre || !form.documento_id) {
      toast.error('Nombre y documento son requeridos');
      return;
    }
    try {
      if (editing) {
        await seguimientoService.updateCohorte({ id: editing.id, ...form });
        toast.success('Cohorte actualizada');
      } else {
        await seguimientoService.createCohorte(form);
        toast.success('Cohorte creada con reglas por defecto');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ nombre: '', documento_id: '', rol_asignar: '', descripcion: '', fecha_inicio: '', fecha_fin: '', estado: 'planificada' });
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error guardando cohorte');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar cohorte y todas sus matrículas?')) return;
    try {
      await seguimientoService.deleteCohorte(id);
      toast.success('Cohorte eliminada');
      cargar();
    } catch (e) {
      toast.error('Error eliminando cohorte');
    }
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      nombre: c.nombre,
      documento_id: c.documento_id,
      rol_asignar: c.rol_asignar || '',
      descripcion: c.descripcion || '',
      fecha_inicio: c.fecha_inicio || '',
      fecha_fin: c.fecha_fin || '',
      estado: c.estado
    });
    setShowModal(true);
  };

  if (loading) return <EmptyState>Cargando...</EmptyState>;

  return (
    <>
      <TopBar>
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{cohortes.length} cohorte(s)</span>
        <Button onClick={() => { setEditing(null); setForm({ nombre: '', documento_id: '', descripcion: '', fecha_inicio: '', fecha_fin: '', estado: 'planificada' }); setShowModal(true); }}>
          + Nueva Cohorte
        </Button>
      </TopBar>

      {cohortes.length === 0 ? (
        <EmptyState>No hay cohortes. Crea la primera para comenzar el seguimiento.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Documento</Th>
              <Th>Rol Asignado</Th>
              <Th>Estado</Th>
              <Th>Fechas</Th>
              <Th>Matrículas</Th>
              <Th>Activos</Th>
              <Th>Completados</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {cohortes.map(c => (
              <tr key={c.id}>
                <Td style={{ fontWeight: 600 }}>{c.nombre}</Td>
                <Td>{c.documento_titulo || '-'}</Td>
                <Td style={{ fontSize: '0.8rem' }}>{c.rol_asignar || <span style={{color:'#94a3b8'}}>-</span>}</Td>
                <Td><Badge $type={c.estado}>{c.estado}</Badge></Td>
                <Td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {c.fecha_inicio || '?'} — {c.fecha_fin || '?'}
                </Td>
                <Td>{c.total_matriculas}</Td>
                <Td>{c.activos}</Td>
                <Td>{c.completados}</Td>
                <Td>
                  <RowFlex>
                    <SmallButton onClick={() => openEdit(c)}>Editar</SmallButton>
                    <SmallButton $danger onClick={() => handleDelete(c.id)}>Eliminar</SmallButton>
                  </RowFlex>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {showModal && (
        <Modal onClick={() => setShowModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>{editing ? 'Editar Cohorte' : 'Nueva Cohorte'}</ModalTitle>
            <FormGroup>
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej: Cohorte Enero 2026" />
            </FormGroup>
            {!editing && (
              <FormGroup>
                <Label>Documento / Programa *</Label>
                <FormSelect value={form.documento_id} onChange={e => setForm({...form, documento_id: e.target.value})}>
                  <option value="">Seleccionar documento...</option>
                  {documentos.map(d => (
                    <option key={d.id} value={d.id}>{d.titulo}</option>
                  ))}
                </FormSelect>
              </FormGroup>
            )}
            <FormGroup>
              <Label>Rol a Asignar al Registrarse</Label>
              <FormSelect value={form.rol_asignar} onChange={e => setForm({...form, rol_asignar: e.target.value})}>
                <option value="">Sin rol específico</option>
                <option value="estudiante">estudiante</option>
                <option value="mentor">mentor</option>
                <option value="coordinador">coordinador</option>
                {roles.map(r => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </FormSelect>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Este rol/grupo dará acceso al documento cuando el contacto se registre</span>
            </FormGroup>
            <FormGroup>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder="Descripción opcional..." />
            </FormGroup>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormGroup>
                <Label>Fecha Inicio</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio: e.target.value})} />
              </FormGroup>
              <FormGroup>
                <Label>Fecha Fin</Label>
                <Input type="date" value={form.fecha_fin} onChange={e => setForm({...form, fecha_fin: e.target.value})} />
              </FormGroup>
            </div>
            <FormGroup>
              <Label>Estado</Label>
              <FormSelect value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                <option value="planificada">Planificada</option>
                <option value="activa">Activa</option>
                <option value="finalizada">Finalizada</option>
                <option value="cancelada">Cancelada</option>
              </FormSelect>
            </FormGroup>
            <RowFlex style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button $secondary onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editing ? 'Guardar' : 'Crear Cohorte'}</Button>
            </RowFlex>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

// ---------- CONTACTOS ----------
const ContactosView = () => {
  const [contactos, setContactos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cohortes, setCohortes] = useState([]);
  const [importCohorte, setImportCohorte] = useState('');
  const [csvPreview, setCsvPreview] = useState([]);
  const fileRef = useRef(null);
  const [contactCohorte, setContactCohorte] = useState('');
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', whatsapp: '', institucion: '', convenio: '', cargo: '' });

  const cargar = useCallback(() => {
    setLoading(true);
    seguimientoService.getContactos({ search, page, limit: 20 })
      .then(r => {
        setContactos(r.data.contactos || []);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .catch(() => toast.error('Error cargando contactos'))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    seguimientoService.getCohortes().then(r => setCohortes(r.data.cohortes || [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.nombre) { toast.error('Nombre es requerido'); return; }
    try {
      if (editing) {
        await seguimientoService.updateContacto({ id: editing.id, ...form });
        toast.success('Contacto actualizado');
      } else {
        await seguimientoService.createContacto({ ...form, cohorte_id: contactCohorte ? parseInt(contactCohorte) : 0 });
        toast.success('Contacto creado');
      }
      setShowModal(false);
      setEditing(null);
      setContactCohorte('');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error guardando contacto');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar contacto?')) return;
    try {
      await seguimientoService.deleteContacto(id);
      toast.success('Contacto eliminado');
      cargar();
    } catch (e) { toast.error('Error eliminando'); }
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ nombre: c.nombre, email: c.email || '', telefono: c.telefono || '', whatsapp: c.whatsapp || '', institucion: c.institucion || '', convenio: c.convenio || '', cargo: c.cargo || '' });
    setShowModal(true);
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    }).filter(obj => obj.nombre);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvPreview.length === 0) { toast.error('No hay datos para importar'); return; }
    try {
      const r = await seguimientoService.importarContactos({
        contactos: csvPreview,
        cohorte_id: importCohorte ? parseInt(importCohorte) : 0
      });
      toast.success(`Importados: ${r.data.importados}, Duplicados: ${r.data.duplicados}, Errores: ${r.data.errores}`);
      setShowImport(false);
      setCsvPreview([]);
      setImportCohorte('');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error en importación');
    }
  };

  return (
    <>
      <TopBar>
        <RowFlex>
          <SearchInput
            placeholder="Buscar por nombre, email, teléfono..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{total} contacto(s)</span>
        </RowFlex>
        <RowFlex>
          <Button $secondary onClick={() => setShowImport(true)}>Importar CSV</Button>
          <Button onClick={() => { setEditing(null); setForm({ nombre: '', email: '', telefono: '', whatsapp: '', institucion: '', convenio: '', cargo: '' }); setContactCohorte(''); setShowModal(true); }}>
            + Nuevo Contacto
          </Button>
        </RowFlex>
      </TopBar>

      {loading ? <EmptyState>Cargando...</EmptyState> : contactos.length === 0 ? (
        <EmptyState>No hay contactos. Importa un CSV o crea uno manualmente.</EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Email</Th>
                <Th>Teléfono</Th>
                <Th>WhatsApp</Th>
                <Th>Institución</Th>
                <Th>Convenio</Th>
                <Th>Matrículas</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {contactos.map(c => (
                <tr key={c.id}>
                  <Td style={{ fontWeight: 600 }}>{c.nombre}</Td>
                  <Td>{c.email || '-'}</Td>
                  <Td>{c.telefono || '-'}</Td>
                  <Td>{c.whatsapp || '-'}</Td>
                  <Td>{c.institucion || '-'}</Td>
                  <Td>{c.convenio || '-'}</Td>
                  <Td>{c.total_matriculas || 0}</Td>
                  <Td>
                    <RowFlex>
                      <SmallButton onClick={() => openEdit(c)}>Editar</SmallButton>
                      <SmallButton $danger onClick={() => handleDelete(c.id)}>Eliminar</SmallButton>
                    </RowFlex>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {pages > 1 && (
            <Pagination>
              <SmallButton $secondary disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</SmallButton>
              <span>Pág. {page} de {pages}</span>
              <SmallButton $secondary disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</SmallButton>
            </Pagination>
          )}
        </>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <Modal onClick={() => setShowModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>{editing ? 'Editar Contacto' : 'Nuevo Contacto'}</ModalTitle>
            <FormGroup><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></FormGroup>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormGroup><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></FormGroup>
              <FormGroup><Label>Teléfono</Label><Input value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /></FormGroup>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormGroup><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="Si es diferente al teléfono" /></FormGroup>
              <FormGroup><Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} /></FormGroup>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormGroup><Label>Institución</Label><Input value={form.institucion} onChange={e => setForm({...form, institucion: e.target.value})} /></FormGroup>
              <FormGroup><Label>Convenio</Label><Input value={form.convenio} onChange={e => setForm({...form, convenio: e.target.value})} /></FormGroup>
            </div>
            {!editing && (
              <FormGroup>
                <Label>Asignar a Cohorte</Label>
                <FormSelect value={contactCohorte} onChange={e => setContactCohorte(e.target.value)}>
                  <option value="">Sin asignar a cohorte</option>
                  {cohortes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </FormSelect>
              </FormGroup>
            )}
            <RowFlex style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button $secondary onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editing ? 'Guardar' : 'Crear'}</Button>
            </RowFlex>
          </ModalContent>
        </Modal>
      )}

      {/* Modal importar CSV */}
      {showImport && (
        <Modal onClick={() => setShowImport(false)}>
          <ModalContent $wide onClick={e => e.stopPropagation()}>
            <ModalTitle>Importar Contactos desde CSV</ModalTitle>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
              El CSV debe tener cabeceras: <strong>nombre, email, telefono, whatsapp, institucion, convenio, cargo</strong> (mínimo nombre).
            </p>

            <FormGroup>
              <Label>Asignar a Cohorte (opcional)</Label>
              <FormSelect value={importCohorte} onChange={e => setImportCohorte(e.target.value)}>
                <option value="">Sin asignar a cohorte</option>
                {cohortes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </FormSelect>
            </FormGroup>

            <DropZone onClick={() => fileRef.current?.click()} $active={csvPreview.length > 0}>
              {csvPreview.length > 0 ? `${csvPreview.length} contactos listos para importar` : 'Haz clic para seleccionar archivo CSV'}
              <FileInput ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileChange} />
            </DropZone>

            {csvPreview.length > 0 && (
              <div style={{ marginTop: '1rem', maxHeight: 200, overflow: 'auto' }}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Nombre</Th>
                      <Th>Email</Th>
                      <Th>Teléfono</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(0, 10).map((c, i) => (
                      <tr key={i}>
                        <Td>{c.nombre}</Td>
                        <Td>{c.email || '-'}</Td>
                        <Td>{c.telefono || '-'}</Td>
                      </tr>
                    ))}
                    {csvPreview.length > 10 && (
                      <tr><Td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8' }}>... y {csvPreview.length - 10} más</Td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}

            <RowFlex style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button $secondary onClick={() => { setShowImport(false); setCsvPreview([]); }}>Cancelar</Button>
              <Button disabled={csvPreview.length === 0} onClick={handleImport}>
                Importar {csvPreview.length} Contactos
              </Button>
            </RowFlex>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

// ---------- MATRICULAS ----------
const MatriculasView = () => {
  const [matriculas, setMatriculas] = useState([]);
  const [stats, setStats] = useState({});
  const [cohortes, setCohortes] = useState([]);
  const [cohorteFilter, setCohorteFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (cohorteFilter) params.cohorte_id = cohorteFilter;
    if (estadoFilter) params.estado = estadoFilter;

    seguimientoService.getMatriculas(params)
      .then(r => {
        setMatriculas(r.data.matriculas || []);
        setStats(r.data.stats || {});
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .catch(() => toast.error('Error cargando matrículas'))
      .finally(() => setLoading(false));
  }, [cohorteFilter, estadoFilter, page]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    seguimientoService.getCohortes().then(r => setCohortes(r.data.cohortes || [])).catch(() => {});
  }, []);

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await seguimientoService.updateMatricula({ id, estado: nuevoEstado });
      toast.success(`Estado cambiado a: ${nuevoEstado}`);
      cargar();
    } catch (e) { toast.error('Error cambiando estado'); }
  };

  return (
    <>
      <TopBar>
        <RowFlex>
          <Select value={cohorteFilter} onChange={e => { setCohorteFilter(e.target.value); setPage(1); }}>
            <option value="">Todas las cohortes</option>
            {cohortes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <Select value={estadoFilter} onChange={e => { setEstadoFilter(e.target.value); setPage(1); }}>
            <option value="">Todos los estados</option>
            <option value="invitado">Invitado</option>
            <option value="registrado">Registrado</option>
            <option value="activo">Activo</option>
            <option value="pausado">Pausado</option>
            <option value="suspendido">Suspendido</option>
            <option value="completado">Completado</option>
            <option value="excluido">Excluido</option>
          </Select>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{total} matrícula(s)</span>
        </RowFlex>
      </TopBar>

      {Object.keys(stats).length > 0 && (
        <StatCards>
          {Object.entries(stats).map(([estado, count]) => (
            <StatCard key={estado} $color={
              estado === 'activo' ? '#10b981' : estado === 'completado' ? '#8b5cf6' :
              estado === 'suspendido' ? '#ef4444' : estado === 'invitado' ? '#3b82f6' : '#94a3b8'
            }>
              <StatValue>{count}</StatValue>
              <StatLabel>{estado}</StatLabel>
            </StatCard>
          ))}
        </StatCards>
      )}

      {loading ? <EmptyState>Cargando...</EmptyState> : matriculas.length === 0 ? (
        <EmptyState>No hay matrículas{cohorteFilter ? ' en esta cohorte' : ''}.</EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Contacto</Th>
                <Th>Email</Th>
                <Th>Cohorte</Th>
                <Th>Estado</Th>
                <Th>Etapa</Th>
                <Th>Recordatorios</Th>
                <Th>Usuario</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {matriculas.map(m => (
                <tr key={m.id}>
                  <Td style={{ fontWeight: 600 }}>{m.contacto_nombre}</Td>
                  <Td style={{ fontSize: '0.8rem' }}>{m.contacto_email || '-'}</Td>
                  <Td style={{ fontSize: '0.8rem' }}>{m.cohorte_nombre}</Td>
                  <Td><Badge $type={m.estado}>{m.estado}</Badge></Td>
                  <Td style={{ fontSize: '0.8rem' }}>{m.etapa_actual?.replace(/_/g, ' ')}</Td>
                  <Td>{m.recordatorios_enviados}</Td>
                  <Td style={{ fontSize: '0.8rem' }}>{m.usuario_nombre || <span style={{color:'#94a3b8'}}>Sin registro</span>}</Td>
                  <Td>
                    <FormSelect
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', width: 'auto' }}
                      value={m.estado}
                      onChange={e => cambiarEstado(m.id, e.target.value)}
                    >
                      <option value="invitado">Invitado</option>
                      <option value="registrado">Registrado</option>
                      <option value="activo">Activo</option>
                      <option value="pausado">Pausado</option>
                      <option value="suspendido">Suspendido</option>
                      <option value="completado">Completado</option>
                      <option value="excluido">Excluido</option>
                    </FormSelect>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {pages > 1 && (
            <Pagination>
              <SmallButton $secondary disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</SmallButton>
              <span>Pág. {page} de {pages}</span>
              <SmallButton $secondary disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</SmallButton>
            </Pagination>
          )}
        </>
      )}
    </>
  );
};

// ---------- REGLAS ----------
const ReglasView = () => {
  const [cohortes, setCohortes] = useState([]);
  const [selectedCohorte, setSelectedCohorte] = useState('');
  const [reglas, setReglas] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      seguimientoService.getCohortes(),
      seguimientoService.getPlantillas()
    ]).then(([cRes, pRes]) => {
      setCohortes(cRes.data.cohortes || []);
      setPlantillas(pRes.data.plantillas || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedCohorte) { setReglas([]); return; }
    setLoading(true);
    seguimientoService.getReglas(selectedCohorte)
      .then(r => setReglas(r.data.reglas || []))
      .catch(() => toast.error('Error cargando reglas'))
      .finally(() => setLoading(false));
  }, [selectedCohorte]);

  const updateRegla = (id, field, value) => {
    setReglas(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await seguimientoService.updateReglas({ cohorte_id: parseInt(selectedCohorte), reglas });
      toast.success('Reglas guardadas');
    } catch (e) {
      toast.error('Error guardando reglas');
    }
    setSaving(false);
  };

  const etapaLabels = { no_registro: 'No se Registra', no_inicia: 'No Inicia', no_avanza: 'No Avanza' };
  const canalOptions = ['email', 'whatsapp', 'llamada', 'in_app'];

  return (
    <>
      <TopBar>
        <RowFlex>
          <Select value={selectedCohorte} onChange={e => setSelectedCohorte(e.target.value)}>
            <option value="">Seleccionar cohorte...</option>
            {cohortes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
        </RowFlex>
        {reglas.length > 0 && (
          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        )}
      </TopBar>

      {!selectedCohorte ? (
        <EmptyState>Selecciona una cohorte para configurar sus reglas de recordatorio.</EmptyState>
      ) : loading ? (
        <EmptyState>Cargando...</EmptyState>
      ) : reglas.length === 0 ? (
        <EmptyState>No hay reglas configuradas para esta cohorte.</EmptyState>
      ) : (
        ['no_registro', 'no_inicia', 'no_avanza'].map(etapa => {
          const etapaReglas = reglas.filter(r => r.etapa === etapa);
          if (etapaReglas.length === 0) return null;
          return (
            <div key={etapa} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#1e293b', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                {etapaLabels[etapa]}
              </h4>
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Días</Th>
                    <Th>Canal</Th>
                    <Th>Plantilla</Th>
                    <Th>Activa</Th>
                  </tr>
                </thead>
                <tbody>
                  {etapaReglas.map(r => (
                    <tr key={r.id}>
                      <Td>Recordatorio {r.numero_recordatorio}</Td>
                      <Td>
                        <Input
                          type="number" min="1" style={{ width: 70, padding: '0.3rem 0.5rem' }}
                          value={r.dias_trigger}
                          onChange={e => updateRegla(r.id, 'dias_trigger', e.target.value)}
                        />
                      </Td>
                      <Td>
                        <FormSelect
                          style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                          value={r.canal}
                          onChange={e => updateRegla(r.id, 'canal', e.target.value)}
                        >
                          {canalOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </FormSelect>
                      </Td>
                      <Td>
                        <FormSelect
                          style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}
                          value={r.plantilla_id || ''}
                          onChange={e => updateRegla(r.id, 'plantilla_id', e.target.value || null)}
                        >
                          <option value="">Sin plantilla</option>
                          {plantillas.filter(p => p.canal === r.canal || !r.canal).map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </FormSelect>
                      </Td>
                      <Td>
                        <input
                          type="checkbox"
                          checked={parseInt(r.activa) === 1}
                          onChange={e => updateRegla(r.id, 'activa', e.target.checked ? 1 : 0)}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          );
        })
      )}
    </>
  );
};

// ---------- PLANTILLAS ----------
const PlantillasView = () => {
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nombre: '', tipo: 'recordatorio', canal: 'email', asunto: '', cuerpo: '' });

  const cargar = useCallback(() => {
    setLoading(true);
    seguimientoService.getPlantillas()
      .then(r => setPlantillas(r.data.plantillas || []))
      .catch(() => toast.error('Error cargando plantillas'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleSubmit = async () => {
    if (!form.nombre || !form.cuerpo) { toast.error('Nombre y cuerpo son requeridos'); return; }
    try {
      if (editing) {
        await seguimientoService.updatePlantilla({ id: editing.id, ...form });
        toast.success('Plantilla actualizada');
      } else {
        await seguimientoService.createPlantilla(form);
        toast.success('Plantilla creada');
      }
      setShowModal(false);
      setEditing(null);
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error guardando plantilla');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar plantilla?')) return;
    try {
      await seguimientoService.deletePlantilla(id);
      toast.success('Plantilla eliminada');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error eliminando');
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ nombre: p.nombre, tipo: p.tipo, canal: p.canal, asunto: p.asunto || '', cuerpo: p.cuerpo });
    setShowModal(true);
  };

  const tipoLabels = {
    invitacion: 'Invitación', confirmacion: 'Confirmación', bienvenida: 'Bienvenida',
    recordatorio: 'Recordatorio', felicitacion: 'Felicitación', suspension: 'Suspensión',
    certificacion: 'Certificación', custom: 'Personalizada'
  };

  return (
    <>
      <TopBar>
        <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{plantillas.length} plantilla(s)</span>
        <Button onClick={() => { setEditing(null); setForm({ nombre: '', tipo: 'recordatorio', canal: 'email', asunto: '', cuerpo: '' }); setShowModal(true); }}>
          + Nueva Plantilla
        </Button>
      </TopBar>

      {loading ? <EmptyState>Cargando...</EmptyState> : plantillas.length === 0 ? (
        <EmptyState>No hay plantillas.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th>Canal</Th>
              <Th>Asunto</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {plantillas.map(p => (
              <tr key={p.id}>
                <Td style={{ fontWeight: 600 }}>{p.nombre}</Td>
                <Td><Badge $type={p.tipo === 'recordatorio' ? 'pausado' : p.tipo === 'invitacion' ? 'invitado' : 'activo'}>{tipoLabels[p.tipo] || p.tipo}</Badge></Td>
                <Td>{p.canal}</Td>
                <Td style={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.asunto || '-'}</Td>
                <Td>
                  <RowFlex>
                    <SmallButton onClick={() => openEdit(p)}>Editar</SmallButton>
                    <SmallButton $danger onClick={() => handleDelete(p.id)}>Eliminar</SmallButton>
                  </RowFlex>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {showModal && (
        <Modal onClick={() => setShowModal(false)}>
          <ModalContent $wide onClick={e => e.stopPropagation()}>
            <ModalTitle>{editing ? 'Editar Plantilla' : 'Nueva Plantilla'}</ModalTitle>
            <FormGroup><Label>Nombre *</Label><Input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} /></FormGroup>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FormGroup>
                <Label>Tipo</Label>
                <FormSelect value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  {Object.entries(tipoLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </FormSelect>
              </FormGroup>
              <FormGroup>
                <Label>Canal</Label>
                <FormSelect value={form.canal} onChange={e => setForm({...form, canal: e.target.value})}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="llamada">Llamada</option>
                  <option value="in_app">In-App</option>
                </FormSelect>
              </FormGroup>
            </div>
            {form.canal === 'email' && (
              <FormGroup><Label>Asunto</Label><Input value={form.asunto} onChange={e => setForm({...form, asunto: e.target.value})} placeholder="Asunto del email..." /></FormGroup>
            )}
            <FormGroup>
              <Label>Cuerpo del Mensaje *</Label>
              <Textarea
                value={form.cuerpo}
                onChange={e => setForm({...form, cuerpo: e.target.value})}
                placeholder="Usa variables: {{nombre}}, {{programa}}, {{enlace_registro}}, {{enlace_programa}}, {{modulo}}, {{progreso}}"
                style={{ minHeight: 150 }}
              />
            </FormGroup>
            <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0 0 1rem 0' }}>
              Variables disponibles: {'{{nombre}}'}, {'{{programa}}'}, {'{{enlace_registro}}'}, {'{{enlace_programa}}'}, {'{{modulo}}'}, {'{{progreso}}'}, {'{{fecha_inicio}}'}, {'{{fecha_fin}}'}
            </p>
            <RowFlex style={{ justifyContent: 'flex-end' }}>
              <Button $secondary onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editing ? 'Guardar' : 'Crear'}</Button>
            </RowFlex>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

const AdminSeguimiento = () => {
  const [activeSubTab, setActiveSubTab] = useState('dashboard');

  const subTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'cohortes', label: 'Cohortes' },
    { id: 'contactos', label: 'Contactos' },
    { id: 'matriculas', label: 'Matrículas' },
    { id: 'reglas', label: 'Reglas' },
    { id: 'plantillas', label: 'Plantillas' },
  ];

  return (
    <Container>
      <SubTabContainer>
        {subTabs.map(tab => (
          <SubTab
            key={tab.id}
            $active={activeSubTab === tab.id}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
          </SubTab>
        ))}
      </SubTabContainer>

      {activeSubTab === 'dashboard' && <DashboardView />}
      {activeSubTab === 'cohortes' && <CohortesView />}
      {activeSubTab === 'contactos' && <ContactosView />}
      {activeSubTab === 'matriculas' && <MatriculasView />}
      {activeSubTab === 'reglas' && <ReglasView />}
      {activeSubTab === 'plantillas' && <PlantillasView />}
    </Container>
  );
};

export default AdminSeguimiento;
