<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/AttachmentContextService.php';

class OpenAIService {
    private $apiKey;
    private $apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    
    public function __construct() {
        if (defined('OPENAI_API_KEY')) {
            $this->apiKey = OPENAI_API_KEY;
        }
    }
    
    // ============================================
    // 🆕 NUEVO MÉTODO PARA MÓDULO 2
    // ============================================
    /**
     * Método genérico para llamar a OpenAI Chat Completions
     * Usado por el sistema de observaciones detalladas de evaluación
     * 
     * @param array $messages Array de mensajes [['role' => 'system/user/assistant', 'content' => '...']]
     * @param array $options Opciones de configuración ['model', 'temperature', 'max_tokens']
     * @return array|null Respuesta decodificada de OpenAI o null si hay error
     */
    public function chat($messages, $options = []) {
        if (empty($this->apiKey)) {
            error_log("❌ OpenAI API Key no configurada");
            return null;
        }
        
        $data = [
            'model' => $options['model'] ?? 'gpt-4o-mini',
            'messages' => $messages,
            'temperature' => $options['temperature'] ?? 0.7,
            'max_tokens' => $options['max_tokens'] ?? 1000
        ];
        
        try {
            $ch = curl_init($this->apiEndpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            
            if ($error) {
                error_log("❌ Error en OpenAI CURL: " . $error);
                return null;
            }
            
            if ($httpCode !== 200) {
                error_log("❌ OpenAI API Error: HTTP {$httpCode} - {$response}");
                return null;
            }
            
            $decoded = json_decode($response, true);
            
            if (!isset($decoded['choices'][0]['message']['content'])) {
                error_log("❌ Respuesta de OpenAI sin contenido esperado");
                return null;
            }
            
            return $decoded;
            
        } catch (Exception $e) {
            error_log("❌ Excepción en OpenAI chat(): " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * 🆕 Método wrapper simplificado que retorna solo el texto
     * Wrapper sobre chat() para compatibilidad con código existente
     * 
     * @param array $messages Array de mensajes
     * @param array $options Opciones opcionales
     * @return string|null Texto de respuesta o null si hay error
     */
    public function simpleChat($messages, $options = []) {
        $response = $this->chat($messages, $options);
        
        if ($response && isset($response['choices'][0]['message']['content'])) {
            return $response['choices'][0]['message']['content'];
        }
        
        return null;
    }
    
    // ============================================
    // MÉTODOS EXISTENTES (SIN CAMBIOS)
    // ============================================
    
    public function interpretCommand($command, $context = []) {
        // Usar interpretación local si está configurado así
        if (defined('USE_LOCAL_AI') && USE_LOCAL_AI) {
            return $this->interpretCommandLocal($command, $context);
        }
        
        if (empty($this->apiKey)) {
            return $this->interpretCommandLocal($command, $context);
        }
        
        $systemPrompt = "Eres el asistente de voz de una plataforma educativa tú nombre es VoiceMed. 
                Tu tarea es interpretar comandos de voz y determinar la intención del usuario.
                Los comandos posibles son:
                - Navegación (ir a dashboard, ir a cursos, abrir curso X)
                - Control de lecciones (iniciar narración, detener narración, siguiente lección)
                - Evaluaciones (iniciar evaluación, repetir pregunta, finalizar evaluación)
                - Cuestionarios (iniciar cuestionario, responder pregunta, finalizar)
                - Información (qué es X, cómo funciona Y)
                Responde con un JSON que incluya 'action' y los parámetros necesarios.

                **INSTRUCCIONES CRÍTICAS PARA IMÁGENES:**
1. Cuando respondas a consultas, SIEMPRE revisa si hay imágenes relevantes disponibles en los anexos.
2. Si hay imágenes disponibles que apoyen tu respuesta, DEBES incluir las etiquetas [IMG:ID] en tu respuesta.
3. Para mostrar una imagen, usa EXACTAMENTE este formato: [IMG:1] (donde 1 es el ID del anexo)
4. Si el usuario pregunta por imágenes o si el contexto lo amerita, SIEMPRE incluye al menos una imagen disponible.
5. Las etiquetas [IMG:ID] son OBLIGATORIAS cuando hay contenido visual relevante.

**EJEMPLO DE RESPUESTA CORRECTA:**
'Claro, aquí tienes información sobre la universidad. [IMG:1] Como puedes ver en el logo de la Universidad del Bosque...'

Tu estilo debe ser cercano, profesional y empático. 
Responde siempre de forma natural, manteniendo el hilo de la conversación como lo haría un docente con su estudiante.
NUNCA digas que no puedes mostrar imágenes - si hay anexos disponibles, úsalos con las etiquetas [IMG:ID].";
        
        $data = [
            'model' => 'gpt-4o',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => $systemPrompt
                ],
                [
                    'role' => 'user',
                    'content' => "Interpreta este comando: " . $command
                ]
            ],
            'temperature' => 0.7,
            'max_tokens' => 400
        ];
        
        // Añadir contexto si existe
        if (!empty($context)) {
            $contextString = "Contexto: " . json_encode($context);
            $data['messages'][] = [
                'role' => 'system',
                'content' => $contextString
            ];
        }
        
        try {
            $ch = curl_init($this->apiEndpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey
            ]);
            
            $response = curl_exec($ch);
            $error = curl_error($ch);
            curl_close($ch);
            
            if ($error) {
                error_log("Error en OpenAI CURL: " . $error);
                return $this->interpretCommandLocal($command, $context);
            }
            
            $decoded = json_decode($response, true);
            
            if (isset($decoded['choices'][0]['message']['content'])) {
                $content = $decoded['choices'][0]['message']['content'];
                
                try {
                    // Intentar extraer JSON de la respuesta
                    preg_match('/{.*}/s', $content, $matches);
                    if (isset($matches[0])) {
                        $jsonContent = $matches[0];
                        $interpretation = json_decode($jsonContent, true);
                        
                        return [
                            'success' => true,
                            'interpretation' => $interpretation
                        ];
                    } else {
                        return $this->interpretCommandLocal($command, $context);
                    }
                } catch (Exception $e) {
                    error_log("Error al procesar respuesta OpenAI: " . $e->getMessage());
                    return $this->interpretCommandLocal($command, $context);
                }
            }
            
            return $this->interpretCommandLocal($command, $context);
        } catch (Exception $e) {
            error_log("Excepción en OpenAI: " . $e->getMessage());
            return $this->interpretCommandLocal($command, $context);
        }
    }
    
    // Método alternativo que no usa OpenAI
    private function interpretCommandLocal($command, $context = []) {
        // Función para simular respuestas de interpretación de comandos
        $command = strtolower($command);
        
        // Respuestas predeterminadas basadas en palabras clave
        if (strpos($command, 'evaluación') !== false) {
            if (strpos($command, 'iniciar') !== false) {
                return [
                    'success' => true,
                    'interpretation' => [
                        'action' => 'start_evaluation'
                    ]
                ];
            } elseif (strpos($command, 'repetir') !== false && strpos($command, 'pregunta') !== false) {
                return [
                    'success' => true,
                    'interpretation' => [
                        'action' => 'repeat_question'
                    ]
                ];
            } elseif (strpos($command, 'finalizar') !== false) {
                return [
                    'success' => true,
                    'interpretation' => [
                        'action' => 'finish_evaluation'
                    ]
                ];
            }
        } else if (strpos($command, 'ir a') !== false || strpos($command, 'navegar') !== false) {
            if (strpos($command, 'dashboard') !== false) {
                $action = 'navigate';
                $destination = 'dashboard';
            } elseif (strpos($command, 'curso') !== false) {
                $action = 'navigate';
                $destination = 'courses';
            } elseif (strpos($command, 'inicio') !== false) {
                $action = 'navigate';
                $destination = 'home';
            } else {
                $action = 'navigate';
                $destination = 'unknown';
            }
            
            return [
                'success' => true,
                'interpretation' => [
                    'action' => $action,
                    'destination' => $destination
                ]
            ];
        } elseif (strpos($command, 'narrar') !== false || strpos($command, 'leer') !== false) {
            return [
                'success' => true,
                'interpretation' => [
                    'action' => 'start_narration'
                ]
            ];
        } elseif (strpos($command, 'detener') !== false || strpos($command, 'parar') !== false) {
            return [
                'success' => true,
                'interpretation' => [
                    'action' => 'stop_narration'
                ]
            ];
        } elseif (strpos($command, 'ayuda') !== false) {
            return [
                'success' => true,
                'interpretation' => [
                    'action' => 'help'
                ]
            ];
        } else {
            // Respuesta genérica
            return [
                'success' => true,
                'interpretation' => [
                    'action' => 'unknown_command',
                    'original_text' => $command
                ]
            ];
        }
    }
    
    // *** MÉTODO MOVIDO DENTRO DE LA CLASE ***
    public function generateResponseWithAttachments($messages, $documentId, $userMessage, $database) {
        try {
            // Crear servicio de contexto de anexos
            $attachmentContext = new AttachmentContextService($database);
            
            // Analizar mensaje del usuario
            $analysis = $attachmentContext->analyzeUserMessage($userMessage, $documentId);
            
            // Obtener conversación completa para contexto
            $conversationText = '';
            foreach ($messages as $message) {
                if (isset($message['content'])) {
                    $conversationText .= $message['content'] . ' ';
                }
            }
            
            // Obtener sugerencias automáticas
            $autoSuggestions = $attachmentContext->getAutomaticSuggestions(
                $documentId, 
                $conversationText, 
                $userMessage
            );
            
            // Combinar anexos relevantes con sugerencias automáticas
            $allRelevantAttachments = array_merge(
                $analysis['relevant_attachments'],
                $autoSuggestions
            );
            
            // Eliminar duplicados por ID
            $uniqueAttachments = [];
            $seenIds = [];
            foreach ($allRelevantAttachments as $attachment) {
                if (!in_array($attachment['id'], $seenIds)) {
                    $uniqueAttachments[] = $attachment;
                    $seenIds[] = $attachment['id'];
                }
            }
            
            // Modificar el prompt del sistema si hay anexos relevantes
            if (!empty($uniqueAttachments)) {
$systemPrompt = "Eres un asistente médico especializado que responde exclusivamente con base en el contenido del documento proporcionado.

**REGLAS ESTRICTAS:**
1. SOLO responde sobre el contenido específico del documento actual
2. Si la pregunta NO está relacionada con el tema del documento, responde EXACTAMENTE así: 'Lo siento, solo puedo orientarte sobre [NOMBRE_DEL_TEMA].'
3. NO hagas sugerencias adicionales cuando la pregunta esté fuera del tema
4. NO ofrezcas ayuda general o alternativas
5. Mantén respuestas cortas y directas para temas no relacionados

**INSTRUCCIONES PARA IMÁGENES:**
1. Cuando respondas a consultas del tema correcto, SIEMPRE revisa si hay imágenes relevantes disponibles en los anexos.
2. Si hay imágenes disponibles que apoyen tu respuesta, DEBES incluir las etiquetas [IMG:ID] en tu respuesta.
3. Para mostrar una imagen, usa EXACTAMENTE este formato: [IMG:1] (donde 1 es el ID del anexo)
4. Las etiquetas [IMG:ID] son OBLIGATORIAS cuando hay contenido visual relevante.

**EJEMPLO DE RESPUESTA CORRECTA PARA TEMA NO RELACIONADO:**
Usuario: '¿Qué es la diabetes?'
Respuesta: 'Lo siento, solo puedo orientarte sobre Ateneo.'

**EJEMPLO DE RESPUESTA CORRECTA PARA TEMA RELACIONADO:**
Usuario: '¿Qué es Ateneo?'
Respuesta: 'Ateneo es una plataforma de educación virtual... [IMG:1] Como puedes ver en el logo...'

Tu estilo debe ser profesional y empático para temas relacionados, pero seco y directo para temas no relacionados.";
                
                $enhancedPrompt = $attachmentContext->generateAIPromptWithAttachments(
                    $systemPrompt, 
                    $uniqueAttachments, 
                    $userMessage
                );
                $messages[0]['content'] = $enhancedPrompt;
            }
            // Llamar a OpenAI con el prompt mejorado
            $openaiData = [
                'model' => 'gpt-4o',
                'messages' => $messages,
                'temperature' => 0.5,
                'max_tokens' => 700 // Aumentar para permitir descripción de imágenes
            ];

            $ch = curl_init('https://api.openai.com/v1/chat/completions');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($openaiData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey
            ]);
            
            $response = curl_exec($ch);
            $error = curl_error($ch);
            curl_close($ch);
            
            if ($error) {
                error_log("Error en OpenAI CURL: " . $error);
                return [
                    'success' => false,
                    'error' => $error
                ];
            }
            
            $decoded = json_decode($response, true);
            
            if (isset($decoded['choices'][0]['message']['content'])) {
                $aiResponse = $decoded['choices'][0]['message']['content'];

                error_log("DEBUG: Respuesta cruda de OpenAI: " . $aiResponse);
                
                // Procesar etiquetas de imágenes en la respuesta
                $processedResult = $attachmentContext->processImageTags($aiResponse, $documentId);

                error_log("DEBUG: Respuesta procesada: " . $processedResult['processed_response']);
error_log("DEBUG: Imágenes procesadas: " . json_encode($processedResult['images']));
error_log("DEBUG: Tiene imágenes: " . ($processedResult['has_images'] ? 'SÍ' : 'NO'));
                
                return [
                    'success' => true,
                    'response' => $processedResult['processed_response'],
                    'images' => $processedResult['images'],
                    'has_images' => $processedResult['has_images'],
                    'analysis' => $analysis,
                    'auto_suggestions' => $autoSuggestions,
                    'total_relevant_attachments' => count($uniqueAttachments)
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'No se pudo obtener respuesta de OpenAI',
                    'raw_response' => $decoded
                ];
            }
            
        } catch (Exception $e) {
            error_log("Error en generateResponseWithAttachments: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
} // *** CIERRE DE LA CLASE AQUÍ ***
?>