// DynamicLanding.js — Orquestador de secciones dinámicas con fuentes globales
import React, { useEffect } from 'react';
import styled from 'styled-components';
import SectionRenderer from './SectionRenderer';

// Google Fonts a cargar dinámicamente
const GOOGLE_FONTS_MAP = {
  'Roboto': 'Roboto:wght@300;400;600;700',
  'Open Sans': 'Open+Sans:wght@300;400;600;700',
  'Montserrat': 'Montserrat:wght@300;400;600;700;900',
  'Poppins': 'Poppins:wght@300;400;600;700',
  'Lato': 'Lato:wght@300;400;700',
  'Inter': 'Inter:wght@300;400;600;700',
  'Playfair Display': 'Playfair+Display:wght@400;700',
};

const LandingWrapper = styled.div`
  font-family: ${p => p.$font || "'Myriad Pro', sans-serif"};
  width: 100%;
`;

const DynamicLanding = ({ secciones, proyecto, openLogin, openRegister }) => {
  const landingConfig = proyecto?.config_json?.landing_config || {};

  // Cargar Google Fonts si se usan
  useEffect(() => {
    const fontsToLoad = new Set();
    const fuentePrincipal = landingConfig.fuente_principal || '';
    const fuenteTitulos = landingConfig.fuente_titulos || '';

    [fuentePrincipal, fuenteTitulos].forEach(f => {
      if (f) {
        // Extraer nombre de la fuente (sin fallbacks)
        const name = f.split(',')[0].replace(/['"]/g, '').trim();
        if (GOOGLE_FONTS_MAP[name]) {
          fontsToLoad.add(GOOGLE_FONTS_MAP[name]);
        }
      }
    });

    // También revisar fuentes dentro de secciones hero
    (secciones || []).forEach(s => {
      if (s.config) {
        [s.config.fuente_titulo, s.config.fuente_subtitulo].forEach(f => {
          if (f) {
            const name = f.split(',')[0].replace(/['"]/g, '').trim();
            if (GOOGLE_FONTS_MAP[name]) {
              fontsToLoad.add(GOOGLE_FONTS_MAP[name]);
            }
          }
        });
      }
    });

    if (fontsToLoad.size > 0) {
      const existing = document.getElementById('dynamic-landing-fonts');
      if (existing) existing.remove();
      const link = document.createElement('link');
      link.id = 'dynamic-landing-fonts';
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${[...fontsToLoad].map(f => `family=${f}`).join('&')}&display=swap`;
      document.head.appendChild(link);
    }

    return () => {
      const el = document.getElementById('dynamic-landing-fonts');
      if (el) el.remove();
    };
  }, [secciones, landingConfig.fuente_principal, landingConfig.fuente_titulos]);

  const visibles = (secciones || [])
    .filter(s => s.visible !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  if (visibles.length === 0) return null;

  const globalFont = landingConfig.fuente_principal || "'Myriad Pro', sans-serif";

  return (
    <LandingWrapper $font={globalFont}>
      {visibles.map(seccion => (
        <SectionRenderer
          key={seccion.id}
          seccion={seccion}
          proyecto={proyecto}
          openLogin={openLogin}
          openRegister={openRegister}
        />
      ))}
    </LandingWrapper>
  );
};

export default DynamicLanding;
