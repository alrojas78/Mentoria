// TextBlockSection.js — Bloque de texto libre
import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.section`
  padding: 4rem 2rem;
  background: ${p => p.$bg || '#fff'};
  text-align: ${p => p.$align || 'center'};
`;

const Container = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const Title = styled.h2`
  font-size: 38px;
  color: ${p => p.$color || '#0f355b'};
  font-family: 'Myriad Pro', sans-serif;
  font-weight: bold;
  margin-bottom: 1.5rem;
`;

const Content = styled.div`
  font-size: 17px;
  color: ${p => p.$color || '#333'};
  line-height: 1.7;
  font-family: 'Myriad Pro', sans-serif;

  p { margin-bottom: 1rem; }
  ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
  strong { font-weight: bold; }
`;

const TextBlockSection = ({ config }) => {
  const align = config.alineacion || 'center';

  return (
    <Wrapper $bg={config.color_fondo} $align={align}>
      <Container>
        {config.titulo && <Title $color={config.color_titulo}>{config.titulo}</Title>}
        {config.contenido && (
          <Content
            $color={config.color_texto}
            dangerouslySetInnerHTML={{ __html: config.contenido }}
          />
        )}
      </Container>
    </Wrapper>
  );
};

export default TextBlockSection;
