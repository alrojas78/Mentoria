// Redesigned Header
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background: #ffffff;
  color: #0f355b;
  padding: 1rem 15px;
  box-shadow: 0 2px 12px rgba(43, 67, 97, 0.1);
  border-bottom: 7px solid #0f355b;
  position: relative;

  @media (max-width: 768px) {
    padding: 1rem;
  }
`;
const VoiceMark = styled.span`
  display: inline-block;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2b4361 0%, #dc2626 100%);
  position: relative;
  box-shadow: 0 2px 8px rgba(43, 67, 97, 0.2);

  &::before {
    content: '🤖';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 18px;
    filter: grayscale(100%) brightness(0) invert(1);
  }
`;
const Logo = styled(Link)`
  font-size: 1.8rem;
  font-weight: 700;
  color: #2b4361;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.3s ease;
  
  &:hover {
    color: #dc2626;
  }
`;

const ButtonMenu = styled.button`
  background: none;
  border: none;
  color: #2b4361;
  font-size: 1.5rem;
  cursor: pointer;
  display: none;
  padding: 0.5rem;
  border-radius: 4px;
  transition: all 0.3s ease;

  &:hover {
    background-color: #f1f5f9;
  }

  @media (max-width: 768px) {
    display: block;
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  font-family: "Myriad Pro", sans-serif;
  font-weight: bold;
  @media (max-width: 768px) {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    display: ${props => (props.open ? 'flex' : 'none')};
    box-shadow: 0 4px 12px rgba(43, 67, 97, 0.15);
    border-top: 1px solid #e2e8f0;
    z-index: 1000;
  }
`;

const NavLink = styled(Link)`
  color: #2b4361;
  text-decoration: none;
  font-weight: bold;
  padding: 4px 1rem;
  border-radius: 0px;
  transition: 0.3s;
  font-family: "Myriad Pro", sans-serif;
  border-right: 1px solid #2b4361;

  &:last-child {
    border-right: none;
  }
  &:hover {
    color: #dc2626;
    background-color: #f8f9fa;
  }

  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    
    &:last-child {
      border-bottom: none;
    }
  }
`;

const NavLinkOne = styled(Link)`
  color: #2b4361;
  text-decoration: none;
  font-weight: bold;
  padding: 4px 1rem;
  border-radius: 0px;
  transition: 0.3s;
  font-family: "Myriad Pro", sans-serif;
  border-right: 0px solid #2b4361;
  &:hover {
    color: #dc2626;
    background-color: #f8f9fa;
  }

  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    
    &:last-child {
      border-bottom: none;
    }
  }
`;










const Button = styled.button`
  background: #dc2626;
  border: 1px solid #dc2626;
  color: white;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);

  &:hover {
    background: #b91c1c;
    border-color: #b91c1c;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(220, 38, 38, 0.3);
  }

  @media (max-width: 768px) {
    width: 100%;
    text-align: center;
    margin-top: 0.5rem;
    transform: none;
    
    &:hover {
      transform: none;
    }
  }
`;


const ContainerHeader = styled.div`
    max-width: 1200px;
    margin: 0px auto;
    text-align: center;
    display: flex;
    justify-content: space-between;

  @media (max-width: 768px) {

  }
`;




const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // --- ✅ ESTA ES LA LÍNEA CORREGIDA ---
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <HeaderContainer>
      <ContainerHeader>
      <Logo to="/">
        <VoiceMark />
        <span>MentorIA</span>
      </Logo>
      <ButtonMenu onClick={() => setMenuOpen(!menuOpen)}>
        ☰
      </ButtonMenu>

      <Nav open={menuOpen} onClick={() => setMenuOpen(false)}>
            {user?.role === 'admin' && (
        
        <NavLinkOne to="/admin-panel" onClick={() => setMenuOpen(false)}>
          Panel Admin 
        </NavLinkOne>
  
)}
 {user?.role === 'admin' && (

<NavLinkOne to="/admin/documentos" onClick={() => setMenuOpen(false)}>
  Administrar Conocimientos 
</NavLinkOne>
)}
        {user ? (
          <>
            <NavLinkOne to="/documentos" onClick={() => setMenuOpen(false)}>Contenidos</NavLinkOne>
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