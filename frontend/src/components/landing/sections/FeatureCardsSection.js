// FeatureCardsSection.js — Tarjetas de características
import React from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.section`
  padding: 5rem 2rem;
  background: ${p => p.$bg || '#fff'};
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
`;

const Title = styled.h2`
  font-size: 42px;
  color: ${p => p.$color || '#0f355b'};
  font-weight: bold;
  font-family: 'Myriad Pro', sans-serif;
  margin-bottom: 3rem;
  @media (max-width: 991px) { font-size: 32px; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2.5rem;
`;

const Card = styled.div`
  background: #fff;
  padding: 18px 27px;
  border-radius: 111px 4px 31px 31px;
  border: 1px solid ${p => p.$borderColor || '#0f355b'};
  transition: 0.3s;
  &:hover { transform: translateY(-5px); box-shadow: 0 12px 30px rgba(43,67,97,0.1); }
`;

const CardImg = styled.img`
  width: 140px;
  max-width: 140px;
  display: block;
  margin: 0 auto -20px;
`;

const CardTitle = styled.h3`
  font-size: 22px;
  color: #fff;
  background: ${p => p.$bg || '#14b6cb'};
  font-weight: bold;
  font-family: 'Myriad Pro', sans-serif;
  width: 100%;
  padding: 8px 0;
  border-radius: 10px;
  margin-bottom: 0;
`;

const CardDesc = styled.p`
  color: ${p => p.$color || '#0f355b'};
  line-height: 1.4;
  font-size: 17px;
  font-family: 'Myriad Pro', sans-serif;
`;

const FeatureCardsSection = ({ config, proyecto }) => {
  const cards = config.cards || [];
  if (cards.length === 0) return null;
  const secondary = config.color_secundario || proyecto?.color_secundario || '#14b6cb';
  const primary = config.color_primario || proyecto?.color_primario || '#0f355b';

  return (
    <Wrapper $bg={config.color_fondo}>
      <Container>
        {config.titulo && <Title $color={primary}>{config.titulo}</Title>}
        <Grid>
          {cards.map((card, i) => (
            <Card key={i} $borderColor={primary}>
              {card.imagen && (
                <CardImg
                  src={card.imagen.startsWith('http') ? card.imagen : `${BACKEND_BASE}/${card.imagen}`}
                  alt={card.titulo}
                />
              )}
              <CardTitle $bg={secondary}>{card.titulo}</CardTitle>
              <CardDesc $color={primary}>{card.descripcion}</CardDesc>
            </Card>
          ))}
        </Grid>
      </Container>
    </Wrapper>
  );
};

export default FeatureCardsSection;
