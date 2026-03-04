import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { membershipService } from '../../services/api';
import styled, { keyframes } from 'styled-components';

// Animaciones
const orbitSpin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const coreGlow = keyframes`
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(20, 182, 203, 0.4));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(20, 182, 203, 0.9));
    transform: scale(1.05);
  }
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
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${coreGlow} 3s ease-in-out infinite;

  .orbit-ring {
    animation: ${orbitSpin} 8s linear infinite;
    transform-origin: 50% 50%;
  }
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

// SVG Icono MentorIA — estilo AI chip con órbita giratoria y pulso
const NeuralIcon = () => (
  <IconWrapper>
    <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hChipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f355b" />
          <stop offset="100%" stopColor="#14b6cb" />
        </linearGradient>
        <radialGradient id="hCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#14b6cb" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Chip cuadrado redondeado */}
      <rect x="22" y="22" width="56" height="56" rx="12" fill="url(#hChipGrad)" opacity="0.15"/>
      <rect x="22" y="22" width="56" height="56" rx="12" stroke="url(#hChipGrad)" strokeWidth="2.5" fill="none"/>

      {/* Pines del chip — arriba */}
      <line x1="38" y1="12" x2="38" y2="22" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="50" y1="12" x2="50" y2="22" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="62" y1="12" x2="62" y2="22" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      {/* abajo */}
      <line x1="38" y1="78" x2="38" y2="88" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="50" y1="78" x2="50" y2="88" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="62" y1="78" x2="62" y2="88" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      {/* izquierda */}
      <line x1="12" y1="38" x2="22" y2="38" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12" y1="50" x2="22" y2="50" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="12" y1="62" x2="22" y2="62" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      {/* derecha */}
      <line x1="78" y1="38" x2="88" y2="38" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="78" y1="50" x2="88" y2="50" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="78" y1="62" x2="88" y2="62" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>

      {/* Órbita giratoria alrededor del núcleo */}
      <g className="orbit-ring">
        <circle cx="50" cy="50" r="16" fill="none" stroke="#14b6cb" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.5"/>
        <circle cx="50" cy="34" r="3.5" fill="#22d3ee"/>
      </g>

      {/* Núcleo central brillante */}
      <circle cx="50" cy="50" r="8" fill="url(#hCoreGlow)" opacity="0.5">
        <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="50" cy="50" r="5" fill="#14b6cb"/>
      <circle cx="50" cy="50" r="2.5" fill="#ffffff"/>

      {/* Pulsos de datos viajando por los pines */}
      <circle r="2" fill="#22d3ee">
        <animate attributeName="cx" values="50;50" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="22;12" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <circle r="2" fill="#22d3ee">
        <animate attributeName="cx" values="78;88" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="50;50" dur="1.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <circle r="2" fill="#22d3ee">
        <animate attributeName="cx" values="50;50" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="78;88" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle r="2" fill="#22d3ee">
        <animate attributeName="cx" values="22;12" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="50;50" dur="1.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0" dur="1.6s" repeatCount="indefinite"/>
      </circle>
    </svg>
  </IconWrapper>
);

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { proyecto } = useProject();
  const [showWaLink, setShowWaLink] = useState(false);

  // Check membership for WA Training link visibility
  useEffect(() => {
    if (!user) { setShowWaLink(false); return; }
    if (user.role === 'admin') { setShowWaLink(true); return; }

    membershipService.getMisProyectos()
      .then(res => {
        const memberships = res.data?.memberships || [];
        const hasWa = memberships.some(m => m.whatsapp_connected);
        setShowWaLink(hasWa);
      })
      .catch(() => setShowWaLink(false));
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <HeaderContainer>
      <ContainerHeader>
        <Logo to="/">
          <NeuralIcon />
          <span>{proyecto?.nombre || 'MentorIA'}</span>
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
              {showWaLink && (
                <NavLink to="/wa-training" onClick={() => setMenuOpen(false)}>Entrenamiento WA</NavLink>
              )}
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
