<?php
/**
 * VideoRetroalimentacionHelper
 * 
 * Helper para manejar la retroalimentación conversacional con 3 preguntas
 * después de que el estudiante termina de ver un video en modo mentor.
 * 
 * Flujo:
 * 1. Genera 3 preguntas específicas del contenido del video
 * 2. Hace cada pregunta de manera conversacional
 * 3. Evalúa cada respuesta y da feedback constructivo
 * 4. Al final pregunta si quiere avanzar o repasar
 * 
 * @author MentorIA Team
 * @version 1.0
 */

class VideoRetroalimentacionHelper {
    
    /**
     * Genera las 3 preguntas iniciales usando OpenAI
     * 
     * @param array $videoData Datos del video con transcripción
     * @param string $userName Nombre del usuario
     * @param object $mentorPromptBuilder Instancia de MentorPromptBuilder
     * @param object $openai Instancia de OpenAIService
     * @return array|false Array con las 3 preguntas o false en caso de error
     */
    public static function generarTresPreguntasVideo($videoData, $userName, $mentorPromptBuilder, $openai) {
        error_log("🎯 Generando 3 preguntas específicas del video: {$videoData['titulo_completo']}");
        
        // Construir prompt para generar preguntas
        $prompt = $mentorPromptBuilder->generarPreguntasRetroalimentacion($videoData, $userName);
        
        // Llamar a OpenAI
        $messages = [
            ['role' => 'system', 'content' => 'Eres un generador de preguntas educativas. Responde SOLO con JSON válido.'],
            ['role' => 'user', 'content' => $prompt]
        ];
        
        try {
            // Usar método chat() en lugar de simpleChat()
            $responseData = $openai->chat($messages, [
                'model' => 'gpt-4o',
                'temperature' => 0.7,
                'max_tokens' => 800
            ]);
            
            // Extraer el contenido de la respuesta
            if (!$responseData || !isset($responseData['choices'][0]['message']['content'])) {
                error_log("❌ Error: Respuesta de OpenAI vacía o mal formada");
                return false;
            }
            
            $response = $responseData['choices'][0]['message']['content'];
            error_log("📝 Respuesta de OpenAI (generación de preguntas): " . substr($response, 0, 200));
            
            // Limpiar respuesta (quitar markdown si viene con ```json)
            $responseClean = trim($response);
            $responseClean = preg_replace('/```json\s*/', '', $responseClean);
            $responseClean = preg_replace('/```\s*$/', '', $responseClean);
            $responseClean = trim($responseClean);
            
            // Parsear JSON
            $preguntas = json_decode($responseClean, true);
            
            if (!$preguntas || !isset($preguntas['pregunta1']) || !isset($preguntas['pregunta2']) || !isset($preguntas['pregunta3'])) {
                error_log("❌ Error: JSON de preguntas mal formado");
                return false;
            }
            
            error_log("✅ 3 preguntas generadas correctamente");
            return [
                'pregunta1' => $preguntas['pregunta1'],
                'pregunta2' => $preguntas['pregunta2'],
                'pregunta3' => $preguntas['pregunta3']
            ];
            
        } catch (Exception $e) {
            error_log("❌ Error generando preguntas: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Inicia el flujo de retroalimentación haciendo la primera pregunta
     * 
     * @param array $videoData Datos del video
     * @param string $userName Nombre del usuario
     * @param int $sessionId ID de la sesión
     * @param object $db Conexión a la base de datos
     * @param object $mentorPromptBuilder Instancia de MentorPromptBuilder
     * @param object $openai Instancia de OpenAIService
     * @param object $contextManager Instancia de ContextManager
     * @return array Respuesta para el frontend
     */
    public static function iniciarRetroalimentacion($videoData, $userName, $sessionId, $db, $mentorPromptBuilder, $openai, $contextManager) {
        error_log("🎬 Iniciando retroalimentación para video: {$videoData['titulo_completo']}");
        
        // Generar las 3 preguntas
        $preguntas = self::generarTresPreguntasVideo($videoData, $userName, $mentorPromptBuilder, $openai);
        
        if (!$preguntas) {
            // Fallback: usar pregunta genérica si falla la generación
            error_log("⚠️ Usando pregunta genérica de fallback");
            return self::usarPreguntaGenerica($videoData, $userName);
        }
        
        // Guardar preguntas en la sesión para usarlas después
        self::guardarPreguntasEnSesion($db, $sessionId, $videoData['id'], $preguntas);
        
        // Construir mensaje inicial con la primera pregunta
        $mensajeInicial = "¡Excelente, {$userName}! Has llegado al final de la lección: **{$videoData['titulo_completo']}**.\n\n" .
                         "Antes de continuar, conversemos un poco para refrescar los conocimientos que adquiriste. " .
                         "Son solo 3 preguntitas rápidas sobre lo que vimos. 😊\n\n" .
                         "**Primera pregunta:**\n" .
                         $preguntas['pregunta1'];
        
        // Guardar mensaje en contexto
        $contextManager->saveMessage($sessionId, 'assistant', $mensajeInicial);
        
        return [
            'response' => $mensajeInicial,
            'has_images' => false,
            'images' => [],
            'retroalimentacion_activa' => true,
            'numero_pregunta' => 1,
            'video_id' => $videoData['id']
        ];
    }
    
    /**
     * Procesa una respuesta del estudiante y continúa con la siguiente pregunta
     * 
     * @param string $respuesta Respuesta del estudiante
     * @param int $numeroPregunta Número de pregunta actual (1, 2 o 3)
     * @param int $sessionId ID de la sesión
     * @param int $videoId ID del video
     * @param string $userName Nombre del usuario
     * @param object $db Conexión a la base de datos
     * @param object $mentorPromptBuilder Instancia de MentorPromptBuilder
     * @param object $openai Instancia de OpenAIService
     * @param object $contextManager Instancia de ContextManager
     * @return array Respuesta para el frontend
     */
    public static function procesarRespuesta($respuesta, $numeroPregunta, $sessionId, $videoId, $userName, $db, $mentorPromptBuilder, $openai, $contextManager) {
        error_log("💬 Procesando respuesta #{$numeroPregunta} del estudiante");
        
        // Obtener preguntas guardadas
        $datosRetroalimentacion = self::obtenerPreguntasGuardadas($db, $sessionId, $videoId);
        
        if (!$datosRetroalimentacion || !isset($datosRetroalimentacion['preguntas'])) {
            error_log("❌ No se encontraron preguntas guardadas");
            return self::errorYContinuar($userName);
        }
        
        $preguntas = $datosRetroalimentacion['preguntas'];
        $videoData = $datosRetroalimentacion['video_data'];
        
        // Obtener la pregunta que se hizo
        $preguntaHecha = $preguntas["pregunta{$numeroPregunta}"];
        
        // Guardar respuesta del estudiante en contexto
        $contextManager->saveMessage($sessionId, 'user', $respuesta);
        
        // Evaluar respuesta con OpenAI
        $prompt = $mentorPromptBuilder->evaluarRespuestaConversacional(
            $preguntaHecha,
            $respuesta,
            $videoData,
            $userName,
            $numeroPregunta
        );
        
        $messages = [
            ['role' => 'system', 'content' => 'Eres un mentor educativo evaluando respuestas de manera conversacional.'],
            ['role' => 'user', 'content' => $prompt]
        ];
        
        try {
            // Usar método chat() en lugar de simpleChat()
            $responseData = $openai->chat($messages, [
                'model' => 'gpt-4o',
                'temperature' => 0.7,
                'max_tokens' => 500
            ]);
            
            // Extraer el contenido de la respuesta
            if (!$responseData || !isset($responseData['choices'][0]['message']['content'])) {
                error_log("❌ Error: Respuesta de OpenAI vacía al evaluar");
                return self::errorYContinuar($userName);
            }
            
            $feedback = $responseData['choices'][0]['message']['content'];
            error_log("✅ Feedback generado para pregunta #{$numeroPregunta}");
            
            // Construir respuesta según número de pregunta
            if ($numeroPregunta < 3) {
                // Hay más preguntas
                $siguientePregunta = $preguntas["pregunta" . ($numeroPregunta + 1)];
                
                $respuestaCompleta = $feedback . "\n\n" .
                                    "**Siguiente pregunta:**\n" .
                                    $siguientePregunta;
                
                // Guardar en contexto
                $contextManager->saveMessage($sessionId, 'assistant', $respuestaCompleta);
                
                return [
                    'response' => $respuestaCompleta,
                    'has_images' => false,
                    'images' => [],
                    'retroalimentacion_activa' => true,
                    'numero_pregunta' => $numeroPregunta + 1,
                    'video_id' => $videoId
                ];
                
            } else {
                // Era la última pregunta - finalizar retroalimentación
                $respuestaCompleta = $feedback . "\n\n" .
                                    "---\n\n" .
                                    "¡Muy bien, {$userName}! Hemos terminado el repaso. " .
                                    "¿Te sientes preparado para avanzar a la siguiente lección o prefieres repasar este video nuevamente?";
                
                // Guardar en contexto
                $contextManager->saveMessage($sessionId, 'assistant', $respuestaCompleta);
                
                // Limpiar datos de retroalimentación de la sesión
                self::limpiarDatosRetroalimentacion($db, $sessionId, $videoId);
                
                return [
                    'response' => $respuestaCompleta,
                    'has_images' => false,
                    'images' => [],
                    'retroalimentacion_completa' => true,
                    'awaiting_confirmation' => true,
                    'video_id' => $videoId
                ];
            }
            
        } catch (Exception $e) {
            error_log("❌ Error evaluando respuesta: " . $e->getMessage());
            return self::errorYContinuar($userName);
        }
    }
    
    /**
     * Guarda las preguntas generadas en la base de datos para usarlas después
     * 
     * @param object $db Conexión a la base de datos
     * @param int $sessionId ID de la sesión
     * @param int $videoId ID del video
     * @param array $preguntas Array con las 3 preguntas
     * @return bool Success
     */
    private static function guardarPreguntasEnSesion($db, $sessionId, $videoId, $preguntas) {
        try {
            $stmt = $db->prepare("
                INSERT INTO doc_video_retroalimentacion_temp 
                (session_id, video_id, preguntas_json, created_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                preguntas_json = VALUES(preguntas_json),
                created_at = NOW()
            ");
            
            $stmt->execute([
                $sessionId,
                $videoId,
                json_encode($preguntas)
            ]);
            
            error_log("✅ Preguntas guardadas en sesión temporal");
            return true;
            
        } catch (Exception $e) {
            error_log("❌ Error guardando preguntas: " . $e->getMessage());
            // Si falla, intentar crear la tabla
            self::crearTablaRetroalimentacionSiNoExiste($db);
            return false;
        }
    }
    
    /**
     * Obtiene las preguntas guardadas de la sesión
     * 
     * @param object $db Conexión a la base de datos
     * @param int $sessionId ID de la sesión
     * @param int $videoId ID del video
     * @return array|false Array con preguntas y datos del video o false
     */
    private static function obtenerPreguntasGuardadas($db, $sessionId, $videoId) {
        try {
            $stmt = $db->prepare("
                SELECT r.preguntas_json, v.*
                FROM doc_video_retroalimentacion_temp r
                JOIN doc_mentor_videos v ON v.id = r.video_id
                WHERE r.session_id = ? AND r.video_id = ?
                ORDER BY r.created_at DESC
                LIMIT 1
            ");
            
            $stmt->execute([$sessionId, $videoId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result) {
                return false;
            }
            
            $preguntas = json_decode($result['preguntas_json'], true);
            
            return [
                'preguntas' => $preguntas,
                'video_data' => $result
            ];
            
        } catch (Exception $e) {
            error_log("❌ Error obteniendo preguntas guardadas: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Limpia los datos de retroalimentación de la sesión después de completar
     * 
     * @param object $db Conexión a la base de datos
     * @param int $sessionId ID de la sesión
     * @param int $videoId ID del video
     * @return bool Success
     */
    private static function limpiarDatosRetroalimentacion($db, $sessionId, $videoId) {
        try {
            $stmt = $db->prepare("
                DELETE FROM doc_video_retroalimentacion_temp 
                WHERE session_id = ? AND video_id = ?
            ");
            
            $stmt->execute([$sessionId, $videoId]);
            error_log("🧹 Datos de retroalimentación limpiados");
            return true;
            
        } catch (Exception $e) {
            error_log("❌ Error limpiando retroalimentación: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Crea la tabla temporal para retroalimentación si no existe
     * 
     * @param object $db Conexión a la base de datos
     * @return bool Success
     */
    private static function crearTablaRetroalimentacionSiNoExiste($db) {
        try {
            $sql = "CREATE TABLE IF NOT EXISTS doc_video_retroalimentacion_temp (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                video_id INT NOT NULL,
                preguntas_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_session_video (session_id, video_id),
                KEY idx_session (session_id),
                KEY idx_video (video_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            
            $db->exec($sql);
            error_log("✅ Tabla doc_video_retroalimentacion_temp creada/verificada");
            return true;
            
        } catch (Exception $e) {
            error_log("❌ Error creando tabla de retroalimentación: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Fallback: usar pregunta genérica si falla la generación de preguntas
     * 
     * @param array $videoData Datos del video
     * @param string $userName Nombre del usuario
     * @return array Respuesta con pregunta genérica
     */
    private static function usarPreguntaGenerica($videoData, $userName) {
        $preguntasGenericas = [
            "¿podrías contarme cuál consideras que fue el punto más importante de lo que acabamos de ver?",
            "¿qué concepto te pareció más relevante o interesante?",
            "¿podrías explicarme con tus propias palabras de qué trató esta lección?"
        ];
        
        $pregunta = $preguntasGenericas[array_rand($preguntasGenericas)];
        
        $mensaje = "¡Excelente, {$userName}! Has llegado al final de la lección: **{$videoData['titulo_completo']}**.\n\n" .
                  "Antes de continuar, " . $pregunta;
        
return [
            'response' => $mensaje,
            'has_images' => false,
            'images' => [],
            'retroalimentacion_activa' => true,
            'numero_pregunta' => 1,
            'video_id' => $videoData['id']
        ];
    }
    
    /**
     * Mensaje de error y opción de continuar
     * 
     * @param string $userName Nombre del usuario
     * @return array Respuesta de error
     */
    private static function errorYContinuar($userName) {
        return [
            'response' => "Entiendo tu respuesta, {$userName}. Hubo un pequeño problema técnico, pero no te preocupes. " .
                         "¿Te gustaría avanzar a la siguiente lección o prefieres repasar este video?",
            'has_images' => false,
            'images' => [],
            'retroalimentacion_completa' => true,
            'awaiting_confirmation' => true
        ];
    }
}
?>
