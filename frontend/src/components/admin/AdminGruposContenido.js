import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = 'https://mentoria.ateneo.co/backend/api';

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
  background: ${props => props.system ? '#fef2f2' : '#f0fdfa'};
  color: ${props => props.system ? '#dc2626' : '#0891B2'};
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
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
  max-width: 450px;
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
  min-height: 60px;
  box-sizing: border-box;

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

const AdminGruposContenido = () => {
  const [groups, setGroups] = useState([]);
  const [systemRoles, setSystemRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/content-groups.php`);
      if (res.data?.success) {
        setGroups(res.data.groups);
        setSystemRoles(res.data.system_roles || []);
      }
    } catch (err) {
      console.error('Error cargando grupos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreateModal = () => {
    setEditGroup(null);
    setFormName('');
    setFormDesc('');
    setShowModal(true);
  };

  const openEditModal = (group) => {
    setEditGroup(group);
    setFormName(group.name);
    setFormDesc(group.description || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!editGroup && !formName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setSaving(true);
    try {
      if (editGroup) {
        await axios.put(`${API_BASE_URL}/admin/content-groups.php`, {
          id: editGroup.id,
          description: formDesc
        });
        toast.success('Grupo actualizado');
      } else {
        await axios.post(`${API_BASE_URL}/admin/content-groups.php`, {
          name: formName,
          description: formDesc
        });
        toast.success('Grupo creado exitosamente');
      }
      setShowModal(false);
      fetchGroups();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error guardando grupo';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group) => {
    if (!window.confirm(`¿Eliminar el grupo "${group.name}"?`)) return;

    try {
      await axios.delete(`${API_BASE_URL}/admin/content-groups.php?id=${group.id}`);
      toast.success('Grupo eliminado');
      fetchGroups();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error eliminando grupo';
      toast.error(msg);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando grupos...</div>;

  return (
    <Container>
      <TopBar>
        <InfoText>
          Los grupos de contenido determinan qué documentos puede ver cada usuario.
          Los roles <strong>admin</strong>, <strong>mentor</strong> y <strong>coordinador</strong> son del sistema y no se gestionan aquí.
        </InfoText>
        <Button onClick={openCreateModal}>+ Nuevo Grupo</Button>
      </TopBar>

      <Table>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Descripción</Th>
            <Th>Usuarios</Th>
            <Th>Documentos</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {systemRoles.map(role => (
            <tr key={role} style={{ background: '#fafafa' }}>
              <Td><Badge system>{role}</Badge></Td>
              <Td style={{ color: '#9ca3af', fontStyle: 'italic' }}>Rol del sistema</Td>
              <Td>—</Td>
              <Td>—</Td>
              <Td style={{ color: '#9ca3af' }}>Protegido</Td>
            </tr>
          ))}
          {groups.map(group => (
            <tr key={group.id}>
              <Td><Badge>{group.name}</Badge></Td>
              <Td>{group.description || '—'}</Td>
              <Td>{group.user_count}</Td>
              <Td>{group.document_count}</Td>
              <Td>
                <ActionBtn onClick={() => openEditModal(group)}>Editar</ActionBtn>
                <ActionBtn danger onClick={() => handleDelete(group)}>Eliminar</ActionBtn>
              </Td>
            </tr>
          ))}
          {groups.length === 0 && (
            <tr>
              <Td colSpan="5" style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                No hay grupos de contenido creados
              </Td>
            </tr>
          )}
        </tbody>
      </Table>

      {showModal && (
        <Modal onClick={() => setShowModal(false)}>
          <ModalContent onClick={e => e.stopPropagation()}>
            <ModalTitle>{editGroup ? 'Editar Grupo' : 'Nuevo Grupo de Contenido'}</ModalTitle>

            <FormGroup>
              <Label>Nombre del grupo</Label>
              {editGroup ? (
                <Input value={formName} disabled style={{ background: '#f3f4f6' }} />
              ) : (
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ej: cardiologia, pediatria, residentes_2026"
                />
              )}
            </FormGroup>

            <FormGroup>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Descripción del grupo de contenido"
              />
            </FormGroup>

            <ModalActions>
              <CancelBtn onClick={() => setShowModal(false)}>Cancelar</CancelBtn>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : (editGroup ? 'Actualizar' : 'Crear Grupo')}
              </Button>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default AdminGruposContenido;
