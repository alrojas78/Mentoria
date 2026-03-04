// HeaderSection.js — Header personalizable para landing
import React from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.header`
  width: 100%;
  background: ${p => p.$bg || '#fff'};
  box-shadow: ${p => p.$shadow || '0 2px 8px rgba(0,0,0,0.06)'};
  position: ${p => p.$fixed ? 'fixed' : 'relative'};
  top: 0;
  z-index: 900;
`;

const Inner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${p => p.$padding || '0.75rem 2rem'};
  @media (max-width: 768px) { padding: 0.5rem 1rem; }
`;

const LogoArea = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const Logo = styled.img`
  height: ${p => p.$h || '48px'};
  object-fit: contain;
`;

const BrandText = styled.span`
  font-size: ${p => p.$size || '1.3rem'};
  font-weight: ${p => p.$weight || '700'};
  color: ${p => p.$color || '#0f355b'};
  font-family: inherit;
`;

const NavArea = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  @media (max-width: 768px) { gap: 0.3rem; }
`;

const NavBtn = styled.button`
  background: ${p => p.$bg || 'transparent'};
  color: ${p => p.$color || '#0f355b'};
  border: ${p => p.$border || '1px solid transparent'};
  padding: ${p => p.$padding || '0.45rem 1.2rem'};
  border-radius: ${p => p.$radius || '8px'};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: 0.2s;
  font-family: inherit;
  &:hover { opacity: 0.85; transform: translateY(-1px); }
`;

const HeaderSection = ({ config, proyecto, openLogin, openRegister }) => {
  const c = config;
  const primary = c.color_primario || proyecto?.color_primario || '#0f355b';
  const secondary = c.color_secundario || proyecto?.color_secundario || '#14b6cb';

  const logoUrl = c.logo
    ? (c.logo.startsWith('http') ? c.logo : `${BACKEND_BASE}/${c.logo}`)
    : (proyecto?.logo ? `${BACKEND_BASE}/${proyecto.logo}` : null);

  const handleAction = (action) => {
    if (action === 'login') openLogin?.();
    else if (action === 'registro') openRegister?.();
    else if (action && action.startsWith('http')) window.open(action, '_blank');
  };

  return (
    <Wrapper $bg={c.color_fondo || '#fff'} $shadow={c.sombra} $fixed={c.fijo}>
      <Inner $padding={c.padding}>
        <LogoArea>
          {logoUrl && <Logo src={logoUrl} alt="" $h={c.altura_logo || '48px'} />}
          {c.texto_marca && (
            <BrandText $color={c.color_texto || primary} $size={c.tamano_marca} $weight={c.peso_marca}>
              {c.texto_marca}
            </BrandText>
          )}
        </LogoArea>
        <NavArea>
          {(c.boton_login !== false) && (
            <NavBtn
              $bg="transparent"
              $color={c.color_texto_botones || primary}
              $border={c.borde_boton_login || '1px solid transparent'}
              $padding={c.padding_botones}
              $radius={c.radio_botones}
              onClick={() => handleAction('login')}
            >
              {c.texto_boton_login || 'Iniciar sesión'}
            </NavBtn>
          )}
          {(c.boton_registro !== false) && (
            <NavBtn
              $bg={c.color_boton_registro || secondary}
              $color={c.color_texto_boton_registro || '#fff'}
              $padding={c.padding_botones}
              $radius={c.radio_botones}
              onClick={() => handleAction('registro')}
            >
              {c.texto_boton_registro || 'Registrarse'}
            </NavBtn>
          )}
        </NavArea>
      </Inner>
    </Wrapper>
  );
};

export default HeaderSection;
