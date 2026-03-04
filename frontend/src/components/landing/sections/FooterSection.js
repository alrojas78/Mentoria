// FooterSection.js — Footer personalizable para landing
import React from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.footer`
  width: 100%;
  background: ${p => p.$bg || '#0f355b'};
  color: ${p => p.$color || '#fff'};
  padding: ${p => p.$padding || '3rem 2rem 1.5rem'};
`;

const Inner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 2rem;
  margin-bottom: 2rem;
  @media (max-width: 768px) { flex-direction: column; align-items: center; text-align: center; }
`;

const BrandCol = styled.div`
  flex: 1;
  min-width: 200px;
`;

const Logo = styled.img`
  height: ${p => p.$h || '40px'};
  object-fit: contain;
  margin-bottom: 0.75rem;
`;

const BrandName = styled.div`
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
`;

const BrandDesc = styled.p`
  font-size: 0.88rem;
  opacity: 0.8;
  line-height: 1.5;
  margin: 0;
`;

const LinksCol = styled.div`
  display: flex;
  gap: 3rem;
  flex-wrap: wrap;
  @media (max-width: 768px) { gap: 2rem; justify-content: center; }
`;

const LinkGroup = styled.div``;

const LinkGroupTitle = styled.h4`
  font-size: 0.9rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
`;

const LinkItem = styled.a`
  display: block;
  color: inherit;
  text-decoration: none;
  font-size: 0.88rem;
  padding: 0.2rem 0;
  opacity: 0.85;
  transition: 0.2s;
  cursor: pointer;
  &:hover { opacity: 1; text-decoration: underline; }
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid rgba(255,255,255,0.15);
  margin: 0 0 1rem;
`;

const BottomRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.82rem;
  opacity: 0.7;
  @media (max-width: 768px) { flex-direction: column; text-align: center; }
`;

const FooterSection = ({ config, proyecto, openLogin, openRegister }) => {
  const c = config;
  const primary = c.color_primario || proyecto?.color_primario || '#0f355b';

  const logoUrl = c.logo
    ? (c.logo.startsWith('http') ? c.logo : `${BACKEND_BASE}/${c.logo}`)
    : (proyecto?.logo ? `${BACKEND_BASE}/${proyecto.logo}` : null);

  const columnas = c.columnas || [];

  const handleLink = (link) => {
    if (link.accion === 'login') openLogin?.();
    else if (link.accion === 'registro') openRegister?.();
    else if (link.url) window.open(link.url, '_blank');
  };

  return (
    <Wrapper $bg={c.color_fondo || primary} $color={c.color_texto || '#fff'} $padding={c.padding}>
      <Inner>
        <TopRow>
          <BrandCol>
            {logoUrl && <Logo src={logoUrl} $h={c.altura_logo} />}
            {c.nombre_marca && <BrandName>{c.nombre_marca}</BrandName>}
            {c.descripcion && <BrandDesc>{c.descripcion}</BrandDesc>}
          </BrandCol>
          {columnas.length > 0 && (
            <LinksCol>
              {columnas.map((col, i) => (
                <LinkGroup key={i}>
                  {col.titulo && <LinkGroupTitle>{col.titulo}</LinkGroupTitle>}
                  {(col.links || []).map((link, j) => (
                    <LinkItem key={j} onClick={() => handleLink(link)}>
                      {link.texto}
                    </LinkItem>
                  ))}
                </LinkGroup>
              ))}
            </LinksCol>
          )}
        </TopRow>
        <Divider />
        <BottomRow>
          <span>{c.texto_copyright || `© ${new Date().getFullYear()} ${proyecto?.nombre || 'MentorIA'}. Todos los derechos reservados.`}</span>
          {c.texto_derecha && <span>{c.texto_derecha}</span>}
        </BottomRow>
      </Inner>
    </Wrapper>
  );
};

export default FooterSection;
