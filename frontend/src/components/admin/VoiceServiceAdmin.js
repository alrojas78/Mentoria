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

const SectionTitle = styled.h3`
  color: #2b4361;
  margin: 1.5rem 0 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
  font-size: 1.1rem;
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

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const RadioLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 2px solid ${props => props.$active ? '#0891B2' : '#e5e7eb'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$active ? 'rgba(8, 145, 178, 0.05)' : 'white'};

  &:hover {
    border-color: #0891B2;
  }

  input {
    margin-top: 3px;
  }
`;

const RadioInfo = styled.div`
  flex: 1;

  strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #1e293b;
  }

  span {
    font-size: 0.85rem;
    color: #64748b;
  }
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

const REALTIME_VOICES = [
  { id: 'sage', name: 'Sage', desc: 'Clara y profesional' },
  { id: 'coral', name: 'Coral', desc: 'Calida y amigable' },
  { id: 'alloy', name: 'Alloy', desc: 'Neutral y versatil' },
  { id: 'ash', name: 'Ash', desc: 'Firme y directa' },
  { id: 'ballad', name: 'Ballad', desc: 'Expresiva y melodica' },
  { id: 'echo', name: 'Echo', desc: 'Suave y serena' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Brillante y energica' },
  { id: 'verse', name: 'Verse', desc: 'Articulada y precisa' }
];

const CorrectionRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const CorrectionInput = styled.input`
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
`;

const SmallButton = styled.button`
  padding: 0.4rem 0.6rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  background: ${props => props.$danger ? '#dc3545' : '#0891B2'};
  color: white;

  &:hover {
    opacity: 0.85;
  }
`;

const HelpText = styled.p`
  font-size: 0.82rem;
  color: #64748b;
  margin: 0.5rem 0 1rem;
  line-height: 1.4;
