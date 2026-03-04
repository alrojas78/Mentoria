// src/components/admin/AdminUserManagement.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import { userService, API_BASE_URL } from '../../services/api';
import { FaEdit, FaTrash, FaPlus, FaUserShield, FaUser, FaSearch, FaFileExport, FaFilter, FaChalkboardTeacher } from 'react-icons/fa';

const ROLE_COLORS = {
  admin: { bg: '#e3f2fd', color: '#0d47a1' },
  mentor: { bg: '#fff3e0', color: '#e65100' },
  vozama: { bg: '#f3e5f5', color: '#6a1b9a' },
};
const DEFAULT_ROLE_COLOR = { bg: '#f1f8e9', color: '#33691e' };
const ucfirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const Container = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  padding: 1.5rem;
`;

const TitleBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  color: #2b4361;
  margin: 0;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: ${props => props.primary ? '#2b4361' : props.danger ? '#e74c3c' : '#f1f1f1'};
  color: ${props => props.primary || props.danger ? 'white' : '#333'};
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SearchContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;
`;

const SearchInput = styled.div`
  position: relative;
  flex: 1;
  max-width: 300px;
  
  input {
    width: 100%;
    padding: 0.5rem 0.5rem 0.5rem 2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  svg {
    position: absolute;
    left: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
  }
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 1rem;
  
  select {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
  }
  
  th {
    color: #2b4361;
    font-weight: 600;
    background-color: #f8f9fa;
  }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background-color: #f1f5f9;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const RoleLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: ${props => (ROLE_COLORS[props.role] || DEFAULT_ROLE_COLOR).bg};
  color: ${props => (ROLE_COLORS[props.role] || DEFAULT_ROLE_COLOR).color};
`;

const Pagination = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 1.5rem;
  gap: 0.5rem;
  
  button {
    border: 1px solid #ddd;
    background-color: white;
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
    
    &:hover:not([disabled]) {
      background-color: #f1f1f1;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    &.active {
      background-color: #2b4361;
      color: white;
      border-color: #2b4361;
    }
  }
`;

const UserCountInfo = styled.div`
  font-size: 0.85rem;
  color: #6b7280;
  margin-right: auto;
`;

// Modal components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  h3 {
    margin: 0;
    color: #2b4361;
  }
  
  button {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #6b7280;
    
    &:hover {
      color: #ef4444;
    }
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
  }
  
  input, select {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    
    &:focus {
      outline: none;
      border-color: #2b4361;
      box-shadow: 0 0 0 1px #2b4361;
    }
  }
  
  .error {
    color: #ef4444;
    font-size: 0.75rem;
    margin-top: 0.3rem;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
`;

const AdminUserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [availableRoles, setAvailableRoles] = useState([]);

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    role: 'user'
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/roles.php`);
        setAvailableRoles(res.data.roles || []);
      } catch (error) {
        console.error('Error cargando roles:', error);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await userService.getAll();
        setUsers(response.data);
        setFilteredUsers(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error cargando usuarios:', error);
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    // Filtrar usuarios basado en búsqueda y filtro de rol
    let filtered = users;
    
    if (search) {
      filtered = filtered.filter(user => 
        user.nombre.toLowerCase().includes(search.toLowerCase()) || 
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page on filter change
  }, [search, roleFilter, users]);

  // Paginación
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: '', // No mostramos la contraseña actual por seguridad
      role: user.role
    });
    setIsModalOpen(true);
  };

  const handleDelete = (user) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = async () => {
    try {
      await userService.deleteUser(selectedUser.id);
      setUsers(users.filter(user => user.id !== selectedUser.id));
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error eliminando usuario:', error);
    }
  };

  const handleAddNew = () => {
    setSelectedUser(null);
    setFormData({
      nombre: '',
      email: '',
      password: '',
      role: 'user'
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when field is edited
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'El email es obligatorio';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    
    // Solo validar contraseña si es un nuevo usuario o si se ha ingresado algo
    if (!selectedUser && !formData.password) {
      errors.password = 'La contraseña es obligatoria';
    } else if (formData.password && formData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      if (selectedUser) {
        // Actualizar usuario existente
        const updatedUser = {
          id: selectedUser.id,
          ...formData
        };
        await userService.updateUser(updatedUser);
        
        // Actualizar estado
        setUsers(users.map(user => 
          user.id === selectedUser.id ? { ...user, ...formData } : user
        ));
      } else {
        // Crear nuevo usuario
        const response = await userService.createUser(formData);
        setUsers([...users, response.data]);
      }
      
      // Cerrar modal
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error guardando usuario:', error);
      
      // Mostrar error de email duplicado si aplica
      if (error.response && error.response.data && error.response.data.message === 'El email ya está registrado') {
        setFormErrors({
          ...formErrors,
          email: 'El email ya está registrado'
        });
      }
    }
  };

  const exportToCSV = () => {
    // Crear CSV con campos relevantes
    const csvContent = [
      // Encabezados
      ['ID', 'Nombre', 'Email', 'Rol', 'Fecha de Creación'].join(','),
      // Datos
      ...filteredUsers.map(user => 
        [user.id, user.nombre, user.email, user.role, user.created].join(',')
      )
    ].join('\n');
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `usuarios_voicemed_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Container>
      <TitleBar>
        <Title>Gestión de Usuarios</Title>
        <ButtonsContainer>
          <Button onClick={exportToCSV}>
            <FaFileExport />
            Exportar
          </Button>
          <Button primary onClick={handleAddNew}>
            <FaPlus />
            Nuevo Usuario
          </Button>
        </ButtonsContainer>
      </TitleBar>
      
      <SearchContainer>
        <SearchInput>
          <FaSearch />
          <input 
            type="text"
            placeholder="Buscar usuarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </SearchInput>
        
        <FilterContainer>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Todos los roles</option>
            {availableRoles.map(r => (
              <option key={r.name} value={r.name}>{r.label}</option>
            ))}
          </select>
        </FilterContainer>
      </SearchContainer>
      
      {loading ? (
        <div>Cargando usuarios...</div>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Fecha Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center' }}>No se encontraron usuarios</td>
                </tr>
              ) : (
                currentUsers.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.nombre}</td>
                    <td>{user.email}</td>
                    <td>
                      <RoleLabel role={user.role}>
                        {user.role === 'admin' ? <FaUserShield /> : user.role === 'mentor' ? <FaChalkboardTeacher /> : <FaUser />}
                        {(availableRoles.find(r => r.name === user.role) || {}).label || ucfirst(user.role)}
                      </RoleLabel>
                    </td>
                    <td>{new Date(user.created).toLocaleDateString()}</td>
                    <td>
                      <ActionButtons>
                        <Button onClick={() => handleEdit(user)}>
                          <FaEdit />
                        </Button>
                        <Button danger onClick={() => handleDelete(user)}>
                          <FaTrash />
                        </Button>
                      </ActionButtons>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          
          <Pagination>
            <UserCountInfo>
              Mostrando {currentUsers.length} de {filteredUsers.length} usuarios
            </UserCountInfo>
            
            <button 
              onClick={() => paginate(1)} 
              disabled={currentPage === 1}
            >
              &laquo;
            </button>
            
            <button 
              onClick={() => paginate(currentPage - 1)} 
              disabled={currentPage === 1}
            >
              &lsaquo;
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }).map((_, index) => {
              // Mostrar 5 páginas centradas en la página actual
              let pageToShow;
              if (totalPages <= 5) {
                pageToShow = index + 1;
              } else if (currentPage <= 3) {
                pageToShow = index + 1;
              } else if (currentPage >= totalPages - 2) {
                pageToShow = totalPages - 4 + index;
              } else {
                pageToShow = currentPage - 2 + index;
              }
              
              return (
                <button
                  key={index}
                  onClick={() => paginate(pageToShow)}
                  className={currentPage === pageToShow ? 'active' : ''}
                >
                  {pageToShow}
                </button>
              );
            })}
            
            <button 
              onClick={() => paginate(currentPage + 1)} 
              disabled={currentPage === totalPages}
            >
              &rsaquo;
            </button>
            
            <button 
              onClick={() => paginate(totalPages)} 
              disabled={currentPage === totalPages}
            >
              &raquo;
            </button>
          </Pagination>
        </>
      )}
      
      {isModalOpen && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <h3>{selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setIsModalOpen(false)}>&times;</button>
            </ModalHeader>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <FormGroup>
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={handleInputChange}
                />
                {formErrors.nombre && <div className="error">{formErrors.nombre}</div>}
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
                {formErrors.email && <div className="error">{formErrors.email}</div>}
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="password">
                  Contraseña {selectedUser && '(Dejar en blanco para mantener la actual)'}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                {formErrors.password && <div className="error">{formErrors.password}</div>}
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="role">Rol</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                >
                  {availableRoles.map(r => (
                    <option key={r.name} value={r.name}>{r.label}</option>
                  ))}
                </select>
              </FormGroup>
              
              <ModalFooter>
                <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button primary type="submit">{selectedUser ? 'Actualizar' : 'Crear'}</Button>
              </ModalFooter>
            </form>
          </ModalContent>
        </ModalOverlay>
      )}
      
      {isDeleteModalOpen && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <h3>Confirmar Eliminación</h3>
              <button onClick={() => setIsDeleteModalOpen(false)}>&times;</button>
            </ModalHeader>
            
            <p>¿Estás seguro de eliminar al usuario <strong>{selectedUser?.nombre}</strong>?</p>
            <p>Esta acción no se puede deshacer.</p>
            
            <ModalFooter>
              <Button onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
              <Button danger onClick={confirmDelete}>Eliminar</Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default AdminUserManagement;