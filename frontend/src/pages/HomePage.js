// src/pages/HomePage.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

import imgdoctora from '../assets/img/doctora_2.png';
import fondo from '../assets/img/banner_ensayo_1.jpg';
import fondo_seed_burbujas from '../assets/img/fondo_seed_burbujas.png';
import logo_vozama from '../assets/img/logo_vozama.svg';


import consulta_inteligente from '../assets/img/consulta_inteligente.png';
import modo_mentor from '../assets/img/modo_mentor.png';
import evaluaciones_certificadas from '../assets/img/evaluaciones_certificadas.png';
import analiticas_avanzadas from '../assets/img/analiticas_avanzadas.png';
import contenido_especializado from '../assets/img/contenido_especializado.png';
import seguridad_medica from '../assets/img/seguridad_medica.png';

import right_fondo from '../assets/img/right_fondo.png';

import icono_cart_one from '../assets/img/icono_cart_1.png';
import icono_cart_02 from '../assets/img/icono_cart_2.png';
import icono_cart_03 from '../assets/img/icono_cart_3.png';
import icono_cart_04 from '../assets/img/icono_cart_4.png';
import icono_cart_05 from '../assets/img/icono_cart_5.png';
import icono_cart_06 from '../assets/img/icono_cart_6.png';
import icono_cart_07 from '../assets/img/icono_cart_7.png';
import icono_cart_08 from '../assets/img/icono_cart_8.png';
import icono_cart_09 from '../assets/img/icono_cart_9.png';
import icono_cart_010 from '../assets/img/icono_cart_10.png';
import icono_cart_011 from '../assets/img/icono_cart_11.png';
import icono_cart_012 from '../assets/img/icono_cart_12.png';
import icono_cart_013 from '../assets/img/icono_cart_13.png';
import icono_cart_014 from '../assets/img/icono_cart_14.png';



// Animaciones sutiles
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const pulse = keyframes`
  0%, 100% {
    box-shadow: 0 4px 20px rgba(220, 38, 38, 0.2);
  }
  50% {
    box-shadow: 0 8px 30px rgba(220, 38, 38, 0.3);
  }
`;

{/* CSS Banner principal home */}
const HeroContainer = styled.div`
    width: 100%;
    background-image: url(${fondo});
    background-size: cover;
    background-position: center;
`;
const HeroPriContainer = styled.div`
    margin: 0 auto;
    display: flex;
    width: 100%;
    align-items: center;

    @media (max-width: 991px) {
      flex-flow: wrap;
    }

`;
const LeftHeroImg = styled.div`
    width: 50%;
    position: relative;

    @media (max-width: 991px) {
      width: 100%;
    }


`;
const HeroImgDoctora = styled.img`
    width: 100%;
    height: auto;
    margin-bottom: 17px;
`;
const LogoVozama = styled.img`
    width: 240px;
    height: auto;
    display: block;
    margin: 0 auto;
    margin-bottom: 20px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 0px;
`;
const PrimaryButton = styled(Link)`
  background: #0f355b;
  color: white;
  padding: 8px 31px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 17px;
  transition: 0.3s;
  box-shadow: 0 4px 20px rgba(220, 38, 38, 0.2);
  animation: ${pulse} 3s infinite;
  font-family: 'Myriad Pro', sans-serif;
  font-weight: bold;

  &:hover {
    background: #b91c1c;
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(220, 38, 38, 0.3);
    animation: none;
  }
`;
const Subtitle = styled.p`
    font-size: 19px;
    margin-bottom: 17px;
    color: #ffffff;
    line-height: 1.6;
    margin-top: 0px;
    text-align: center;
    font-family: 'Myriad Pro', sans-serif;
    font-weight: 300;
    padding: 0px 10%;
    @media (max-width: 991px) {
      padding: 0px;
      line-height: 1.2;
    }



`;
const MainTitle = styled.h1`
    font-size: 57px;
    color: rgb(255, 255, 255);
    margin-bottom: 0px;
    position: relative;
    font-weight: 300;
    font-family: 'Myriad Pro';
    margin-top: 0px;
    text-align: center;
`;

{/* End CSS Banner principal home */}



{/* CSS Herramientas Profesionales */}
const FeatureSection = styled.section`
  padding: 5rem 2rem;
  background-color: #ffffff;
  background-image: url(${fondo_seed_burbujas});
  background-position: bottom left;
  background-size: 31%;
  background-repeat: no-repeat;
  @media (max-width: 991px) {
    padding: 5rem 12px;
  }



`;
const HeroContent = styled.div`
  max-width: 1000px;
  padding: 2rem;
  position: relative;
  z-index: 1;
  animation: ${fadeInUp} 1s ease-out;
`;


const HeroImgIcon = styled.img`
    width: 140px;
    max-width: 140px;
    display: block;
    margin: 0px auto;
    margin-top: -42px;
`;


{/* End CSS Herramientas Profesionales */}



