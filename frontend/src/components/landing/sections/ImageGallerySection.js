// ImageGallerySection.js — Galería de imágenes
import React from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.section`
  padding: 4rem 2rem;
  background: ${p => p.$bg || '#fff'};
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
`;

const Title = styled.h2`
  font-size: 38px;
  color: ${p => p.$color || '#0f355b'};
  font-family: 'Myriad Pro', sans-serif;
  font-weight: bold;
  margin-bottom: 2rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(${p => p.$cols || 3}, 1fr);
  gap: 1.5rem;
  @media (max-width: 768px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const Item = styled.div`
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: 0.3s;
  &:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
`;

const Img = styled.img`
  width: 100%;
  height: 220px;
  object-fit: cover;
`;

const Caption = styled.div`
  padding: 0.75rem;
  background: #f8fafc;
`;

const CaptionTitle = styled.h4`
  margin: 0 0 0.3rem;
  font-size: 1rem;
  color: #0f355b;
`;

const CaptionDesc = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
`;

const ImageGallerySection = ({ config, proyecto }) => {
  const imagenes = config.imagenes || [];
  if (imagenes.length === 0) return null;
  const cols = config.columnas || 3;
  const primary = config.color_primario || proyecto?.color_primario || '#0f355b';

  return (
    <Wrapper $bg={config.color_fondo}>
      <Container>
        {config.titulo && <Title $color={primary}>{config.titulo}</Title>}
        <Grid $cols={cols}>
          {imagenes.map((img, i) => (
            <Item key={i}>
              <Img
                src={img.url?.startsWith('http') ? img.url : `${BACKEND_BASE}/${img.url}`}
                alt={img.titulo || ''}
              />
              {(img.titulo || img.descripcion) && (
                <Caption>
                  {img.titulo && <CaptionTitle>{img.titulo}</CaptionTitle>}
                  {img.descripcion && <CaptionDesc>{img.descripcion}</CaptionDesc>}
                </Caption>
              )}
            </Item>
          ))}
        </Grid>
      </Container>
    </Wrapper>
  );
};

export default ImageGallerySection;
