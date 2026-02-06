// src/services/analyticsService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://mentoria.ateneo.co/backend/api';

// Configurar interceptor para autenticación
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const analyticsService = {
  // ==========================================
  // MÉTRICAS GENERALES DEL DOCUMENTO
  // ==========================================
  
  /**
   * Obtiene métricas generales de un documento específico
   * @param {number} documentId - ID del documento
   * @returns {Promise} Objeto con métricas principales
   */
  getDocumentMetrics: async (documentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard-data.php?document_id=${documentId}&type=metrics`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo métricas del documento:', error);
      throw error;
    }
  },

  /**
   * Obtiene datos de actividad de usuarios para un documento
   * @param {number} documentId - ID del documento
   * @param {string} period - Período de tiempo (7d, 30d, 90d)
   * @returns {Promise} Array con datos de actividad
   */
  getUserActivity: async (documentId, period = '30d') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard-data.php?document_id=${documentId}&type=user_activity&period=${period}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo actividad de usuarios:', error);
      throw error;
    }
  },

  /**
   * Obtiene ranking de preguntas más frecuentes
   * @param {number} documentId - ID del documento
   * @param {number} limit - Número máximo de preguntas a retornar
   * @returns {Promise} Array con ranking de preguntas
   */
  getQuestionRanking: async (documentId, limit = 10) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard-data.php?document_id=${documentId}&type=question_ranking&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo ranking de preguntas:', error);
      throw error;
    }
  },

  /**
   * Obtiene progreso del modo mentor para un documento
   * @param {number} documentId - ID del documento
   * @returns {Promise} Array con datos de progreso
   */
  getMentorProgress: async (documentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard-data.php?document_id=${documentId}&type=mentor_progress`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo progreso mentor:', error);
      throw error;
    }
  },

  /**
   * Obtiene resultados de evaluaciones para un documento
   * @param {number} documentId - ID del documento
   * @returns {Promise} Array con resultados de evaluaciones
   */
  getEvaluationResults: async (documentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard-data.php?document_id=${documentId}&type=evaluation_results`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo resultados de evaluaciones:', error);
      throw error;
    }
  },

  // ==========================================
  // ANALÍTICAS TEMPORALES
  // ==========================================
  
  /**
   * Obtiene actividad por hora del día
   * @param {number} documentId - ID del documento
   * @returns {Promise} Array con actividad por hora
   */
  getHourlyActivity: async (documentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/time-analytics.php?document_id=${documentId}&type=hourly`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo actividad por hora:', error);
      throw error;
    }
  },

  /**
   * Obtiene actividad por día de la semana
   * @param {number} documentId - ID del documento
   * @returns {Promise} Array con actividad por día de la semana
   */
  getWeeklyActivity: async (documentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/time-analytics.php?document_id=${documentId}&type=weekly`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo actividad por día de la semana:', error);
      throw error;
    }
  },

  /**
   * Obtiene tendencias temporales de actividad
   * @param {number} documentId - ID del documento
   * @param {string} period - Período (daily, weekly, monthly)
   * @param {number} limit - Número de períodos a retornar
   * @returns {Promise} Array con tendencias temporales
   */
  getTemporalTrends: async (documentId, period = 'daily', limit = 30) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/time-analytics.php?document_id=${documentId}&type=trends&period=${period}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo tendencias temporales:', error);
      throw error;
    }
  },

  // ==========================================
  // RANKINGS DE USUARIOS
  // ==========================================
  
  /**
   * Obtiene usuarios más activos
   * @param {number} documentId - ID del documento
   * @param {number} limit - Número de usuarios a retornar
   * @returns {Promise} Array con usuarios más activos
   */
  getMostActiveUsers: async (documentId, limit = 10) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/user-rankings.php?document_id=${documentId}&type=most_active&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo usuarios más activos:', error);
      throw error;
    }
  },

  /**
   * Obtiene usuarios con mejores calificaciones
   * @param {number} documentId - ID del documento
   * @param {number} limit - Número de usuarios a retornar
   * @returns {Promise} Array con usuarios con mejores calificaciones
   */
  getTopPerformers: async (documentId, limit = 10) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/user-rankings.php?document_id=${documentId}&type=top_performers&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo usuarios top:', error);
      throw error;
    }
  },

  // ==========================================
  // FUNCIONES DE UTILIDAD
  // ==========================================
  
  /**
   * Obtiene resumen completo del dashboard
   * @param {number} documentId - ID del documento
   * @returns {Promise} Objeto con todos los datos principales del dashboard
   */
  getDashboardSummary: async (documentId) => {
    try {
      const [
        metrics,
        userActivity,
        questionRanking,
        mentorProgress,
        evaluationResults,
        timelyTrends
      ] = await Promise.all([
        analyticsService.getDocumentMetrics(documentId),
        analyticsService.getUserActivity(documentId, '30d'),
        analyticsService.getQuestionRanking(documentId, 10),
        analyticsService.getMentorProgress(documentId),
        analyticsService.getEvaluationResults(documentId),
        analyticsService.getTemporalTrends(documentId, 'daily', 7)
      ]);

      return {
        metrics,
        userActivity,
        questionRanking,
        mentorProgress,
        evaluationResults,
        timelyTrends,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error obteniendo resumen del dashboard:', error);
      throw error;
    }
  },

  /**
   * Obtiene datos de actividad temporal para gráficos
   * @param {number} documentId - ID del documento
   * @param {string} period - Período (24h, 7days, 30days, 90days) o 'heatmap' para mapa de calor
   * @returns {Promise} Array con datos de actividad
   */
  getActivityData: async (documentId, period = '7days') => {
    try {
      // Si es heatmap, usar endpoint específico
      if (period === 'heatmap') {
        const response = await axios.get(`${API_BASE_URL}/analytics/time-analytics.php?document_id=${documentId}&type=heatmap`);
        return response.data;
      }

      const response = await axios.get(`${API_BASE_URL}/analytics/time-analytics.php?document_id=${documentId}&type=activity_data&period=${period}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo datos de actividad:', error);
      throw error;
    }
  },

  /**
   * Obtiene ranking de usuarios
   * @param {number} documentId - ID del documento
   * @param {string} type - Tipo de ranking (general_ranking, most_active, etc.)
   * @param {number} limit - Límite de resultados
   * @returns {Promise} Array con ranking de usuarios
   */
  getUserRanking: async (documentId, type = 'general_ranking', limit = 10) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/user-rankings.php?document_id=${documentId}&type=${type}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo ranking de usuarios:', error);
      throw error;
    }
  },

    /**
   * Obtiene datos de progreso del modo mentor
   * @param {number} documentId - ID del documento
   * @param {string} type - Tipo de datos (overview, detailed_progress, etc.)
   * @returns {Promise} Datos de progreso mentor
   */
  getMentorProgress: async (documentId, type = 'overview') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/mentor-progress.php?document_id=${documentId}&type=${type}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo progreso mentor:', error);
      throw error;
    }
  },

  /**
   * Obtiene análisis de evaluaciones
   * @param {number} documentId - ID del documento
   * @param {string} type - Tipo de análisis (overview, score_distribution, etc.)
   * @returns {Promise} Datos de análisis de evaluaciones
   */
  getEvaluationAnalytics: async (documentId, type = 'overview') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/evaluation-analytics.php?document_id=${documentId}&type=${type}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo análisis de evaluaciones:', error);
      throw error;
    }
  },

  /**
   * Obtiene ranking de preguntas más frecuentes
   * @param {number} documentId - ID del documento
   * @param {string} mode - Modo de filtro (all, consulta, mentor, evaluacion)
   * @param {number} limit - Límite de resultados
   * @returns {Promise} Ranking de preguntas
   */
  getQuestionRanking: async (documentId, mode = 'all', limit = 20) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/question-ranking.php?document_id=${documentId}&mode=${mode}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo ranking de preguntas:', error);
      throw error;
    }
  },

  /**
   * Valida si un documento tiene analytics habilitados
   * @param {number} documentId - ID del documento
   * @returns {Promise} Boolean indicando si tiene analytics habilitados
   */
  checkAnalyticsEnabled: async (documentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/dashboard-data.php?document_id=${documentId}&type=check_enabled`);
      return response.data.enabled;
    } catch (error) {
      console.error('Error verificando analytics:', error);
      return false;
    }
  },

  /**
   * Obtiene las preguntas realizadas por un usuario específico
   * @param {number} documentId - ID del documento
   * @param {number} userId - ID del usuario
   * @param {number} limit - Límite de resultados
   * @returns {Promise} Array con las preguntas del usuario
   */
  getUserQuestions: async (documentId, userId, limit = 50) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/user-rankings.php?document_id=${documentId}&type=user_questions&user_id=${userId}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo preguntas del usuario:', error);
      throw error;
    }
  },

  /**
   * Obtiene los usuarios que hicieron una pregunta específica
   * @param {number} documentId - ID del documento
   * @param {string} question - Texto exacto de la pregunta
   * @param {string} mode - Modo de filtro (all, consulta, mentor, evaluacion)
   * @returns {Promise} Objeto con lista de usuarios y estadísticas
   */
  getQuestionUsers: async (documentId, question, mode = 'all') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/question-ranking.php`, {
        params: {
          document_id: documentId,
          type: 'question_users',
          question: question,
          mode: mode
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo usuarios de la pregunta:', error);
      throw error;
    }
  }
};



export default analyticsService;