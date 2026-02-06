// src/components/layout/Footer.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import logo from '../../assets/img/logo_footer.png'; // ajusta el nombre del archivo si es distinto


const FooterContainer = styled.footer`
  background: rgb(255, 255, 255);
  padding: 57px 15px 33px 15px;
  margin-top: auto;
  color: rgb(15, 53, 91);
`;

const FooterContent = styled.div`
    max-width: 1200px;
    margin: auto;
`;

const FooterSection = styled.div`
    display: flex;
    align-items: end;
`;

const FooterLink = styled(Link)`
  color: #706f6f;
  text-decoration: none;
  display: block;
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
  font-size: 0.9rem;

  &:hover {
    color: #dc2626;
  }
`;

const ExternalLink = styled.a`
  color: #706f6f;
  text-decoration: none;
  display: block;
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
  font-size: 0.9rem;

  &:hover {
    color: #dc2626;
  }
`;

const FooterText = styled.p`
    color: rgb(15, 53, 91);
    font-size: 28px;
    line-height: 1.6;
    margin: 0px;
    font-weight: bold;
    font-family: "Myriad Pro", sans-serif;
    padding-left: 17px;
    @media (max-width: 991px) {
      padding-left: 0px;
      text-align: center;
      line-height: 1;
    }
    @media (max-width: 767px) {
      font-size: 18px;
    }

    

`;

const Logo = styled.div`
    display: flex;
    align-items: center;
    margin-bottom: 0px;
    @media (max-width: 767px) {
      transform: scale(0.6);
    }

`;

const LogoIcon = styled.div`
    width: 47px;
    height: 47px;
    border-radius: 6px;
    background: linear-gradient(135deg, rgb(220, 38, 38) 0%, rgb(43, 67, 97) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
  
  &::before {
    content: '🤖';
    filter: grayscale(100%) brightness(0) invert(1);
  }
`;

const LogoText = styled.span`
  font-size: 52px;
  font-weight: 700;
  color: #0f355b;
  padding-left: 9px;
`;

const FooterBottom = styled.div`
    border-top: 0px solid rgb(55, 65, 81);
    padding-top: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 17px;
    color: rgb(112, 111, 111);
    font-family: "Myriad Pro", sans-serif;

  @media (max-width: 768px) {
    text-align: center;
    justify-content: center;
    font-size: 13px;
    padding-bottom: 55px;
  }
`;

const FooterEnlaces = styled(Link)`
  color: #0f355b;
  text-decoration: none;
  &:hover {
    color: #dc2626;
  }
`;

const FooteContainer = styled.div`
    width: 100%;
    display: flex;
    justify-content: space-between;
    flex-flow: wrap;
`;
const LeftFooter = styled.div`
    display: flex;
    align-items: baseline;
    flex-flow: wrap;
    @media (max-width: 991px) {
      margin-bottom: 14px;
      width: 100%;
      justify-content: center;
    }
`;
const RightFooter = styled.div`

    @media (max-width: 991px) {
      display: flex;
      width: 100%;
      justify-content: center;
    }
`;

const RightFooterImg = styled.img`
  width: 126px;

  @media (max-width: 767px) {
    width: 93px;
  }


`;




const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <FooterContainer>
      <FooterContent>
        {/* Sección Principal */}
        <FooterSection>
          <FooteContainer>
            <LeftFooter>
              <Logo>
                <LogoIcon />
                <LogoText>MentorIA</LogoText>
              </Logo>
              <FooterText>
                <strong>Contacto:</strong> <FooterEnlaces to="mailto:soporte@ateneo.co">soporte@ateneo.co</FooterEnlaces>
              </FooterText>
            </LeftFooter>
            <RightFooter>
              <RightFooterImg src={logo} alt="Logo" />
            </RightFooter>
          </FooteContainer>
        </FooterSection>
        <FooterBottom>
          <div>
            © {currentYear} Ateneo.co. Todos los derechos reservados. | ver 3.9 Beta
            <ExternalLink 
              href="#" 
              onClick={(e) => e.preventDefault()}
              style={{ display: 'inline', marginLeft: '0.5rem' }}
            >
              Política de Privacidad
            </ExternalLink>
            {' | '}
            <ExternalLink 
              href="#" 
              onClick={(e) => e.preventDefault()}
              style={{ display: 'inline', marginLeft: '0.5rem' }}
            >
              Términos de Servicio
            </ExternalLink>
          </div>
        </FooterBottom>
      </FooterContent>
    </FooterContainer>
  );
};

export default Footer;