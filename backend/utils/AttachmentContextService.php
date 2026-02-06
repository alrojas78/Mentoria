<?php
// =====================================================
// SERVICIO: Contexto Inteligente de Anexos
// =====================================================

require_once __DIR__ . '/../models/Anexo.php';
require_once __DIR__ . '/../config/attachments.php';

class AttachmentContextService {
    private $db;
    private $anexo;
    
    public function __construct($database) {
        $this->db = $database;
        $this->anexo = new Anexo($this->db);
    }

    // Analizar mensaje del usuario para detectar solicitudes de imágenes
    public function analyzeUserMessage($message, $documentId) {
        $message = strtolower($message);
        
        // Patrones que indican solicitud de imágenes
        $imageRequestPatterns = [
            '/.*tienes.*imagen.*/i',
            '/.*muestra.*imagen.*/i',
            '/.*ver.*imagen.*/i',
            '/.*foto.*/i',
            '/.*imágenes.*/i',
            '/.*gráfico.*/i',
            '/.*diagrama.*/i',
            '/.*ejemplo.*visual.*/i',
            '/.*puede.*ver.*/i',
            '/.*hay.*imagen.*/i'
        ];

        $isImageRequest = false;
        foreach ($imageRequestPatterns as $pattern) {
            if (preg_match($pattern, $message)) {
                $isImageRequest = true;
                break;
            }
        }

        // Extraer palabras clave del mensaje
        $keywords = $this->extractKeywords($message);
        
        // Buscar anexos relevantes
        $relevantAttachments = $this->findRelevantAttachments($documentId, $keywords);

        return [
            'is_image_request' => $isImageRequest,
            'extracted_keywords' => $keywords,
            'relevant_attachments' => $relevantAttachments,
            'should_suggest_images' => $isImageRequest && !empty($relevantAttachments)
        ];
    }

    // Extraer palabras clave del mensaje
    private function extractKeywords($message) {
        // Palabras comunes a ignorar
        $stopWords = [
            'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su',
            'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'sus', 'más', 'muy', 'este',
            'esta', 'estos', 'estas', 'como', 'pero', 'todo', 'bien', 'cada', 'hasta', 'donde', 'mientras',
            'tienes', 'imagen', 'imágenes', 'muestra', 'ver', 'hay', 'puede', 'alguna', 'algún'
        ];

        // Limpiar mensaje y extraer palabras
        $cleanMessage = preg_replace('/[^\w\sáéíóúñü]/i', ' ', $message);
        $words = array_filter(
            array_map('trim', explode(' ', $cleanMessage)),
            function($word) use ($stopWords) {
                return strlen($word) > 2 && !in_array(strtolower($word), $stopWords);
            }
        );

        return array_values($words);
    }

