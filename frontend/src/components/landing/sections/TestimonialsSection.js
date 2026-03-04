// TestimonialsSection.js — Sección de testimonios
import React from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.section`
  padding: 4rem 2rem;
  background: ${p => p.$bg || '#f8fafc'};
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
  margin-bottom: 2.5rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 2rem 1.5rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  text-align: center;
  transition: 0.3s;
  &:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
`;

const Avatar = styled.img`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 1rem;
  border: 3px solid ${p => p.$borderColor || '#14b6cb'};
`;

const AvatarPlaceholder = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: ${p => p.$bg || '#14b6cb'};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0 auto 1rem;
`;

const Quote = styled.p`
  font-size: 1rem;
  color: #475569;
  line-height: 1.6;
  font-style: italic;
  margin-bottom: 1rem;
  &::before { content: '"'; }
  &::after { content: '"'; }
`;

const Name = styled.div`
  font-weight: bold;
  color: #0f355b;
  font-size: 1rem;
`;

const Cargo = styled.div`
  color: #64748b;
  font-size: 0.85rem;
`;

const TestimonialsSection = ({ config, proyecto }) => {
  const items = config.items || [];
  if (items.length === 0) return null;
  const primary = config.color_primario || proyecto?.color_primario || '#0f355b';
  const secondary = config.color_secundario || proyecto?.color_secundario || '#14b6cb';

  return (
    <Wrapper $bg={config.color_fondo}>
      <Container>
        {config.titulo && <Title $color={primary}>{config.titulo}</Title>}
        <Grid>
          {items.map((item, i) => (
            <Card key={i}>
              {item.foto ? (
                <Avatar
                  src={item.foto.startsWith('http') ? item.foto : `${BACKEND_BASE}/${item.foto}`}
                  alt={item.nombre}
                  $borderColor={secondary}
                />
              ) : (
                <AvatarPlaceholder $bg={secondary}>
                  {(item.nombre || '?')[0].toUpperCase()}
                </AvatarPlaceholder>
              )}
              <Quote>{item.texto}</Quote>
              <Name>{item.nombre}</Name>
              {item.cargo && <Cargo>{item.cargo}</Cargo>}
            </Card>
          ))}
        </Grid>
      </Container>
    </Wrapper>
  );
};

export default TestimonialsSection;
