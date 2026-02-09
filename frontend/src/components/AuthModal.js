// src/components/AuthModal.js
// Modal overlay para Login/Registro con tabs
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/api';
import axios from 'axios';

const API_BASE_URL = 'https://mentoria.ateneo.co/backend/api';

// Animaciones
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(30px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

// Styled components
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: ${fadeIn} 0.25s ease-out;
`;

const ModalCard = styled.div`
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 420px;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  animation: ${slideUp} 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  color: #64748B;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 1;

  &:hover {
    background: rgba(0, 0, 0, 0.12);
    color: #1e293b;
  }
`;

const ModalHeader = styled.div`
  padding: 2rem 2rem 0;
  text-align: center;
`;

const LogoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
`;

const LogoText = styled.span`
  font-size: 1.6rem;
  font-weight: 700;
  color: #0f355b;
  font-family: 'Myriad Pro', sans-serif;
`;

const TabRow = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 4px;
  margin: 0 2rem;
`;

const Tab = styled.button`
  flex: 1;
  padding: 0.6rem;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  background: ${props => props.$active ? '#fff' : 'transparent'};
  color: ${props => props.$active ? '#0f355b' : '#94A3B8'};
  box-shadow: ${props => props.$active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'};
`;

const FormBody = styled.div`
  padding: 1.5rem 2rem 2rem;
`;

const InputGroup = styled.div`
  margin-bottom: 1rem;
`;

const InputLabel = styled.label`
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.35rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  font-size: 0.95rem;
  background: #f8fafc;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: #0891B2;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.1);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  border: 1.5px solid #e2e8f0;
  font-size: 0.95rem;
  background: #f8fafc;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  cursor: pointer;

  &:focus {
    border-color: #0891B2;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.1);
  }
`;

const SubmitBtn = styled.button`
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #0f355b 0%, #1a4a7a 100%);
  cursor: pointer;
  transition: all 0.25s ease;
  margin-top: 0.5rem;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(15, 53, 91, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ErrorMsg = styled.p`
  color: #ef4444;
  font-size: 0.85rem;
  text-align: center;
  margin: 0.5rem 0 0;
`;

const SwitchText = styled.p`
  text-align: center;
  font-size: 0.85rem;
  color: #64748B;
  margin-top: 1rem;

  button {
    background: none;
    border: none;
    color: #0891B2;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;

    &:hover {
      text-decoration: underline;
    }
  }
`;

// Mini chip icon for modal logo
const MiniChip = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
    <rect x="22" y="22" width="56" height="56" rx="12" stroke="#0f355b" strokeWidth="3" fill="rgba(15,53,91,0.06)"/>
    <line x1="38" y1="14" x2="38" y2="22" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="50" y1="14" x2="50" y2="22" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="62" y1="14" x2="62" y2="22" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="38" y1="78" x2="38" y2="86" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="50" y1="78" x2="50" y2="86" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="62" y1="78" x2="62" y2="86" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="14" y1="38" x2="22" y2="38" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="14" y1="50" x2="22" y2="50" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="14" y1="62" x2="22" y2="62" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="78" y1="38" x2="86" y2="38" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="78" y1="50" x2="86" y2="50" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="78" y1="62" x2="86" y2="62" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="50" cy="50" r="10" fill="rgba(8,145,178,0.15)"/>
    <circle cx="50" cy="50" r="5" fill="#0891B2"/>
  </svg>
);

const AuthModal = ({ isOpen, onClose, initialTab = 'login' }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(initialTab);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register state
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regError, setRegError] = useState('');
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      const fetchGroups = async () => {
        try {
          const res = await axios.get(`${API_BASE_URL}/public-groups.php`);
          if (res.data?.success && res.data.groups.length > 0) {
            setGroups(res.data.groups);
            setRegRole(res.data.groups[0].name);
          }
        } catch (err) {
          setGroups([{ name: 'estudiante', description: 'Estudiante' }]);
          setRegRole('estudiante');
        } finally {
          setLoadingGroups(false);
        }
      };
      fetchGroups();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await authService.login({ email: loginEmail, password: loginPassword });
      const { token, user } = response.data;
      login({ token, user });
      onClose();
      navigate('/documentos');
    } catch (err) {
      setLoginError('Credenciales inválidas');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (!regRole) {
      setRegError('Selecciona un grupo de contenido');
      return;
    }
    try {
      const response = await authService.register({
        nombre: regNombre, email: regEmail, password: regPassword, role: regRole
      });
      if (!response || !response.data) throw new Error('Respuesta inválida');
      const { token, user } = response.data;
      if (!user || user.id === null || user.id === undefined) {
        if (user && user.email) {
          let hash = 0;
          for (let i = 0; i < user.email.length; i++) {
            hash = ((hash << 5) - hash) + user.email.charCodeAt(i);
            hash |= 0;
          }
          login({ token, user: { ...user, id: Math.abs(hash) } });
        } else {
          throw new Error('No se pudo generar ID');
        }
      } else {
        if (typeof user.id === 'string') user.id = parseInt(user.id, 10);
        login({ token, user });
      }
      onClose();
      navigate('/documentos');
    } catch (err) {
      setRegError(err.response?.data?.message || err.message || 'Error al registrar');
    }
  };

  return (
    <Overlay onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <ModalCard>
        <CloseBtn onClick={onClose}>&times;</CloseBtn>

        <ModalHeader>
          <LogoRow>
            <MiniChip />
            <LogoText>MentorIA</LogoText>
          </LogoRow>
        </ModalHeader>

        <TabRow>
          <Tab $active={tab === 'login'} onClick={() => { setTab('login'); setLoginError(''); }}>
            Iniciar Sesión
          </Tab>
          <Tab $active={tab === 'register'} onClick={() => { setTab('register'); setRegError(''); }}>
            Registrarse
          </Tab>
        </TabRow>

        <FormBody>
          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <InputGroup>
                <InputLabel>Correo electrónico</InputLabel>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </InputGroup>
              <InputGroup>
                <InputLabel>Contraseña</InputLabel>
                <Input
                  type="password"
                  placeholder="Tu contraseña"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                />
              </InputGroup>
              {loginError && <ErrorMsg>{loginError}</ErrorMsg>}
              <SubmitBtn type="submit">Entrar</SubmitBtn>
              <SwitchText>
                ¿No tienes cuenta? <button type="button" onClick={() => setTab('register')}>Regístrate aquí</button>
              </SwitchText>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <InputGroup>
                <InputLabel>Nombre completo</InputLabel>
                <Input
                  type="text"
                  placeholder="Tu nombre"
                  value={regNombre}
                  onChange={e => setRegNombre(e.target.value)}
                  required
                  autoFocus
                />
              </InputGroup>
              <InputGroup>
                <InputLabel>Correo electrónico</InputLabel>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  required
                />
              </InputGroup>
              <InputGroup>
                <InputLabel>Contraseña</InputLabel>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                />
              </InputGroup>
              <InputGroup>
                <InputLabel>Grupo de contenido</InputLabel>
                <Select
                  value={regRole}
                  onChange={e => setRegRole(e.target.value)}
                  disabled={loadingGroups}
                >
                  {loadingGroups ? (
                    <option value="">Cargando...</option>
                  ) : groups.length === 0 ? (
                    <option value="">No disponible</option>
                  ) : (
                    groups.map(g => (
                      <option key={g.name} value={g.name}>
                        {g.name.charAt(0).toUpperCase() + g.name.slice(1)}
                        {g.description ? ` — ${g.description}` : ''}
                      </option>
                    ))
                  )}
                </Select>
              </InputGroup>
              {regError && <ErrorMsg>{regError}</ErrorMsg>}
              <SubmitBtn type="submit" disabled={loadingGroups || !regRole}>
                Crear cuenta
              </SubmitBtn>
              <SwitchText>
                ¿Ya tienes cuenta? <button type="button" onClick={() => setTab('login')}>Inicia sesión</button>
              </SwitchText>
            </form>
          )}
        </FormBody>
      </ModalCard>
    </Overlay>
  );
};

export default AuthModal;