`;

const VoiceServiceAdmin = () => {
  const [config, setConfig] = useState({
    service: 'polly',
    voice_id: 'Lupe',
    voice_mode: 'realtime',
    realtime_voice: 'sage',
    realtime_model: 'gpt-4o-realtime-preview-2024-12-17'
  });

  const [voices, setVoices] = useState({
    polly: [],
    elevenlabs: []
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Correcciones STT
  const [sttCorrections, setSttCorrections] = useState([]);
  const [savingSTT, setSavingSTT] = useState(false);

  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const response = await adminService.getVoiceService();
        if (response.data) {
          setConfig(prev => ({
            ...prev,
            ...response.data
          }));
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

        // Cargar correcciones STT
        try {
          const sttRes = await adminService.getSttCorrections();
          setSttCorrections(sttRes.data.corrections || []);
        } catch (e) {
          console.error('Error cargando correcciones STT:', e);
        }

      } catch (error) {
        console.error('Error al cargar configuración:', error);
        toast.error('Error al cargar la configuración');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Manejar cambio de modo de voz
  const handleVoiceModeChange = (mode) => {
    setConfig(prev => ({ ...prev, voice_mode: mode }));
  };

  // Manejar cambio de servicio TTS (para fallback/texto)
  const handleServiceChange = (e) => {
    const service = e.target.value;
    setConfig(prev => ({
      ...prev,
      service,
      voice_id: service === 'polly'
        ? (voices.polly.length > 0 ? voices.polly[0].name : 'Lupe')
        : (voices.elevenlabs.length > 0 ? voices.elevenlabs[0].voice_id : 'EXAVITQu4vr4xnSDxMaL')
    }));
  };

  // Manejar cambio de voz TTS
  const handleVoiceChange = (e) => {
    setConfig(prev => ({ ...prev, voice_id: e.target.value }));
  };

  // Manejar cambio de voz realtime
  const handleRealtimeVoiceChange = (e) => {
    setConfig(prev => ({ ...prev, realtime_voice: e.target.value }));
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

  // Probar voz TTS actual
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

  // Obtener las voces actuales según el servicio TTS
  const currentVoices = config.service === 'polly' ? voices.polly : voices.elevenlabs;
  const voiceIdField = config.service === 'polly' ? 'name' : 'voice_id';

  return (
    <Container>
      <Title>Configuración del Servicio de Voz</Title>

      {/* Modo de voz principal */}
      <FormGroup>
        <Label>Modo de interacción por voz</Label>
        <RadioGroup>
          <RadioLabel $active={config.voice_mode === 'realtime'}>
            <input
              type="radio"
              name="voice_mode"
              checked={config.voice_mode === 'realtime'}
              onChange={() => handleVoiceModeChange('realtime')}
            />
            <RadioInfo>
              <strong>OpenAI Realtime (Recomendado)</strong>
              <span>Conversación bidireccional en tiempo real. Voz nativa, baja latencia, VAD automático. El estudiante habla y MentorIA responde por voz directamente.</span>
            </RadioInfo>
          </RadioLabel>

          <RadioLabel $active={config.voice_mode === 'polly'}>
            <input
              type="radio"
              name="voice_mode"
              checked={config.voice_mode === 'polly'}
              onChange={() => handleVoiceModeChange('polly')}
            />
            <RadioInfo>
              <strong>Amazon Polly (Texto)</strong>
              <span>Flujo texto: Whisper transcribe, GPT responde, Polly sintetiza audio. Mayor control pero más latencia.</span>
            </RadioInfo>
          </RadioLabel>

          <RadioLabel $active={config.voice_mode === 'elevenlabs'}>
            <input
              type="radio"
              name="voice_mode"
              checked={config.voice_mode === 'elevenlabs'}
              onChange={() => handleVoiceModeChange('elevenlabs')}
            />
            <RadioInfo>
              <strong>ElevenLabs (Texto)</strong>
              <span>Flujo texto: Whisper transcribe, GPT responde, ElevenLabs sintetiza. Voces muy naturales pero mayor latencia.</span>
            </RadioInfo>
          </RadioLabel>
        </RadioGroup>
      </FormGroup>

      {/* Configuración Realtime */}
      {config.voice_mode === 'realtime' && (
        <>
          <SectionTitle>Configuración Realtime</SectionTitle>
          <FormGroup>
            <Label>Voz de MentorIA (Realtime)</Label>
            <Select value={config.realtime_voice} onChange={handleRealtimeVoiceChange}>
              {REALTIME_VOICES.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.desc}
                </option>
              ))}
            </Select>
          </FormGroup>
        </>
      )}

      {/* Configuración TTS (siempre visible como fallback) */}
      <SectionTitle>
        {config.voice_mode === 'realtime'
          ? 'Servicio TTS de respaldo (modo texto)'
          : 'Configuración del servicio TTS'}
      </SectionTitle>

      <FormGroup>
        <Label>Servicio a utilizar</Label>
        <Select value={config.service} onChange={handleServiceChange}>
          <option value="polly">Amazon Polly</option>
          <option value="elevenlabs">ElevenLabs</option>
        </Select>

        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
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
        Probar Voz TTS
      </SecondaryButton>

      {/* Correcciones STT */}
      <SectionTitle>Correcciones de Transcripción (STT)</SectionTitle>
      <HelpText>
        Cuando el reconocimiento de voz transcribe mal un término (ej: "Bosama" en vez de "Vozama"),
        agrega una corrección aquí. Se aplica automáticamente al guardar las consultas de sesiones de voz.
      </HelpText>

      {sttCorrections.map((corr, idx) => (
        <CorrectionRow key={idx}>
          <CorrectionInput
            placeholder="Término incorrecto"
            value={corr.incorrecto}
            onChange={(e) => {
              const updated = [...sttCorrections];
              updated[idx] = { ...updated[idx], incorrecto: e.target.value };
              setSttCorrections(updated);
            }}
          />
          <span style={{ color: '#64748b' }}>→</span>
          <CorrectionInput
            placeholder="Término correcto"
            value={corr.correcto}
            onChange={(e) => {
              const updated = [...sttCorrections];
              updated[idx] = { ...updated[idx], correcto: e.target.value };
              setSttCorrections(updated);
            }}
          />
          <SmallButton $danger onClick={() => {
            setSttCorrections(sttCorrections.filter((_, i) => i !== idx));
          }}>X</SmallButton>
        </CorrectionRow>
      ))}

      <SmallButton onClick={() => setSttCorrections([...sttCorrections, { incorrecto: '', correcto: '' }])}
        style={{ marginBottom: '1rem' }}>
        + Agregar corrección
      </SmallButton>

      <div>
        <Button onClick={async () => {
          setSavingSTT(true);
          try {
            const valid = sttCorrections.filter(c => c.incorrecto.trim() && c.correcto.trim());
            await adminService.updateSttCorrections(valid);
            setSttCorrections(valid);
            toast.success(`${valid.length} correcciones guardadas`);
          } catch (err) {
            toast.error('Error al guardar correcciones');
          } finally {
            setSavingSTT(false);
          }
        }} disabled={savingSTT}>
          {savingSTT ? 'Guardando...' : 'Guardar Correcciones STT'}
        </Button>
      </div>
    </Container>
  );
};

export default VoiceServiceAdmin;
