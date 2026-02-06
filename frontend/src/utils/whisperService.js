// src/services/whisperService.js
// Servicio para transcripción de voz usando Whisper API de OpenAI
// Optimizado para iOS Safari con MediaRecorder

import axios from 'axios';

const WHISPER_API_URL = 'https://mentoria.ateneo.co/backend/api/whisper.php';

/**
 * Servicio de Whisper para transcripción de audio
 */
export const whisperService = {
  /**
   * Transcribe un archivo de audio usando Whisper API
   * @param {Blob} audioBlob - Audio en formato webm, mp3, wav, etc.
   * @param {number} userId - ID del usuario (opcional)
   * @returns {Promise<string>} Transcripción del audio
   */
  transcribe: async (audioBlob, userId = null) => {
    try {
      console.log('🎤 Whisper Service - Iniciando transcripción');
      console.log('📦 Tamaño del audio:', (audioBlob.size / 1024).toFixed(2), 'KB');
      console.log('🎵 Tipo de audio:', audioBlob.type);
      
      // Convertir Blob a base64
      const base64Audio = await blobToBase64(audioBlob);
      
      console.log('✅ Audio convertido a base64');
      console.log('📏 Longitud base64:', base64Audio.length, 'caracteres');
      
      // Preparar payload
      const payload = {
        audio: base64Audio,
        user_id: userId
      };
      
      console.log('📤 Enviando request a Whisper API...');
      
      // Enviar al backend
      const response = await axios.post(WHISPER_API_URL, payload, {
        timeout: 30000, // 30 segundos
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 Respuesta recibida:', response.data);
      
      // Verificar respuesta exitosa
      if (response.data.success) {
        const transcription = response.data.text;
        console.log('✅ Transcripción exitosa:', transcription);
        return transcription;
      } else {
        throw new Error(response.data.error || 'Error desconocido en la transcripción');
      }
      
    } catch (error) {
      console.error('❌ Error en whisperService.transcribe:', error);
      
      // Manejo de errores específicos
      if (error.response) {
        // Error del servidor
        const serverError = error.response.data?.error || error.response.statusText;
        throw new Error(`Error del servidor: ${serverError}`);
      } else if (error.request) {
        // No hubo respuesta
        throw new Error('No se pudo conectar con el servidor de transcripción');
      } else {
        // Error en la configuración del request
        throw new Error(error.message);
      }
    }
  }
};

/**
 * Convierte un Blob a string base64
 * @param {Blob} blob - Blob a convertir
 * @returns {Promise<string>} String base64 (sin prefijo data:)
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      // Resultado viene como "data:audio/webm;base64,XXXXXX"
      // Necesitamos solo la parte "XXXXXX"
      const base64String = reader.result;
      const base64Data = base64String.split(',')[1];
      
      if (!base64Data) {
        reject(new Error('Error al convertir audio a base64'));
        return;
      }
      
      resolve(base64Data);
    };
    
    reader.onerror = () => {
      reject(new Error('Error al leer el archivo de audio'));
    };
    
    reader.readAsDataURL(blob);
  });
};

export default whisperService;