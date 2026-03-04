// AdminProyectos.js — Fase 9: Gestión de Proyectos Multi-Tenant
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { proyectoService, consultaService, operatixService, BACKEND_BASE } from '../../services/api';
import axios from 'axios';
import { API_BASE_URL } from '../../services/api';
import AdminLandingEditor from './AdminLandingEditor';

// Meta App ID de Operatix (aprobada por Meta)
const META_APP_ID = '1235794175100517';
const META_CONFIG_ID = '802318412947494';

const Container = styled.div``;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Title = styled.h2`
  margin: 0;
  color: #0f355b;
  font-size: 1.3rem;
`;

const AddBtn = styled.button`
  background: linear-gradient(135deg, #0f355b, #14b6cb);
  color: #fff;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(20,182,203,0.3); }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);

  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.9rem;
  }
  th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  tr:hover td { background: #f8fafc; }
`;

const Badge = styled.span`
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
  background: ${p => p.$active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};
  color: ${p => p.$active ? '#059669' : '#dc2626'};
`;

const ActionBtn = styled.button`
  background: none;
  border: 1px solid #e2e8f0;
  color: #475569;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  margin-right: 0.4rem;
  transition: all 0.2s;
  &:hover { border-color: #14b6cb; color: #14b6cb; }
`;

const DeleteBtn = styled(ActionBtn)`
  &:hover { border-color: #ef4444; color: #ef4444; }
`;

const LandingBtn = styled(ActionBtn)`
  &:hover { border-color: #8b5cf6; color: #8b5cf6; }
`;

const WhatsAppBtn = styled(ActionBtn)`
  &:hover { border-color: #25d366; color: #25d366; }
`;

const MembersBtn = styled(ActionBtn)`
  &:hover { border-color: #3b82f6; color: #3b82f6; }
`;

