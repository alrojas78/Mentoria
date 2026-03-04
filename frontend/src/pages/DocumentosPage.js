// DocumentosPage.js - DISEÑO DE GRILLA TECNOLÓGICA Y ELEGANTE
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { consultaService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';

// Iconos SVG paths
const ICONS = {
  consult: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5v-6h14v6zM7 11h2v2H7z",
  analytics: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
  cert: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  questions: "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"
};

const BACKEND_BASE = '/backend';

// Animaciones
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// Styled components
const PageWrapper = styled.div`
  min-height: 100vh;
  background: #0c1220;
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(8,145,178,0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 100%, rgba(20,182,203,0.06) 0%, transparent 60%);
`;

const Container = styled.div`
  padding: 3rem 2rem;
  max-width: 1400px;
  margin: 0 auto;

  @media (max-width: 767px) {
    padding: 1.5rem 1rem;
  }
`;

const PageHeader = styled.header`
  text-align: center;
  margin-bottom: 3rem;
  animation: ${fadeInUp} 0.6s ease-out;
`;

const PageTitle = styled.h1`
  font-size: 2.8rem;
  font-weight: 800;
  color: #F1F5F9;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;

  @media (max-width: 767px) {
    font-size: 1.6rem;
  }
`;

const PageSubtitle = styled.p`
  font-size: 1.15rem;
  color: #64748B;

  @media (max-width: 767px) {
    font-size: 1rem;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.5rem;

  @media (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(51, 65, 85, 0.4);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  animation: ${fadeInUp} 0.6s ease-out both;
  animation-delay: ${props => props.$delay || '0s'};

  &:hover {
    transform: translateY(-8px);
    border-color: rgba(8, 145, 178, 0.6);
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(8, 145, 178, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  &:hover .card-image-overlay {
    opacity: 1;
  }

  &:hover .card-image img {
    transform: scale(1.05);
  }
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, #1a2332 0%, #0f1923 100%);
  overflow: hidden;
`;

const CardImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
`;

const ImageOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.35s ease;
  display: flex;
  align-items: flex-end;
  padding: 1rem;
`;

const ImagePlaceholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #334155;
`;

const CardBody = styled.div`
  padding: 1.25rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const CardTitle = styled.h2`
  font-size: 1.2rem;
  font-weight: 700;
  color: #F1F5F9;
  margin: 0 0 0.6rem 0;
  line-height: 1.3;
  position: relative;
  padding-left: 1rem;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 2px;
    width: 3px;
    border-radius: 3px;
    background: linear-gradient(180deg, #0891B2, #22D3EE);
  }
`;

const CardDescription = styled.p`
  font-size: 0.9rem;
  color: #64748B;
  line-height: 1.5;
  margin: 0 0 1rem 0;
  flex-grow: 1;
  min-height: 42px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const MetaBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  background: ${props => props.$bg || 'rgba(51, 65, 85, 0.4)'};
  color: ${props => props.$color || '#94A3B8'};
  border: 1px solid ${props => props.$border || 'rgba(51, 65, 85, 0.5)'};
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.6rem;
  margin-top: auto;
`;

const ConsultLink = styled(Link)`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  color: #fff;
  background: linear-gradient(135deg, #0891B2 0%, #0e7490 100%);
  border: none;
  transition: all 0.25s ease;

  &:hover {
    background: linear-gradient(135deg, #06b6d4 0%, #0891B2 100%);
    box-shadow: 0 4px 16px rgba(8, 145, 178, 0.35);
    transform: translateY(-1px);
  }
`;

const AnalyticsBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem;
  border-radius: 10px;
  border: 1px solid rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.08);
  color: #10B981;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    background: rgba(16, 185, 129, 0.18);
    border-color: #10B981;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }
`;

const MentorLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0.7rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  text-decoration: none;
  color: #F59E0B;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.08);
  transition: all 0.25s ease;

  &:hover {
    background: rgba(245, 158, 11, 0.18);
    border-color: #F59E0B;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
  }
`;

