// IconTextGridSection.js — Grilla de iconos con texto
import React from 'react';
import styled from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const Wrapper = styled.section`
  max-width: 100%;
  padding: 0 0 80px;
  background: ${p => p.$bg || '#fff'};
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  @media (max-width: 991px) { padding: 0 30px; }
`;

const Item = styled.div`
  width: ${p => p.$colWidth || '33.33%'};
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-family: 'Myriad Pro', sans-serif;
  color: ${p => p.$color || '#0f355b'};
  font-size: 17px;
  border-bottom: 1px solid ${p => p.$borderColor || '#14b6cb'};
  padding: 20px 0;
  &:nth-last-child(-n+${p => p.$cols || 3}) { border-bottom: none; }
  @media (max-width: 991px) {
    width: 100%;
    justify-content: center;
    text-align: center;
  }
`;

const Icon = styled.img`
  width: 58px;
  min-width: 58px;
  margin-bottom: 6px;
`;

const EmojiIcon = styled.span`
  font-size: 2rem;
  min-width: 58px;
  text-align: center;
`;

const Text = styled.div`
  padding-left: 9px;
  padding-right: 33px;
  width: 100%;
  line-height: 1.4;
  @media (max-width: 991px) { padding: 0; }
`;

const IconTextGridSection = ({ config, proyecto }) => {
  const items = config.items || [];
  if (items.length === 0) return null;
  const cols = config.columnas || 3;
  const colWidth = `${(100 / cols).toFixed(2)}%`;
  const primary = config.color_primario || proyecto?.color_primario || '#0f355b';
  const secondary = config.color_secundario || proyecto?.color_secundario || '#14b6cb';

  return (
    <Wrapper $bg={config.color_fondo}>
      <Container>
        {items.map((item, i) => (
          <Item key={i} $colWidth={colWidth} $color={primary} $borderColor={secondary} $cols={cols}>
            {item.icono ? (
              item.icono.startsWith('http') || item.icono.startsWith('uploads/') ? (
                <Icon src={item.icono.startsWith('http') ? item.icono : `${BACKEND_BASE}/${item.icono}`} alt="" />
              ) : (
                <EmojiIcon>{item.icono}</EmojiIcon>
              )
            ) : null}
            <Text>{item.texto}</Text>
          </Item>
        ))}
      </Container>
    </Wrapper>
  );
};

export default IconTextGridSection;