const WaPanel = styled.div`
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 420px;
  max-width: 95vw;
  background: #fff;
  box-shadow: -4px 0 30px rgba(0,0,0,0.15);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const WaPanelHeader = styled.div`
  padding: 1.5rem;
  background: linear-gradient(135deg, #25d366, #128c7e);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const WaPanelBody = styled.div`
  padding: 1.5rem;
  flex: 1;
`;

const WaStatusCard = styled.div`
  background: ${p => p.$connected ? '#f0fdf4' : '#fef2f2'};
  border: 1px solid ${p => p.$connected ? '#bbf7d0' : '#fecaca'};
  border-radius: 12px;
  padding: 1.2rem;
  margin-bottom: 1rem;
  text-align: center;
`;

const WaConnectBtn = styled.button`
  background: linear-gradient(135deg, #25d366, #128c7e);
  color: #fff;
  border: none;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
  &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(37,211,102,0.4); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const WaDisconnectBtn = styled.button`
  background: none;
  border: 1px solid #ef4444;
  color: #ef4444;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 1rem;
  &:hover { background: #fef2f2; }
`;

const WaOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 1000;
`;

const SlugLink = styled.a`
  color: #14b6cb;
  text-decoration: none;
  font-size: 0.85rem;
  &:hover { text-decoration: underline; }
`;

const Modal = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalCard = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 2rem;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
`;

const ModalTitle = styled.h3`
  margin: 0 0 1.5rem;
  color: #0f355b;
  font-size: 1.2rem;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  ${p => p.$full && 'grid-column: 1 / -1;'}
`;

const Label = styled.label`
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
`;

const Input = styled.input`
  padding: 0.55rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const TextArea = styled.textarea`
  padding: 0.55rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 60px;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const Select = styled.select`
  padding: 0.55rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  &:focus { outline: none; border-color: #14b6cb; }
`;

const ColorInput = styled.input`
  width: 50px;
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  padding: 2px;
`;

const ColorRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CheckboxList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
`;

const CheckboxItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  transition: background 0.15s;
  &:hover { background: #f1f5f9; }
`;

const BtnRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
`;

const SaveBtn = styled.button`
  background: linear-gradient(135deg, #0f355b, #14b6cb);
  color: #fff;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;

const CancelBtn = styled.button`
  background: #f1f5f9;
  color: #475569;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
`;

const LogoPreview = styled.img`
  height: 48px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  padding: 4px;
  background: #f8fafc;
`;

const ToggleSwitch = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;

  input { display: none; }
  .slider {
    width: 40px; height: 22px;
    background: ${p => p.$on ? '#14b6cb' : '#cbd5e1'};
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
    &::after {
      content: '';
      position: absolute;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #fff;
      top: 2px;
      left: ${p => p.$on ? '20px' : '2px'};
      transition: left 0.2s;
    }
  }
`;

const AdminProyectos = () => {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [landingProyecto, setLandingProyecto] = useState(null);
  const [waProyecto, setWaProyecto] = useState(null); // proyecto seleccionado para WhatsApp panel
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);

  // Miembros panel state
  const [membersProyecto, setMembersProyecto] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addRol, setAddRol] = useState('supervisor');

  // Form state
  const [form, setForm] = useState({
    nombre: '', slug: '', dominio_personalizado: '',
    color_primario: '#0f355b', color_secundario: '#14b6cb',
    titulo_landing: '', subtitulo_landing: '',
    rol_default: '', registro_abierto: 1, activo: 1,
    documento_ids: []
  });
  const [logoFile, setLogoFile] = useState(null);

  // Documentos y grupos para los selectors
  const [documentos, setDocumentos] = useState([]);
  const [groups, setGroups] = useState([]);

  const fetchProyectos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await proyectoService.list();
      setProyectos(res.data?.proyectos || []);
    } catch (err) {
      toast.error('Error cargando proyectos');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuxData = useCallback(async () => {
    try {
      const [docsRes, groupsRes] = await Promise.all([
        consultaService.getDocumentos(),
        axios.get(`${API_BASE_URL}/admin/content-groups.php`)
      ]);
      setDocumentos(docsRes.data?.documentos || docsRes.data || []);
      setGroups(groupsRes.data?.groups || []);
    } catch (err) {
      console.error('Error cargando datos auxiliares:', err);
    }
  }, []);

  useEffect(() => { fetchProyectos(); fetchAuxData(); }, [fetchProyectos, fetchAuxData]);

  const resetForm = () => {
    setForm({
      nombre: '', slug: '', dominio_personalizado: '',
      color_primario: '#0f355b', color_secundario: '#14b6cb',
      titulo_landing: '', subtitulo_landing: '',
      rol_default: '', registro_abierto: 1, activo: 1,
      documento_ids: []
    });
    setLogoFile(null);
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = async (p) => {
    try {
      const res = await proyectoService.get(p.id);
      const pData = res.data?.proyecto;
      setForm({
        nombre: pData.nombre || '',
        slug: pData.slug || '',
        dominio_personalizado: pData.dominio_personalizado || '',
        color_primario: pData.color_primario || '#0f355b',
        color_secundario: pData.color_secundario || '#14b6cb',
        titulo_landing: pData.titulo_landing || '',
        subtitulo_landing: pData.subtitulo_landing || '',
        rol_default: pData.rol_default || '',
        registro_abierto: pData.registro_abierto ? 1 : 0,
        activo: pData.activo ? 1 : 0,
        documento_ids: pData.documento_ids || []
      });
      setEditing(pData);
      setLogoFile(null);
      setShowModal(true);
    } catch (err) {
      toast.error('Error cargando proyecto');
    }
  };

  const handleSave = async () => {
    if (!form.nombre || !form.slug) {
      toast.error('Nombre y slug son requeridos');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (editing) fd.append('id', editing.id);
      fd.append('nombre', form.nombre);
      fd.append('slug', form.slug);
      fd.append('dominio_personalizado', form.dominio_personalizado);
      fd.append('color_primario', form.color_primario);
      fd.append('color_secundario', form.color_secundario);
      fd.append('titulo_landing', form.titulo_landing);
      fd.append('subtitulo_landing', form.subtitulo_landing);
      fd.append('rol_default', form.rol_default);
      fd.append('registro_abierto', form.registro_abierto);
      fd.append('activo', form.activo);
      fd.append('documento_ids', JSON.stringify(form.documento_ids));
      if (logoFile) fd.append('logo', logoFile);

      if (editing) {
        await proyectoService.update(fd);
        toast.success('Proyecto actualizado');
      } else {
        await proyectoService.create(fd);
        toast.success('Proyecto creado');
      }
      setShowModal(false);
      fetchProyectos();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error guardando proyecto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Desactivar el proyecto "${p.nombre}"?`)) return;
    try {
      await proyectoService.delete(p.id);
      toast.success('Proyecto desactivado');
      fetchProyectos();
    } catch (err) {
      toast.error('Error desactivando proyecto');
    }
  };

  const openLanding = async (p) => {
    try {
      const res = await proyectoService.get(p.id);
      setLandingProyecto(res.data?.proyecto || p);
    } catch (err) {
      toast.error('Error cargando proyecto para landing');
    }
  };

  const autoSlug = (name) => {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // === WhatsApp Panel handlers ===
  const openWhatsApp = async (p) => {
    setWaProyecto(p);
    setWaLoading(true);
    try {
      const res = await operatixService.whatsappStatus(p.id);
      setWaStatus(res.data?.whatsapp || { connected: false });
    } catch (err) {
      setWaStatus({ connected: false });
    } finally {
      setWaLoading(false);
    }
  };

  const closeWhatsApp = () => {
    setWaProyecto(null);
    setWaStatus(null);
  };

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

  const handleConnectWhatsApp = async () => {
    setWaConnecting(true);
    try {
      await loadFBSDK();
      window.FB.login(function(response) {
        if (response.authResponse && response.authResponse.code) {
          processWhatsAppCode(response.authResponse.code);
        } else {
          toast.error('Proceso cancelado o no autorizado');
          setWaConnecting(false);
        }
      }, {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' }
      });
    } catch (err) {
      toast.error('Error cargando Facebook SDK');
      setWaConnecting(false);
    }
  };

  const processWhatsAppCode = async (code) => {
    try {
      const res = await operatixService.connectWhatsApp(waProyecto.id, code);
      if (res.data?.success) {
        toast.success('WhatsApp conectado exitosamente');
        setWaStatus(res.data.whatsapp);
        fetchProyectos();
      } else {
        toast.error(res.data?.error || 'Error conectando WhatsApp');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error conectando WhatsApp');
    } finally {
      setWaConnecting(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!window.confirm('¿Desconectar WhatsApp de este proyecto? Los programas de entrenamiento activos dejarán de funcionar.')) return;
    try {
      await operatixService.disconnectWhatsApp(waProyecto.id);
      toast.success('WhatsApp desconectado');
      setWaStatus({ connected: false });
      fetchProyectos();
    } catch (err) {
      toast.error('Error desconectando');
    }
  };

  // === Miembros Panel handlers ===
  const openMembers = async (p) => {
    setMembersProyecto(p);
    setMembersLoading(true);
    setSearchQuery('');
    setSearchResults([]);
    try {
      const res = await proyectoService.getMiembros(p.id);
      setMiembros(res.data?.miembros || []);
    } catch (err) {
      toast.error('Error cargando miembros');
      setMiembros([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const closeMembers = () => {
    setMembersProyecto(null);
    setMiembros([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSearchUsers = useCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await proyectoService.buscarUsuarios(q);
      const results = (res.data?.usuarios || []).filter(
        u => !miembros.some(m => parseInt(m.user_id) === parseInt(u.id))
      );
      setSearchResults(results);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [miembros]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) handleSearchUsers(searchQuery);
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearchUsers]);

  const handleAddMember = async (userId) => {
    try {
      await proyectoService.addMiembro({
        proyecto_id: membersProyecto.id,
        user_id: userId,
        rol_proyecto: addRol
      });
      toast.success('Miembro agregado');
      const res = await proyectoService.getMiembros(membersProyecto.id);
      setMiembros(res.data?.miembros || []);
      setSearchQuery('');
      setSearchResults([]);
      fetchProyectos();
    } catch (err) {
      toast.error('Error agregando miembro');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('¿Eliminar este miembro del proyecto?')) return;
    try {
      await proyectoService.removeMiembro(memberId);
      toast.success('Miembro eliminado');
      setMiembros(prev => prev.filter(m => m.id !== memberId));
      fetchProyectos();
    } catch (err) {
      toast.error('Error eliminando miembro');
    }
  };

  const handleChangeRole = async (memberId, newRole) => {
    const member = miembros.find(m => m.id === memberId);
    if (!member) return;
    try {
      await proyectoService.addMiembro({
        proyecto_id: membersProyecto.id,
        user_id: member.user_id,
        rol_proyecto: newRole
      });
      setMiembros(prev => prev.map(m =>
        m.id === memberId ? { ...m, rol_proyecto: newRole } : m
      ));
    } catch (err) {
      toast.error('Error actualizando rol');
    }
  };

  const toggleDoc = (docId) => {
    setForm(prev => ({
      ...prev,
      documento_ids: prev.documento_ids.includes(docId)
        ? prev.documento_ids.filter(id => id !== docId)
        : [...prev.documento_ids, docId]
    }));
  };

  return (
    <Container>
      <TopBar>
        <Title>Proyectos Multi-Tenant</Title>
        <AddBtn onClick={openCreate}>+ Nuevo Proyecto</AddBtn>
      </TopBar>

      {loading ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>Cargando proyectos...</p>
      ) : proyectos.length === 0 ? (
        <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No hay proyectos creados.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Dominio</th>
              <th>Rol Default</th>
              <th>Docs</th>
              <th>Miembros</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>
                  {p.logo && <LogoPreview src={`${BACKEND_BASE}/${p.logo}`} alt="" style={{ height: 24, marginRight: 8, verticalAlign: 'middle' }} />}
                  {p.nombre}
                </td>
                <td>
                  <SlugLink href={`https://${p.slug}.ateneomentoria.com`} target="_blank" rel="noopener noreferrer">
                    {p.slug}.ateneomentoria.com
                  </SlugLink>
                </td>
                <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.dominio_personalizado || '—'}</td>
                <td><Badge $active={!!p.rol_default}>{p.rol_default || 'Ninguno'}</Badge></td>
                <td>{p.doc_count || 0}</td>
                <td>{p.member_count || 0}</td>
                <td><Badge $active={!!parseInt(p.activo)}>{parseInt(p.activo) ? 'Activo' : 'Inactivo'}</Badge></td>
                <td>
                  <ActionBtn onClick={() => openEdit(p)}>Editar</ActionBtn>
                  <MembersBtn onClick={() => openMembers(p)}>Miembros</MembersBtn>
                  <LandingBtn onClick={() => openLanding(p)}>Landing</LandingBtn>
                  <WhatsAppBtn onClick={() => openWhatsApp(p)}>WhatsApp</WhatsAppBtn>
                  {parseInt(p.activo) === 1 && <DeleteBtn onClick={() => handleDelete(p)}>Desactivar</DeleteBtn>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {landingProyecto && (
        <AdminLandingEditor
          proyecto={landingProyecto}
          onClose={() => setLandingProyecto(null)}
          onSaved={() => { fetchProyectos(); }}
        />
      )}

      {waProyecto && (
        <>
          <WaOverlay onClick={closeWhatsApp} />
          <WaPanel>
            <WaPanelHeader>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>WhatsApp Business</div>
                <div style={{ opacity: 0.85, fontSize: '0.85rem' }}>{waProyecto.nombre}</div>
              </div>
              <ActionBtn onClick={closeWhatsApp} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
                Cerrar
              </ActionBtn>
            </WaPanelHeader>
            <WaPanelBody>
              {waLoading ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>Consultando estado...</p>
              ) : waStatus?.connected ? (
                <>
                  <WaStatusCard $connected>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#9989;</div>
                    <div style={{ fontWeight: 700, color: '#059669', fontSize: '1.05rem' }}>WhatsApp Conectado</div>
                  </WaStatusCard>

                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.3rem' }}>Número</div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{waStatus.phone_number || '—'}</div>
                  </div>

                  {waStatus.display_name && (
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.3rem' }}>Nombre de display</div>
                      <div style={{ fontWeight: 600 }}>{waStatus.display_name}</div>
                    </div>
                  )}

                  {waStatus.business_name && (
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.3rem' }}>Empresa</div>
                      <div style={{ fontWeight: 600 }}>{waStatus.business_name}</div>
                    </div>
                  )}

                  {waStatus.connected_at && (
                    <div style={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', marginTop: '1rem' }}>
                      Conectado: {waStatus.connected_at}
                    </div>
                  )}

                  <div style={{ textAlign: 'center' }}>
                    <WaDisconnectBtn onClick={handleDisconnectWhatsApp}>
                      Desconectar WhatsApp
                    </WaDisconnectBtn>
                  </div>
                </>
              ) : (
                <>
                  <WaStatusCard $connected={false}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128247;</div>
                    <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '0.5rem' }}>No conectado</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      Conecta tu número de WhatsApp Business para habilitar el entrenamiento por WhatsApp.
                    </div>
                  </WaStatusCard>

                  <WaConnectBtn onClick={handleConnectWhatsApp} disabled={waConnecting}>
                    {waConnecting ? 'Conectando...' : 'Conectar WhatsApp Business'}
                  </WaConnectBtn>

                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#eff6ff', borderRadius: 10, fontSize: '0.83rem', color: '#1e40af' }}>
                    <strong>¿Cómo funciona?</strong>
                    <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                      <li>Se abrirá una ventana de Meta para autorizar</li>
                      <li>Selecciona tu cuenta de WhatsApp Business</li>
                      <li>El número quedará vinculado a este proyecto</li>
                      <li>Podrás enviar contenido de entrenamiento por WhatsApp</li>
                    </ul>
                  </div>
                </>
              )}
            </WaPanelBody>
          </WaPanel>
        </>
      )}

      {membersProyecto && (
        <>
          <WaOverlay onClick={closeMembers} />
          <WaPanel>
            <WaPanelHeader style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Miembros</div>
                <div style={{ opacity: 0.85, fontSize: '0.85rem' }}>{membersProyecto.nombre}</div>
              </div>
              <ActionBtn onClick={closeMembers} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
                Cerrar
              </ActionBtn>
            </WaPanelHeader>
            <WaPanelBody>
              {/* Buscar y agregar */}
              <div style={{ marginBottom: '1.5rem' }}>
                <Label style={{ marginBottom: '0.5rem', display: 'block' }}>Agregar miembro</Label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Input
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Select value={addRol} onChange={e => setAddRol(e.target.value)} style={{ width: 130 }}>
                    <option value="supervisor">Supervisor</option>
                    <option value="coordinador">Coordinador</option>
                  </Select>
                </div>
                {searchLoading && <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Buscando...</p>}
                {searchResults.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
                    {searchResults.map(u => (
                      <div key={u.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.88rem'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{u.email}</div>
                        </div>
                        <ActionBtn onClick={() => handleAddMember(u.id)} style={{ fontSize: '0.78rem' }}>
                          + Agregar
                        </ActionBtn>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.5rem 0' }}>Sin resultados</p>
                )}
              </div>

              {/* Lista de miembros actuales */}
              <Label style={{ marginBottom: '0.5rem', display: 'block' }}>
                Miembros actuales ({miembros.length})
              </Label>
              {membersLoading ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '1rem' }}>Cargando...</p>
              ) : miembros.length === 0 ? (
                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem', fontSize: '0.9rem' }}>
                  No hay miembros asignados
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {miembros.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.nombre}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{m.email}</div>
                      </div>
                      <Select
                        value={m.rol_proyecto}
                        onChange={e => handleChangeRole(m.id, e.target.value)}
                        style={{ width: 120, fontSize: '0.82rem', marginRight: '0.5rem' }}
                      >
                        <option value="supervisor">Supervisor</option>
                        <option value="coordinador">Coordinador</option>
                      </Select>
                      <DeleteBtn onClick={() => handleRemoveMember(m.id)} style={{ fontSize: '0.78rem', margin: 0 }}>
                        Eliminar
                      </DeleteBtn>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: '#eff6ff', borderRadius: 8, fontSize: '0.82rem', color: '#1e40af' }}>
                <strong>Roles:</strong>
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>
                  <li><strong>Coordinador</strong> — Dashboard completo + conectar/desconectar WhatsApp</li>
                  <li><strong>Supervisor</strong> — Dashboard solo lectura (metricas, progreso)</li>
                </ul>
              </div>
            </WaPanelBody>
          </WaPanel>
        </>
      )}

      {showModal && (
        <Modal onClick={(e) => { if (e.target === e.currentTarget) { setShowModal(false); resetForm(); } }}>
          <ModalCard>
            <ModalTitle>{editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</ModalTitle>

            <FormGrid>
              <FormGroup>
                <Label>Nombre *</Label>
                <Input
                  value={form.nombre}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      nombre: val,
                      ...(!editing ? { slug: autoSlug(val) } : {})
                    }));
                  }}
                  placeholder="Hospital XYZ"
                />
              </FormGroup>

              <FormGroup>
                <Label>Slug * (URL)</Label>
                <Input
                  value={form.slug}
                  onChange={e => setForm(prev => ({ ...prev, slug: autoSlug(e.target.value) }))}
                  placeholder="hospital-xyz"
                />
                {form.slug && (
                  <span style={{ fontSize: '0.78rem', color: '#14b6cb' }}>
                    https://{form.slug}.ateneomentoria.com
                  </span>
                )}
              </FormGroup>

              <FormGroup>
                <Label>Dominio personalizado (opcional)</Label>
                <Input
                  value={form.dominio_personalizado}
                  onChange={e => setForm(prev => ({ ...prev, dominio_personalizado: e.target.value }))}
                  placeholder="educacion.hospital.com"
                />
              </FormGroup>

              <FormGroup>
                <Label>Rol Default (registro)</Label>
                <Select
                  value={form.rol_default}
                  onChange={e => setForm(prev => ({ ...prev, rol_default: e.target.value }))}
                >
                  <option value="">Sin rol automático</option>
                  {groups.map(g => (
                    <option key={g.id || g.name} value={g.name}>{g.name}{g.description ? ` — ${g.description}` : ''}</option>
                  ))}
                  <option value="__nuevo__">+ Crear nuevo grupo...</option>
                </Select>
                {form.rol_default === '__nuevo__' && (
                  <Input
                    style={{ marginTop: 4 }}
                    placeholder="Nombre del nuevo grupo"
                    onChange={e => setForm(prev => ({ ...prev, rol_default: e.target.value }))}
                    autoFocus
                  />
                )}
              </FormGroup>

              <FormGroup>
                <Label>Color Primario</Label>
                <ColorRow>
                  <ColorInput
                    type="color"
                    value={form.color_primario}
                    onChange={e => setForm(prev => ({ ...prev, color_primario: e.target.value }))}
                  />
                  <Input
                    value={form.color_primario}
                    onChange={e => setForm(prev => ({ ...prev, color_primario: e.target.value }))}
                    style={{ width: 100 }}
                  />
                </ColorRow>
              </FormGroup>

              <FormGroup>
                <Label>Color Secundario</Label>
                <ColorRow>
                  <ColorInput
                    type="color"
                    value={form.color_secundario}
                    onChange={e => setForm(prev => ({ ...prev, color_secundario: e.target.value }))}
                  />
                  <Input
                    value={form.color_secundario}
                    onChange={e => setForm(prev => ({ ...prev, color_secundario: e.target.value }))}
                    style={{ width: 100 }}
                  />
                </ColorRow>
              </FormGroup>

              <FormGroup $full>
                <Label>Logo del proyecto</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
                  {editing?.logo && !logoFile && (
                    <LogoPreview src={`${BACKEND_BASE}/${editing.logo}`} alt="Logo actual" />
                  )}
                </div>
              </FormGroup>

              <FormGroup $full>
                <Label>Título de Landing</Label>
                <Input
                  value={form.titulo_landing}
                  onChange={e => setForm(prev => ({ ...prev, titulo_landing: e.target.value }))}
                  placeholder="Nombre que aparece en la landing (default: MentorIA)"
                />
              </FormGroup>

              <FormGroup $full>
                <Label>Subtítulo de Landing</Label>
                <TextArea
                  value={form.subtitulo_landing}
                  onChange={e => setForm(prev => ({ ...prev, subtitulo_landing: e.target.value }))}
                  placeholder="Descripción que aparece bajo el título (default: texto MentorIA)"
                />
              </FormGroup>

              <FormGroup $full>
                <Label>Documentos Asignados</Label>
                <CheckboxList>
                  {documentos.length === 0 ? (
                    <span style={{ color: '#94a3b8' }}>No hay documentos disponibles</span>
                  ) : documentos.map(doc => (
                    <CheckboxItem key={doc.id}>
                      <input
                        type="checkbox"
                        checked={form.documento_ids.includes(doc.id) || form.documento_ids.includes(String(doc.id))}
                        onChange={() => toggleDoc(doc.id)}
                      />
                      {doc.titulo || doc.nombre || `Doc #${doc.id}`}
                    </CheckboxItem>
                  ))}
                </CheckboxList>
              </FormGroup>

              <FormGroup>
                <ToggleSwitch $on={!!form.registro_abierto}>
                  <input
                    type="checkbox"
                    checked={!!form.registro_abierto}
                    onChange={e => setForm(prev => ({ ...prev, registro_abierto: e.target.checked ? 1 : 0 }))}
                  />
                  <div className="slider" />
                  Registro abierto
                </ToggleSwitch>
              </FormGroup>

              {editing && (
                <FormGroup>
                  <ToggleSwitch $on={!!form.activo}>
                    <input
                      type="checkbox"
                      checked={!!form.activo}
                      onChange={e => setForm(prev => ({ ...prev, activo: e.target.checked ? 1 : 0 }))}
                    />
                    <div className="slider" />
                    Proyecto activo
                  </ToggleSwitch>
                </FormGroup>
              )}
            </FormGrid>

            <BtnRow>
              <CancelBtn onClick={() => { setShowModal(false); resetForm(); }}>Cancelar</CancelBtn>
              <SaveBtn onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : (editing ? 'Actualizar' : 'Crear Proyecto')}
              </SaveBtn>
            </BtnRow>
          </ModalCard>
        </Modal>
      )}
    </Container>
  );
};

export default AdminProyectos;
