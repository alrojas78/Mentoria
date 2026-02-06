// src/pages/DocumentAnalyticsPage.js
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { consultaService } from '../services/api';

// Importar componentes de analíticas
import DashboardContainer from '../components/Analytics/DashboardContainer';

const DocumentAnalyticsPage = () => {
  const { documentId } = useParams();
  const { user } = useAuth();
  const [documento, setDocumento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarDocumento();
  }, [documentId]);

  const cargarDocumento = async () => {
    try {
      const response = await consultaService.getDocumentById(documentId);
      setDocumento(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error al cargar documento:', err);
      setError('Error al cargar la información del documento');
      setLoading(false);
    }
  };

  // Verificar permisos
  if (!user || (user.role !== 'admin' && user.role !== 'mentor')) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Acceso denegado</h2>
        <p>No tienes permisos para ver estas analíticas.</p>
        <Link to="/documentos" style={{ color: '#2b4361' }}>Volver a documentos</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Cargando analíticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
        <Link to="/documentos" style={{ color: '#2b4361' }}>← Volver a documentos</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link 
          to="/documentos" 
          style={{ 
            color: '#2b4361', 
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            marginBottom: '1rem'
          }}
        >
          ← Volver a documentos
        </Link>
        
        <h1 style={{ color: '#2b4361', margin: 0 }}>
          📊 Analíticas del Documento
        </h1>
        
        {documento && (
          <div style={{ marginTop: '0.5rem' }}>
            <h2 style={{ color: '#6b7280', fontSize: '1.2rem', margin: 0 }}>
              {documento.titulo}
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
              {documento.descripcion}
            </p>
          </div>
        )}
        
        {/* Info de configuración */}
        {documento && (
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginTop: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            fontSize: '0.9rem'
          }}>
            <div>
              <strong>📝 Preguntas por evaluación:</strong> {documento.preguntas_por_evaluacion || 10}
            </div>
            <div>
              <strong>📊 Porcentaje de aprobación:</strong> {documento.porcentaje_aprobacion || 60}%
            </div>
            <div>
              <strong>🔄 Máximo de intentos:</strong> {documento.max_intentos || 3}
            </div>
            <div>
              <strong>🏆 Genera certificado:</strong> {documento.tiene_certificado ? 'Sí' : 'No'}
            </div>
          </div>
        )}
      </div>

      {/* Dashboard de analíticas */}
      <DashboardContainer documentId={documentId} />
    </div>
  );
};

export default DocumentAnalyticsPage;