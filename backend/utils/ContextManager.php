<?php
/**
 * ContextManager
 * 
 * Gestiona el contexto conversacional manteniendo una ventana deslizante
 * de mensajes recientes para permitir preguntas de seguimiento naturales.
 * 
 * @author MentorIA Team
 * @version 1.0
 */

class ContextManager {
    private $db;
    
    // Configuración de ventana de contexto
    private $maxContextMessages = 5; // Últimos 5 intercambios (10 mensajes)
    private $contextWindowSize = 10; // 5 user + 5 assistant
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Guarda un mensaje en el historial de la sesión
     * 
     * @param int $sessionId ID de la sesión
     * @param string $role 'user' o 'assistant'
     * @param string $content Contenido del mensaje
     * @param array $metadata Metadata adicional (opcional)
     * @return bool Success status
     */
    public function saveMessage($sessionId, $role, $content, $metadata = []) {
        try {
            // Mapear role a tipo según estructura de BD
            $tipo = ($role === 'user') ? 'pregunta_usuario' : 'comando';
            
            // Agregar rol a metadata para poder recuperarlo después
            if (!isset($metadata['role'])) {
                $metadata['role'] = $role;
            }
            
            $stmt = $this->db->prepare("
                INSERT INTO doc_conversacion_mensajes 
                (session_id, tipo, contenido, metadata, timestamp) 
                VALUES (?, ?, ?, ?, NOW())
            ");
            
            $metadataJson = !empty($metadata) ? json_encode($metadata) : null;
            
            $stmt->execute([
                $sessionId,
                $tipo,
                $content,
                $metadataJson
            ]);
            
            return true;
        } catch (Exception $e) {
            error_log("Error guardando mensaje en contexto: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtiene el contexto reciente de una sesión (ventana deslizante)
     * 
     * @param int $sessionId ID de la sesión
     * @param int $limit Número de mensajes a obtener (default: 10)
     * @return array Array de mensajes con formato ['role' => ..., 'content' => ...]
     */
public function getRecentContext($sessionId, $limit = null) {
    if ($limit === null) {
        $limit = $this->contextWindowSize;
    }
    
    // Asegurar que limit sea un entero
    $limit = (int)$limit;
    
    try {
        // 🆕 FILTRAR mensajes que no tienen contexto_cerrado = true
        // Esto excluye mensajes de modos anteriores
        $stmt = $this->db->prepare("
            SELECT tipo, contenido, metadata, timestamp 
            FROM doc_conversacion_mensajes 
            WHERE session_id = ? 
            AND (
                metadata IS NULL 
                OR JSON_EXTRACT(metadata, '$.contexto_cerrado') IS NULL
                OR JSON_EXTRACT(metadata, '$.contexto_cerrado') = FALSE
            )
            ORDER BY timestamp DESC 
            LIMIT " . $limit . "
        ");
            
            $stmt->execute([$sessionId]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Invertir orden para que sea cronológico
            $messages = array_reverse($messages);
            
            // Formatear para OpenAI
            $formattedMessages = [];
            foreach ($messages as $msg) {
                // Intentar recuperar rol de metadata
                $role = 'user'; // default
                if (!empty($msg['metadata'])) {
                    $metadata = json_decode($msg['metadata'], true);
                    if (isset($metadata['role'])) {
                        $role = $metadata['role'];
                    }
                }
                
                // Si no hay metadata, usar tipo para determinar rol
                if ($role === 'user' && $msg['tipo'] !== 'pregunta_usuario') {
                    $role = 'assistant';
                }
                
                $formattedMessages[] = [
                    'role' => $role,
                    'content' => $msg['contenido']
                ];
            }
            
            return $formattedMessages;
            
        } catch (Exception $e) {
            error_log("Error obteniendo contexto: " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Limpia mensajes antiguos manteniendo solo la ventana reciente
     * (Optimización para evitar tablas muy grandes)
     * 
     * @param int $sessionId ID de la sesión
     * @return bool Success status
     */
    public function cleanOldMessages($sessionId) {
        try {
            // Mantener solo los últimos 20 mensajes por sesión
            $stmt = $this->db->prepare("
                DELETE FROM doc_conversacion_mensajes 
                WHERE session_id = ? 
                AND id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM doc_conversacion_mensajes 
                        WHERE session_id = ? 
                        ORDER BY timestamp DESC 
                        LIMIT 20
                    ) as recent_messages
                )
            ");
            
            $stmt->execute([$sessionId, $sessionId]);
            return true;
            
        } catch (Exception $e) {
            error_log("Error limpiando mensajes antiguos: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtiene estadísticas de la sesión actual
     * 
     * @param int $sessionId ID de la sesión
     * @return array Estadísticas (total_messages, user_questions, assistant_responses)
     */
    public function getSessionStats($sessionId) {
        try {
            $stmt = $this->db->prepare("
                SELECT 
                    COUNT(*) as total_messages,
                    SUM(CASE WHEN tipo = 'pregunta_usuario' THEN 1 ELSE 0 END) as user_questions,
                    SUM(CASE WHEN tipo != 'pregunta_usuario' THEN 1 ELSE 0 END) as assistant_responses
                FROM doc_conversacion_mensajes 
                WHERE session_id = ?
            ");
            
            $stmt->execute([$sessionId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
            
        } catch (Exception $e) {
            error_log("Error obteniendo estadísticas de sesión: " . $e->getMessage());
            return [
                'total_messages' => 0,
                'user_questions' => 0,
                'assistant_responses' => 0
            ];
        }
    }
    
    /**
     * Detecta si el mensaje actual necesita contexto previo
     * (Ej: "¿y eso?", "¿por qué?", "explica más", "sí me gustaría")
     * 
     * @param string $userMessage Mensaje del usuario
     * @return bool True si necesita contexto
     */
    public function needsContextualUnderstanding($userMessage) {
        $messageLower = strtolower(trim($userMessage));
        
        error_log("🔍 DETECTANDO CONTEXTO para: '{$messageLower}'");
        
        // 🆕 RESPUESTAS DE AFIRMACIÓN/NEGACIÓN (indican seguimiento)
        $afirmacionesPatterns = [
            // Afirmaciones simples
            '/^(si|sí)\s*$/i',  // "sí" o "si" solo
            '/^(si|sí)\s+(me\s+)?(gustaria|gustaría|quiero|quisiera)$/i',  // "sí me gustaría"
            '/^(si|sí)\s+(por\s+favor|porfavor|gracias|perfecto|claro)$/i',  // "sí por favor"
            
            // Afirmaciones elaboradas
            '/^(claro|por\s+supuesto|vale|ok|okay|dale|perfecto)\s*$/i',
            '/^(claro\s+que\s+)(si|sí)$/i',  // "claro que sí"
            
            // Negaciones
            '/^no(\s+gracias|\s+,?\s*gracias)?$/i',  // "no" o "no gracias"
            
            // Expresiones de interés
            '/^(me\s+)?(gustaria|gustaría|interesa|interesaria|interesaría)$/i',  // "me gustaría"
            '/^(quiero|quisiera)(\s+saber(\s+mas|\s+más)?)?$/i'  // "quiero" o "quiero saber más"
        ];
        
        foreach ($afirmacionesPatterns as $i => $pattern) {
            if (preg_match($pattern, $messageLower)) {
                error_log("✅ DETECTADA afirmación con patrón #{$i}: '{$messageLower}'");
                return true;
            }
        }
        
        // Patrones que indican referencia al contexto previo
        $contextPatterns = [
            // Pronombres demostrativos sin referente claro
            '/^(y )?eso\??$/i',
            '/^(y )?esto\??$/i',
            '/^(y )?esa\??$/i',
            
            // Preguntas de seguimiento cortas
            '/^¿?(por qué|porque)\??$/i',
            '/^¿?(cómo|como)\??$/i',
            '/^¿?qué es\??$/i',
            '/^¿?cuál\??$/i',
            
            // Peticiones de elaboración
            '/^(explica|explicame|profundiza|dime) más$/i',
            '/^dame (más|otro) ejemplo/i',
            '/^¿?y (qué|que) (pasa|sucede|ocurre)/i',
            
            // Referencias pronominales
            '/^(de|en|con) (eso|esto|esa)/i',
            '/^(lo|la) entiendo pero/i',
            
            // Conectores de continuación
            '/^(y |entonces |luego |después )/i',
            
            // Preguntas con pronombres sin antecedente
            '/\b(lo|la|los|las|eso|esos|esas)\b(?!.*\b(es|son|fue|fueron)\b)/i'
        ];
        
        foreach ($contextPatterns as $pattern) {
            if (preg_match($pattern, $messageLower)) {
                return true;
            }
        }
        
        // Si el mensaje es muy corto (< 20 caracteres) y no es una palabra clave obvia
        if (strlen($messageLower) < 20 && !$this->isStandaloneQuestion($messageLower)) {
            error_log("✅ Mensaje CORTO detectado que necesita contexto: '{$messageLower}' (longitud: " . strlen($messageLower) . ")");
            return true;
        }
        
        error_log("❌ NO SE DETECTÓ necesidad de contexto para: '{$messageLower}'");
        return false;
    }
    
    /**
     * Verifica si es una pregunta independiente que no necesita contexto
     * 
     * @param string $message Mensaje en minúsculas
     * @return bool True si es pregunta independiente
     */
    private function isStandaloneQuestion($message) {
        $standalonePatterns = [
            '/^(qué|que) es (el|la|los|las|un|una)/i',
            '/^(cómo|como) (se |funciona|opera)/i',
            '/^(cuál|cual|cuales|cuáles) (es|son)/i',
            '/^(dónde|donde|cuando|cuándo)/i',
            '/^(explica|explicame|define|defineme)/i',
            '/^(cuáles|cuales) son (los|las)/i'
        ];
        
        foreach ($standalonePatterns as $pattern) {
            if (preg_match($pattern, $message)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Resume mensajes antiguos para mantener contexto sin enviar todo a OpenAI
     * (Útil para conversaciones muy largas)
     * 
     * @param int $sessionId ID de la sesión
     * @param int $keepRecentCount Cantidad de mensajes recientes a mantener completos
     * @return array Resumen estructurado
     */
    public function summarizeOldContext($sessionId, $keepRecentCount = 6) {
        try {
            // Obtener mensajes antiguos (más allá de la ventana reciente)
            $stmt = $this->db->prepare("
                SELECT tipo, contenido, metadata
                FROM doc_conversacion_mensajes 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
            ");
            
            $stmt->execute([$sessionId]);
            $allMessages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (count($allMessages) <= $keepRecentCount) {
                // No hay suficientes mensajes para resumir
                return [
                    'summary' => null,
                    'recent_messages' => $allMessages
                ];
            }
            
            // Separar mensajes antiguos de recientes
            $oldMessages = array_slice($allMessages, 0, -$keepRecentCount);
            $recentMessages = array_slice($allMessages, -$keepRecentCount);
            
            // Extraer temas principales de mensajes antiguos
            $topicsDiscussed = [];
            foreach ($oldMessages as $msg) {
                if ($msg['tipo'] === 'pregunta_usuario') {
                    // Extraer temas clave (esto es simplificado)
                    $topicsDiscussed[] = substr($msg['contenido'], 0, 100);
                }
            }
            
            $summary = count($topicsDiscussed) > 0 
                ? "Temas previamente discutidos: " . implode(', ', array_slice($topicsDiscussed, 0, 3))
                : null;
            
            return [
                'summary' => $summary,
                'recent_messages' => $recentMessages
            ];
            
        } catch (Exception $e) {
            error_log("Error resumiendo contexto antiguo: " . $e->getMessage());
            return [
                'summary' => null,
                'recent_messages' => $this->getRecentContext($sessionId, $keepRecentCount)
            ];
        }
    }
    
    /**
     * Obtiene el último tema discutido en la sesión
     * (Útil para contexto de preguntas de seguimiento)
     * 
     * @param int $sessionId ID de la sesión
     * @return string|null Último tema o null si no hay
     */
    public function getLastDiscussedTopic($sessionId) {
        try {
            $stmt = $this->db->prepare("
                SELECT contenido 
                FROM doc_conversacion_mensajes 
                WHERE session_id = ? AND tipo = 'pregunta_usuario' 
                ORDER BY timestamp DESC 
                LIMIT 1
            ");
            
            $stmt->execute([$sessionId]);
            $lastMessage = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return $lastMessage ? $lastMessage['contenido'] : null;
            
        } catch (Exception $e) {
            error_log("Error obteniendo último tema: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Registra metadata de interacción (para analytics)
     * 
     * @param int $sessionId ID de la sesión
     * @param string $eventType Tipo de evento (ej: 'topic_change', 'clarification_needed')
     * @param array $eventData Datos adicionales del evento
     * @return bool Success status
     */
    public function logInteractionEvent($sessionId, $eventType, $eventData = []) {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO doc_conversation_events 
                (session_id, event_type, event_data, created_at) 
                VALUES (?, ?, ?, NOW())
            ");
            
            $stmt->execute([
                $sessionId,
                $eventType,
                json_encode($eventData)
            ]);
            
            return true;
            
        } catch (Exception $e) {
            // Esta tabla es opcional, no debe romper el flujo si no existe
            error_log("Info: No se pudo registrar evento de interacción: " . $e->getMessage());
            return false;
        }
    }
}
?>