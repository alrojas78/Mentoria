import React, { useState, useEffect } from 'react';
import { adminService, voiceService } from '../../services/api';
import { toast } from 'react-toastify';
import styled from 'styled-components';

const Container = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  color: #2b4361;
  margin-bottom: 1.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  margin-bottom: 1rem;
`;

const Button = styled.button`
  background-color: #2b4361;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.75rem 1.5rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 1rem;
  margin-right: 1rem;
  
  &:hover {
    background-color: #1e2e45;
  }
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const SecondaryButton = styled(Button)`
  background-color: #6c757d;
  
  &:hover {
    background-color: #5a6268;
  }
`;

const VoiceServiceAdmin = () => {
  const [config, setConfig] = useState({
    service: 'polly',
    voice_id: 'Lupe'
  });
  
  const [voices, setVoices] = useState({
    polly: [],
    elevenlabs: []
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const response = await adminService.getVoiceService();
        if (response.data) {
          setConfig(response.data);
        }
        
        // Cargar voces disponibles para ambos servicios
        const [pollyResponse, elevenLabsResponse] = await Promise.all([
          adminService.getAvailableVoices('polly'),
          adminService.getAvailableVoices('elevenlabs')
        ]);
        
        setVoices({
          polly: pollyResponse.data.voices || [],
          elevenlabs: elevenLabsResponse.data.voices || []
        });
        
      } catch (error) {
        console.error('Error al cargar configuración:', error);
        toast.error('Error al cargar la configuración');
      } finally {
        setLoading(false);
      }
    };
    
    loadConfig();
  }, []);
  
  // Manejar cambio de servicio
  const handleServiceChange = (e) => {
    const service = e.target.value;
    setConfig(prev => ({
      ...prev,
      service,
      // Establecer voz por defecto al cambiar de servicio
      voice_id: service === 'polly' 
        ? (voices.polly.length > 0 ? voices.polly[0].name : 'Lupe')
        : (voices.elevenlabs.length > 0 ? voices.elevenlabs[0].voice_id : 'EXAVITQu4vr4xnSDxMaL')
    }));
  };
  
  // Manejar cambio de voz
  const handleVoiceChange = (e) => {
    setConfig(prev => ({
      ...prev,
      voice_id: e.target.value
    }));
  };
  
  // Guardar configuración
  const handleSave = async () => {
    setSaving(true);
    try {
      await adminService.updateVoiceService(config);
      toast.success('Configuración guardada con éxito');
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };
  
  // Probar voz actual
  const handleTestVoice = async () => {
    try {
      await voiceService.speak('Esta es una prueba del servicio de voz configurado', {
        forceService: config.service,
        voiceId: config.voice_id
      });
      toast.info('Reproduciendo audio de prueba');
    } catch (error) {
      console.error('Error al probar voz:', error);
      toast.error('Error al probar la voz');
    }
  };
  
  if (loading) {
    return <Container><p>Cargando configuración...</p></Container>;
  }
  
  // Obtener las voces actuales según el servicio
  const currentVoices = config.service === 'polly' ? voices.polly : voices.elevenlabs;
  const voiceIdField = config.service === 'polly' ? 'name' : 'voice_id';
  
  return (
    <Container>
      <Title>Configuración del Servicio de Voz</Title>
      
      <FormGroup>
        <Label>Servicio a utilizar</Label>
        <Select value={config.service} onChange={handleServiceChange}>
          <option value="polly">Amazon Polly</option>
          <option value="elevenlabs">ElevenLabs</option>
        </Select>
        
        <p>
          {config.service === 'polly' 
            ? 'Amazon Polly ofrece voces de buena calidad con baja latencia. Ideal para uso general.' 
            : 'ElevenLabs ofrece voces más naturales y expresivas. Mayor calidad pero puede tener mayor latencia.'}
        </p>
      </FormGroup>
      
      <FormGroup>
        <Label>Voz a utilizar</Label>
        <Select value={config.voice_id} onChange={handleVoiceChange}>
          {currentVoices.map(voice => (
            <option 
              key={voice[voiceIdField] || voice.id} 
              value={voice[voiceIdField] || voice.id}
            >
              {voice.name} {voice.language ? `(${voice.language})` : ''}
            </option>
          ))}
        </Select>
      </FormGroup>
      
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </Button>
      
      <SecondaryButton onClick={handleTestVoice}>
        Probar Voz
      </SecondaryButton>
    </Container>
  );
};

export default VoiceServiceAdmin;