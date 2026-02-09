import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styled, { keyframes } from 'styled-components';

// Animaciones
const neuralPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

const glowPulse = keyframes`
  0%, 100% { filter: drop-shadow(0 0 3px rgba(20, 182, 203, 0.3)); }
  50% { filter: drop-shadow(0 0 8px rgba(20, 182, 203, 0.6)); }
`;

const HeaderContainer = styled.header`
  background: #ffffff;
  color: #0f355b;
  padding: 0.8rem 15px;
  box-shadow: 0 1px 20px rgba(15, 53, 91, 0.08);
  border-bottom: 3px solid transparent;
  border-image: linear-gradient(90deg, #0f355b 0%, #14b6cb 50%, #0f355b 100%) 1;
  position: relative;

  @media (max-width: 768px) {
    padding: 0.8rem 1rem;
  }
`;

const ContainerHeader = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled(Link)`
  font-size: 1.6rem;
  font-weight: 700;
  color: #0f355b;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  transition: all 0.3s ease;
  font-family: 'Myriad Pro', sans-serif;
  letter-spacing: -0.5px;

  &:hover {
    color: #14b6cb;
  }
`;

const IconWrapper = styled.div`
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${glowPulse} 3s ease-in-out infinite;
`;

const ButtonMenu = styled.button`
  background: none;
  border: 1px solid #e2e8f0;
  color: #0f355b;
  font-size: 1.3rem;
  cursor: pointer;
  display: none;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  transition: all 0.3s ease;

  &:hover {
    background: #f1f5f9;
    border-color: #14b6cb;
  }

  @media (max-width: 768px) {
    display: block;
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: 'Myriad Pro', sans-serif;

  @media (max-width: 768px) {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    gap: 0;
    padding: 0.5rem 1rem 1rem;
    display: ${props => (props.open ? 'flex' : 'none')};
    box-shadow: 0 8px 24px rgba(15, 53, 91, 0.12);
    border-top: 1px solid #e2e8f0;
    z-index: 1000;
  }
`;

const NavLink = styled(Link)`
  color: #475569;
  text-decoration: none;
  font-weight: 600;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.9rem;

  &:hover {
    color: #0f355b;
    background: #f1f5f9;
  }

  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    padding: 0.75rem 1rem;
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #0f355b 0%, #1a4a7a 100%);
  border: none;
  color: white;
  padding: 0.45rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Myriad Pro', sans-serif;

  &:hover {
    background: linear-gradient(135deg, #14b6cb 0%, #0e9aad 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(20, 182, 203, 0.3);
  }

  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    margin-top: 0.5rem;
  }
`;

// SVG Icono Neural MentorIA
const NeuralIcon = () => (
  <IconWrapper>
    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cerebro estilizado con conexiones neurales */}
      <defs>
        <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f355b" />
          <stop offset="100%" stopColor="#14b6cb" />
        </linearGradient>
      </defs>
      {/* Hemisferio izquierdo */}
      <path d="M50 20 C35 20, 18 32, 18 50 C18 68, 35 80, 50 80"
            stroke="url(#brainGrad)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* Hemisferio derecho */}
      <path d="M50 20 C65 20, 82 32, 82 50 C82 68, 65 80, 50 80"
            stroke="url(#brainGrad)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* Línea central */}
      <line x1="50" y1="22" x2="50" y2="78" stroke="#14b6cb" strokeWidth="1.5" opacity="0.4"/>
      {/* Nodos neurales */}
      <circle cx="32" cy="38" r="4" fill="#14b6cb"/>
      <circle cx="68" cy="38" r="4" fill="#0f355b"/>
      <circle cx="28" cy="55" r="3.5" fill="#0f355b"/>
      <circle cx="72" cy="55" r="3.5" fill="#14b6cb"/>
      <circle cx="50" cy="30" r="3" fill="#14b6cb"/>
      <circle cx="50" cy="50" r="5" fill="url(#brainGrad)"/>
      <circle cx="50" cy="70" r="3" fill="#0f355b"/>
      <circle cx="38" cy="68" r="3" fill="#14b6cb" opacity="0.7"/>
      <circle cx="62" cy="68" r="3" fill="#0f355b" opacity="0.7"/>
      {/* Conexiones neurales animadas */}
      <line x1="32" y1="38" x2="50" y2="50" stroke="#14b6cb" strokeWidth="1.2" opacity="0.5">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
      </line>
      <line x1="68" y1="38" x2="50" y2="50" stroke="#0f355b" strokeWidth="1.2" opacity="0.5">
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite"/>
      </line>
      <line x1="28" y1="55" x2="50" y2="50" stroke="#14b6cb" strokeWidth="1.2" opacity="0.5">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.5s" repeatCount="indefinite"/>
      </line>
      <line x1="72" y1="55" x2="50" y2="50" stroke="#0f355b" strokeWidth="1.2" opacity="0.5">
        <animate attributeName="opacity" values="1;0.4;1" dur="2.5s" repeatCount="indefinite"/>
      </line>
      <line x1="50" y1="30" x2="50" y2="50" stroke="#14b6cb" strokeWidth="1" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="3s" repeatCount="indefinite"/>
      </line>
      <line x1="50" y1="70" x2="50" y2="50" stroke="#0f355b" strokeWidth="1" opacity="0.4">
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="3s" repeatCount="indefinite"/>
      </line>
      {/* Pulso central */}
      <circle cx="50" cy="50" r="8" fill="none" stroke="#14b6cb" strokeWidth="1" opacity="0.3">
        <animate attributeName="r" values="5;10;5" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
      </circle>
    </svg>
  </IconWrapper>
);

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <HeaderContainer>
      <ContainerHeader>
        <Logo to="/">
          <NeuralIcon />
          <span>MentorIA</span>
        </Logo>
        <ButtonMenu onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </ButtonMenu>

        <Nav open={menuOpen} onClick={() => setMenuOpen(false)}>
          {user?.role === 'admin' && (
            <NavLink to="/admin-panel" onClick={() => setMenuOpen(false)}>
              Panel Admin
            </NavLink>
          )}
          {user ? (
            <>
              <NavLink to="/documentos" onClick={() => setMenuOpen(false)}>Contenidos</NavLink>
              <Button onClick={() => { handleLogout(); setMenuOpen(false); }}>Cerrar Sesión</Button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setMenuOpen(false)}>Iniciar Sesión</NavLink>
              <NavLink to="/register" onClick={() => setMenuOpen(false)}>Registrarse</NavLink>
            </>
          )}
        </Nav>
      </ContainerHeader>
    </HeaderContainer>
  );
};

export default Header;
