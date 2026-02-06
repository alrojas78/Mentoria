// src/components/admin/AdminCourseManagement.js
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { courseService } from '../../services/api';
import { FaEdit, FaTrash, FaPlus, FaLock, FaLockOpen, FaEye, FaFileMedical, FaCog, FaChartLine } from 'react-icons/fa';

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

const SearchContainer = styled.div`
  margin-bottom: 1.5rem;
  
  input {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 300px;
  }
`;

const CourseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
`;

const CourseCard = styled.div`
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
`;

const CourseImage = styled.div`
  height: 150px;
  background-color: #e0e6ed;
  background-image: url(${props => props.src || ''});
  background-size: cover;
  background-position: center;
  position: relative;
`;

const CourseStatus = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background-color: ${props => props.active ? 'rgba(39, 174, 96, 0.9)' : 'rgba(231, 76, 60, 0.9)'};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const CourseContent = styled.div`
  padding: 1rem;
`;

const CourseTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  color: #2b4361;
  font-size: 1.1rem;
`;

const CourseDescription = styled.p`
  margin: 0 0 1rem 0;
  color: #6b7280;
  font-size: 0.9rem;
  height: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const CourseStats = styled.div`
  display: flex;
  justify-content: space-between;
  color: #6b7280;
  font-size: 0.8rem;
  margin-bottom: 1rem;
`;

const CourseActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
`;

// Modal components (similar to AdminUserManagement)
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
  max-width: 600px;
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

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
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

const ModuleContainer = styled.div`
  margin-bottom: 1.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
`;

const ModuleHeader = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
`;

const ModuleTitle = styled.h4`
  margin: 0;
  color: #2b4361;
`;

const ModuleContent = styled.div`
  padding: 0.75rem;
`;

const LessonList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const LessonItem = styled.li`
  padding: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:last-child {
    border-bottom: none;
  }