    // Buscar anexos relevantes por palabras clave
// Buscar anexos relevantes por palabras clave
    private function findRelevantAttachments($documentId, $keywords) {
        try {
            // SIEMPRE buscar todas las imágenes disponibles primero
            $query = "SELECT id, document_id, filename, original_name, file_type, mime_type, 
                            titulo, descripcion, keywords, thumbnail_path, created_at
                     FROM doc_anexos 
                     WHERE document_id = ? 
                     AND is_active = 1 
                     AND (file_type = 'image' OR mime_type LIKE 'image/%')
                     ORDER BY created_at DESC";
            
            $stmt = $this->db->prepare($query);
            $stmt->execute([$documentId]);
            $attachments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Agregar URLs públicas y score de relevancia
            foreach ($attachments as &$attachment) {
                $attachment['public_url'] = AttachmentConfig::getPublicUrl($attachment['filename']);
                if ($attachment['thumbnail_path']) {
                    $attachment['thumbnail_url'] = AttachmentConfig::getPublicUrl($attachment['thumbnail_path'], true);
                }
                
                // Calcular score de relevancia
                $attachment['relevance_score'] = $this->calculateRelevanceScore($attachment, $keywords);
                
                // Decodificar metadata si existe
                if (isset($attachment['metadata']) && $attachment['metadata']) {
                    $attachment['metadata'] = json_decode($attachment['metadata'], true);
                }
            }

            // Ordenar por score de relevancia (mayor primero)
            usort($attachments, function($a, $b) {
                return $b['relevance_score'] <=> $a['relevance_score'];
            });

            return $attachments;

        } catch (Exception $e) {
            error_log("Error buscando anexos relevantes: " . $e->getMessage());
            return [];
        }
    }
    // Calcular score de relevancia entre anexo y keywords
    private function calculateRelevanceScore($attachment, $keywords) {
        $score = 0;
        $searchableText = strtolower(
            $attachment['titulo'] . ' ' . 
            $attachment['descripcion'] . ' ' . 
            $attachment['keywords']
        );

        foreach ($keywords as $keyword) {
            $keyword = strtolower($keyword);
            
            // Coincidencia exacta en título (peso alto)
            if (strpos(strtolower($attachment['titulo']), $keyword) !== false) {
                $score += 10;
            }
            
            // Coincidencia en keywords (peso medio)
            if (strpos(strtolower($attachment['keywords']), $keyword) !== false) {
                $score += 7;
            }
            
            // Coincidencia en descripción (peso bajo)
            if (strpos(strtolower($attachment['descripcion']), $keyword) !== false) {
                $score += 3;
            }
            
            // Coincidencia parcial (peso muy bajo)
            if (strpos($searchableText, $keyword) !== false) {
                $score += 1;
            }
        }

        return $score;
    }

    // Generar prompt para IA con contexto de anexos
    public function generateAIPromptWithAttachments($originalPrompt, $relevantAttachments, $userMessage) {
        if (empty($relevantAttachments)) {
            return $originalPrompt;
        }

        $attachmentContext = "\n\n**ANEXOS DISPONIBLES PARA MOSTRAR:**\n";
        
        foreach ($relevantAttachments as $index => $attachment) {
            $attachmentContext .= ($index + 1) . ". **{$attachment['titulo']}** (ID: {$attachment['id']})\n";
            $attachmentContext .= "   - Tipo: {$attachment['file_type']}\n";
            $attachmentContext .= "   - Descripción: {$attachment['descripcion']}\n";
            $attachmentContext .= "   - Keywords: {$attachment['keywords']}\n";
            $attachmentContext .= "   - Tag para mostrar: [IMG:{$attachment['id']}]\n\n";
        }

        $enhancedPrompt = $originalPrompt . $attachmentContext;
        
        $enhancedPrompt .= "\n**INSTRUCCIONES PARA ANEXOS:**\n";
        $enhancedPrompt .= "- Si el usuario solicita imágenes o si es apropiado mostrar una imagen relacionada con el tema, incluye en tu respuesta la etiqueta [IMG:ID] donde ID es el número del anexo.\n";
        $enhancedPrompt .= "- Puedes incluir múltiples imágenes si son relevantes: [IMG:1] [IMG:3]\n";
        $enhancedPrompt .= "- Cuando muestres una imagen, explica brevemente qué se puede ver en ella.\n";
        $enhancedPrompt .= "- Si el usuario pregunta específicamente por imágenes y hay anexos disponibles, siempre muestra al menos uno.\n";
        $enhancedPrompt .= "- Las etiquetas [IMG:ID] serán procesadas automáticamente para mostrar las imágenes.\n\n";

        return $enhancedPrompt;
    }

