import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { notificacionService, API_BASE_URL } from '../../services/api';
import axios from 'axios';

const Container = styled.div``;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
`;

const InfoText = styled.p`
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
`;

const Button = styled.button`
  background: ${props => props.danger ? '#dc2626' : '#0891B2'};
  color: white;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s;

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
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
  padding: 0.75rem 1rem;
  background: #f8fafc;
  color: #2b4361;
  font-weight: 600;
  font-size: 0.85rem;
  border-bottom: 2px solid #e5e7eb;
`;

const Td = styled.td`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.9rem;
  color: #374151;
`;

const Badge = styled.span`
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => {
    if (props.tipo === 'warning') return '#fef3c7';
    if (props.tipo === 'success') return '#d1fae5';
    return '#dbeafe';
  }};
  color: ${props => {
    if (props.tipo === 'warning') return '#92400e';
    if (props.tipo === 'success') return '#065f46';
    return '#1e40af';
  }};
`;

const ToggleBtn = styled.button`
  background: ${props => props.$active ? '#d1fae5' : '#fee2e2'};
  color: ${props => props.$active ? '#065f46' : '#991b1b'};
  border: none;
  padding: 0.25rem 0.6rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;

  &:hover { opacity: 0.8; }
`;

const ActionBtn = styled.button`
  background: none;
  border: 1px solid ${props => props.danger ? '#dc2626' : '#d1d5db'};
  color: ${props => props.danger ? '#dc2626' : '#374151'};
  padding: 0.3rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-right: 0.5rem;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.danger ? '#fef2f2' : '#f9fafb'};
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 2rem;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
`;

const ModalTitle = styled.h3`
  color: #2b4361;
  margin: 0 0 1.5rem 0;
`;

const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.3rem;
  font-size: 0.9rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #0891B2;
    box-shadow: 0 0 0 2px rgba(8,145,178,0.2);
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 80px;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #0891B2;
    box-shadow: 0 0 0 2px rgba(8,145,178,0.2);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
  background: white;

  &:focus {
    outline: none;
    border-color: #0891B2;
    box-shadow: 0 0 0 2px rgba(8,145,178,0.2);
  }
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
`;

const CancelBtn = styled.button`
  background: #f3f4f6;
  color: #374151;
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
`;

const AdminNotificaciones = () => {
  const [notificaciones, setNotificaciones] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formMensaje, setFormMensaje] = useState('');
  const [formTipo, setFormTipo] = useState('info');
  const [formRolDestino, setFormRolDestino] = useState('todos');

  const fetchNotificaciones = useCallback(async () => {
    try {
      const res = await notificacionService.getAll();
      if (res.data?.success) {
        setNotificaciones(res.data.notificaciones);
      }
    } catch (err) {
      console.error('Error cargando notificaciones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/roles.php`);
      if (res.data?.roles) {
        setRoles(res.data.roles);
      }
    } catch (err) {
      console.error('Error cargando roles:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotificaciones();
    fetchRoles();
  }, [fetchNotificaciones, fetchRoles]);

  const openCreateModal = () => {
    setEditItem(null);
    setFormTitulo('');
    setFormMensaje('');
    setFormTipo('info');
    setFormRolDestino('todos');
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditItem(item);
    setFormTitulo(item.titulo);
    setFormMensaje(item.mensaje);
    setFormTipo(item.tipo);
    setFormRolDestino(item.rol_destino || 'todos');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formTitulo.trim() || !formMensaje.trim()) {
      toast.error('Titulo y mensaje son requeridos');
      return;
    }

    setSaving(true);
    try {
      const data = {
        titulo: formTitulo,
        mensaje: formMensaje,
        tipo: formTipo,
        rol_destino: formRolDestino === 'todos' ? null : formRolDestino
      };

      if (editItem) {
        await notificacionService.update({ ...data, id: editItem.id });
        toast.success('Notificacion actualizada');
      } else {
        await notificacionService.create(data);
        toast.success('Notificacion creada exitosamente');
      }
      setShowModal(false);
      fetchNotificaciones();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error guardando notificacion';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    try {
      await notificacionService.update({ id: item.id, activa: item.activa === '1' ? 0 : 1 });
      toast.success(item.activa === '1' ? 'Notificacion desactivada' : 'Notificacion activada');
      fetchNotificaciones();
    } catch (err) {
      toast.error('Error cambiando estado');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Eliminar la notificacion "${item.titulo}"?`)) return;

    try {
      await notificacionService.delete(item.id);
      toast.success('Notificacion eliminada');
      fetchNotificaciones();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error eliminando notificacion';
      toast.error(msg);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando notificaciones...</div>;

  return (
    <Container>
      <TopBar>
        <InfoText>
          Las notificaciones se muestran como modal a los usuarios al cargar la app. Puedes dirigirlas a un rol o a todos.
        </InfoText>
        <Button onClick={openCreateModal}>+ Nueva Notificacion</Button>
      </TopBar>

      <Table>
        <thead>
          <tr>
            <Th>Titulo</Th>
            <Th>Tipo</Th>
            <Th>Destino</Th>
            <Th>Estado</Th>
            <Th>Leidas</Th>
            <Th>Fecha</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {notificaciones.map(n => (
            <tr key={n.id}>
              <Td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {n.titulo}
              </Td>
              <Td><Badge tipo={n.tipo}>{n.tipo}</Badge></Td>
              <Td>{n.rol_destino || 'Todos'}</Td>
              <Td>
                <ToggleBtn $active={n.activa === '1'} onClick={() => handleToggle(n)}>
                  {n.activa === '1' ? 'Activa' : 'Inactiva'}
                </ToggleBtn>
              </Td>
              <Td>{n.leidas_count}</Td>
              <Td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{formatDate(n.created_at)}</Td>
              <Td>
                <ActionBtn onClick={() => openEditModal(n)}>Editar</ActionBtn>
                <ActionBtn danger onClick={() => handleDelete(n)}>Eliminar</ActionBtn>
              </Td>
            </tr>
          ))}
          {notificaciones.length === 0 && (
            <tr>
              <Td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                No hay notificaciones creadas
              </Td>
            </tr>
          )}
        </tbody>
      </Table>

      {showModal && (
        <Modal onClick={() => setShowModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>{editItem ? 'Editar Notificacion' : 'Nueva Notificacion'}</ModalTitle>

            <FormGroup>
              <Label>Titulo</Label>
              <Input
                value={formTitulo}
                onChange={e => setFormTitulo(e.target.value)}
                placeholder="Ej: Mantenimiento programado"
              />
            </FormGroup>

            <FormGroup>
              <Label>Mensaje</Label>
              <Textarea
                value={formMensaje}
                onChange={e => setFormMensaje(e.target.value)}
                placeholder="Contenido del mensaje para los usuarios..."
              />
            </FormGroup>

            <FormGroup>
              <Label>Tipo</Label>
              <Select value={formTipo} onChange={e => setFormTipo(e.target.value)}>
                <option value="info">Informacion</option>
                <option value="warning">Advertencia</option>
                <option value="success">Exito</option>
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>Rol destino</Label>
              <Select value={formRolDestino} onChange={e => setFormRolDestino(e.target.value)}>
                <option value="todos">Todos los usuarios</option>
                {roles.map(r => (
                  <option key={r.name} value={r.name}>{r.label}</option>
                ))}
              </Select>
            </FormGroup>

            <ModalActions>
              <CancelBtn onClick={() => setShowModal(false)}>Cancelar</CancelBtn>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : (editItem ? 'Actualizar' : 'Crear Notificacion')}
              </Button>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default AdminNotificaciones;
