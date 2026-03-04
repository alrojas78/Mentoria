// StatsSection.js — Sección de estadísticas
import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.section`
  padding: 60px 0;
  background: ${p => p.$bg || '#0f355b'};
  color: #fff;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  text-align: center;
  justify-content: center;
  flex-wrap: wrap;
`;

const Card = styled.div`
  padding: 0 1rem;
  width: ${p => p.$width || '22%'};
  border-right: 1px solid rgba(255,255,255,0.3);
  &:last-child { border-right: none; }
  @media (max-width: 767px) { width: 50%; margin-bottom: 1rem; }
`;

const Value = styled.div`
  font-size: 47px;
  font-weight: 700;
  color: ${p => p.$color || '#fff'};
  font-family: 'Myriad Pro', sans-serif;
`;

const Label = styled.div`
  font-size: 1.1rem;
  color: ${p => p.$color || '#fff'};
  font-family: 'Myriad Pro', sans-serif;
`;

const StatsSection = ({ config, proyecto }) => {
  const items = config.items || [];
  if (items.length === 0) return null;
  const bg = config.color_fondo || proyecto?.color_primario || '#0f355b';
  const textColor = config.color_texto || '#fff';
  const w = items.length > 0 ? `${Math.floor(100 / items.length)}%` : '25%';

  return (
    <Wrapper $bg={bg}>
      <Container>
        {items.map((item, i) => (
          <Card key={i} $width={w}>
            <Value $color={textColor}>{item.valor}</Value>
            <Label $color={textColor}>{item.etiqueta}</Label>
          </Card>
        ))}
      </Container>
    </Wrapper>
  );
};

export default StatsSection;