`;

const AdminCourseManagement = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    imagen: '',
    activo: true,
    modules: []
  });
  
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await courseService.getAllCourses();
        setCourses(response.data || []);
        setLoading(false);
      } catch (error) {
        console.error('Error cargando cursos:', error);
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const filteredCourses = courses.filter(course => 
    course.titulo.toLowerCase().includes(search.toLowerCase()) ||
    course.descripcion.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (course) => {
    setSelectedCourse(course);
    setFormData({
      titulo: course.titulo,
      descripcion: course.descripcion,
      imagen: course.imagen || '',
      activo: true, // Asumiendo que todos los cursos están activos
      modules: course.modules || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = (course) => {
    setSelectedCourse(course);
    setIsDeleteModalOpen(true);
  };
  
  const confirmDelete = async () => {
    try {
      await courseService.deleteCourse(selectedCourse.id);
      setCourses(courses.filter(course => course.id !== selectedCourse.id));
      setIsDeleteModalOpen(false);
      setSelectedCourse(null);
    } catch (error) {
      console.error('Error eliminando curso:', error);
    }
  };

  const handleAddNew = () => {
    setSelectedCourse(null);
    setFormData({
      titulo: '',
      descripcion: '',
      imagen: '',
      activo: true,
      modules: []
    });
    setFormErrors({});
    setIsModalOpen(true);
    setActiveTab('general');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error when field is edited
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.titulo.trim()) {
      errors.titulo = 'El título es obligatorio';
    }
    
    if (!formData.descripcion.trim()) {
      errors.descripcion = 'La descripción es obligatoria';
    }
    
    return errors;
  };
  
  const handleAddModule = () => {
    setFormData({
      ...formData,
      modules: [
        ...formData.modules,
        {
          id: `temp-${Date.now()}`, // ID temporal, se reemplazará en el backend
          titulo: 'Nuevo Módulo',
          descripcion: 'Descripción del módulo',
          orden: formData.modules.length + 1,
          lessons: []
        }
      ]
    });
  };
  
  const handleUpdateModule = (index, field, value) => {
    const updatedModules = [...formData.modules];
    updatedModules[index] = {
      ...updatedModules[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      modules: updatedModules
    });
  };
  
  const handleRemoveModule = (index) => {
    const updatedModules = formData.modules.filter((_, i) => i !== index);
    // Actualizar el orden de los módulos restantes
    updatedModules.forEach((module, i) => {
      module.orden = i + 1;
    });
    
    setFormData({
      ...formData,
      modules: updatedModules
    });
  };
  
  const handleAddLesson = (moduleIndex) => {
    const updatedModules = [...formData.modules];
    updatedModules[moduleIndex].lessons = [
      ...(updatedModules[moduleIndex].lessons || []),
      {
        id: `temp-lesson-${Date.now()}`,
        titulo: 'Nueva Lección',
        contenido: 'Contenido de la lección',
        orden: (updatedModules[moduleIndex].lessons?.length || 0) + 1
      }
    ];
    
    setFormData({
      ...formData,
      modules: updatedModules
    });
  };
  
  const handleUpdateLesson = (moduleIndex, lessonIndex, field, value) => {
    const updatedModules = [...formData.modules];
    updatedModules[moduleIndex].lessons[lessonIndex] = {
      ...updatedModules[moduleIndex].lessons[lessonIndex],
      [field]: value
    };
    
    setFormData({
      ...formData,
      modules: updatedModules
    });
  };
  
  const handleRemoveLesson = (moduleIndex, lessonIndex) => {
    const updatedModules = [...formData.modules];
    updatedModules[moduleIndex].lessons = updatedModules[moduleIndex].lessons.filter((_, i) => i !== lessonIndex);
    
    // Actualizar el orden de las lecciones restantes
    updatedModules[moduleIndex].lessons.forEach((lesson, i) => {
      lesson.orden = i + 1;
    });
    
    setFormData({
      ...formData,
      modules: updatedModules
    });
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      if (selectedCourse) {
        // Actualizar curso existente
        const updatedCourse = {
          id: selectedCourse.id,
          ...formData
        };
        const response = await courseService.updateCourse(updatedCourse);
        
        // Actualizar estado
        setCourses(courses.map(course => 
          course.id === selectedCourse.id ? response.data : course
        ));
      } else {
        // Crear nuevo curso
        const response = await courseService.createCourse(formData);
        setCourses([...courses, response.data]);
      }
      
      // Cerrar modal
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error guardando curso:', error);
    }
  };

  const handleViewCourse = (courseId) => {
    window.open(`/courses/${courseId}`, '_blank');
  };

  return (
    <Container>
      <TitleBar>
        <Title>Gestión de Cursos</Title>
        <ButtonsContainer>
          <Button primary onClick={handleAddNew}>
            <FaPlus />
            Nuevo Curso
          </Button>
        </ButtonsContainer>
      </TitleBar>
      
      <SearchContainer>
        <input 
          type="text"
          placeholder="Buscar cursos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </SearchContainer>
      
      {loading ? (
        <div>Cargando cursos...</div>
      ) : (
        <>
          {filteredCourses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>No se encontraron cursos. Crea uno nuevo para comenzar.</p>
            </div>
          ) : (
            <CourseGrid>
              {filteredCourses.map(course => (
                <CourseCard key={course.id}>
                  <CourseImage src={course.imagen && `https://voicemed.edtechsm.com/backend${course.imagen}`}>
                    <CourseStatus active={true}>
                      {true ? (
                        <>
                          <FaLockOpen />
                          Activo
                        </>
                      ) : (
                        <>
                          <FaLock />
                          Inactivo
                        </>
                      )}
                    </CourseStatus>
                  </CourseImage>
                  
                  <CourseContent>
                    <CourseTitle>{course.titulo}</CourseTitle>
                    <CourseDescription>{course.descripcion}</CourseDescription>
                    
                    <CourseStats>
                      <span>{course.modules?.length || 0} módulos</span>
                      <span>
                        {course.modules?.reduce(
                          (total, module) => total + (module.lessons?.length || 0), 
                          0
                        ) || 0} lecciones
                      </span>
                    </CourseStats>
                    
                    <CourseActions>
                      <Button onClick={() => handleViewCourse(course.id)}>
                        <FaEye />
                      </Button>
                      <Button onClick={() => handleEdit(course)}>
                        <FaEdit />
                      </Button>
                      <Button danger onClick={() => handleDelete(course)}>
                        <FaTrash />
                      </Button>
                    </CourseActions>
                  </CourseContent>
                </CourseCard>
              ))}
            </CourseGrid>
          )}
        </>
      )}
      
      {isModalOpen && (
        <ModalOverlay>
          <ModalContent>
            <ModalHeader>
              <h3>{selectedCourse ? 'Editar Curso' : 'Nuevo Curso'}</h3>
              <button onClick={() => setIsModalOpen(false)}>&times;</button>
            </ModalHeader>
            
            <TabsContainer>
              <Tab 
                active={activeTab === 'general'} 
                onClick={() => setActiveTab('general')}
              >
                Información General
              </Tab>
              <Tab 
                active={activeTab === 'modules'} 
                onClick={() => setActiveTab('modules')}
              >
                Módulos y Lecciones
              </Tab>
              {selectedCourse && (
                <Tab 
                  active={activeTab === 'stats'} 
                  onClick={() => setActiveTab('stats')}
                >
                  Estadísticas
                </Tab>
              )}
            </TabsContainer>
            
            {activeTab === 'general' && (
              <form onSubmit={(e) => { e.preventDefault(); }}>
                <FormGroup>
                  <label htmlFor="titulo">Título del Curso</label>
                  <input
                    id="titulo"
                    name="titulo"
                    type="text"
                    value={formData.titulo}
                    onChange={handleInputChange}
                  />
                  {formErrors.titulo && <div className="error">{formErrors.titulo}</div>}
                </FormGroup>
                
                <FormGroup>
                  <label htmlFor="descripcion">Descripción</label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                  />
                  {formErrors.descripcion && <div className="error">{formErrors.descripcion}</div>}
                </FormGroup>
                
                <FormGroup>
                  <label htmlFor="imagen">URL de la Imagen</label>
                  <input
                    id="imagen"
                    name="imagen"
                    type="text"
                    value={formData.imagen}
                    onChange={handleInputChange}
                    placeholder="/assets/images/nombre-imagen.jpg"
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: '#6b7280' }}>
                    La imagen debe estar en la carpeta /assets/images del servidor
                  </small>
                </FormGroup>
                
                <FormGroup>
                  <label htmlFor="activo">Estado del Curso</label>
                  <select
                    id="activo"
                    name="activo"
                    value={formData.activo}
                    onChange={(e) => handleInputChange({
                      target: {
                        name: 'activo',
                        value: e.target.value === 'true'
                      }
                    })}
                  >
                    <option value={true}>Activo</option>
                    <option value={false}>Inactivo</option>
                  </select>
                </FormGroup>
              </form>
            )}
            
            {activeTab === 'modules' && (
              <div>
                <Button primary onClick={handleAddModule} style={{ marginBottom: '1rem' }}>
                  <FaPlus /> Añadir Módulo
                </Button>
                
                {formData.modules.length === 0 ? (
                  <p>Este curso no tiene módulos. Añade uno para comenzar.</p>
                ) : (
                  formData.modules.map((module, moduleIndex) => (
                    <ModuleContainer key={moduleIndex}>
                      <ModuleHeader>
                        <ModuleTitle>{module.titulo}</ModuleTitle>
                        <ButtonsContainer>
                          <Button onClick={() => handleAddLesson(moduleIndex)}>
                            <FaFileMedical />
                          </Button>
                          <Button danger onClick={() => handleRemoveModule(moduleIndex)}>
                            <FaTrash />
                          </Button>
                        </ButtonsContainer>
                      </ModuleHeader>
                      
                      <ModuleContent>
                        <FormGroup>
                          <label>Título del Módulo</label>
                          <input
                            type="text"
                            value={module.titulo}
                            onChange={(e) => handleUpdateModule(moduleIndex, 'titulo', e.target.value)}
                          />
                        </FormGroup>
                        
                        <FormGroup>
                          <label>Descripción del Módulo</label>
                          <textarea
                            value={module.descripcion}
                            onChange={(e) => handleUpdateModule(moduleIndex, 'descripcion', e.target.value)}
                          />
                        </FormGroup>
                        
                        <h5>Lecciones</h5>
                        {module.lessons && module.lessons.length > 0 ? (
                          <LessonList>
                            {module.lessons.map((lesson, lessonIndex) => (
                              <LessonItem key={lessonIndex}>
                                <div>
                                  <strong>{lesson.titulo}</strong>
                                </div>
                                <ButtonsContainer>
                                  <Button onClick={() => {
                                    // Mostrar modal o expandir para editar lección
                                    const newLesson = prompt('Editar título de lección:', lesson.titulo);
                                    if (newLesson) {
                                      handleUpdateLesson(moduleIndex, lessonIndex, 'titulo', newLesson);
                                    }
                                  }}>
                                    <FaEdit />
                                  </Button>
                                  <Button danger onClick={() => handleRemoveLesson(moduleIndex, lessonIndex)}>
                                    <FaTrash />
                                  </Button>
                                </ButtonsContainer>
                              </LessonItem>
                            ))}
                          </LessonList>
                        ) : (
                          <p>No hay lecciones en este módulo.</p>
                        )}
                      </ModuleContent>
                    </ModuleContainer>
                  ))
                )}
              </div>
            )}
            
            {activeTab === 'stats' && selectedCourse && (
              <div>
                <h3>Estadísticas del Curso</h3>
                <p>Estadísticas no disponibles en esta versión de demostración.</p>
                
                {/* Aquí irían estadísticas como:
                - Usuarios inscritos
                - Tasa de finalización
                - Calificaciones promedio
                - Tiempo promedio de completitud
                - etc. */}
              </div>
            )}
            
            <ModalFooter>
              <Button onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button primary onClick={handleSubmit}>{selectedCourse ? 'Actualizar' : 'Crear'}</Button>
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
            
            <p>¿Estás seguro de eliminar el curso <strong>{selectedCourse?.titulo}</strong>?</p>
            <p>Esta acción eliminará también todos los módulos, lecciones y evaluaciones asociadas.</p>
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

export default AdminCourseManagement;