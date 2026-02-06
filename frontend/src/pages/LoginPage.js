import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/api';
import styled from 'styled-components';
import { FaUser, FaLock } from 'react-icons/fa';

const Container = styled.div`
  max-width: 400px;
  margin: 5rem auto;
  padding: 2.5rem;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  font-family: 'Segoe UI', sans-serif;
`;

const Title = styled.h2`
  color: #2b4361;
  text-align: center;
  margin-bottom: 2rem;
  letter-spacing: 1px;
  font-weight: 700;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  background-color: #eaf1fa;
  border-radius: 30px;
  padding-left: 2.5rem;
  border: 1px solid #ccd6e0;

  &:focus-within {
    background-color: white;
    border-color: #2b4361;
  }
`;

const Icon = styled.div`
  position: absolute;
  left: 16px;
  color: #2b4361;
  font-size: 1rem;
`;

const Input = styled.input`
  flex: 1;
  border: none;
  padding: 0.75rem;
  font-size: 1rem;
  background: transparent;
  outline: none;
  border-radius: 30px;
`;

const SubmitButton = styled.button`
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.75rem;
  font-weight: 600;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(220, 38, 38, 0.2);

  &:hover {
    background: #b91c1c;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(220, 38, 38, 0.3);
  }
`;

const ErrorMsg = styled.p`
  color: red;
  font-size: 0.9rem;
  text-align: center;
`;

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await authService.login({ email, password });
      const { token, user } = response.data;
      login({ token, user });
      navigate('/documentos');
    } catch (err) {
      setError('Credenciales inválidas');
    }
  };

  return (
    <Container>
      <Title>Iniciar Sesión</Title>
      <Form onSubmit={handleSubmit}>
        <InputWrapper>
          <Icon><FaUser /></Icon>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </InputWrapper>
        <InputWrapper>
          <Icon><FaLock /></Icon>
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </InputWrapper>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <SubmitButton type="submit">Entrar</SubmitButton>
      </Form>
    </Container>
  );
};

export default LoginPage;