import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useProject } from '../../contexts/ProjectContext';
import logoAdium from '../../assets/img/logo_footer.png';

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
  align-items: center;

  a {
    color: #64748b;
    text-decoration: none;
    transition: color 0.3s ease;

    &:hover {
      color: #14b6cb;
    }
  }
`;

const AdiumLogo = styled.img`
  height: 28px;
  opacity: 0.7;
  transition: opacity 0.3s ease;
  filter: brightness(0) invert(1);

  &:hover {
    opacity: 1;
  }

  @media (max-width: 767px) {
    height: 22px;
  }
`;

// Mini chip AI para el footer (versión estática)
const FooterNeuralIcon = () => (
  <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="fChipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#14b6cb" />
        <stop offset="100%" stopColor="#22d3ee" />
      </linearGradient>
    </defs>
    <rect x="22" y="22" width="56" height="56" rx="12" stroke="url(#fChipGrad)" strokeWidth="2.5" fill="none"/>
    <line x1="38" y1="12" x2="38" y2="22" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="50" y1="12" x2="50" y2="22" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="62" y1="12" x2="62" y2="22" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="38" y1="78" x2="38" y2="88" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="50" y1="78" x2="50" y2="88" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="62" y1="78" x2="62" y2="88" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="12" y1="38" x2="22" y2="38" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="12" y1="50" x2="22" y2="50" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="12" y1="62" x2="22" y2="62" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="78" y1="38" x2="88" y2="38" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="78" y1="50" x2="88" y2="50" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="78" y1="62" x2="88" y2="62" stroke="#14b6cb" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="50" cy="50" r="5" fill="#14b6cb"/>
    <circle cx="50" cy="50" r="2.5" fill="#ffffff"/>
  </svg>
);

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { proyecto } = useProject();

  return (
    <FooterContainer>
      <FooterContent>
        <FooterMain>
          <LogoSection>
            <FooterNeuralIcon />
            <LogoText>{proyecto?.nombre || 'MentorIA'}</LogoText>
          </LogoSection>
          <ContactSection>
            <AdiumLogo src={logoAdium} alt="Adium" />
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