const FeaturedIcon = styled.div`
  max-width: 100%;
  position: relative;
  padding: 0px 0px 192px 0px;
  background-color: #ffffff;
  background-image: url(${right_fondo});
  background-position: bottom right;
  background-repeat: no-repeat;
  background-size: 22%;
  @media (max-width: 991px) {
    padding: 0px 30px;
    padding: 0px 0px 75px;
  }


`;
const FeaturedContainer = styled.div`
    max-width: 1200px;
    margin: 0px auto;
    display: flex;
    justify-content: left;
    flex-flow: wrap;
    @media (max-width: 991px) {
      padding: 0px 30px;
    }


`;
const DivIcon = styled.div`
    width: 33%;
    display: flex;
    font-family: "Myriad Pro", sans-serif;
    color: #0f355b;
    font-size: 17px;
    border-bottom: 1px solid #14b6cb;
    padding-top: 20px;
    padding-bottom: 20px;
    align-items: center;
    flex-flow: wrap;

    @media (max-width: 991px) {
      flex-flow: wrap;
      justify-content: center;
      text-align: center;
      width: 100%;
    }

  &:nth-last-child(-n+2) {
    border-bottom: 0px solid #fff;
  }
`;

const DivText = styled.div`
    padding-left: 9px;
    padding-right: 33px;
    display: block;
    width: 100%;
    color: rgb(15, 53, 91);
    line-height: 1.4;
    font-size: 17px;
    font-family: "Myriad Pro";

    @media (max-width: 991px) {
      padding: 0px;
    }

`;
const HeroImgCart = styled.img`
  width: 58px;
  min-width: 58px;
  margin-bottom: 6px;
`;

const FeatureContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
`;

const FeatureTitle = styled.h2`
  font-size: 42px;
  color: #0f355b;
  margin-bottom: 3rem;
  position: relative;
  font-weight: bold;
  font-family: "Myriad Pro";
  margin-top: 0px;

  @media (max-width: 991px) {
    font-size: 32px;
  }


`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2.5rem;
  margin-top: 4rem;
`;

const FeatureCard = styled.div`
    background: rgb(255, 255, 255);
    padding: 18px 27px 18px 27px;
    border-radius: 111px 4px 31px 31px;
    transition: 0.3s;
    position: relative;
    border-width: 1px;
    border-style: solid;
    border-color: #0f355b;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 30px rgba(43, 67, 97, 0.1);
  }
`;

const FeatureIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1.5rem;
  color: #2b4361;
`;

const FeatureCardTitle = styled.h3`
    font-size: 22px;
    color: #fff;
    background: #14b6cb;
    font-weight: bold;
    font-family: "Myriad Pro";
    display: inline-block;
    width: 100%;
    padding: 8px 0px 8px 0px;
    line-height: 1;
    border-radius: 10px;
    margin-bottom: 0px;
`;

const FeatureDescription = styled.p`
    color: #0f355b;
    line-height: 1.4;
    font-size: 17px;
    font-family: "Myriad Pro";
`;

const StatsSection = styled.section`
    padding: 60px 0px;
    background: #0f355b;
    color: white;
`;

const StatsContainer = styled.div`
    max-width: 1200px;
    margin: 0px auto;
    display: flex;
    text-align: center;
    justify-content: center;
    flex-flow: wrap;
`;

const StatCard = styled.div`
  padding: 0px 1rem;
  width: 22%;
  border-right: 1px solid #fff;

  &:last-child {
    border-right: none;
  }
  @media (max-width: 767px) {
    width: 50%;
  }



`;

const StatNumber = styled.div`
    font-size: 47px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 0px;
    font-family: 'Myriad Pro', sans-serif;
`;

const StatLabel = styled.div`
    font-size: 1.1rem;
    color: #ffffff;
    font-family: 'Myriad Pro', sans-serif;
`;

const IconoCart1 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart2 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart3 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart4 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart5 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart6 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart7 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart8 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart9 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart10 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart11 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart12 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart13 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;
const IconoCart14 = styled.img`
  width: 38px;
  min-width: 38px;
  margin-bottom: 6px;
