import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import analyticsService from '../../services/analyticsService';
import { API_BASE_URL } from '../../services/api';

const RetentionContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
  }
`;

const RetentionInfo = styled.div`
  flex: 1;
`;

const RetentionTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #374151;
`;

const RetentionDescription = styled.p`
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
`;

const ChartWrapper = styled.div`
  width: 250px;
  height: 150px;
`;

const TableContainer = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
`;

const TableHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
`;

const TableTitle = styled.h3`
  margin: 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 600;
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
`;

const ExportButton = styled.button`
  background-color: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    background-color: #e0f2fe;
    border-color: #7dd3fc;
  }
`;

const TypeSelector = styled.select`
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
  min-width: 200px;
  
  &:focus {
    outline: none;
    border-color: #4f46e5;
  }
  
  &::placeholder {
    color: #9ca3af;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`;

const TableHead = styled.thead`
  background: #f8fafc;
`;

const TableRow = styled.tr`
  border-bottom: 1px solid #e5e7eb;
  
  &:hover {
    background: #f8fafc;
  }
`;

const TableHeaderCell = styled.th`
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  cursor: pointer;
  user-select: none;
  position: relative;
  
  &:hover {
    background: #f1f5f9;
  }
  
  ${props => props.sortable && `
    &:after {
      content: '↕️';
      position: absolute;
      right: 8px;
      opacity: 0.5;
    }
    
    &:hover:after {
      opacity: 1;
    }
  `}
`;

const TableCell = styled.td`
  padding: 12px 16px;
  color: #374151;
  vertical-align: middle;
`;



const PositionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: bold;
  color: white;
  font-size: 12px;

  
  
  ${props => {
    if (props.position <= 3) {
      const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
      return `background: ${colors[props.position - 1]};`;
    }
    return 'background: #6b7280;';
  }}
`;

const ModeBadge = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
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

const ScoreBadge = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    const score = parseFloat(props.score);
    if (score >= 80) return 'background: #dcfce7; color: #166534;';
    if (score >= 60) return 'background: #fef3c7; color: #92400e;';
    return 'background: #fee2e2; color: #991b1b;';
  }}
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

const EmptyContainer = styled.div`
  padding: 40px;
  text-align: center;
  color: #6b7280;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  gap: 16px;
  flex-wrap: wrap;
`;

const PaginationInfo = styled.div`
  color: #6b7280;
  font-size: 14px;
`;

const PaginationControls = styled.div`
  display: flex;
  gap: 8px;
`;

const PaginationButton = styled.button`
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  background: ${props => props.active ? '#4f46e5' : 'white'};
  color: ${props => props.active ? 'white' : '#374151'};
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: ${props => props.active ? '#4338ca' : '#f8fafc'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ClickableNumber = styled.span`
  color: #4f46e5;
  cursor: pointer;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: #eef2ff;
    text-decoration: underline;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  color: #1a1a1a;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  line-height: 1;

  &:hover {
    color: #1a1a1a;
  }
`;

const ModalBody = styled.div`
  padding: 24px;
  overflow-y: auto;
  flex: 1;
`;

const QuestionItem = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f9fafb;
  }
`;

const QuestionText = styled.p`
  margin: 0 0 8px 0;
  color: #374151;
  font-size: 14px;
  line-height: 1.5;
`;

const QuestionMeta = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9ca3af;
`;

