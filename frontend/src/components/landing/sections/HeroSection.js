// HeroSection.js — Sección hero dinámica con personalización completa
import React from 'react';
import styled, { keyframes } from 'styled-components';
import { BACKEND_BASE } from '../../../services/api';

const pulse = keyframes`
  0%, 100% { box-shadow: 0 4px 20px rgba(220, 38, 38, 0.2); }
  50% { box-shadow: 0 8px 30px rgba(220, 38, 38, 0.3); }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Wrapper = styled.div`
  width: 100%;
  background-size: cover;
  background-position: ${p => p.$bgPosition || 'center'};
  background-color: ${p => p.$bgColor || '#0f355b'};
  ${p => p.$bgImage && `background-image: url(${p.$bgImage});`}
  min-height: ${p => p.$minHeight || 'auto'};
  display: flex;
  align-items: center;
`;

const Overlay = styled.div`
  width: 100%;
  ${p => p.$overlay && `background: ${p.$overlay};`}
`;

const Inner = styled.div`
  max-width: ${p => p.$maxWidth || '1200px'};
  margin: 0 auto;
  display: flex;
  align-items: ${p => p.$verticalAlign || 'center'};
  padding: ${p => p.$padding || '2rem'};
  flex-direction: ${p => p.$layout === 'img-right' ? 'row-reverse' : (p.$layout === 'text-only' ? 'column' : 'row')};
  @media (max-width: 991px) {
    flex-wrap: wrap;
    padding: 1.5rem 1rem;
    flex-direction: column;
  }
`;

const ImgCol = styled.div`
  width: ${p => p.$width || '50%'};
  text-align: center;
  @media (max-width: 991px) { width: 100%; }
`;

const MainImg = styled.img`
  width: 100%;
  max-height: ${p => p.$maxH || '450px'};
  object-fit: contain;
`;

const ContentCol = styled.div`
  width: ${p => p.$width || '50%'};
  padding: ${p => p.$padding || '2rem'};
  animation: ${fadeInUp} 1s ease-out;
  text-align: ${p => p.$align || 'center'};
  @media (max-width: 991px) { width: 100%; text-align: center; padding: 1rem; }
`;

const Title = styled.h1`
  font-size: ${p => p.$size || '52px'};
  color: ${p => p.$color || '#ffffff'};
  font-family: ${p => p.$font || "'Myriad Pro', sans-serif"};
  font-weight: ${p => p.$weight || '700'};
  margin: 0 0 0.5rem;
  line-height: ${p => p.$lineHeight || '1.15'};
  text-align: ${p => p.$align || 'inherit'};
  text-transform: ${p => p.$transform || 'none'};
  @media (max-width: 991px) { font-size: ${p => parseInt(p.$size || 52) * 0.65}px; }
`;

const Subtitle = styled.p`
  font-size: ${p => p.$size || '19px'};
  color: ${p => p.$color || '#ffffff'};
  line-height: ${p => p.$lineHeight || '1.6'};
  font-family: ${p => p.$font || "'Myriad Pro', sans-serif"};
  font-weight: ${p => p.$weight || '300'};
  text-align: ${p => p.$align || 'inherit'};
  margin-bottom: ${p => p.$mb || '1rem'};
  @media (max-width: 991px) { line-height: 1.3; }
`;

const BtnRow = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: ${p => p.$justify || 'center'};
  flex-wrap: wrap;
  margin-top: ${p => p.$mt || '1rem'};
  @media (max-width: 991px) { justify-content: center; }
`;

const Btn = styled.button`
  background: ${p => p.$bg || '#0f355b'};
  color: ${p => p.$color || '#fff'};
  padding: ${p => p.$padding || '10px 32px'};
  border-radius: ${p => p.$radius || '8px'};
  font-weight: bold;
  font-size: ${p => p.$size || '17px'};
  font-family: inherit;
  border: ${p => p.$border || 'none'};
  cursor: pointer;
  transition: 0.3s;
  animation: ${pulse} 3s infinite;
  &:hover { transform: translateY(-2px); animation: none; opacity: 0.9; }
`;

const resolveUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${BACKEND_BASE}/${url}`;
};

const HeroSection = ({ config, proyecto, openLogin, openRegister }) => {
  const c = config;
  const primary = c.color_primario || proyecto?.color_primario || '#0f355b';
  const secondary = c.color_secundario || proyecto?.color_secundario || '#14b6cb';

  const bgImg = resolveUrl(c.imagen_fondo);
  const mainImg = resolveUrl(c.imagen_principal);

  // Layout: img-left (default), img-right, text-only
  const layout = c.layout || (mainImg ? 'img-left' : 'text-only');
  const textAlign = c.alineacion_texto || 'center';

  // Justify map for buttons
  const btnJustify = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  const handleAction = (action) => {
    if (action === 'login') openLogin?.();
    else if (action === 'registro') openRegister?.();
    else if (action && action.startsWith('http')) window.open(action, '_blank');
  };

  const contentWidth = layout === 'text-only' ? '100%' : (c.ancho_contenido || '50%');
  const imgWidth = layout === 'text-only' ? '0%' : (c.ancho_imagen || '50%');

  return (
    <Wrapper
      $bgColor={primary}
      $bgImage={bgImg}
      $bgPosition={c.posicion_fondo || 'center'}
      $minHeight={c.altura_minima || 'auto'}
    >
      <Overlay $overlay={c.overlay_fondo}>
        <Inner
          $layout={layout}
          $padding={c.padding || '2rem'}
          $maxWidth={c.ancho_maximo || '1200px'}
          $verticalAlign={c.alineacion_vertical || 'center'}
        >
          {layout !== 'text-only' && mainImg && (
            <ImgCol $width={imgWidth}>
              <MainImg src={mainImg} alt={c.titulo || ''} $maxH={c.altura_imagen || '450px'} />
            </ImgCol>
          )}
          <ContentCol $width={contentWidth} $align={textAlign} $padding={c.padding_contenido || '2rem'}>
            <Title
              $color={c.color_titulo || '#fff'}
              $size={c.tamano_titulo || '52px'}
              $weight={c.peso_titulo || '700'}
              $font={c.fuente_titulo}
              $lineHeight={c.interlineado_titulo || '1.15'}
              $align={textAlign}
              $transform={c.transform_titulo || 'none'}
            >
              {c.titulo || 'Bienvenido'}
            </Title>
            <Subtitle
              $color={c.color_subtitulo || '#fff'}
              $size={c.tamano_subtitulo || '19px'}
              $weight={c.peso_subtitulo || '300'}
              $font={c.fuente_subtitulo}
              $lineHeight={c.interlineado_subtitulo || '1.6'}
              $align={textAlign}
              $mb={c.margen_subtitulo}
            >
              {c.subtitulo || ''}
            </Subtitle>
            <BtnRow $justify={btnJustify} $mt={c.margen_botones}>
              {(c.boton_login !== false) && (
                <Btn
                  $bg={c.color_boton_login || secondary}
                  $color={c.color_texto_boton_login || '#fff'}
                  $padding={c.padding_botones}
                  $radius={c.radio_botones || '8px'}
                  $size={c.tamano_botones}
                  $border={c.borde_botones}
                  onClick={() => handleAction(c.accion_boton_login || 'login')}
                >
                  {c.texto_boton_login || 'Inicia sesión'}
                </Btn>
              )}
              {(c.boton_registro !== false) && (
                <Btn
                  $bg={c.color_boton_registro || secondary}
                  $color={c.color_texto_boton_registro || '#fff'}
                  $padding={c.padding_botones}
                  $radius={c.radio_botones || '8px'}
                  $size={c.tamano_botones}
                  $border={c.borde_botones}
                  onClick={() => handleAction(c.accion_boton_registro || 'registro')}
                >
                  {c.texto_boton_registro || 'Regístrate'}
                </Btn>
              )}
            </BtnRow>
          </ContentCol>
        </Inner>
      </Overlay>
    </Wrapper>
  );
};

export default HeroSection;
