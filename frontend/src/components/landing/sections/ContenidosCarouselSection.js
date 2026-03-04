// ContenidosCarouselSection.js — Carrusel tipo Netflix de contenidos del proyecto
import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.section`
  padding: ${p => p.$padding || '3rem 0'};
  background: ${p => p.$bg || '#0b1929'};
  overflow: hidden;
`;

const Header = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  font-size: ${p => p.$size || '32px'};
  color: ${p => p.$color || '#fff'};
  font-family: inherit;
  font-weight: 700;
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: ${p => p.$color || 'rgba(255,255,255,0.7)'};
  margin: 0.5rem 0 0;
`;

const CarouselContainer = styled.div`
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
`;

const Track = styled.div`
  display: flex;
  gap: ${p => p.$gap || '16px'};
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
  padding-bottom: 0.5rem;
`;

const Card = styled.div`
  flex-shrink: 0;
  width: ${p => p.$cardWidth || '280px'};
  border-radius: ${p => p.$radius || '12px'};
  overflow: hidden;
  background: ${p => p.$cardBg || '#162337'};
  transition: transform 0.3s, box-shadow 0.3s;
  cursor: pointer;
  &:hover {
    transform: scale(1.05) translateY(-8px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    z-index: 2;
  }
`;

const CardImg = styled.div`
  width: 100%;
  height: ${p => p.$h || '160px'};
  background-image: url(${p => p.$src});
  background-size: cover;
  background-position: center;
  background-color: #1a2a3a;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(transparent, ${p => p.$overlay || '#162337'});
  }
`;

const CardBody = styled.div`
  padding: 0.75rem 1rem 1rem;
`;

const CardTitle = styled.h3`
  margin: 0 0 0.3rem;
  font-size: ${p => p.$size || '1rem'};
  color: ${p => p.$color || '#fff'};
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardDesc = styled.p`
  margin: 0;
  font-size: 0.82rem;
  color: ${p => p.$color || 'rgba(255,255,255,0.6)'};
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardBadge = styled.span`
  display: inline-block;
  background: ${p => p.$bg || '#14b6cb'};
  color: #fff;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
`;

const NavBtn = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${p => p.$dir === 'left' ? 'left: 0px;' : 'right: 0px;'}
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: none;
  font-size: 1.3rem;
  cursor: pointer;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
  &:hover { background: rgba(0,0,0,0.85); }
`;

const PlaceholderImg = styled.div`
  width: 100%;
  height: ${p => p.$h || '160px'};
  background: linear-gradient(135deg, ${p => p.$from || '#1a3a5c'}, ${p => p.$to || '#14b6cb'});
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
`;

const ContenidosCarouselSection = ({ config, proyecto }) => {
  const c = config;
  const trackRef = useRef(null);
  const [showNav, setShowNav] = useState(true);

  // Fuente de datos: documentos del proyecto (auto) o items manuales
  let items = [];
  if (c.fuente === 'manual' && Array.isArray(c.items)) {
    items = c.items;
  } else {
    // Auto: usar documentos del proyecto
    items = (proyecto?.documentos || []).map(doc => ({
      titulo: doc.titulo,
      descripcion: doc.descripcion || '',
      imagen: doc.imagen || doc.logo,
      badge: doc.badge || '',
    }));
  }

  if (items.length === 0) return null;

  const primary = c.color_primario || proyecto?.color_primario || '#0f355b';
  const secondary = c.color_secundario || proyecto?.color_secundario || '#14b6cb';
  const cardWidth = parseInt(c.ancho_tarjeta || 280);
  const gap = parseInt(c.gap || 16);

  const scroll = (dir) => {
    if (!trackRef.current) return;
    const amount = (cardWidth + gap) * 2;
    trackRef.current.scrollLeft += dir === 'left' ? -amount : amount;
  };

  const resolveImg = (img) => {
    if (!img) return null;
    return img.startsWith('http') ? img : `${BACKEND_BASE}/${img}`;
  };

  return (
    <Wrapper $bg={c.color_fondo || '#0b1929'} $padding={c.padding}>
      <Header>
        {c.titulo && <Title $color={c.color_titulo || '#fff'} $size={c.tamano_titulo}>{c.titulo}</Title>}
        {c.subtitulo && <Subtitle $color={c.color_subtitulo}>{c.subtitulo}</Subtitle>}
      </Header>

      <CarouselContainer>
        {items.length > 3 && showNav && (
          <>
            <NavBtn $dir="left" onClick={() => scroll('left')}>‹</NavBtn>
            <NavBtn $dir="right" onClick={() => scroll('right')}>›</NavBtn>
          </>
        )}

        <Track ref={trackRef} $gap={`${gap}px`}>
          {items.map((item, i) => {
            const imgUrl = resolveImg(item.imagen);
            return (
              <Card key={i} $cardWidth={`${cardWidth}px`} $cardBg={c.color_tarjeta || '#162337'} $radius={c.radio_tarjeta}>
                {imgUrl ? (
                  <CardImg $src={imgUrl} $h={c.altura_imagen || '160px'} $overlay={c.color_tarjeta || '#162337'} />
                ) : (
                  <PlaceholderImg $h={c.altura_imagen || '160px'} $from={primary} $to={secondary}>
                    📄
                  </PlaceholderImg>
                )}
                <CardBody>
                  <CardTitle $color={c.color_titulo_tarjeta || '#fff'} $size={c.tamano_titulo_tarjeta}>
                    {item.titulo}
                  </CardTitle>
                  {item.descripcion && (
                    <CardDesc $color={c.color_desc_tarjeta}>{item.descripcion}</CardDesc>
                  )}
                  {item.badge && <CardBadge $bg={secondary}>{item.badge}</CardBadge>}
                </CardBody>
              </Card>
            );
          })}
        </Track>
      </CarouselContainer>
    </Wrapper>
  );
};

export default ContenidosCarouselSection;
