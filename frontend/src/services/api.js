// src/services/api.js
import axios from 'axios';

const API_BASE_URL = 'https://mentoria.ateneo.co/backend/api';


// Interceptor para añadir el token a todas las peticiones
axios.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// 🆕 Interceptor para manejar respuestas y errores 401
axios.interceptors.response.use(
    response => {
        // Si la respuesta es exitosa, simplemente la retornamos
        return response;
    },
    error => {
        // Verificar si el error es 401 (No autorizado)
        if (error.response && error.response.status === 401) {
            console.log('🚨 Error 401: Token expirado o inválido');
            
            // Limpiar el almacenamiento local
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Emitir evento personalizado para notificar al componente
            window.dispatchEvent(new CustomEvent('sessionExpired', {
                detail: { message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.' }
            }));
            
            // Redirigir al login después de un breve delay
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        }
        
        return Promise.reject(error);
    }
);

export const certificadoService = {
    getCertificadosByUser: (userId) =>
      axios.get(`${API_BASE_URL}/certificados.php?user_id=${userId}`)
  };
  

  export const adminService = {
    getDashboardStats: () => {
      return axios.get(`${API_BASE_URL}/admin/dashboard-stats.php`);
      },

      // Gestión de servicio de voz
    getVoiceService: () => {
      return axios.get(`${API_BASE_URL}/admin/voice-service.php`);
  },
  
  updateVoiceService: (config) => {
      return axios.post(`${API_BASE_URL}/admin/voice-service.php`, config);
  },
  
  getAvailableVoices: (service) => {
      return axios.get(`${API_BASE_URL}/voices.php?service=${service}`);
  }

  };
  

// Servicios de progreso del usuario
export const progressService = {
    getUserProgress: (userId) => {
        return axios.get(`${API_BASE_URL}/progress.php?user_id=${userId}`);
    },
    saveProgress: (progressData) => {
        return axios.post(`${API_BASE_URL}/progress.php`, progressData);
    },
    getLastActivity: (userId) => {
        return axios.get(`${API_BASE_URL}/progress.php?user_id=${userId}&last_activity=true`);
    },

    getFullCourseProgress: (userId, cursoId, moduleId) => {
        return axios.get(`${API_BASE_URL}/progress.php?user_id=${userId}&curso_id=${cursoId}&module_id=${moduleId}`);
      },

      registerCompletedCourse: ({ user_id, curso_id }) => {
        return axios.post(`${API_BASE_URL}/completed_course.php`, {
            user_id,
            curso_id
        });   
    },

      // Nuevos servicios para administradores
  getSystemProgress: () => {
    return axios.get(`${API_BASE_URL}/admin/progress-stats.php`);
  },
  
  getActivityByDay: () => {
    return axios.get(`${API_BASE_URL}/admin/activity-by-day.php`);
  },
  
  getUserRegistrationsByDate: () => {
    return axios.get(`${API_BASE_URL}/admin/user-registrations.php`);
  },
  
  getCourseCompletion: (courseId) => {
    return axios.get(`${API_BASE_URL}/admin/course-completion.php?course_id=${courseId}`);
  }
};

// Servicios de evaluación
export const evaluationService = {
    submitEvaluation: (evaluationData) => {
        return axios.post(`${API_BASE_URL}/evaluations.php`, evaluationData);
    },
    getUserEvaluations: (userId) => {
        return axios.get(`${API_BASE_URL}/evaluations.php?user_id=${userId}`);
    },
    getEvaluationById: (id) => {
        return axios.get(`${API_BASE_URL}/evaluations.php?id=${id}`);
    },
    evaluateAnswer: (question, expectedAnswer, userAnswer) => {
        return axios.post(`${API_BASE_URL}/evaluate-answer.php`, {
            question,
            expectedAnswer,
            userAnswer
        });
    },

    // Nuevos servicios para administradores
  getAllEvaluations: () => {
    return axios.get(`${API_BASE_URL}/admin/evaluations.php`);
  },
  getEvaluationWithQuestions: (id) => {
    return axios.get(`${API_BASE_URL}/admin/evaluations.php?id=${id}&include_questions=true`);
  },
  createEvaluation: (evaluationData) => {
    return axios.post(`${API_BASE_URL}/admin/evaluations.php`, evaluationData);
  },
  updateEvaluation: (evaluationData) => {
    return axios.put(`${API_BASE_URL}/admin/evaluations.php`, evaluationData);
  },
  deleteEvaluation: (id) => {
    return axios.delete(`${API_BASE_URL}/admin/evaluations.php`, { 
      data: { id } 
    });
  },
  getScoreDistribution: () => {
    return axios.get(`${API_BASE_URL}/admin/evaluation-scores.php`);
  }

};

// Servicios de preguntas
export const questionService = {
    getQuestionsByModule: (moduleId) => {
        return axios.get(`${API_BASE_URL}/questions.php?module_id=${moduleId}`);
    }
};

// Servicios de autenticación
export const authService = {
    login: (credentials) => {
        return axios.post(`${API_BASE_URL}/auth.php?action=login`, credentials);
    },
    register: (userData) => {
        return axios.post(`${API_BASE_URL}/auth.php?action=register`, userData);
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

// Servicios de cursos
export const courseService = {
    getAllCourses: () => {
        return axios.get(`${API_BASE_URL}/courses.php`);
    },
    getCourseById: (id) => {
        return axios.get(`${API_BASE_URL}/courses.php?id=${id}`);
    },
    getModulesByCourse: (courseId) => {
        return axios.get(`${API_BASE_URL}/modules.php?course_id=${courseId}`);
    },

    // Nuevos servicios para administradores
  createCourse: (courseData) => {
    return axios.post(`${API_BASE_URL}/admin/courses.php`, courseData);
  },
  updateCourse: (courseData) => {
    return axios.put(`${API_BASE_URL}/admin/courses.php`, courseData);
  },
  deleteCourse: (id) => {
    return axios.delete(`${API_BASE_URL}/admin/courses.php`, { 
      data: { id } 
    });
  }

};

// Servicios de lecciones
export const lessonService = {
    getLessonsByCourse: (courseId) => {
        return axios.get(`${API_BASE_URL}/lessons.php?curso_id=${courseId}`);
    },
    getLessonById: (id) => {
        return axios.get(`${API_BASE_URL}/lessons.php?id=${id}`);
    },
    getLessonsByModule: (moduleId) => {
        return axios.get(`${API_BASE_URL}/lessons.php?module_id=${moduleId}`);
    },
    getNextActivity: (moduleId, currentLessonId) => {
        return axios.get(`${API_BASE_URL}/lessons.php?action=next_activity&module_id=${moduleId}&current_lesson_id=${currentLessonId}`);
      },
      
      
      markLessonCompleted: ({ user_id, lesson_id, completado = 1 }) => {
        // Si no hay user_id, intentar recuperarlo del localStorage
        if (!user_id) {
          try {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser && storedUser.id) {
              console.log('Recuperando ID de usuario desde localStorage en api.js:', storedUser.id);
              user_id = storedUser.id;
            }
          } catch (e) {
            console.error('Error recuperando usuario desde localStorage en api.js:', e);
          }
        }
      
        // Convertir a números
        const userData = {
          user_id: user_id ? (typeof user_id === 'string' ? parseInt(user_id, 10) : user_id) : null,
          lesson_id: typeof lesson_id === 'string' ? parseInt(lesson_id, 10) : lesson_id,
          completado: typeof completado === 'string' ? parseInt(completado, 10) : completado
        };
      
        // Registrar datos enviados
        console.log('Enviando datos a progress.php:', userData);
      
        return axios.post(`${API_BASE_URL}/progress.php`, userData)
          .then(response => {
            console.log('Respuesta de progress.php:', response.data);
            return response;
          })
          .catch(error => {
            console.error('Error al marcar lección completada:', error);
            if (error.response) {
              console.error('Datos de respuesta del error:', error.response.data);
            }
            throw error;
          });
      }
      
};

// Servicios de voz
export const voiceService = {
    // Texto a voz
    speak: (text, options = {}) => {

          // 🔍 AGREGAR ESTAS LÍNEAS AQUÍ
    console.log('🔍 DEBUG API - options completo:', options);
    console.log('🔍 DEBUG API - options.sessionToken:', options.sessionToken);
    console.log('🔍 DEBUG API - typeof:', typeof options.sessionToken);

        return axios.post(`${API_BASE_URL}/tts.php`, { 
            text,
            forceService: options.forceService,
            voiceId: options.voiceId,
            sessionToken: options.sessionToken // 🆕 AGREGAR ESTA LÍNEA
        });
    },
    
    // Obtener voces disponibles
    getVoices: (service = 'polly') => {
        return axios.get(`${API_BASE_URL}/voices.php?service=${service}`);
    },
    
    // Interpretación de comandos con OpenAI
    interpretCommand: (command, context = {}) => {
        return axios.post(`${API_BASE_URL}/voice-command.php`, { command, context });
    }
};

export const completedCourseService = {
    saveCompletedCourse: (userId, cursoId) => {
      return axios.post(`${API_BASE_URL}/completed.php`, {
        user_id: userId,
        curso_id: cursoId
      });
    }
  };
  
  export const userService = {
    getAll: () => axios.get(`${API_BASE_URL}/users.php`),
    deleteUser: (id) => axios.delete(`${API_BASE_URL}/users.php`, { data: { id } }),
    updateUser: (data) => axios.put(`${API_BASE_URL}/users.php`, data),

    // Nuevos servicios para administradores
  createUser: (userData) => {
    return axios.post(`${API_BASE_URL}/admin/create-user.php`, userData);
  }

  };
 
  // src/services/api.js
// Agregar al final del archivo:

// Servicios de consulta
export const consultaService = {
  // Obtener información de un documento
  getDocumentById: (documentId) => {
    return axios.get(`${API_BASE_URL}/documentos.php?id=${documentId}`);
  },
  
  // Enviar una consulta
  sendQuestion: (data) => {
    return axios.post(`${API_BASE_URL}/consulta.php`, data);
  },
  
  // Obtener lista de documentos disponibles
  getDocumentos: () => {
    return axios.get(`${API_BASE_URL}/documentos.php`);
  },
  
  // Crear un nuevo documento
  createDocumento: (formData) => {
    console.log("Enviando createDocumento a", `${API_BASE_URL}/documentos.php`);
    
    // Debug - listar contenido del FormData
    for (let pair of formData.entries()) {
      console.log(pair[0] + ': ' + (pair[0] === 'imagen' ? 'File object' : pair[1]));
    }
    
    return axios.post(`${API_BASE_URL}/documentos.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  // Actualizar un documento existente
// Actualizar un documento existente
updateDocumento: (data) => {
  console.log('🔄 updateDocumento - Enviando PUT con datos:', data);
  return axios.put(`${API_BASE_URL}/documentos.php`, data, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
},
  
  // Subir/actualizar imagen de un documento
  uploadDocumentoImagen: (documentId, file) => {
    const formData = new FormData();
    formData.append('imagen', file);
    return axios.patch(`${API_BASE_URL}/documentos.php?id=${documentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // Eliminar un documento
  deleteDocumento: (id) => {
    return axios.delete(`${API_BASE_URL}/documentos.php?id=${id}`);
  },
  
  // Obtener progreso del modo mentor para un usuario
  getMentorProgress: (documentId, userId) => {
    return axios.get(`${API_BASE_URL}/mentor/progreso.php`, {
      params: {
        document_id: documentId,
        user_id: userId
      }
    });
  },

  // Obtener video de una lección específica
  getVideoForLesson: (documentId, moduleNumber, lessonNumber) => {
    return axios.get(`${API_BASE_URL}/mentor/video-leccion.php`, {
      params: {
        document_id: documentId,
        modulo: moduleNumber,
        leccion: lessonNumber
      }
    });
  }
};

// Servicios de anexos multimedia
export const attachmentService = {
  // Subir anexo
upload: (documentId, file, titulo, descripcion = '', keywords = '', transcripcion = '') => {
  const formData = new FormData();
  
  if (file) {
    formData.append('file', file);
  }
  formData.append('document_id', documentId);
  formData.append('titulo', titulo);
  formData.append('descripcion', descripcion);
  formData.append('keywords', keywords);
  formData.append('transcripcion', transcripcion); // ✅ AGREGAR ESTA LÍNEA

  return axios.post(`${API_BASE_URL}/anexos.php?action=upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: (progressEvent) => {
      const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      window.dispatchEvent(new CustomEvent('uploadProgress', { 
        detail: { progress, file: file ? file.name : 'video-vimeo' } 
      }));
    }
  });
},



  // Obtener anexos por documento
  getByDocument: (documentId, activeOnly = true) => {
    return axios.get(`${API_BASE_URL}/anexos.php?action=by_document&document_id=${documentId}&active_only=${activeOnly}`);
  },

  // Obtener anexo específico
  getById: (anexoId) => {
    return axios.get(`${API_BASE_URL}/anexos.php?action=by_id&id=${anexoId}`);
  },

  // Buscar anexos
  search: (documentId, keywords) => {
    return axios.get(`${API_BASE_URL}/anexos.php?action=search&document_id=${documentId}&keywords=${encodeURIComponent(keywords)}`);
  },

  // Actualizar anexo
  update: (anexoData) => {
    return axios.put(`${API_BASE_URL}/anexos.php`, anexoData);
  },

  // Eliminar anexo
  delete: (anexoId, hardDelete = false) => {
    return axios.delete(`${API_BASE_URL}/anexos.php?id=${anexoId}&hard=${hardDelete}`);
  },

  // Obtener estadísticas
  getStats: () => {
    return axios.get(`${API_BASE_URL}/anexos.php?action=stats`);
  },

  // Limpiar archivos huérfanos
  cleanup: () => {
    return axios.post(`${API_BASE_URL}/anexos.php?action=cleanup`);
  },

  // Descargar archivo
  download: (anexoId, isThumb = false) => {
    const url = `${API_BASE_URL}/anexos.php?action=download&id=${anexoId}&thumb=${isThumb}`;
    window.open(url, '_blank');
  },

  // Validar archivo antes de subir
  validateFile: (file, maxSizeMB = 5) => {
    const errors = [];
    
    // Validar tamaño
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      errors.push(`El archivo es demasiado grande. Máximo: ${maxSizeMB}MB`);
    }

    // Validar tipo
    const allowedTypes = {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      document: ['application/pdf'],
      video: ['video/mp4', 'video/webm'],
      audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
    };

    const isValidType = Object.values(allowedTypes).flat().includes(file.type);
    if (!isValidType) {
      errors.push('Tipo de archivo no permitido');
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      fileType: Object.keys(allowedTypes).find(type => 
        allowedTypes[type].includes(file.type)
      ) || 'other'
    };
  }
};

// Servicios de transcripciones de video
export const transcriptionService = {
  // Guardar transcripción
  save: (videoId, transcripcion, formato = 'texto', timestamps = null) => {
    return axios.post(`${API_BASE_URL}/video-transcripciones.php?action=save`, {
      video_id: videoId,
      transcripcion: transcripcion,
      formato: formato,
      timestamps: timestamps
    });
  },

  // Obtener transcripción
  get: (videoId) => {
    return axios.get(`${API_BASE_URL}/video-transcripciones.php?video_id=${videoId}`);
  },

  // Procesar transcripción de texto con timestamps
  processTimestampText: (text) => {
    const lines = text.split('\n');
    const processed = {
      texto_limpio: '',
      timestamps: []
    };

    lines.forEach(line => {
      const match = line.match(/^(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+)(.+)$/);
      if (match) {
        const [, inicio, fin, texto] = match;
        processed.texto_limpio += texto.trim() + ' ';
        processed.timestamps.push({
          inicio: inicio,
          fin: fin,
          texto: texto.trim()
        });
      }
    });

    return processed;
  }
};

// Servicios de reto semanal
export const retoService = {
  // Verificar si hay reto pendiente para el usuario
  verificarRetoPendiente: (documentId, userId) => {
    return axios.get(`${API_BASE_URL}/reto.php`, {
      params: {
        action: 'verificar',
        document_id: documentId,
        user_id: userId
      }
    });
  },

  // Obtener historial de retos del usuario
  obtenerHistorial: (documentId, userId, limite = 10) => {
    return axios.get(`${API_BASE_URL}/reto.php`, {
      params: {
        action: 'historial',
        document_id: documentId,
        user_id: userId,
        limite: limite
      }
    });
  },

  // Enviar respuesta a un reto
  responderReto: (retoId, userId, respuesta) => {
    return axios.post(`${API_BASE_URL}/reto.php`, {
      action: 'responder',
      reto_id: retoId,
      user_id: userId,
      respuesta: respuesta
    });
  },

  // Obtener estadísticas de retos para admin
  obtenerEstadisticasAdmin: (documentId) => {
    return axios.get(`${API_BASE_URL}/reto.php`, {
      params: {
        action: 'admin_stats',
        document_id: documentId
      }
    });
  },

  // Generar reto manualmente (admin)
  generarReto: (documentId, diaReto = null) => {
    return axios.post(`${API_BASE_URL}/reto.php`, {
      action: 'generar',
      document_id: documentId,
      dia_reto: diaReto
    });
  },

  // Obtener detalle de un reto específico con todas sus respuestas
  obtenerDetalleReto: (retoId) => {
    return axios.get(`${API_BASE_URL}/reto.php`, {
      params: {
        action: 'reto_detalle',
        reto_id: retoId
      }
    });
  }
};

export default {
  auth: authService,
  courses: courseService,
  lessons: lessonService,
  voice: voiceService,
  evaluations: evaluationService,
  questions: questionService,
  progress: progressService,
  admin: adminService,
  users: userService,
  certificates: certificadoService,
  completedCourses: completedCourseService,
  consulta: consultaService,
  attachments: attachmentService,
  transcriptions: transcriptionService,
  reto: retoService  // Servicio de reto semanal
};