`;

const HomePage = () => {
  return (
    <>
    {/* Banner principal home */}
      <HeroContainer>
        <HeroPriContainer>
          <LeftHeroImg>
              <HeroImgDoctora src={imgdoctora} alt="Doctora" />
          </LeftHeroImg>
          <HeroContent>
            <LogoVozama src={logo_vozama} alt="Logo Vozama" />
            <MainTitle>MentorIA</MainTitle>
            <Subtitle>
              Plataforma profesional de educación médica con inteligencia artificial conversacional. Aprende, practica y evalúa tus conocimientos médicos con precisión y confianza.
            </Subtitle>
            <ButtonContainer>
              <PrimaryButton to="/login">
                Inicia sesión
              </PrimaryButton>
              <PrimaryButton to="/register">
                Regístrate
              </PrimaryButton>
            </ButtonContainer>
          </HeroContent>
        </HeroPriContainer>
      </HeroContainer>
    {/* END Banner principal home */}

    
      {/* Stats Section */}
      <StatsSection>
        <StatsContainer>
          <StatCard>
            <StatNumber>98%</StatNumber>
            <StatLabel>Precisión en respuestas</StatLabel>
          </StatCard>
          <StatCard>
            <StatNumber>24/7</StatNumber>
            <StatLabel>Disponibilidad</StatLabel>
          </StatCard>
        </StatsContainer>
      </StatsSection>

      {/* Features Section */}
      <FeatureSection>
        <FeatureContainer>
          <FeatureTitle>Herramientas Profesionales</FeatureTitle>
          
          <FeatureGrid>
            <FeatureCard>
              <HeroImgIcon src={consulta_inteligente} alt="Consulta Inteligente" />
              <FeatureCardTitle>Consulta Inteligente</FeatureCardTitle>
              <FeatureDescription>
                Interactúa con documentos médicos especializados mediante 
                conversaciones naturales. Obtén respuestas precisas basadas 
                en evidencia científica y literatura médica actualizada.
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard>
              <HeroImgIcon src={modo_mentor} alt="Modo Mentor" />
              <FeatureCardTitle>Modo Mentor</FeatureCardTitle>
              <FeatureDescription>
                Sistema de aprendizaje estructurado que adapta el contenido 
                a tu nivel de conocimiento. Recibe retroalimentación 
                personalizada y seguimiento de tu progreso académico.
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard>
              <HeroImgIcon src={evaluaciones_certificadas} alt="Evaluaciones Certificadas" />
              <FeatureCardTitle>Evaluaciones Certificadas</FeatureCardTitle>
              <FeatureDescription>
                Evaluaciones adaptativas que se ajustan a tu desempeño. 
                Obtén certificaciones válidas y métricas detalladas 
                de tu rendimiento en diferentes áreas médicas.
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard>
              <HeroImgIcon src={analiticas_avanzadas} alt="Analíticas Avanzadas" />
              <FeatureCardTitle>Analíticas Avanzadas</FeatureCardTitle>
              <FeatureDescription>
                Dashboards profesionales con métricas de aprendizaje, 
                progreso temporal y análisis comparativo. Identifica 
                fortalezas y áreas de mejora con datos precisos.
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard>
              <HeroImgIcon src={seguridad_medica} alt="Seguridad Médica" />
              <FeatureCardTitle>Seguridad Médica</FeatureCardTitle>
              <FeatureDescription>
                Cumplimiento de estándares internacionales de privacidad 
                médica. Protección de datos sensibles y acceso controlado 
                según roles profesionales establecidos.
              </FeatureDescription>
            </FeatureCard>

            <FeatureCard>
              <HeroImgIcon src={contenido_especializado} alt="Contenido Especializado" />
              <FeatureCardTitle>Contenido Especializado</FeatureCardTitle>
              <FeatureDescription>
                Biblioteca curada de documentos médicos de alta calidad, 
                guías clínicas, protocolos de tratamiento y literatura 
                científica revisada por pares médicos.
              </FeatureDescription>
            </FeatureCard>
          </FeatureGrid>
        </FeatureContainer>
      </FeatureSection>

      <FeaturedIcon>
        <FeaturedContainer>
          <DivIcon>
            <IconoCart1 src={icono_cart_one} />
            <DivText>Puedes hablar y chatear, lo que prefieras.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart2 src={icono_cart_02} />
            <DivText>Responde todas las preguntas.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart3 src={icono_cart_03} />
            <DivText>Evaluaciones inteligentes y certificaciones automáticas.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart4 src={icono_cart_04} />
            <DivText>Lanza preguntas autónomamente y retos.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart5 src={icono_cart_05} />
            <DivText>Microlearning videos.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart6 src={icono_cart_06} />
            <DivText>Algoritmos.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart7 src={icono_cart_07} />
            <DivText>Infografías.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart8 src={icono_cart_08} />
            <DivText>Casos clínicos.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart9 src={icono_cart_09} />
            <DivText>Sabe todo, todo es TODO del curso, es el mejor speaker.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart10 src={icono_cart_010} />
            <DivText>Estudia y aprende todo el curso para responder preguntas.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart11 src={icono_cart_011} />
            <DivText>Estudia y aprende TODA la bibliografía.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart12 src={icono_cart_012} />
            <DivText>Tablero de progreso para cada estudiante.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart13 src={icono_cart_013} />
            <DivText>Descarga de certificado.</DivText>
          </DivIcon>
          <DivIcon>
            <IconoCart14 src={icono_cart_014} />
            <DivText>Repaso de preguntas mal contestadas.</DivText>
          </DivIcon>
        </FeaturedContainer>
      </FeaturedIcon>

    </>
  );
};

export default HomePage;