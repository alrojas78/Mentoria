// src/pages/RegisterPage.js
import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
`;

const ErrorMessage = styled.p`
  color: #e74c3c;
  font-size: 0.9rem;
  margin-top: -0.5rem;
  margin-bottom: 1rem;
`;

const RoleSelector = styled.div`
  margin-bottom: 1rem;
  text-align: left;
`;

const RoleLabel = styled.label`
  display: block;
  font-size: 0.9rem;
  color: #2b4361;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const RoleOptions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const RoleOption = styled.label`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 0.5rem;
  border-radius: 8px;
  border: 2px solid ${props => props.$selected ? '#0891B2' : '#ddd'};
  background-color: ${props => props.$selected ? 'rgba(8, 145, 178, 0.08)' : '#fff'};
  color: ${props => props.$selected ? '#0891B2' : '#6b7280'};
  font-size: 0.85rem;
  font-weight: ${props => props.$selected ? '600' : '400'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #0891B2;
    background-color: rgba(8, 145, 178, 0.04);
  }

  input {
    display: none;
  }
`;

const RegisterPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('estudiante');
  const [error, setError] = useState('');

// src/pages/RegisterPage.js

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');

  try {
      console.log('Enviando datos de registro:', { nombre, email, password, role });
      const response = await authService.register({ nombre, email, password, role });
      console.log('Respuesta completa del registro:', response);
      
      // Verificar que la respuesta contenga los datos necesarios
      if (!response || !response.data) {
          throw new Error('Respuesta de registro inválida');
      }
      
      // Extraer token y datos de usuario
      const { token, user } = response.data;
      
      // Verificar que el usuario tenga ID
      if (!user || user.id === null || user.id === undefined) {
          console.error('Usuario sin ID en la respuesta:', user);
          
          // Generar ID temporal desde el email
          let tempId = null;
          if (user && user.email) {
              // Generar hash simple del email
              let hash = 0;
              for (let i = 0; i < user.email.length; i++) {
                  hash = ((hash << 5) - hash) + user.email.charCodeAt(i);
                  hash |= 0;
              }
              tempId = Math.abs(hash);
              console.log('ID temporal generado del email:', tempId);
              
              // Crear usuario con ID temporal
              const userWithId = {
                  ...user,
                  id: tempId
              };
              
              // Login con el usuario modificado
              login({ token, user: userWithId });
              navigate('/documentos');
          } else {
              throw new Error('No se pudo generar ID para el usuario');
          }
      } else {
          // Asegurarse que el ID sea número
          if (typeof user.id === 'string') {
              user.id = parseInt(user.id, 10);
          }
          
          console.log('Usuario con ID válido:', user);
          login({ token, user });
          navigate('/documentos');
      }
  } catch (err) {
      console.error('Error durante el registro:', err);
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
        <RoleSelector>
          <RoleLabel>Tipo de cuenta:</RoleLabel>
          <RoleOptions>
            <RoleOption $selected={role === 'estudiante'}>
              <input type="radio" name="role" value="estudiante" checked={role === 'estudiante'} onChange={(e) => setRole(e.target.value)} />
              Estudiante
            </RoleOption>
            <RoleOption $selected={role === 'mentor'}>
              <input type="radio" name="role" value="mentor" checked={role === 'mentor'} onChange={(e) => setRole(e.target.value)} />
              Mentor
            </RoleOption>
            <RoleOption $selected={role === 'coordinador'}>
              <input type="radio" name="role" value="coordinador" checked={role === 'coordinador'} onChange={(e) => setRole(e.target.value)} />
              Coordinador
            </RoleOption>
          </RoleOptions>
        </RoleSelector>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="submit">Crear cuenta</Button>
      </form>
    </Container>
  );
};

export default RegisterPage;