    // Detectar y procesar etiquetas de imágenes en respuesta de IA
    public function processImageTags($aiResponse, $documentId) {
        // Buscar patrones [IMG:ID] en la respuesta
        $pattern = '/\[IMG:(\d+)\]/';
        $matches = [];
        preg_match_all($pattern, $aiResponse, $matches);

        if (empty($matches[1])) {
            return [
                'processed_response' => $aiResponse,
                'images' => [],
                'has_images' => false
            ];
        }

        $imageIds = array_unique($matches[1]);
        $images = [];

        // Obtener información de cada imagen
        foreach ($imageIds as $imageId) {
            $this->anexo->id = $imageId;
            if ($this->anexo->readOne()) {
                $imageInfo = [
                    'id' => $this->anexo->id,
                    'titulo' => $this->anexo->titulo,
                    'descripcion' => $this->anexo->descripcion,
                    'filename' => $this->anexo->filename,
                    'file_type' => $this->anexo->file_type,
                    'public_url' => AttachmentConfig::getPublicUrl($this->anexo->filename),
                    'thumbnail_url' => $this->anexo->thumbnail_path ? 
                        AttachmentConfig::getPublicUrl($this->anexo->thumbnail_path, true) : null,
                    'metadata' => $this->anexo->metadata ? json_decode($this->anexo->metadata, true) : null
                ];
                $images[] = $imageInfo;
            }
        }

        // Remover las etiquetas [IMG:ID] del texto
        $processedResponse = preg_replace($pattern, '', $aiResponse);
        $processedResponse = preg_replace('/\s+/', ' ', $processedResponse); // Limpiar espacios extra
        $processedResponse = trim($processedResponse);

        return [
            'processed_response' => $processedResponse,
            'images' => $images,
            'has_images' => !empty($images),
            'total_images' => count($images)
        ];
    }

    // Generar sugerencias automáticas de imágenes basadas en contexto
  public function getAutomaticSuggestions($documentId, $conversationContext, $currentTopic = '') {
    $iaEnabled = AttachmentConfig::getConfig('ia_auto_trigger_enabled', true);
    $sensitivity = AttachmentConfig::getConfig('ia_context_sensitivity', 0.75);
    $maxSuggestions = AttachmentConfig::getConfig('ia_max_suggestions_per_response', 2);

    if (!$iaEnabled) {
        return [];
    }

    // Analizar contexto de la conversación
    $contextKeywords = $this->extractKeywords($conversationContext . ' ' . $currentTopic);
    
    // Buscar TODAS las imágenes (sin tabla de referencias)
    try {
        $query = "SELECT * FROM doc_anexos 
                  WHERE document_id = ? 
                  AND is_active = 1 
                  AND (file_type = 'image' OR mime_type LIKE 'image/%')
                  ORDER BY created_at DESC";
        
        $stmt = $this->db->prepare($query);
        $stmt->execute([$documentId]);
        $autoTriggerAttachments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $suggestions = [];
        foreach ($autoTriggerAttachments as $attachment) {
            // CALCULAR RELEVANCIA CONTEXTUAL INTELIGENTE
            $contextScore = $this->calculateContextualRelevance(
                $attachment, 
                $contextKeywords, 
                $conversationContext
            );
            
            // Solo sugerir si es REALMENTE relevante (score > 0.6)
            if ($contextScore >= 0.6) {
                $attachment['public_url'] = AttachmentConfig::getPublicUrl($attachment['filename']);
                if (!empty($attachment['thumbnail_path'])) {
                    $attachment['thumbnail_url'] = AttachmentConfig::getPublicUrl($attachment['thumbnail_path'], true);
                }
                $attachment['context_match_score'] = $contextScore;
                $suggestions[] = $attachment;
            }
        }

        // Limitar al máximo configurado
        return array_slice($suggestions, 0, $maxSuggestions);

    } catch (Exception $e) {
        error_log("Error obteniendo sugerencias automáticas: " . $e->getMessage());
        return [];
    }
}

// NUEVO MÉTODO: Calcular relevancia contextual inteligente
private function calculateContextualRelevance($attachment, $contextKeywords, $conversationContext) {
    $score = 0;
    
    // Texto combinado del anexo
    $attachmentText = strtolower(
        $attachment['titulo'] . ' ' . 
        $attachment['descripcion'] . ' ' . 
        $attachment['keywords']
    );
    
    // Contexto de conversación
    $conversationLower = strtolower($conversationContext);
    
    // 1. RELEVANCIA POR KEYWORDS DIRECTAS (peso 40%)
    foreach ($contextKeywords as $keyword) {
        $keyword = strtolower($keyword);
        if (strpos($attachmentText, $keyword) !== false) {
            $score += 0.4;
            break; // Solo una vez por keyword match
        }
    }
    
    // 2. RELEVANCIA POR CONTEXTO SEMÁNTICO (peso 35%)
    $semanticKeywords = [
        'anatomía' => ['nervio', 'estructura', 'forma', 'ver', 'aspecto'],
        'proceso' => ['algoritmo', 'pasos', 'procedimiento', 'método'],
        'comparación' => ['diferencia', 'tipos', 'comparar', 'versus'],
        'ejemplo' => ['ejemplo', 'caso', 'muestra', 'ilustración']
    ];
    
    foreach ($semanticKeywords as $concept => $relatedWords) {
        if (strpos($attachmentText, $concept) !== false) {
            foreach ($relatedWords as $relatedWord) {
                if (strpos($conversationLower, $relatedWord) !== false) {
                    $score += 0.35;
                    break 2; // Salir de ambos loops
                }
            }
        }
    }
    
    // 3. RELEVANCIA POR MENCIONES INDIRECTAS (peso 25%)
    $attachmentWords = explode(' ', $attachmentText);
    foreach ($attachmentWords as $word) {
        if (strlen($word) > 4 && strpos($conversationLower, $word) !== false) {
            $score += 0.25;
            break;
        }
    }
    
    return min(1.0, $score); // Máximo 1.0
}



