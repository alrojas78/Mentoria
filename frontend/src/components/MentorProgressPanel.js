// MentorProgressPanel.js - Panel de progreso del modo mentor
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { consultaService } from '../services/api';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ProgressCard = styled.div`
  background: rgba(74, 144, 226, 0.1);
  border: 1px solid rgba(74, 144, 226, 0.3);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
`;

const ProgressTitle = styled.div`
  color: #93C5FD;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CurrentPosition = styled.div`
  color: #F1F5F9;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
`;

const ProgressStats = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(74, 144, 226, 0.2);
`;

const StatItem = styled.div`
  flex: 1;
  text-align: center;
`;

const StatValue = styled.div`
  color: #93C5FD;
  font-size: 1.2rem;
  font-weight: bold;
`;

const StatLabel = styled.div`
  color: #94A3B8;
  font-size: 0.7rem;
  margin-top: 2px;
`;

const ModulesTree = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ModuleItem = styled.div`
  background: rgba(30, 41, 59, 0.5);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid ${props => props.isActive ? 'rgba(74, 144, 226, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
`;

const ModuleHeader = styled.div`
  padding: 12px;
  background: ${props => props.isActive ? 'rgba(74, 144, 226, 0.2)' : 'transparent'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.2s ease;
  
  &:hover {
    background: rgba(74, 144, 226, 0.15);
  }
`;

const ModuleIcon = styled.div`
  font-size: 1.2rem;
`;

const ModuleTitle = styled.div`
  flex: 1;
  color: ${props => props.isActive ? '#93C5FD' : '#E2E8F0'};
  font-size: 0.9rem;
  font-weight: 600;
`;

const ModuleBadge = styled.div`
  padding: 3px 8px;
  background: ${props => {
    if (props.status === 'completed') return 'rgba(16, 185, 129, 0.3)';
    if (props.status === 'current') return 'rgba(74, 144, 226, 0.3)';
    return 'rgba(100, 116, 139, 0.3)';
  }};
  color: ${props => {
    if (props.status === 'completed') return '#6EE7B7';
    if (props.status === 'current') return '#93C5FD';
    return '#94A3B8';
  }};
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
`;

const LessonsContainer = styled.div`
  display: ${props => props.isOpen ? 'flex' : 'none'};
  flex-direction: column;
  background: rgba(15, 23, 42, 0.5);
`;

const LessonItem = styled.div`
  padding: 10px 16px 10px 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-left: 3px solid ${props => {
    if (props.status === 'completed') return '#10B981';
    if (props.status === 'current') return '#4A90E2';
    return 'transparent';
  }};
  background: ${props => props.status === 'current' ? 'rgba(74, 144, 226, 0.1)' : 'transparent'};
  transition: all 0.2s ease;

  /* Clickeable solo para lecciones completadas o actuales */
  cursor: ${props => (props.status === 'completed' || props.status === 'current') ? 'pointer' : 'default'};

  &:hover {
    background: ${props => (props.status === 'completed' || props.status === 'current')
      ? 'rgba(74, 144, 226, 0.15)'
      : 'rgba(74, 144, 226, 0.08)'};
  }

  &:active {
    transform: ${props => (props.status === 'completed' || props.status === 'current')
      ? 'scale(0.98)'
      : 'none'};
  }
`;

// Icono de reproducir para lecciones completadas
const PlayReplayIcon = styled.span`
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: #6EE7B7;

  ${LessonItem}:hover & {
    opacity: 1;
  }
`;

const LessonIcon = styled.div`
  font-size: 0.9rem;
`;

const LessonTitle = styled.div`
  flex: 1;
  color: ${props => {
    if (props.status === 'completed') return '#6EE7B7';
    if (props.status === 'current') return '#F1F5F9';
    return '#94A3B8';
  }};
  font-size: 0.85rem;
  font-weight: ${props => props.status === 'current' ? '600' : '400'};
`;

const LessonBadge = styled.div`
  font-size: 0.7rem;
  color: ${props => {
    if (props.status === 'completed') return '#6EE7B7';
    if (props.status === 'current') return '#93C5FD';
    return '#64748B';
  }};
  font-weight: 600;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 20px;
  color: #94A3B8;
  font-size: 0.85rem;
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 20px;
  color: #F87171;
  font-size: 0.85rem;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 30px 20px;
  color: #94A3B8;
  font-size: 0.85rem;
  line-height: 1.6;
`;

