// SectionRenderer.js — Switch por tipo de sección → componente
import React from 'react';
import HeroSection from './sections/HeroSection';
import StatsSection from './sections/StatsSection';
import FeatureCardsSection from './sections/FeatureCardsSection';
import IconTextGridSection from './sections/IconTextGridSection';
import TextBlockSection from './sections/TextBlockSection';
import ImageGallerySection from './sections/ImageGallerySection';
import CtaButtonSection from './sections/CtaButtonSection';
import TestimonialsSection from './sections/TestimonialsSection';
import CustomHtmlSection from './sections/CustomHtmlSection';
import HeaderSection from './sections/HeaderSection';
import FooterSection from './sections/FooterSection';
import ContenidosCarouselSection from './sections/ContenidosCarouselSection';

const SECTION_MAP = {
  hero: HeroSection,
  stats: StatsSection,
  feature_cards: FeatureCardsSection,
  icon_text_grid: IconTextGridSection,
  text_block: TextBlockSection,
  image_gallery: ImageGallerySection,
  cta_button: CtaButtonSection,
  testimonials: TestimonialsSection,
  custom_html: CustomHtmlSection,
  header: HeaderSection,
  footer: FooterSection,
  contenidos_carousel: ContenidosCarouselSection,
};

const SectionRenderer = ({ seccion, proyecto, openLogin, openRegister }) => {
  const Component = SECTION_MAP[seccion.tipo];
  if (!Component) {
    console.warn(`Tipo de sección desconocido: ${seccion.tipo}`);
    return null;
  }
  return (
    <Component
      config={seccion.config || {}}
      proyecto={proyecto}
      openLogin={openLogin}
      openRegister={openRegister}
    />
  );
};

export default SectionRenderer;
