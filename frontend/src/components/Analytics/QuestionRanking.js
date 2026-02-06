import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import analyticsService from '../../services/analyticsService';

const RankingContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  margin-bottom: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const FullWidthContainer = styled.div`
  grid-column: 1 / -1;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const CardTitle = styled.h3`
  margin: 0 0 20px 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
`;

const ModeSelector = styled.select`
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #4f46e5;
  }
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 14px;
  flex: 1;
  min-width: 200px;
  
  &:focus {
    outline: none;
    border-color: #4f46e5;
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 20px;
  font-weight: bold;
  color: #1f2937;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
`;

const QuestionList = styled.div`
  max-height: 600px;
  overflow-y: auto;
`;

const QuestionItem = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #f8fafc;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const QuestionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const PositionBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-weight: bold;
  color: white;
  font-size: 12px;
  flex-shrink: 0;
  
  ${props => {
    if (props.position <= 3) {
      const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
      return `background: ${colors[props.position - 1]};`;
    }
    return 'background: #6b7280;';
  }}
`;

const FrequencyBadge = styled.span`
  padding: 4px 8px;
  background: #4f46e5;
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
`;

const ModeBadge = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  
  ${props => {
    switch (props.mode) {
      case 'mentor':
        return 'background: #dbeafe; color: #1e40af;';
      case 'evaluacion':
        return 'background: #fef3c7; color: #92400e;';
      default:
        return 'background: #f3f4f6; color: #374151;';
    }
  }}
`;

const CategoryBadge = styled.span`
  padding: 4px 8px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
`;

const QuestionText = styled.div`
  color: #374151;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
  font-style: italic;
`;

const QuestionStats = styled.div`
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
`;

const LoadingContainer = styled.div`
  padding: 40px;
  text-align: center;
  color: #6b7280;
`;

const ErrorContainer = styled.div`
  padding: 40px;
  text-align: center;
  color: #ef4444;
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
`;

const ModalTitle = styled.h3`
  margin: 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 600;
  flex: 1;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  line-height: 1;

  &:hover {
    color: #374151;
  }
`;

const QuestionPreview = styled.div`
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-style: italic;
  color: #374151;
  font-size: 14px;
`;

const UsersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const UserItem = styled.div`
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 3px solid #4f46e5;
`;

const UserName = styled.div`
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
`;

const UserEmail = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
`;

const UserDates = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const DateChip = styled.span`
  font-size: 11px;
  padding: 4px 8px;
  background: #e5e7eb;
  border-radius: 4px;
  color: #374151;
`;

const ClickableCount = styled.span`
  cursor: pointer;
  color: #4f46e5;
  text-decoration: underline;

  &:hover {
    color: #3730a3;
  }
`;

const QuestionRanking = ({ documentId }) => {
  const [questions, setQuestions] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMode, setSelectedMode] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para el modal de usuarios
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [questionUsers, setQuestionUsers] = useState(null);

  const modeOptions = [
    { key: 'all', label: 'Todos los Modos' },
    { key: 'consulta', label: 'Modo Consulta' },
    { key: 'mentor', label: 'Modo Mentor' },
    { key: 'evaluacion', label: 'Modo Evaluación' }
  ];

  useEffect(() => {
    if (documentId) {
      loadQuestionRanking();
    }
  }, [documentId, selectedMode]);

  const loadQuestionRanking = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await analyticsService.getQuestionRanking(documentId, selectedMode, 50);
      setQuestions(data.ranking || []);
      setStatistics(data.estadisticas || {});
      
    } catch (err) {
      console.error('Error cargando ranking de preguntas:', err);
      setError('Error al cargar el ranking de preguntas');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getModeLabel = (mode) => {
    const labels = {
      consulta: 'Consulta',
      mentor: 'Mentor',
      evaluacion: 'Evaluación'
    };
    return labels[mode] || mode;
  };

  // Manejar click en el contador de usuarios
  const handleUserCountClick = async (question) => {
    setSelectedQuestion(question.pregunta);
    setModalOpen(true);
    setModalLoading(true);
    setQuestionUsers(null);

    try {
      const data = await analyticsService.getQuestionUsers(documentId, question.pregunta, selectedMode);
      setQuestionUsers(data);
    } catch (err) {
      console.error('Error cargando usuarios de la pregunta:', err);
      setQuestionUsers({ error: true, message: 'Error al cargar usuarios' });
    } finally {
      setModalLoading(false);
    }
  };

  // Formatear fecha y hora
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Cerrar modal
  const closeModal = () => {
    setModalOpen(false);
    setSelectedQuestion(null);
    setQuestionUsers(null);
  };

  // Filtrar preguntas por búsqueda
const ignoredPhrases = [
    'estoy listo',
    'activar modo',
    'saludo',
    'gracias',
    'estoy preparado',
    'continuar con el video',
    'continuar con el vídeo',
     'osama',
    'salir del modo', // Agregado basado en tu captura ("salir del modo actual")
    'buenas',         // Opcional: variaciones de saludos
    'hola' ,  
    'suscribete'         // Opcional: variaciones de saludos
  ];

  // 2. Aplicamos el filtro combinando la búsqueda y la exclusión
  const filteredQuestions = questions.filter(question => {
    const lowerQuestion = question.pregunta.toLowerCase();
    const lowerCategory = question.categoria.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();

    // A. Coincidencia con la búsqueda del usuario (SearchInput)
    const matchesSearch = lowerQuestion.includes(lowerSearch) ||
                          lowerCategory.includes(lowerSearch);

    // B. Verificación de frases basura
    // Retorna true si la pregunta contiene alguna de las frases ignoradas
    const isGarbage = ignoredPhrases.some(phrase => 
      lowerQuestion.includes(phrase)
    );

    // Solo mostramos si coincide con la búsqueda Y NO es basura
    return matchesSearch && !isGarbage;
  });

  // Preparar datos para gráficos
  const topQuestionsChart = filteredQuestions.slice(0, 10).map(q => ({
    pregunta: q.pregunta.length > 30 ? q.pregunta.substring(0, 30) + '...' : q.pregunta,
    frecuencia: q.frecuencia,
    usuarios: q.usuarios_diferentes
  }));

  // Datos para gráfico de categorías
 const categoryData = filteredQuestions.reduce((acc, question) => {
    const cat = question.categoria;
    acc[cat] = (acc[cat] || 0) + question.frecuencia;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryData).map(([categoria, count]) => ({
    name: categoria,
    value: count
  }));

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  if (loading) {
    return (
      <Card>
        <LoadingContainer>
          Cargando ranking de preguntas...
        </LoadingContainer>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorContainer>
          {error}
          <br />
          <button 
            onClick={loadQuestionRanking}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
        </ErrorContainer>
      </Card>
    );
  }

  return (
    <>
      {/* Estadísticas generales */}
      <FullWidthContainer>
        <Card>
          <CardTitle>❓ Ranking de Preguntas Más Frecuentes</CardTitle>
          
          <StatsGrid>
            <StatItem>
              <StatValue>{statistics.total_preguntas || 0}</StatValue>
              <StatLabel>Total Preguntas</StatLabel>
            </StatItem>
            <StatItem>
              <StatValue>{statistics.preguntas_unicas || 0}</StatValue>
              <StatLabel>Preguntas Únicas</StatLabel>
            </StatItem>
            <StatItem>
              <StatValue>{questions.length}</StatValue>
              <StatLabel>Con Repeticiones</StatLabel>
            </StatItem>
            <StatItem>
              <StatValue>{getModeLabel(statistics.modo_filtro)}</StatValue>
              <StatLabel>Modo Filtrado</StatLabel>
            </StatItem>
          </StatsGrid>

          <ControlsContainer>
            <ModeSelector
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              {modeOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </ModeSelector>
            <SearchInput
              type="text"
              placeholder="Buscar pregunta o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </ControlsContainer>
        </Card>
      </FullWidthContainer>

      <RankingContainer>
        {/* Lista de preguntas */}
        <Card>
          <CardTitle>📋 Top Preguntas</CardTitle>
          <QuestionList>
            {filteredQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                No se encontraron preguntas con los filtros aplicados
              </div>
            ) : (
              filteredQuestions.map((question, index) => (
                <QuestionItem key={question.posicion}>
                  <QuestionHeader>
                    <PositionBadge position={question.posicion}>
                      {question.posicion}
                    </PositionBadge>
                    <FrequencyBadge>
                      {question.frecuencia}x
                    </FrequencyBadge>
                    <ModeBadge mode={question.modo_activo}>
                      {getModeLabel(question.modo_activo)}
                    </ModeBadge>
                    <CategoryBadge>
                      {question.categoria}
                    </CategoryBadge>
                  </QuestionHeader>
                  
                  <QuestionText>
                    "{question.pregunta}"
                  </QuestionText>
                  
                  <QuestionStats>
                    <ClickableCount
                      onClick={() => handleUserCountClick(question)}
                      title="Ver usuarios que hicieron esta pregunta"
                    >
                      👥 {question.usuarios_diferentes} usuarios
                    </ClickableCount>
                    <span>💬 {question.sesiones_diferentes} sesiones</span>
                    <span>📏 {question.longitud_promedio} caracteres</span>
                    <span>⭐ {question.popularidad} popularidad</span>
                    <span>📅 Primera vez: {formatDate(question.primera_vez)}</span>
                    <span>🕒 Última vez: {formatDate(question.ultima_vez)}</span>
                  </QuestionStats>
                </QuestionItem>
              ))
            )}
          </QuestionList>
        </Card>

        {/* Gráfico de categorías */}
        <Card>
          <CardTitle>📊 Por Categorías</CardTitle>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </RankingContainer>

      {/* Gráfico de top preguntas */}
      <FullWidthContainer>
        <Card>
          <CardTitle>📈 Top 10 Preguntas Más Frecuentes</CardTitle>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={topQuestionsChart} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={true} vertical={false} />
              <XAxis type="number" stroke="#64748b" fontSize={12} />
              <YAxis
                type="category"
                dataKey="pregunta"
                stroke="#64748b"
                fontSize={11}
                width={180}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(value, name) => [value, name === 'frecuencia' ? 'Frecuencia' : name]}
              />
              <Bar dataKey="frecuencia" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </FullWidthContainer>

      {/* Modal de usuarios que hicieron la pregunta */}
      {modalOpen && (
        <ModalOverlay onClick={closeModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Usuarios que hicieron esta pregunta</ModalTitle>
              <CloseButton onClick={closeModal}>&times;</CloseButton>
            </ModalHeader>

            <QuestionPreview>
              "{selectedQuestion}"
            </QuestionPreview>

            {modalLoading ? (
              <LoadingContainer>Cargando usuarios...</LoadingContainer>
            ) : questionUsers?.error ? (
              <ErrorContainer>{questionUsers.message}</ErrorContainer>
            ) : questionUsers ? (
              <>
                <StatsGrid style={{ marginBottom: '16px' }}>
                  <StatItem>
                    <StatValue>{questionUsers.total_usuarios}</StatValue>
                    <StatLabel>Usuarios</StatLabel>
                  </StatItem>
                  <StatItem>
                    <StatValue>{questionUsers.total_veces}</StatValue>
                    <StatLabel>Veces Preguntado</StatLabel>
                  </StatItem>
                </StatsGrid>

                <UsersList>
                  {questionUsers.usuarios?.map((user, index) => (
                    <UserItem key={user.user_id}>
                      <UserName>{user.nombre}</UserName>
                      <UserEmail>{user.email}</UserEmail>
                      <UserDates>
                        {user.fechas.map((fecha, idx) => (
                          <DateChip key={idx} title={`Modo: ${getModeLabel(fecha.modo)}`}>
                            {formatDateTime(fecha.fecha)}
                          </DateChip>
                        ))}
                      </UserDates>
                    </UserItem>
                  ))}
                </UsersList>
              </>
            ) : null}
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

export default QuestionRanking;