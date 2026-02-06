// DocumentosPage.js - DISEÑO DE GRILLA TECNOLÓGICA Y ELEGANTE
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { consultaService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';

// Componente de Icono
const Icon = ({ path, size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d={path} />
  </svg>
);

// Iconos SVG
const ICONS = {
  consult: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5v-6h14v6zM7 11h2v2H7z",
  analytics: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z",
  tag: "M17.63 5.84C17.27 5.48 16.8 5.27 16.27 5.27H9.27C8.16 5.27 7.27 6.16 7.27 7.27v7c0 .53.21 1 .57 1.37l6.36 6.36c.36.36.86.57 1.37.57.5 0 1-.21 1.37-.57l6.36-6.36c.36-.36.57-.86.57-1.37V9.27c0-.53-.21-1-.57-1.37l-6.37-6.36z"
};

const DocumentosPage = () => {
  const { user } = useAuth();
  const { speak } = useVoice();
  const navigate = useNavigate();

  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const hoverTimeoutRef = useRef(null);

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

  const handleMouseEnter = (text) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => speak(text), 350);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;
  if (error) return <div style={{ padding: '2rem', color: 'var(--color-accent-red)' }}>{error}</div>;

  return (
    <>
      <style>{`
        :root {
          --color-background: #121826;
          --color-surface: rgba(30, 41, 59, 0.7); /* Superficie semi-transparente */
          --color-border: rgba(51, 65, 85, 0.5);
          --color-border-hover: rgba(8, 145, 178, 0.7);
          --color-primary: #0891B2;
          --color-primary-light: #22D3EE;
          --color-text-primary: #F1F5F9;
          --color-text-secondary: #94A3B8;
          --color-accent-green: #10B981;
          --font-family: 'Inter', sans-serif;
        }
        body {
          font-family: var(--font-family);
          background-color: var(--color-background);
          color: var(--color-text-primary);
        }
        .card-border-gradient {
          border-image-source: linear-gradient(to bottom right, var(--color-border), transparent);
          border-image-slice: 1;
        }
        .card-border-gradient:hover {
          border-image-source: linear-gradient(to bottom right, var(--color-primary), var(--color-primary-light));
        }
      `}</style>
    
      <div style={{ padding: '3rem 2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: '2.8rem', fontWeight: '800', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Centro de Contenidos
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)' }}>
            Selecciona un tema para iniciar una consulta interactiva.
          </p>
        </header>
        
        {documentos.length === 0 ? (
          <p style={{ textAlign: 'center' }}>No hay documentos disponibles.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
            {documentos.map(doc => (
              <div key={doc.id}
                onMouseEnter={() => handleMouseEnter(doc.titulo)}
                onMouseLeave={handleMouseLeave}
                className="card-border-gradient"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px',
                  border: '1px solid',
                  padding: '1.5rem',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-image-source 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <h2 style={{ fontSize: '1.3rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: '0 0 0.75rem 0', borderLeft: '3px solid var(--color-primary)', paddingLeft: '1rem' }}>
                  {doc.titulo}
                </h2>
                <p style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 1.5rem 0', flexGrow: 1, minHeight: '60px' }}>
                  {doc.descripcion || 'Sin descripción disponible.'}
                </p>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Preguntas por evaluación">
                      <strong>{doc.preguntas_por_evaluacion || 10}</strong> Preguntas
                    </span>
                    <span style={{ margin: '0 0.25rem' }}>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Intentos máximos">
                      <strong>{doc.max_intentos || 3}</strong> Intentos
                    </span>
                    {doc.tiene_certificado && <>
                      <span style={{ margin: '0 0.25rem' }}>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-accent-green)' }} title="Incluye certificado">
                        <Icon path={ICONS.tag} size={16} /> Certificado
                      </span>
                    </>}
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                  <Link to={`/consulta/${doc.id}`}
                    style={{
                      flex: 1, backgroundColor: 'var(--color-primary)', color: 'var(--color-text-primary)', textDecoration: 'none',
                      padding: '0.75rem 1rem', borderRadius: '8px', fontWeight: '600',
                      transition: 'background-color 0.2s, transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                    onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = '#06b6d4'; e.currentTarget.style.transform = 'scale(1.02)';}}
                    onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = 'var(--color-primary)'; e.currentTarget.style.transform = 'scale(1)';}}
                  >
                    <Icon path={ICONS.consult} size={18} />
                    Consultar
                  </Link>
                  {canViewAnalytics && (
                    <button onClick={() => handleAnalytics(doc.id)}
                      style={{
                        backgroundColor: 'var(--color-surface)', color: 'var(--color-accent-green)', border: '1px solid var(--color-accent-green)',
                        borderRadius: '8px', padding: '0.75rem', cursor: 'pointer',
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                      }}
                      onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';}}
                      onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = 'var(--color-surface)';}}
                      title="Ver analíticas"
                    >
                       <Icon path={ICONS.analytics} size={20} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default DocumentosPage;