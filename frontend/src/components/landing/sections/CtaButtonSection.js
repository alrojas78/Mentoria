// CtaButtonSection.js — Sección de Call to Action
import React from 'react';
import styled, { keyframes } from 'styled-components';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 4px 20px rgba(20,182,203,0.3); }
  50% { box-shadow: 0 8px 30px rgba(20,182,203,0.5); }
`;

const Wrapper = styled.section`
  padding: 4rem 2rem;
  background: ${p => p.$bg || '#f8fafc'};
  text-align: center;
`;

const Title = styled.h2`
  font-size: 38px;
  color: ${p => p.$color || '#0f355b'};
  font-family: 'Myriad Pro', sans-serif;
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 19px;
  color: ${p => p.$color || '#64748b'};
  font-family: 'Myriad Pro', sans-serif;
  margin-bottom: 2rem;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
`;

const Btn = styled.button`
  background: ${p => p.$bg || '#14b6cb'};
  color: ${p => p.$color || '#fff'};
  padding: 12px 40px;
  border-radius: 10px;
  font-weight: bold;
  font-size: 19px;
  font-family: 'Myriad Pro', sans-serif;
  border: none;
  cursor: pointer;
  transition: 0.3s;
  animation: ${pulse} 3s infinite;
  &:hover { transform: translateY(-3px); animation: none; }
`;

const CtaButtonSection = ({ config, openLogin, openRegister }) => {
  const handleClick = () => {
    const action = config.accion || 'registro';
    if (action === 'login') openLogin?.();
    else if (action === 'registro') openRegister?.();
    else if (action.startsWith('http')) window.open(action, '_blank');
  };

  return (
    <Wrapper $bg={config.color_fondo}>
      {config.titulo && <Title $color={config.color_titulo}>{config.titulo}</Title>}
      {config.subtitulo && <Subtitle $color={config.color_subtitulo}>{config.subtitulo}</Subtitle>}
      <Btn $bg={config.color_boton} $color={config.color_texto_boton} onClick={handleClick}>
        {config.texto_boton || 'Comenzar ahora'}
      </Btn>
    </Wrapper>
  );
};

export default CtaButtonSection;