    // Verificar coincidencia de contexto
// Verificar coincidencia de contexto
private function checkContextMatch($contextKeywords, $extractedKeywords) {
    // Si no hay contextKeywords o extractedKeywords, retornar score por defecto
    if (empty($contextKeywords) || empty($extractedKeywords)) {
        return 0.5; // Score neutro
    }

    $contextWords = array_map('trim', explode(',', strtolower($contextKeywords)));
    $extractedWords = array_map('strtolower', $extractedKeywords);
    
    $matches = 0;
    $total = count($contextWords);

    foreach ($contextWords as $contextWord) {
        foreach ($extractedWords as $extractedWord) {
            if (strpos($extractedWord, $contextWord) !== false || 
                strpos($contextWord, $extractedWord) !== false) {
                $matches++;
                break;
            }
        }
    }

    return $total > 0 ? $matches / $total : 0;
}

    // Registrar estadística de uso de anexo
    public function logAttachmentUsage($anexoId, $userId, $sessionId, $actionType, $contextMode, $triggerType) {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO doc_anexo_stats 
                (anexo_id, user_id, session_id, action_type, context_mode, trigger_type) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([$anexoId, $userId, $sessionId, $actionType, $contextMode, $triggerType]);

            // Actualizar contador en referencias si es auto-trigger
            if ($triggerType === 'automatic') {
                $updateStmt = $this->db->prepare("
                    UPDATE doc_anexo_referencias 
                    SET usage_count = usage_count + 1, last_used = NOW() 
                    WHERE anexo_id = ?
                ");
                $updateStmt->execute([$anexoId]);
            }

            return true;
        } catch (Exception $e) {
            error_log("Error registrando uso de anexo: " . $e->getMessage());
            return false;
        }
    }

    // Crear referencia contextual automática
    public function createContextualReference($anexoId, $tagName, $contextKeywords, $autoTrigger = false, $triggerProbability = 0.80) {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO doc_anexo_referencias 
                (anexo_id, tag_name, context_keywords, auto_trigger, trigger_probability) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                context_keywords = VALUES(context_keywords),
                auto_trigger = VALUES(auto_trigger),
                trigger_probability = VALUES(trigger_probability)
            ");
            
            return $stmt->execute([$anexoId, $tagName, $contextKeywords, $autoTrigger, $triggerProbability]);
        } catch (Exception $e) {
            error_log("Error creando referencia contextual: " . $e->getMessage());
            return false;
        }
    }
}
?>