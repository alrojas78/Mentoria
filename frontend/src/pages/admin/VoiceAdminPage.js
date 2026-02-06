import React from 'react';
import styled from 'styled-components';
import VoiceServiceAdmin from '../../components/admin/VoiceServiceAdmin';

const Container = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 1rem;
`;

const Title = styled.h1`
  color: #2b4361;
  margin-bottom: 2rem;
`;

const VoiceAdminPage = () => {
  return (
    <Container>
      <Title>Administración de Servicios de Voz</Title>
      <VoiceServiceAdmin />
    </Container>
  );
};

export default VoiceAdminPage;