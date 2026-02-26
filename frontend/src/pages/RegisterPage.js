// src/pages/RegisterPage.js
// Fase 5: Dropdown dinámico de "Grupo de Contenido" en vez de radio buttons de rol
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_BASE_URL = 'https://mentoria.ateneo.co/backend/api';

const Container = styled.div`
  max-width: 400px;
  margin: 3rem auto;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  text-align: center;
`;

const Title = styled.h2`
  margin-bottom: 1.5rem;
  color: #2b4361;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  background-color: #eef4ff;
  font-size: 0.95rem;
  box-sizing: border-box;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  background-color: #eef4ff;
  font-size: 0.95rem;
  box-sizing: border-box;
  color: ${props => props.value ? '#2b4361' : '#9ca3af'};
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #0891B2;
    box-shadow: 0 0 0 2px rgba(8,145,178,0.2);
  }
`;

const SelectLabel = styled.label`
  display: block;
  text-align: left;
  font-size: 0.9rem;
  color: #2b4361;
  font-weight: 600;
  margin-bottom: 0.4rem;
`;

const Button = styled.button`
  width: 100%;
  background-color: #dc2626;
  color: white;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: #b91c1c;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ErrorMessage = styled.p`
  color: #e74c3c;
  font-size: 0.9rem;
  margin-top: -0.5rem;
  margin-bottom: 1rem;
`;

const RegisterPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Cargar grupos de contenido disponibles
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/public-groups.php`);
        if (res.data?.success && res.data.groups.length > 0) {
          setGroups(res.data.groups);
          setRole(res.data.groups[0].name); // Seleccionar primero por defecto
        }
      } catch (err) {
        console.error('Error cargando grupos:', err);
        // Fallback
        setGroups([{ name: 'estudiante', description: 'Estudiante' }]);
        setRole('estudiante');
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!role) {
      setError('Selecciona un grupo de contenido');
      return;
    }

    try {
      const response = await authService.register({ nombre, email, password, role });

      if (!response || !response.data) {
        throw new Error('Respuesta de registro inválida');
      }

      const { token, user } = response.data;

      if (!user || user.id === null || user.id === undefined) {
        // Generar ID temporal desde el email
        if (user && user.email) {
          let hash = 0;
          for (let i = 0; i < user.email.length; i++) {
            hash = ((hash << 5) - hash) + user.email.charCodeAt(i);
            hash |= 0;
          }
          const userWithId = { ...user, id: Math.abs(hash) };
          login({ token, user: userWithId });
          navigate('/documentos');
        } else {
          throw new Error('No se pudo generar ID para el usuario');
        }
      } else {
        if (typeof user.id === 'string') {
          user.id = parseInt(user.id, 10);
        }
        login({ token, user });
        navigate('/documentos');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al registrar usuario');
    }
  };

  return (
    <Container>
      <Title>Registrarse</Title>
      <form onSubmit={handleSubmit}>
        <Input
          type="text"
          placeholder="Nombre completo"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
          <SelectLabel>Grupo de contenido:</SelectLabel>
          <Select
            value={role}
            onChange={e => setRole(e.target.value)}
            disabled={loadingGroups}
          >
            {loadingGroups ? (
              <option value="">Cargando grupos...</option>
            ) : groups.length === 0 ? (
              <option value="">No hay grupos disponibles</option>
            ) : (
              groups.map(g => (
                <option key={g.name} value={g.name}>
                  {g.name.charAt(0).toUpperCase() + g.name.slice(1)}
                  {g.description ? ` — ${g.description}` : ''}
                </option>
              ))
            )}
          </Select>
        </div>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="submit" disabled={loadingGroups || !role}>
          Crear cuenta
        </Button>
      </form>
    </Container>
  );
};

export default RegisterPage;