const Icon = ({ path, size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d={path} />
  </svg>
);

const DocumentosPage = () => {
  const { user } = useAuth();
  const { speak } = useVoice();
  const navigate = useNavigate();

  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarDocumentos = async () => {
      try {
        const response = await consultaService.getDocumentos();
        setDocumentos(response.data || []);
      } catch (err) {
        setError('Error al cargar los documentos');
      } finally {
        setLoading(false);
      }
    };
    cargarDocumentos();
  }, []);

  const handleAnalytics = (documentId) => navigate(`/analytics/${documentId}`);
  const canViewAnalytics = user && (user.role === 'admin' || user.role === 'mentor');

  useEffect(() => {
    if (user && documentos.length > 0 && !loading) {
      const welcomeKey = `documentos_welcome_${user.id}`;
      const alreadyWelcomed = sessionStorage.getItem(welcomeKey);
      if (!alreadyWelcomed) {
        speak(`Hola ${user.nombre}, bienvenido. Selecciona un tema para comenzar.`);
        sessionStorage.setItem(welcomeKey, 'true');
      }
    }
  }, [user, documentos, loading, speak]);

  if (loading) return (
    <PageWrapper>
      <Container style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: '#64748B', fontSize: '1.1rem' }}>Cargando contenidos...</p>
      </Container>
    </PageWrapper>
  );

  if (error) return (
    <PageWrapper>
      <Container>
        <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>
      </Container>
    </PageWrapper>
  );

  return (
    <PageWrapper>
      <Container>
        <PageHeader>
          <PageTitle>Centro de Contenidos</PageTitle>
          <PageSubtitle>Selecciona un tema para iniciar una consulta interactiva.</PageSubtitle>
        </PageHeader>

        {documentos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#64748B' }}>No hay documentos disponibles.</p>
        ) : (
          <Grid>
            {documentos.map((doc, idx) => (
              <Card key={doc.id} $delay={`${idx * 0.08}s`}>
                <ImageContainer className="card-image">
                  {doc.imagen ? (
                    <CardImage
                      src={`${BACKEND_BASE}/${doc.imagen}`}
                      alt={doc.titulo}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <ImagePlaceholder>
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                      </svg>
                    </ImagePlaceholder>
                  )}
                  <ImageOverlay className="card-image-overlay">
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
                      Click para consultar
                    </span>
                  </ImageOverlay>
                </ImageContainer>

                <CardBody>
                  <CardTitle>{doc.titulo}</CardTitle>
                  <CardDescription>
                    {doc.descripcion || 'Sin descripción disponible.'}
                  </CardDescription>

                  <MetaRow>
                    <MetaBadge
                      $bg="rgba(8, 145, 178, 0.1)"
                      $color="#22D3EE"
                      $border="rgba(8, 145, 178, 0.3)"
                    >
                      <Icon path={ICONS.questions} size={13} />
                      {doc.preguntas_por_evaluacion || 10} Preguntas
                    </MetaBadge>
                    <MetaBadge>
                      {doc.max_intentos || 3} Intentos
                    </MetaBadge>
                    {doc.tiene_certificado && (
                      <MetaBadge
                        $bg="rgba(16, 185, 129, 0.1)"
                        $color="#34D399"
                        $border="rgba(16, 185, 129, 0.3)"
                      >
                        <Icon path={ICONS.cert} size={13} />
                        Certificado
                      </MetaBadge>
                    )}
                  </MetaRow>

                  <ButtonRow>
                    <ConsultLink to={`/consulta/${doc.id}`}>
                      <Icon path={ICONS.consult} size={18} />
                      Consultar
                    </ConsultLink>
                    {Number(doc.modo_mentor) === 1 && (
                      <MentorLink to={`/mentor/${doc.id}`} title="Modo Mentor 2.0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
                        </svg>
                        Mentor
                      </MentorLink>
                    )}
                    {canViewAnalytics && (
                      <AnalyticsBtn
                        onClick={() => handleAnalytics(doc.id)}
                        title="Ver analíticas"
                      >
                        <Icon path={ICONS.analytics} size={20} />
                      </AnalyticsBtn>
                    )}
                  </ButtonRow>
                </CardBody>
              </Card>
            ))}
          </Grid>
        )}
      </Container>
    </PageWrapper>
  );
};

export default DocumentosPage;