const MentorProgressPanel = ({ documentId, userId, refreshKey, onLessonClick }) => {

  const [progressData, setProgressData] = useState(null);
  const [expandedModules, setExpandedModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (documentId && userId) {
      loadMentorProgress();
    }
}, [documentId, userId, refreshKey]);

  const loadMentorProgress = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener progreso del mentor para el usuario actual
      const response = await consultaService.getMentorProgress(documentId, userId);
      
      console.log('📊 Respuesta completa del API:', response);
      console.log('📊 response.data:', response.data);
      
      // Tu API retorna { success: true, data: { ... } }
      // Entonces los datos están en response.data.data
      const progressData = response.data?.data || response.data;
      
      console.log('📊 Datos de progreso extraídos:', progressData);
      
      if (progressData && progressData.estructura_contenido) {
        setProgressData(progressData);
        
        // Auto-expandir el módulo actual
        if (progressData.modulo_actual) {
          setExpandedModules([progressData.modulo_actual]);
        }
      } else {
        setProgressData(null);
      }
      
    } catch (err) {
      console.error('Error cargando progreso del mentor:', err);
      setError('No se pudo cargar el progreso');
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (moduleNumber) => {
    setExpandedModules(prev => 
      prev.includes(moduleNumber)
        ? prev.filter(m => m !== moduleNumber)
        : [...prev, moduleNumber]
    );
  };

  const getLessonStatus = (moduleNum, lessonNum) => {
    if (!progressData) return 'pending';
    
    const { modulo_actual, leccion_actual, estado } = progressData;
    
    // ✅ SI EL PROGRAMA ESTÁ COMPLETADO, TODAS LAS LECCIONES ESTÁN COMPLETADAS
    if (estado === 'completado') {
      return 'completed';
    }
    
    // Lección actual
    if (moduleNum === modulo_actual && lessonNum === leccion_actual) {
      return 'current';
    }
    
    // Lecciones completadas (módulos anteriores o lecciones anteriores del módulo actual)
    if (moduleNum < modulo_actual) {
      return 'completed';
    }
    
    if (moduleNum === modulo_actual && lessonNum < leccion_actual) {
      return 'completed';
    }
    
    // Pendientes
    return 'pending';
  };

  const getModuleStatus = (moduleNum) => {
    if (!progressData) return 'pending';
    
    const { modulo_actual, estado } = progressData;
    
    // ✅ SI EL PROGRAMA ESTÁ COMPLETADO, TODOS LOS MÓDULOS ESTÁN COMPLETADOS
    if (estado === 'completado') {
      return 'completed';
    }
    
    if (moduleNum < modulo_actual) return 'completed';
    if (moduleNum === modulo_actual) return 'current';
    return 'pending';
  };

  const calculateProgress = () => {
    if (!progressData || !progressData.estructura_contenido) return { completed: 0, total: 0, percentage: 0, isCompleted: false };
    
    const estructura = progressData.estructura_contenido;
    const videosInfo = progressData.videos_info || {};
    let totalLessons = 0;
    let completedLessons = 0;
    
    if (estructura.modulos) {
      estructura.modulos.forEach(modulo => {
        if (modulo.lecciones) {
          totalLessons += modulo.lecciones.length;
          
          // Contar completadas
          if (modulo.numero < progressData.modulo_actual) {
            // Módulos anteriores: todas las lecciones completadas
            completedLessons += modulo.lecciones.length;
          } else if (modulo.numero === progressData.modulo_actual) {
            // Módulo actual:
            
            // Si el programa tiene videos, usar la info de videos completados
            if (videosInfo.tiene_videos && videosInfo.total_videos > 0) {
              // Calcular basándose en videos completados
              const leccionesPorModulo = modulo.lecciones.length;
              const videosCompletadosEsteModulo = videosInfo.videos_completados;
              
              // Si completó todos los videos de este módulo
              if (videosCompletadosEsteModulo >= leccionesPorModulo) {
                completedLessons += leccionesPorModulo;
              } else {
                completedLessons += videosCompletadosEsteModulo;
              }
            } else {
              // Sin videos: usar leccion_actual - 1
              completedLessons += Math.max(0, progressData.leccion_actual - 1);
            }
          }
        }
      });
    }
    
    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    
    // Considerar completado si:
    // 1. El estado es 'completado'
    // 2. Completó todas las lecciones
    // 3. Si tiene videos, completó todos los videos
    let isCompleted = progressData.estado === 'completado';
    if (!isCompleted && videosInfo.tiene_videos) {
      isCompleted = videosInfo.videos_completados >= totalLessons;
    } else if (!isCompleted) {
      isCompleted = completedLessons >= totalLessons;
    }
    
    return {
      completed: completedLessons,
      total: totalLessons,
      percentage: isCompleted ? 100 : percentage,
      isCompleted
    };
  };

  if (loading) {
    return <LoadingState>Cargando progreso del mentor...</LoadingState>;
  }

  if (error) {
    return <ErrorState>{error}</ErrorState>;
  }

  if (!progressData || !progressData.estructura_contenido) {
    return (
      <EmptyState>
        No hay progreso registrado aún.
        <br />
        Inicia el modo mentor para comenzar tu programa de estudio.
      </EmptyState>
    );
  }

  const progress = calculateProgress();
  const estructura = progressData.estructura_contenido;

  return (
    <Container>
      {/* Tarjeta de progreso actual */}
      <ProgressCard>
        {progress.isCompleted ? (
          <>
            <ProgressTitle>🎉 ¡Programa Completado!</ProgressTitle>
            <CurrentPosition>
              ¡Felicitaciones! Has completado todas las lecciones del programa.
            </CurrentPosition>
            <ProgressStats>
              <StatItem>
                <StatValue>100%</StatValue>
                <StatLabel>Completado</StatLabel>
              </StatItem>
              <StatItem>
                <StatValue>{progress.total}/{progress.total}</StatValue>
                <StatLabel>Lecciones</StatLabel>
              </StatItem>
            </ProgressStats>
          </>
        ) : (
          <>
            <ProgressTitle>📍 Posición Actual</ProgressTitle>
            <CurrentPosition>
              Módulo {progressData.modulo_actual} - Lección {progressData.leccion_actual}
            </CurrentPosition>
            <ProgressStats>
              <StatItem>
                <StatValue>{progress.percentage}%</StatValue>
                <StatLabel>Completado</StatLabel>
              </StatItem>
              <StatItem>
                <StatValue>{progress.completed}/{progress.total}</StatValue>
                <StatLabel>Lecciones</StatLabel>
              </StatItem>
            </ProgressStats>
          </>
        )}
      </ProgressCard>

      {/* Árbol de módulos y lecciones */}
      <ModulesTree>
        {estructura.modulos && estructura.modulos.map((modulo) => {
          const moduleStatus = getModuleStatus(modulo.numero);
          const isExpanded = expandedModules.includes(modulo.numero);
          const isActive = modulo.numero === progressData.modulo_actual;
          
          return (
            <ModuleItem key={modulo.numero} isActive={isActive}>
              <ModuleHeader 
                onClick={() => toggleModule(modulo.numero)}
                isActive={isActive}
              >
                <ModuleIcon>{isExpanded ? '📂' : '📁'}</ModuleIcon>
                <ModuleTitle isActive={isActive}>
                  {modulo.titulo || `Módulo ${modulo.numero}`}
                </ModuleTitle>
                <ModuleBadge status={moduleStatus}>
                  {moduleStatus === 'completed' && '✓ Completado'}
                  {moduleStatus === 'current' && 'En curso'}
                  {moduleStatus === 'pending' && 'Pendiente'}
                </ModuleBadge>
              </ModuleHeader>
              
              <LessonsContainer isOpen={isExpanded}>
                {modulo.lecciones && modulo.lecciones.map((leccion) => {
                  const lessonStatus = getLessonStatus(modulo.numero, leccion.numero);
                  const isClickable = lessonStatus === 'completed' || lessonStatus === 'current';

                  // Handler para click en lección
                  const handleLessonClick = () => {
                    if (isClickable && onLessonClick) {
                      onLessonClick({
                        moduleNumber: modulo.numero,
                        lessonNumber: leccion.numero,
                        lessonTitle: leccion.titulo || `Lección ${leccion.numero}`,
                        moduleTitle: modulo.titulo || `Módulo ${modulo.numero}`,
                        isCompleted: lessonStatus === 'completed',
                        isCurrent: lessonStatus === 'current',
                        videoId: leccion.video_id || null,
                        leccionData: leccion
                      });
                    }
                  };

                  return (
                    <LessonItem
                      key={`${modulo.numero}-${leccion.numero}`}
                      status={lessonStatus}
                      onClick={handleLessonClick}
                      title={isClickable ? (lessonStatus === 'completed' ? 'Click para repasar' : 'Lección actual') : ''}
                    >
                      <LessonIcon>
                        {lessonStatus === 'completed' && '✅'}
                        {lessonStatus === 'current' && '🔵'}
                        {lessonStatus === 'pending' && '⚪'}
                      </LessonIcon>
                      <LessonTitle status={lessonStatus}>
                        {leccion.titulo || `Lección ${leccion.numero}`}
                      </LessonTitle>
                      {lessonStatus === 'current' && (
                        <LessonBadge status="current">ACTUAL</LessonBadge>
                      )}
                      {lessonStatus === 'completed' && (
                        <PlayReplayIcon>▶ Ver</PlayReplayIcon>
                      )}
                    </LessonItem>
                  );
                })}
              </LessonsContainer>
            </ModuleItem>
          );
        })}
      </ModulesTree>
    </Container>
  );
};

export default MentorProgressPanel;
