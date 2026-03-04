// CustomHtmlSection.js — Sección de HTML libre
import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.section`
  ${p => p.$css || ''}
`;

const CustomHtmlSection = ({ config }) => {
  if (!config.html) return null;

  return (
    <Wrapper $css={config.css || ''}>
      <div dangerouslySetInnerHTML={{ __html: config.html }} />
    </Wrapper>
  );
};

export default CustomHtmlSection;
