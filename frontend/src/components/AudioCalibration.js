// src/components/AudioCalibration.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useVoice } from '../contexts/VoiceContext';
import { FaMicrophone, FaCheck, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

// ============= ESTILOS =============

const CalibrationContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
`;

const Title = styled.h3`
  margin: 0;
  color: #2b4361;
  font-size: 1.1rem;
`;

const IconWrapper = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${props => props.color || '#2b4361'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.1rem;
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: ${props => {
    if (props.quality === 'good') return '#d4edda';
    if (props.quality === 'fair') return '#fff3cd';
    return '#f8d7da';
  }};
  border-radius: 8px;
  margin-bottom: 1.25rem;
  border: 1px solid ${props => {
    if (props.quality === 'good') return '#c3e6cb';
    if (props.quality === 'fair') return '#ffeaa7';
    return '#f5c6cb';
  }};
`;

const StatusIcon = styled.div`
  font-size: 1.5rem;
  color: ${props => {
    if (props.quality === 'good') return '#155724';
    if (props.quality === 'fair') return '#856404';
    return '#721c24';
  }};
`;

const StatusText = styled.div`
  flex: 1;
`;

const StatusTitle = styled.div`
  font-weight: 600;
  color: ${props => {
    if (props.quality === 'good') return '#155724';
    if (props.quality === 'fair') return '#856404';
    return '#721c24';
  }};
  margin-bottom: 0.25rem;
`;

const StatusDescription = styled.div`
  font-size: 0.9rem;
  color: ${props => {
    if (props.quality === 'good') return '#155724';
    if (props.quality === 'fair') return '#856404';
    return '#721c24';
  }};
`;

const NoiseMeter = styled.div`
  margin-bottom: 1.5rem;
`;

const MeterLabel = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #6b7280;
`;

const MeterBar = styled.div`
  width: 100%;
  height: 24px;
  background: #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
`;

const MeterFill = styled.div`
  height: 100%;
  width: ${props => Math.min(props.level, 100)}%;
  background: ${props => {
    if (props.level < 25) return 'linear-gradient(90deg, #10b981, #34d399)';
    if (props.level < 50) return 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    return 'linear-gradient(90deg, #ef4444, #f87171)';
  }};
  transition: width 0.3s ease, background 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 0.5rem;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
`;

const SensitivityControl = styled.div`
  margin-bottom: 1.5rem;
`;

const ControlLabel = styled.label`
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
`;

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Slider = styled.input`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #2b4361;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.2);
    }
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #2b4361;
    cursor: pointer;
    border: none;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.2);
    }
  }
`;

const SliderValue = styled.div`
  min-width: 50px;
  text-align: center;
  font-weight: 600;
  color: #2b4361;
  font-size: 0.95rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
`;

const Button = styled.button`
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  ${props => props.primary ? `
    background: #2b4361;
    color: white;
    &:hover {
      background: #1e2f47;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  ` : `
    background: #e5e7eb;
    color: #374151;
    &:hover {
      background: #d1d5db;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }
`;

const InfoBox = styled.div`
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
  font-size: 0.9rem;
  color: #1e40af;
  line-height: 1.5;
`;

// ============= COMPONENTE =============

const AudioCalibration = ({ onClose }) => {
  const {
    audioInitialized,
    noiseLevel,
    sensitivity,
    audioQuality,
    setSensitivity,
    initializeAudioProcessing,
    analyzeNoise
  } = useVoice();

  const isIOS = (() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOSUserAgent = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isIOSPlatform = /iPad|iPhone|iPod/.test(navigator.platform) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOSSafari = /Safari/.test(userAgent) && 
                        /Apple/.test(navigator.vendor) &&
                        !(/Chrome|CriOS|FxiOS|EdgiOS/.test(userAgent));
    return isIOSUserAgent || isIOSPlatform || isIOSSafari;
  })();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localSensitivity, setLocalSensitivity] = useState(sensitivity);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Sincronizar sensibilidad local con la del contexto
  useEffect(() => {
    setLocalSensitivity(sensitivity);
  }, [sensitivity]);

  // Analizar ruido al montar el componente si el audio ya está inicializado
  useEffect(() => {
    if (audioInitialized && !analysisResult) {
      handleAnalyze();
    }
  }, [audioInitialized]);

