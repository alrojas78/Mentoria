// src/pages/CertificadosPage.js
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../contexts/AuthContext';

const Container = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 2rem;
  font-family: 'Segoe UI', sans-serif;
`;

const Title = styled.h1`
  color: #2b4361;
  font-size: 2rem;
  margin-bottom: 1rem;
`;

const CertList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
`;

const CertCard = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
  text-align: center;
  border: 1px solid #e0e0e0;
`;

const CertTitle = styled.h3`
  color: #2b4361;
  font-size: 1.1rem;
`;

const Button = styled.a`
  display: inline-block;
  margin-top: 1rem;
  background-color: #2b4361;
  color: white;
  padding: 0.5rem 1.2rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    background-color: #1e2e45;
  }
`;

const CertificadosPage = () => {
  const { user } = useAuth();
  const [certificados, setCertificados] = useState([]);

  useEffect(() => {
    const fetchCerts = async () => {
      try {
        const res = await fetch(`https://voicemed.edtechsm.com/backend/api/certificados.php?user_id=${user.id}`);
        const data = await res.json();
        setCertificados(data);
      } catch (e) {
        console.error('Error al cargar certificados:', e);
      }
    };
    fetchCerts();
  }, [user]);

  return (
    <Container>
      <Title>📄 Tus Certificados</Title>
      <CertList>
        {certificados.length > 0 ? certificados.map(cert => (
          <CertCard key={cert.id}>
            <CertTitle>{cert.course_title}</CertTitle>
            <p>Finalizado: {cert.fecha}</p>
            <Button
              href={`https://voicemed.edtechsm.com/backend/certificado.php?user_id=${user.id}&course_id=${cert.course_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Descargar PDF
            </Button>
          </CertCard>
        )) : <p>No has completado cursos aún.</p>}
      </CertList>
    </Container>
  );
};

export default CertificadosPage;
