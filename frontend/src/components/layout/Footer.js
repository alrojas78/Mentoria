import React from 'react';
import styled, { keyframes } from 'styled-components';

const subtleGlow = keyframes`
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
`;

const FooterContainer = styled.footer`
  background: linear-gradient(180deg, #0a2a47 0%, #0f355b 100%);
  padding: 3rem 15px 1.5rem;
  margin-top: auto;
  color: #94a3b8;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
`;

const FooterMain = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(20, 182, 203, 0.15);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1.5rem;
    text-align: center;
  }
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LogoText = styled.span`
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Myriad Pro', sans-serif;
  letter-spacing: -0.5px;
`;

const ContactSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;

  @media (max-width: 768px) {
    align-items: center;
  }
`;

const ContactLabel = styled.span`
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #64748b;
`;

const ContactEmail = styled.a`
  color: #14b6cb;
  text-decoration: none;
  font-size: 1rem;
  font-weight: 600;
  transition: color 0.3s ease;

  &:hover {
    color: #22d3ee;
  }
`;

const FooterBottom = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1.5rem;
  font-size: 0.82rem;
  color: #64748b;
  font-family: 'Myriad Pro', sans-serif;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
    padding-bottom: 60px;
  }
`;

const VersionBadge = styled.span`
  background: rgba(20, 182, 203, 0.12);
  color: #14b6cb;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.5px;
`;

const FooterLinks = styled.div`
  display: flex;
  gap: 1.5rem;

  a {
    color: #64748b;
    text-decoration: none;
    transition: color 0.3s ease;

    &:hover {
      color: #14b6cb;
    }
  }
`;

// Mini versión del icono neural para el footer
const FooterNeuralIcon = () => (
  <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="footerBrainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14b6cb" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <path d="M50 20 C35 20, 18 32, 18 50 C18 68, 35 80, 50 80"
          stroke="url(#footerBrainGrad)" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M50 20 C65 20, 82 32, 82 50 C82 68, 65 80, 50 80"
          stroke="url(#footerBrainGrad)" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <circle cx="50" cy="50" r="5" fill="#14b6cb"/>
    <circle cx="32" cy="38" r="3" fill="#14b6cb" opacity="0.7"/>
    <circle cx="68" cy="38" r="3" fill="#22d3ee" opacity="0.7"/>
    <circle cx="28" cy="55" r="2.5" fill="#22d3ee" opacity="0.5"/>
    <circle cx="72" cy="55" r="2.5" fill="#14b6cb" opacity="0.5"/>
    <line x1="32" y1="38" x2="50" y2="50" stroke="#14b6cb" strokeWidth="1" opacity="0.4"/>
    <line x1="68" y1="38" x2="50" y2="50" stroke="#22d3ee" strokeWidth="1" opacity="0.4"/>
  </svg>
);

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <FooterContainer>
      <FooterContent>
        <FooterMain>
          <LogoSection>
            <FooterNeuralIcon />
            <LogoText>MentorIA</LogoText>
          </LogoSection>
          <ContactSection>
            <ContactLabel>Contacto</ContactLabel>
            <ContactEmail href="mailto:soporte@ateneo.co">soporte@ateneo.co</ContactEmail>
          </ContactSection>
        </FooterMain>
        <FooterBottom>
          <div>
            &copy; {currentYear} Ateneo.co. Todos los derechos reservados.
          </div>
          <FooterLinks>
            <a href="#" onClick={e => e.preventDefault()}>Privacidad</a>
            <a href="#" onClick={e => e.preventDefault()}>Términos</a>
            <VersionBadge>v4.0</VersionBadge>
          </FooterLinks>
        </FooterBottom>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;
