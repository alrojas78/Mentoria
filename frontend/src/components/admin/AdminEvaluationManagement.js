// src/components/admin/AdminEvaluationManagement.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { evaluationService, questionService, courseService } from '../../services/api';
import { FaEdit, FaTrash, FaPlus, FaChartBar, FaEye, FaCog, FaCheck, FaTimes } from 'react-icons/fa';

const Container = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  padding: 1.5rem;
`;

const TitleBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const Title = styled.h2`
  color: #2b4361;
  margin: 0;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 1rem;
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background-color: ${props => props.primary ? '#2b4361' : props.danger ? '#e74c3c' : props.success ? '#27ae60' : '#f1f1f1'};
  color: ${props => props.primary || props.danger || props.success ? 'white' : '#333'};
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #e0e0e0;
  }
  
  th {
    color: #2b4361;
    font-weight: 600;
    background-color: #f8f9fa;
  }
  
  tr:last-child td {
    border-bottom: none;
  }
  
  tr:hover td {
    background-color: #f1f5f9;
  }
`;

const SettingItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #e0e0e0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const SettingLabel = styled.div`
  font-weight: 500;
`;

const SettingControl = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const StatusTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background-color: ${props => props.active ? '#e3f2fd' : '#f1f8e9'};
  color: ${props => props.active ? '#0d47a1' : '#33691e'};
`;