const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        // Inicializar audio SOLO para análisis
        if (!audioInitialized) {
            console.log('🎤 Inicializando audio solo para análisis...');
            await initializeAudioProcessing();
        }

        // Analizar ruido
        const result = await analyzeNoise();
        setAnalysisResult(result);
        
        console.log('📊 Análisis completado:', result);
        
        // Dar recomendación pero NO aplicar cambios automáticamente
        if (result.noiseLevel > 50) {
            console.log('⚠️ Mucho ruido detectado');
            console.log('💡 Recomendación: Aumenta la sensibilidad manualmente a 1.8-2.0x');
        } else if (result.noiseLevel > 25) {
            console.log('⚡ Ruido moderado detectado');
            console.log('💡 Recomendación: Sensibilidad de 1.5-1.7x debería funcionar');
        } else {
            console.log('✅ Ambiente óptimo - sensibilidad normal (1.0-1.3x) es suficiente');
        }
        
    } catch (error) {
        console.error('Error al analizar:', error);
    } finally {
        setIsAnalyzing(false);
    }
};

  const handleSensitivityChange = (e) => {
    const value = parseFloat(e.target.value);
    setLocalSensitivity(value);
  };

  const handleApply = () => {
    setSensitivity(localSensitivity);
    console.log(`✅ Sensibilidad aplicada: ${localSensitivity}`);
  };

  const getQualityInfo = () => {
    if (!audioQuality && !analysisResult) {
      return {
        icon: <FaMicrophone />,
        color: '#6b7280',
        title: 'No analizado',
        description: 'Presiona "Analizar Ambiente" para verificar la calidad del audio'
      };
    }

    const quality = audioQuality || 'good';
    const level = analysisResult?.noiseLevel || noiseLevel || 0;

    if (quality === 'good' || level < 25) {
      return {
        icon: <FaCheck />,
        color: '#10b981',
        title: 'Excelente calidad',
        description: 'El ambiente es ideal para el reconocimiento de voz'
      };
    } else if (quality === 'fair' || level < 50) {
      return {
        icon: <FaExclamationTriangle />,
        color: '#f59e0b',
        title: 'Calidad aceptable',
        description: 'Se detecta ruido moderado. Considera acercarte al micrófono'
      };
    } else {
      return {
        icon: <FaTimes />,
        color: '#ef4444',
        title: 'Mucho ruido ambiente',
        description: 'Busca un lugar más silencioso para mejor reconocimiento'
      };
    }
  };

  const qualityInfo = getQualityInfo();
  const displayNoiseLevel = analysisResult?.noiseLevel || noiseLevel || 0;

    if (isIOS) {
    return (
      <CalibrationContainer>
        <Header>
          <IconWrapper color="#2b4361">
            <FaMicrophone />
          </IconWrapper>
          <Title>Calibración de Audio</Title>
        </Header>

        <InfoBox style={{ background: '#fff3cd', borderColor: '#ffc107', color: '#856404' }}>
          <strong>🍎 Dispositivo iOS Detectado</strong>
          <p style={{ margin: '0.5rem 0 0 0' }}>
            En dispositivos iOS (iPhone/iPad), Safari usa su propio sistema de procesamiento 
            de audio optimizado. La calibración manual no está disponible, pero el sistema 
            funciona correctamente con la configuración nativa de iOS.
          </p>
          <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
            <li>Habla cerca del micrófono (15-30 cm)</li>
            <li>Busca lugares silenciosos para mejor reconocimiento</li>
            <li>Habla claro y a velocidad normal</li>
          </ul>
        </InfoBox>

        {onClose && (
          <Button onClick={onClose} style={{ marginTop: '1rem' }}>
            Cerrar
          </Button>
        )}
      </CalibrationContainer>
    );
  }


  return (
    <CalibrationContainer>
      <Header>
        <IconWrapper color={qualityInfo.color}>
          {qualityInfo.icon}
        </IconWrapper>
        <Title>Calibración de Audio</Title>
      </Header>

      <StatusBar quality={audioQuality}>
        <StatusIcon quality={audioQuality}>
          {qualityInfo.icon}
        </StatusIcon>
        <StatusText>
          <StatusTitle quality={audioQuality}>
            {qualityInfo.title}
          </StatusTitle>
          <StatusDescription quality={audioQuality}>
            {qualityInfo.description}
          </StatusDescription>
        </StatusText>
      </StatusBar>

      <NoiseMeter>
        <MeterLabel>
          <span>Nivel de Ruido Ambiente</span>
          <span>{displayNoiseLevel.toFixed(1)} / 100</span>
        </MeterLabel>
        <MeterBar>
          <MeterFill level={displayNoiseLevel}>
            {displayNoiseLevel > 10 && `${displayNoiseLevel.toFixed(0)}%`}
          </MeterFill>
        </MeterBar>
      </NoiseMeter>

      <SensitivityControl>
        <ControlLabel>
          Sensibilidad del Micrófono
        </ControlLabel>
        <SliderContainer>
          <Slider
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={localSensitivity}
            onChange={handleSensitivityChange}
          />
          <SliderValue>
            {localSensitivity.toFixed(1)}x
          </SliderValue>
        </SliderContainer>
      </SensitivityControl>

      <ButtonGroup>
        <Button onClick={handleAnalyze} disabled={isAnalyzing} primary>
          <FaMicrophone />
          {isAnalyzing ? 'Analizando...' : 'Analizar Ambiente'}
        </Button>
        <Button onClick={handleApply} disabled={localSensitivity === sensitivity}>
          <FaCheck />
          Aplicar
        </Button>
      </ButtonGroup>

      {onClose && (
        <Button onClick={onClose} style={{ marginTop: '0.75rem' }}>
          Cerrar
        </Button>
      )}

      <InfoBox>
        <strong>💡 Consejos:</strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
          <li>En lugares ruidosos, aumenta la sensibilidad a 1.8-2.0x</li>
          <li>Habla cerca del micrófono (15-30 cm)</li>
          <li>Evita cubrir el micrófono con la mano</li>
          <li>En lugares silenciosos, sensibilidad 1.0-1.3x es suficiente</li>
        </ul>
      </InfoBox>
    </CalibrationContainer>
  );
};

export default AudioCalibration;