const UserRankingTable = ({ documentId }) => {
  const [users, setUsers] = useState([]);
  const [retentionData, setRetentionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rankingType, setRankingType] = useState('general_ranking');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('posicion');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Estados para el modal de preguntas
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userQuestions, setUserQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const rankingTypes = [
    { key: 'general_ranking', label: 'Ranking General' },
    { key: 'most_active', label: 'Más Activos' },
    { key: 'top_performers', label: 'Mejores Rendimientos' },
    { key: 'mentor_progress', label: 'Progreso Mentor' },
    { key: 'evaluation_scores', label: 'Calificaciones' }
  ];

  useEffect(() => {
    if (documentId) {
      loadUserRanking();
    }
  }, [documentId, rankingType]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Cargamos ranking Y retención en paralelo
      const [rankingData, retention] = await Promise.all([
        analyticsService.getUserRanking(documentId, rankingType, 50),
        analyticsService.getUserRanking(documentId, 'retention_stats') // Nueva llamada
      ]);
      
      setUsers(rankingData);
      setRetentionData(retention || []);
      
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar datos de usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadUserRanking = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await analyticsService.getUserRanking(documentId, rankingType, 50);
      setUsers(data);
      setCurrentPage(1); // Reset pagination when changing ranking type
      
    } catch (err) {
      console.error('Error cargando ranking de usuarios:', err);
      setError('Error al cargar el ranking de usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Cargar preguntas de un usuario
  const handleShowQuestions = async (user) => {
    setSelectedUser(user);
    setShowQuestionsModal(true);
    setLoadingQuestions(true);
    setUserQuestions([]);

    try {
      const questions = await analyticsService.getUserQuestions(documentId, user.usuario_id, 50);
      setUserQuestions(questions);
    } catch (err) {
      console.error('Error cargando preguntas:', err);
      setUserQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const closeQuestionsModal = () => {
    setShowQuestionsModal(false);
    setSelectedUser(null);
    setUserQuestions([]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours}h`;
  };

  // Filter and sort data
  const filteredUsers = users.filter(user =>
    user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Función para exportar todas las consultas de usuarios
  const exportConsultas = async () => {
    try {
      const apiUrl = API_BASE_URL;
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${apiUrl}/analytics/export-consultas.php?document_id=${documentId}&format=json&limit=5000`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Error al obtener datos');
      }

      const result = await response.json();

      if (!result.data || result.data.length === 0) {
        alert('No hay consultas para exportar');
        return;
      }

      // Generar CSV manualmente
      const csvContent = [
        '"Usuario","Email","Consulta","Fecha"',
        ...result.data.map(row => {
          const usuario = (row.usuario || '').replace(/"/g, '""');
          const email = (row.email || '').replace(/"/g, '""');
          const consulta = (row.consulta || '').replace(/"/g, '""');
          const fecha = row.fecha || '';
          return `"${usuario}","${email}","${consulta}","${fecha}"`;
        })
      ].join('\n');

      // Descargar archivo
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `consultas_usuarios_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Error exportando consultas:', err);
      alert('Error al exportar consultas: ' + err.message);
    }
  };

  // Función para exportar a CSV
  const exportToCSV = () => {
    if (sortedUsers.length === 0) return;

    // Definir columnas base
    let csvHeaders = ['Posición', 'Nombre', 'Email', 'Sesiones', 'Última Actividad'];
    let csvKeys = ['posicion', 'nombre', 'email', 'total_sesiones', 'ultima_actividad'];

    // Agregar columnas específicas según el tipo de ranking
    switch (rankingType) {
      case 'general_ranking':
        csvHeaders.push('Preguntas', 'Tiempo Total (h)', 'Modo Preferido', 'Promedio Evaluaciones');
        csvKeys.push('total_preguntas', 'tiempo_total_horas', 'modo_preferido', 'promedio_evaluaciones');
        break;
      case 'most_active':
        csvHeaders.push('Preguntas', 'Tiempo Total (h)', 'Días Activos', 'Sesiones por Día');
        csvKeys.push('total_preguntas', 'tiempo_total_horas', 'dias_activos', 'promedio_sesiones_por_dia');
        break;
      case 'top_performers':
        csvHeaders.push('Promedio Eval.', 'Eval. Aprobadas', 'Tasa Aprobación (%)', 'Total Evaluaciones');
        csvKeys.push('promedio_evaluaciones', 'evaluaciones_aprobadas', 'tasa_aprobacion', 'total_evaluaciones');
        break;
      case 'mentor_progress':
        csvHeaders.push('Módulo Actual', 'Lección Actual', 'Progreso (%)', 'Tiempo Mentor (h)');
        csvKeys.push('modulo_actual', 'leccion_actual', 'progreso_estimado', 'tiempo_mentor_horas');
        break;
      case 'evaluation_scores':
        csvHeaders.push('Promedio Calificaciones', 'Mejor Calificación', 'Tasa Aprobación', 'Intentos Promedio');
        csvKeys.push('promedio_calificaciones', 'mejor_calificacion', 'tasa_aprobacion', 'promedio_intentos');
        break;
      default:
        break;
    }

    // Construir contenido CSV
    const csvContent = [
      csvHeaders.join(','), // Encabezados
      ...sortedUsers.map(user => {
        return csvKeys.map(key => {
          let value = user[key];
          
          // Formatear valores específicos
          if (key === 'ultima_actividad' && value) {
            value = new Date(value).toLocaleDateString('es-ES');
          }
          if (value === null || value === undefined) {
            value = '';
          }
          
          // Escapar comillas y convertir a string
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
      })
    ].join('\n');

    // Descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ranking_usuarios_${rankingType}_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Pagination
  const totalItems = sortedUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = sortedUsers.slice(startIndex, endIndex);

  const renderTableHeaders = () => {
    const commonHeaders = [
      { key: 'posicion', label: '#', sortable: true },
      { key: 'nombre', label: 'Usuario', sortable: true },
      { key: 'total_sesiones', label: 'Sesiones', sortable: true },
      { key: 'ultima_actividad', label: 'Última Actividad', sortable: true }
    ];

    const specificHeaders = {
      general_ranking: [
        { key: 'total_preguntas', label: 'Preguntas', sortable: true },
        { key: 'tiempo_total_horas', label: 'Tiempo', sortable: true },
        { key: 'modo_preferido', label: 'Modo Preferido', sortable: false },
        { key: 'promedio_evaluaciones', label: 'Promedio Eval.', sortable: true }
      ],
      most_active: [
        { key: 'total_preguntas', label: 'Preguntas', sortable: true },
        { key: 'tiempo_total_horas', label: 'Tiempo', sortable: true },
        { key: 'dias_activos', label: 'Días Activos', sortable: true },
        { key: 'promedio_sesiones_por_dia', label: 'Sesiones/Día', sortable: true }
      ],
      top_performers: [
        { key: 'promedio_evaluaciones', label: 'Promedio', sortable: true },
        { key: 'evaluaciones_aprobadas', label: 'Aprobadas', sortable: true },
        { key: 'tasa_aprobacion', label: 'Tasa Aprob.', sortable: true },
        { key: 'total_evaluaciones', label: 'Total Eval.', sortable: true }
      ],
      mentor_progress: [
        { key: 'modulo_actual', label: 'Módulo', sortable: true },
        { key: 'leccion_actual', label: 'Lección', sortable: true },
        { key: 'progreso_estimado', label: 'Progreso', sortable: true },
        { key: 'tiempo_mentor_horas', label: 'Tiempo Mentor', sortable: true }
      ],
      evaluation_scores: [
        { key: 'promedio_calificaciones', label: 'Promedio', sortable: true },
        { key: 'mejor_calificacion', label: 'Mejor', sortable: true },
        { key: 'tasa_aprobacion', label: 'Tasa Aprob.', sortable: true },
        { key: 'promedio_intentos', label: 'Intentos Prom.', sortable: true }
      ]
    };

    const headers = [...commonHeaders, ...specificHeaders[rankingType]];

    return headers.map(header => (
      <TableHeaderCell
        key={header.key}
        sortable={header.sortable}
        onClick={() => header.sortable && handleSort(header.key)}
      >
        {header.label}
        {sortField === header.key && (
          <span style={{ marginLeft: '4px' }}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </TableHeaderCell>
    ));
  };

  const renderTableRow = (user, index) => {
    return (
      <TableRow key={user.usuario_id}>
        <TableCell>
          <PositionBadge position={user.posicion}>
            {user.posicion}
          </PositionBadge>
        </TableCell>
        <TableCell>
          <div>
            <div style={{ fontWeight: '500' }}>{user.nombre}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</div>
          </div>
        </TableCell>
        <TableCell>{user.total_sesiones}</TableCell>
        <TableCell>{formatDate(user.ultima_actividad)}</TableCell>
        
        {/* Columnas específicas por tipo de ranking */}
        {rankingType === 'general_ranking' && (
          <>
            <TableCell>
              {user.total_preguntas > 0 ? (
                <ClickableNumber onClick={() => handleShowQuestions(user)}>
                  {user.total_preguntas}
                </ClickableNumber>
              ) : (
                user.total_preguntas
              )}
            </TableCell>
            <TableCell>{formatTime(user.tiempo_total_horas)}</TableCell>
            <TableCell>
              <ModeBadge mode={user.modo_preferido}>
                {user.modo_preferido === 'mentor' ? 'Mentor' : 
                 user.modo_preferido === 'evaluacion' ? 'Evaluación' : 'Consulta'}
              </ModeBadge>
            </TableCell>
            <TableCell>
              {user.promedio_evaluaciones > 0 ? (
                <ScoreBadge score={user.promedio_evaluaciones}>
                  {user.promedio_evaluaciones}%
                </ScoreBadge>
              ) : 'N/A'}
            </TableCell>
          </>
        )}
        
        {rankingType === 'most_active' && (
          <>
            <TableCell>
              {user.total_preguntas > 0 ? (
                <ClickableNumber onClick={() => handleShowQuestions(user)}>
                  {user.total_preguntas}
                </ClickableNumber>
              ) : (
                user.total_preguntas
              )}
            </TableCell>
            <TableCell>{formatTime(user.tiempo_total_horas)}</TableCell>
            <TableCell>{user.dias_activos}</TableCell>
            <TableCell>{user.promedio_sesiones_por_dia}</TableCell>
          </>
        )}
        
        {rankingType === 'top_performers' && (
          <>
            <TableCell>
              <ScoreBadge score={user.promedio_evaluaciones}>
                {user.promedio_evaluaciones}%
              </ScoreBadge>
            </TableCell>
            <TableCell>{user.evaluaciones_aprobadas}</TableCell>
            <TableCell>{user.tasa_aprobacion}%</TableCell>
            <TableCell>{user.total_evaluaciones}</TableCell>
          </>
        )}
        
        {rankingType === 'mentor_progress' && (
          <>
            <TableCell>{user.modulo_actual}</TableCell>
            <TableCell>{user.leccion_actual}</TableCell>
            <TableCell>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '60px', 
                  height: '6px', 
                  background: '#e5e7eb', 
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${user.progreso_estimado}%`,
                    height: '100%',
                    background: '#4f46e5',
                    borderRadius: '3px'
                  }} />
                </div>
                <span style={{ fontSize: '12px' }}>{user.progreso_estimado}%</span>
              </div>
            </TableCell>
            <TableCell>{formatTime(user.tiempo_mentor_horas)}</TableCell>
          </>
        )}
        
        {rankingType === 'evaluation_scores' && (
          <>
            <TableCell>
              <ScoreBadge score={user.promedio_calificaciones}>
                {user.promedio_calificaciones}%
              </ScoreBadge>
            </TableCell>
            <TableCell>{user.mejor_calificacion}%</TableCell>
            <TableCell>{user.tasa_aprobacion}%</TableCell>
            <TableCell>{user.promedio_intentos}</TableCell>
          </>
        )}
      </TableRow>
    );
  };

  if (loading) {
    return (
      <TableContainer>
        <LoadingContainer>
          Cargando ranking de usuarios...
        </LoadingContainer>
      </TableContainer>
    );
  }

  if (error) {
    return (
      <TableContainer>
        <ErrorContainer>
          {error}
          <br />
          <button 
            onClick={loadUserRanking}
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
      </TableContainer>
    );
  }

  const RETENTION_COLORS = ['#10b981', '#4f46e5'];

  return (
    <>
      {/* Nuevo Bloque de Retención */}
      {retentionData.length > 0 && (
        <RetentionContainer>
          <RetentionInfo>
            <RetentionTitle>👥 Retención de Usuarios (30 días)</RetentionTitle>
            <RetentionDescription>
              Comparativa entre usuarios nuevos (primera sesión reciente) y usuarios recurrentes (que han regresado). 
              Una alta tasa de recurrentes indica un buen "engagement".
            </RetentionDescription>
          </RetentionInfo>
          <ChartWrapper>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={retentionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {retentionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || RETENTION_COLORS[index % 2]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </RetentionContainer>
      )}
    
    <TableContainer>
      <TableHeader>
        <TableTitle>👥 Ranking de Usuarios</TableTitle>
        <ControlsContainer>
          <ExportButton onClick={exportConsultas} style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac' }}>
            <span>📋</span> Exportar Consultas
          </ExportButton>
          <ExportButton onClick={exportToCSV}>
            <span>📥</span> Exportar Ranking
          </ExportButton>
          <TypeSelector
            value={rankingType}
            onChange={(e) => setRankingType(e.target.value)}
          >
            {rankingTypes.map(type => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </TypeSelector>
          <SearchInput
            type="text"
            placeholder="Buscar usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </ControlsContainer>
      </TableHeader>

      {currentUsers.length === 0 ? (
        <EmptyContainer>
          No se encontraron usuarios para mostrar.
        </EmptyContainer>
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                {renderTableHeaders()}
              </TableRow>
            </TableHead>
            <tbody>
              {currentUsers.map((user, index) => renderTableRow(user, index))}
            </tbody>
          </Table>

          {totalPages > 1 && (
            <PaginationContainer>
              <PaginationInfo>
                Mostrando {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems} usuarios
              </PaginationInfo>
              <PaginationControls>
                <PaginationButton
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </PaginationButton>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                  return (
                    <PaginationButton
                      key={pageNumber}
                      active={pageNumber === currentPage}
                      onClick={() => setCurrentPage(pageNumber)}
                    >
                      {pageNumber}
                    </PaginationButton>
                  );
                })}
                
                <PaginationButton
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </PaginationButton>
              </PaginationControls>
            </PaginationContainer>
          )}
        </>
      )}
    </TableContainer>

      {/* Modal de preguntas del usuario */}
      {showQuestionsModal && (
        <ModalOverlay onClick={closeQuestionsModal}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>
                Preguntas de {selectedUser?.nombre}
              </ModalTitle>
              <CloseButton onClick={closeQuestionsModal}>&times;</CloseButton>
            </ModalHeader>
            <ModalBody>
              {loadingQuestions ? (
                <LoadingContainer>Cargando preguntas...</LoadingContainer>
              ) : userQuestions.length === 0 ? (
                <EmptyContainer>No se encontraron preguntas para este usuario.</EmptyContainer>
              ) : (
                userQuestions.map((q, index) => (
                  <QuestionItem key={q.id || index}>
                    <QuestionText>{q.pregunta}</QuestionText>
                    <QuestionMeta>
                      <span>{formatDate(q.fecha)}</span>
                      <ModeBadge mode={q.modo}>
                        {q.modo === 'mentor' ? 'Mentor' :
                         q.modo === 'evaluacion' ? 'Evaluacion' : 'Consulta'}
                      </ModeBadge>
                    </QuestionMeta>
                  </QuestionItem>
                ))
              )}
            </ModalBody>
          </ModalContent>
        </ModalOverlay>
      )}
</>
  );
};
export default UserRankingTable;