// Modal components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1.5rem;
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  
  h3 {
    margin: 0;
    color: #2b4361;
  }
  
  button {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #6b7280;
    
    &:hover {
      color: #ef4444;
    }
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #374151;
  }
  
  input, select, textarea {
    width: 100%;
    padding: 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    
    &:focus {
      outline: none;
      border-color: #2b4361;
      box-shadow: 0 0 0 1px #2b4361;
    }
  }
  
  textarea {
    min-height: 100px;
    resize: vertical;
  }
  
  .error {
    color: #ef4444;
    font-size: 0.75rem;
    margin-top: 0.3rem;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 1.5rem;
`;

const Tab = styled.div`
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: ${props => props.active ? 'bold' : 'normal'};
  color: ${props => props.active ? '#2b4361' : '#6b7280'};
  border-bottom: ${props => props.active ? '2px solid #2b4361' : 'none'};
  
  &:hover {
    color: #2b4361;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
`;

const QuestionList = styled.div`
  margin-top: 1rem;
`;

const QuestionItem = styled.div`
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 1rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const AdminEvaluationManagement = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('questions');
  const [formData, setFormData] = useState({
    moduleId: '',
    passingScore: 70,
    maxAttempts: 3,
    timeLimit: 0, // 0 = sin límite
    randomizeQuestions: false,
    showFeedback: true,
    questions: []
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Obtener evaluaciones
        const evaluationsResponse = await evaluationService.getAllEvaluations();
        // Obtener cursos para el selector
        const coursesResponse = await courseService.getAllCourses();
        
        setEvaluations(evaluationsResponse.data || []);
        setCourses(coursesResponse.data || []);
        
        // Extraer todos los módulos para facilitar la selección
        const allModules = [];
        coursesResponse.data.forEach(course => {
          if (course.modules && course.modules.length) {
            course.modules.forEach(module => {
              allModules.push({
                ...module,
                courseName: course.titulo,
                courseId: course.id
              });
            });
          }
        });
        setModules(allModules);
        
        setLoading(false);
      } catch (error) {
        console.error('Error cargando datos:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleViewEvaluation = (evaluationId) => {
    // Redirigir a la vista de previsualización
    window.open(`/admin/preview-evaluation/${evaluationId}`, '_blank');
  };
  
  const handleEdit = async (evaluation) => {
    try {
      setLoading(true);
      // Obtener detalle de la evaluación con preguntas
      const detailResponse = await evaluationService.getEvaluationWithQuestions(evaluation.id);
      
      setSelectedEvaluation(detailResponse.data);
      setFormData({
        moduleId: detailResponse.data.module_id,
        passingScore: detailResponse.data.passing_score || 70,
        maxAttempts: detailResponse.data.max_attempts || 3,
        timeLimit: detailResponse.data.time_limit || 0,
        randomizeQuestions: detailResponse.data.randomize_questions || false,
        showFeedback: detailResponse.data.show_feedback !== false, // por defecto true
        questions: detailResponse.data.questions || []
      });
      
      // Encontrar el módulo seleccionado
      const selectedMod = modules.find(m => m.id === detailResponse.data.module_id);
      setSelectedModule(selectedMod);
      
      setActiveTab('questions');
      setIsModalOpen(true);
      setLoading(false);
    } catch (error) {
      console.error('Error cargando detalle de evaluación:', error);
      setLoading(false);
    }
  };

  const handleDelete = (evaluation) => {
    setSelectedEvaluation(evaluation);
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = async () => {
    try {
      await evaluationService.deleteEvaluation(selectedEvaluation.id);
      setEvaluations(evaluations.filter(e => e.id !== selectedEvaluation.id));
      setIsDeleteModalOpen(false);
      setSelectedEvaluation(null);
    } catch (error) {
      console.error('Error eliminando evaluación:', error);
    }
  };

  const handleAddNew = () => {
    setSelectedEvaluation(null);
    setSelectedModule(null);
    setFormData({
      moduleId: '',
      passingScore: 70,
      maxAttempts: 3,
      timeLimit: 0,
      randomizeQuestions: false,
      showFeedback: true,
      questions: []
    });
    setFormErrors({});
    setIsModalOpen(true);
    setActiveTab('questions');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear error when field is edited
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
    
    // Si cambia el módulo, actualizar el módulo seleccionado
    if (name === 'moduleId') {
      const selectedMod = modules.find(m => m.id === value);
      setSelectedModule(selectedMod);
    }
  };

  const handleAddQuestion = () => {
    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          id: `temp-${Date.now()}`,
          question_text: 'Nueva pregunta',
          expected_answer: 'Respuesta esperada',
          orden: formData.questions.length + 1
        }
      ]
    });
  };
  
  const handleUpdateQuestion = (index, field, value) => {
    const updatedQuestions = [...formData.questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      questions: updatedQuestions
    });
  };
  
  const handleRemoveQuestion = (index) => {
    const updatedQuestions = formData.questions.filter((_, i) => i !== index);
    // Actualizar orden
    updatedQuestions.forEach((q, i) => {
      q.orden = i + 1;
    });
    
    setFormData({
      ...formData,
      questions: updatedQuestions
    });
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.moduleId) {
      errors.moduleId = 'Debe seleccionar un módulo';
    }
    
    if (formData.questions.length === 0) {
      errors.questions = 'Debe añadir al menos una pregunta';
    }
    
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      let responseData;
      
      if (selectedEvaluation) {
        // Actualizar evaluación existente
        const response = await evaluationService.updateEvaluation({
          id: selectedEvaluation.id,
          ...formData
        });
        responseData = response.data;
        
        // Actualizar estado
        setEvaluations(evaluations.map(evaluation => 
            evaluation.id === selectedEvaluation.id ? responseData : evaluation
        ));

      } else {
        // Crear nueva evaluación
        const response = await evaluationService.createEvaluation(formData);
        responseData = response.data;
        setEvaluations([...evaluations, responseData]);
      }
      
      // Cerrar modal
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error guardando evaluación:', error);
    }
  };

  // Para simulación, crear estadísticas ficticias para cada evaluación
  const getEvaluationStats = (evaluationId) => {
    // Simulación de estadísticas
    return {
      attempts: Math.floor(Math.random() * 50) + 10,
      passRate: Math.floor(Math.random() * 100),
      avgScore: Math.floor(Math.random() * 40) + 60
    };
  };

  return (
    <Container>
      <TitleBar>
        <Title>Gestión de Evaluaciones</Title>
        <ButtonsContainer>
          <Button primary onClick={handleAddNew}>
            <FaPlus />
            Nueva Evaluación
          </Button>
        </ButtonsContainer>
      </TitleBar>
      
      {loading ? (
        <div>Cargando evaluaciones...</div>
      ) : (
        <>
          {evaluations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>No hay evaluaciones configuradas. Crea una nueva para comenzar.</p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Curso / Módulo</th>
                  <th>Preguntas</th>
                  <th>Calificación Aprobatoria</th>
                  <th>Estadísticas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map(evaluation => {
                  const stats = getEvaluationStats(evaluation.id);
                  const moduleInfo = modules.find(m => m.id === evaluation.module_id) || {};
                  
                  return (
                    <tr key={evaluation.id}>
                      <td>{evaluation.id}</td>
                      <td>
                        {moduleInfo.courseName ? (
                          <>
                            <div><strong>{moduleInfo.courseName}</strong></div>
                            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>{moduleInfo.title}</div>
                          </>
                        ) : (
                          `Módulo ID: ${evaluation.module_id}`
                        )}
                      </td>
                      <td>{evaluation.question_count || '?'}</td>
                      <td>{evaluation.passing_score || 70}%</td>
                      <td>
                        <div>Intentos: {stats.attempts}</div>
                        <div>Tasa de aprobación: {stats.passRate}%</div>
                      </td>
                      <td>
                        <ActionButtons>
                          <Button onClick={() => handleViewEvaluation(evaluation.id)}>
                            <FaEye />
                          </Button>
                          <Button onClick={() => handleEdit(evaluation)}>
                            <FaEdit />
                          </Button>
                          <Button danger onClick={() => handleDelete(evaluation)}>
                            <FaTrash />
                          </Button>
                        </ActionButtons>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}
      
      {isModalOpen && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <h3>{selectedEvaluation ? 'Editar Evaluación' : 'Nueva Evaluación'}</h3>
              <button onClick={() => setIsModalOpen(false)}>&times;</button>
            </ModalHeader>
            
            <TabsContainer>
              <Tab 
                active={activeTab === 'questions'} 
                onClick={() => setActiveTab('questions')}
              >
                Preguntas
              </Tab>
              <Tab 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')}
              >
                Configuración
              </Tab>
              {selectedEvaluation && (
                <Tab 
                  active={activeTab === 'results'} 
                  onClick={() => setActiveTab('results')}
                >
                  Resultados
                </Tab>
              )}
            </TabsContainer>
            
            {activeTab === 'questions' && (
              <>
                <FormGroup>
                  <label htmlFor="moduleId">Módulo</label>
                  <select
                    id="moduleId"
                    name="moduleId"
                    value={formData.moduleId}
                    onChange={handleInputChange}
                  >
                    <option value="">Seleccionar módulo...</option>
                    {modules.map(module => (
                      <option key={module.id} value={module.id}>
                        {module.courseName} - {module.title}
                      </option>
                    ))}
                  </select>
                  {formErrors.moduleId && <div className="error">{formErrors.moduleId}</div>}
                </FormGroup>
                
                <Button primary onClick={handleAddQuestion} style={{ marginBottom: '1rem' }}>
                  <FaPlus /> Añadir Pregunta
                </Button>
                
                {formData.questions.length === 0 ? (
                  <div>
                    <p>No hay preguntas en esta evaluación. Añade una pregunta para comenzar.</p>
                    {formErrors.questions && <div className="error">{formErrors.questions}</div>}
                  </div>
                ) : (
                  <QuestionList>
                    {formData.questions.map((question, index) => (
                      <QuestionItem key={index}>
                        <FormGroup>
                          <label>Pregunta {index + 1}</label>
                          <textarea
                            value={question.question_text}
                            onChange={(e) => handleUpdateQuestion(index, 'question_text', e.target.value)}
                          />
                        </FormGroup>
                        <FormGroup>
                          <label>Respuesta Esperada</label>
                          <textarea
                            value={question.expected_answer}
                            onChange={(e) => handleUpdateQuestion(index, 'expected_answer', e.target.value)}
                          />
                        </FormGroup>
                        <Button danger onClick={() => handleRemoveQuestion(index)}>
                          <FaTrash /> Eliminar Pregunta
                        </Button>
                      </QuestionItem>
                    ))}
                  </QuestionList>
                )}
              </>
            )}
            
            {activeTab === 'settings' && (
              <div>
                <SettingItem>
                  <SettingLabel>Calificación Aprobatoria (%)</SettingLabel>
                  <SettingControl>
                    <input
                      type="number"
                      name="passingScore"
                      value={formData.passingScore}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      style={{ width: '80px' }}
                    />
                  </SettingControl>
                </SettingItem>
                
                <SettingItem>
                  <SettingLabel>Intentos Máximos</SettingLabel>
                  <SettingControl>
                    <input
                      type="number"
                      name="maxAttempts"
                      value={formData.maxAttempts}
                      onChange={handleInputChange}
                      min="1"
                      style={{ width: '80px' }}
                    />
                  </SettingControl>
                </SettingItem>
                
                <SettingItem>
                  <SettingLabel>Límite de Tiempo (minutos, 0 = sin límite)</SettingLabel>
                  <SettingControl>
                    <input
                      type="number"
                      name="timeLimit"
                      value={formData.timeLimit}
                      onChange={handleInputChange}
                      min="0"
                      style={{ width: '80px' }}
                    />
                  </SettingControl>
                </SettingItem>
                
                <SettingItem>
                  <SettingLabel>Orden de preguntas aleatorio</SettingLabel>
                  <SettingControl>
                    <input
                      type="checkbox"
                      name="randomizeQuestions"
                      checked={formData.randomizeQuestions}
                      onChange={handleInputChange}
                    />
                  </SettingControl>
                </SettingItem>
                
                <SettingItem>
                  <SettingLabel>Mostrar retroalimentación</SettingLabel>
                  <SettingControl>
                    <input
                      type="checkbox"
                      name="showFeedback"
                      checked={formData.showFeedback}
                      onChange={handleInputChange}
                    />
                  </SettingControl>
                </SettingItem>
              </div>
            )}
            
            {activeTab === 'results' && selectedEvaluation && (
              <div>
                <h3>Resultados de la Evaluación</h3>
                <p>Estadísticas y resultados detallados no disponibles en esta versión de demostración.</p>
              </div>
            )}
            
            <ModalFooter>
              <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button primary onClick={handleSubmit}>{selectedEvaluation ? 'Actualizar' : 'Crear'}</Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
      
      {isDeleteModalOpen && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <h3>Confirmar Eliminación</h3>
              <button onClick={() => setIsDeleteModalOpen(false)}>&times;</button>
            </ModalHeader>
            
            <p>¿Estás seguro de eliminar esta evaluación?</p>
            <p>Esta acción eliminará todas las preguntas asociadas y los resultados de estudiantes.</p>
            <p>Esta acción no se puede deshacer.</p>
            
            <ModalFooter>
              <Button onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
              <Button danger onClick={confirmDelete}>Eliminar</Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default AdminEvaluationManagement;