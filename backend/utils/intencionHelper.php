<?php
// =====================================================
// HELPER: Detección Inteligente de Intenciones
// Propósito: Analizar y clasificar las intenciones del usuario
// para determinar relevancia y contexto
// =====================================================

class IntencionHelper {
    private $db;
    private $openai;
    private $documento;
    
    public function __construct($database = null) {
        $this->db = $database;
        // OpenAI se inyectará cuando sea necesario
    }
    
    /**
     * Configura el servicio OpenAI
     */
    public function setOpenAI($openaiService) {
        $this->openai = $openaiService;
        return $this;
    }
    
    /**
     * Configura el documento actual
     */
    public function setDocumento($documento) {
        $this->documento = $documento;
        return $this;
    }
    
    /**
     * Analiza si una pregunta está relacionada con el documento
     * Método principal que usa múltiples estrategias
     */
    public function esConsultaRelevante($pregunta, $documento = null, $contextoConversacion = []) {
        if ($documento) {
            $this->documento = $documento;
        }
        
        // Registrar análisis
        error_log("🔍 Analizando relevancia de: " . $pregunta);
        
        // 1. Verificar si es obviamente fuera de tema
        if ($this->esObviamenteFueraDeTema($pregunta)) {
            error_log("❌ Pregunta obviamente fuera de tema");
            return [
                'es_relevante' => false,
                'confianza' => 0.1,
                'razon' => 'Tema no relacionado con medicina o el documento',
                'sugerencia' => 'Por favor, realiza preguntas relacionadas con ' . $this->documento->titulo
            ];
        }
        
        // 2. Análisis rápido por palabras clave
        $analisisRapido = $this->analizarPorPalabrasClave($pregunta);
        if ($analisisRapido['es_relevante'] && $analisisRapido['confianza'] > 0.8) {
            error_log("✅ Relevancia alta por palabras clave");
            return $analisisRapido;
        }
        
        // 3. Análisis contextual si hay conversación previa
        if (!empty($contextoConversacion)) {
            $analisisContextual = $this->analizarPorContexto($pregunta, $contextoConversacion);
            if ($analisisContextual['es_relevante'] && $analisisContextual['confianza'] > 0.7) {
                error_log("✅ Relevancia por contexto conversacional");
                return $analisisContextual;
            }
        }
        
        // 4. Análisis semántico flexible
        $analisisSemantico = $this->analizarSemantica($pregunta);
        
        // 5. Decisión final - ser permisivo
        if ($analisisSemantico['confianza'] > 0.4) {
            error_log("✅ Permitiendo pregunta por análisis semántico");
            return [
                'es_relevante' => true,
                'confianza' => $analisisSemantico['confianza'],
                'razon' => $analisisSemantico['razon'],
                'sugerencia' => null
            ];
        }
        
        // Por defecto, ser permisivo con preguntas ambiguas
        error_log("⚠️ Pregunta ambigua - siendo permisivo");
        return [
            'es_relevante' => true,
            'confianza' => 0.5,
            'razon' => 'Pregunta potencialmente relacionada',
            'sugerencia' => null
        ];
    }
    
    /**
     * Detecta preguntas claramente fuera de tema
     */
    private function esObviamenteFueraDeTema($pregunta) {
        $pregunta_lower = mb_strtolower($pregunta, 'UTF-8');
        
        // Patrones de temas NO médicos
        $patronesFueraDeTema = [
            // Entretenimiento
            '/\b(película|serie|netflix|spotify|youtube|tiktok|instagram)\b/i',
            '/\b(fútbol|basketball|tenis|deportes?|partido|mundial)\b/i',
            '/\b(música|canción|concierto|artista|banda)\b/i',
            
            // Temas cotidianos no médicos
            '/\b(clima|tiempo atmosférico|lluvia|sol|temperatura ambiente)\b/i',
            '/\b(receta de cocina|cocinar|ingredientes para|restaurante)\b/i',
            '/\b(viaje|turismo|hotel|vacaciones|playa)\b/i',
            
            // Tecnología no médica
            '/\b(programación|código|javascript|python|html)\b/i',
            '/\b(criptomoneda|bitcoin|trading|forex|bolsa)\b/i',
            '/\b(videojuegos?|playstation|xbox|nintendo)\b/i',
            
            // Preguntas personales al asistente
            '/^(hola|hi|hey|qué tal|cómo estás)/i',
            '/\b(quién eres|cómo te llamas|dónde vives|cuántos años tienes)\b/i',
            '/\b(qué hora es|qué día es|fecha de hoy)\b/i'
        ];
        
        foreach ($patronesFueraDeTema as $patron) {
            if (preg_match($patron, $pregunta_lower)) {
                // Verificar que NO mencione el documento o términos médicos
                $terminosMedicos = ['medicina', 'tratamiento', 'síntoma', 'enfermedad', 'paciente', 'ibp', 'vozama', 'inhibidor'];
                foreach ($terminosMedicos as $termino) {
                    if (stripos($pregunta_lower, $termino) !== false) {
                        return false; // Tiene contexto médico, no es fuera de tema
                    }
                }
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Análisis rápido basado en palabras clave
     */
    private function analizarPorPalabrasClave($pregunta) {
        if (!$this->documento) {
            return ['es_relevante' => true, 'confianza' => 0.5, 'razon' => 'Sin documento para comparar'];
        }
        
        $pregunta_lower = mb_strtolower($pregunta, 'UTF-8');
        $titulo_lower = mb_strtolower($this->documento->titulo, 'UTF-8');
        
        // Palabras clave del título
        $palabrasTitulo = $this->extraerPalabrasClave($titulo_lower);
        
        // Términos médicos relacionados específicos
        $terminosRelacionados = [
            'vozama' => ['vozama', 'voza', 'vonoprazan', 'p-cab', 'pcab', 'bloqueador', 'competitivo'],
            'ibp' => ['ibp', 'inhibidor', 'bomba', 'protones', 'omeprazol', 'esomeprazol', 'lansoprazol'],
            'tratamiento' => ['tratamiento', 'terapia', 'medicamento', 'fármaco', 'dosis', 'administración'],
            'gastrico' => ['gástrico', 'estómago', 'acidez', 'reflujo', 'úlcera', 'gastritis', 'helicobacter'],
            'osama' => ['osama', 'osa', 'enfermedad', 'patología'],
            'efectos' => ['efecto', 'secundario', 'adverso', 'reacción', 'contraindicación'],
            'comparacion' => ['diferencia', 'comparar', 'versus', 'mejor', 'ventaja', 'desventaja']
        ];
        
        $puntaje = 0;
        $razonesEncontradas = [];
        
        // Buscar coincidencias directas con el título
        foreach ($palabrasTitulo as $palabra) {
            if (strlen($palabra) > 3 && stripos($pregunta_lower, $palabra) !== false) {
                $puntaje += 0.4;
                $razonesEncontradas[] = "menciona '$palabra'";
            }
        }
        
        // Buscar términos relacionados
        foreach ($terminosRelacionados as $categoria => $terminos) {
            foreach ($terminos as $termino) {
                if (stripos($pregunta_lower, $termino) !== false) {
                    $puntaje += 0.3;
                    $razonesEncontradas[] = "término relacionado: $termino";
                    break; // Solo contar una vez por categoría
                }
            }
        }
        
        // Análisis de intención médica
        $intencionMedica = $this->detectarIntencionMedica($pregunta_lower);
        if ($intencionMedica) {
            $puntaje += 0.2;
            $razonesEncontradas[] = "intención médica detectada";
        }
        
        $confianza = min(1.0, $puntaje);
        
        return [
            'es_relevante' => $confianza > 0.3,
            'confianza' => $confianza,
            'razon' => !empty($razonesEncontradas) ? 
                'Pregunta relevante: ' . implode(', ', array_slice($razonesEncontradas, 0, 2)) :
                'Sin palabras clave directas encontradas'
        ];
    }
    
    /**
     * Análisis basado en contexto conversacional
     */
    private function analizarPorContexto($pregunta, $contextoConversacion) {
        // Si hay mensajes recientes sobre el tema, la pregunta probablemente continúa el hilo
        $temasRecientes = [];
        $ultimosMensajes = array_slice($contextoConversacion, -4); // Últimos 4 mensajes
        
        foreach ($ultimosMensajes as $mensaje) {
            $contenido_lower = mb_strtolower($mensaje['content'], 'UTF-8');
            
            // Buscar temas médicos en mensajes anteriores
            if (preg_match('/\b(vozama|ibp|inhibidor|tratamiento|medicamento|gástrico)\b/i', $contenido_lower)) {
                $temasRecientes[] = 'medicina';
            }
            if (preg_match('/\b(efecto|dosis|administra|tomar|paciente)\b/i', $contenido_lower)) {
                $temasRecientes[] = 'tratamiento';
            }
        }
        
        if (!empty($temasRecientes)) {
            return [
                'es_relevante' => true,
                'confianza' => 0.8,
                'razon' => 'Continuación de conversación médica en curso'
            ];
        }
        
        // Detectar preguntas de seguimiento
        if (preg_match('/\b(eso|esto|lo que|mencionaste|dijiste|hablamos|anterior)\b/i', $pregunta)) {
            return [
                'es_relevante' => true,
                'confianza' => 0.7,
                'razon' => 'Pregunta de seguimiento detectada'
            ];
        }
        
        return [
            'es_relevante' => false,
            'confianza' => 0.4,
            'razon' => 'Sin contexto conversacional relevante'
        ];
    }
    
    /**
     * Análisis semántico de la pregunta
     */
    private function analizarSemantica($pregunta) {
        $pregunta_lower = mb_strtolower($pregunta, 'UTF-8');
        
        // Patrones de preguntas médicas válidas
        $patronesMedicos = [
            '/\b(cómo|qué|cuál|cuándo|dónde|por qué).*(afecta|funciona|sirve|trata|cura|alivia)\b/i',
            '/\b(diferencia|comparación|versus|mejor|peor) entre\b/i',
            '/\b(síntoma|efecto|reacción|contraindicación|interacción)\b/i',
            '/\b(puedo|debo|necesito|tengo que).*(tomar|usar|consumir|aplicar)\b/i',
            '/\b(ventaja|desventaja|beneficio|riesgo|peligro)\b/i',
            '/\b(dosis|cantidad|frecuencia|horario|duración)\b/i'
        ];
        
        foreach ($patronesMedicos as $patron) {
            if (preg_match($patron, $pregunta_lower)) {
                return [
                    'es_relevante' => true,
                    'confianza' => 0.7,
                    'razon' => 'Estructura de pregunta médica detectada'
                ];
            }
        }
        
        // Si la pregunta es muy corta, ser permisivo
        if (str_word_count($pregunta) <= 5) {
            return [
                'es_relevante' => true,
                'confianza' => 0.6,
                'razon' => 'Pregunta corta - asumiendo relevancia'
            ];
        }
        
        return [
            'es_relevante' => true, // Por defecto, ser permisivo
            'confianza' => 0.5,
            'razon' => 'Pregunta ambigua - permitiendo por defecto'
        ];
    }
    
    /**
     * Detecta si hay intención médica en la pregunta
     */
    private function detectarIntencionMedica($pregunta_lower) {
        $palabrasMedicas = [
            'tratamiento', 'medicina', 'medicamento', 'fármaco',
            'síntoma', 'enfermedad', 'patología', 'condición',
            'paciente', 'doctor', 'médico', 'diagnóstico',
            'terapia', 'cura', 'alivio', 'mejoría',
            'efecto', 'reacción', 'dosis', 'administración'
        ];
        
        foreach ($palabrasMedicas as $palabra) {
            if (stripos($pregunta_lower, $palabra) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Extrae palabras clave significativas
     */
    private function extraerPalabrasClave($texto) {
        // Eliminar palabras comunes (stop words)
        $stopWords = ['el', 'la', 'de', 'en', 'y', 'a', 'los', 'las', 'del', 'con', 'por', 'para', 'es', 'un', 'una'];
        
        $palabras = preg_split('/\s+/', $texto);
        $palabrasClave = [];
        
        foreach ($palabras as $palabra) {
            $palabra = trim($palabra, '.,;:!?()[]{}');
            if (strlen($palabra) > 3 && !in_array($palabra, $stopWords)) {
                $palabrasClave[] = $palabra;
            }
        }
        
        return $palabrasClave;
    }
    
    /**
     * Método para usar con OpenAI si está disponible
     */
    public function analizarConIA($pregunta, $documento, $contexto = []) {
        if (!$this->openai) {
            return $this->esConsultaRelevante($pregunta, $documento, $contexto);
        }
        
        // Preparar prompt para OpenAI
        $systemPrompt = "Eres un analizador de relevancia. Determina si la pregunta está relacionada con el documento: '{$documento->titulo}'.
        
        Responde SOLO con JSON:
        {
            \"es_relevante\": true/false,
            \"confianza\": 0.0-1.0,
            \"razon\": \"explicación breve\"
        }
        
        Sé PERMISIVO. Si hay alguna posibilidad de relación, considera relevante.";
        
        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $pregunta]
        ];
        
        try {
            $response = $this->openai->simpleChat($messages, [
                'temperature' => 0.3,
                'max_tokens' => 100
            ]);
            
            if ($response) {
                $result = json_decode($response, true);
                if ($result) {
                    return $result;
                }
            }
        } catch (Exception $e) {
            error_log("Error en análisis con IA: " . $e->getMessage());
        }
        
        // Fallback al análisis sin IA
        return $this->esConsultaRelevante($pregunta, $documento, $contexto);
    }
}

// Función helper global para compatibilidad
function evaluarRelevanciaConsulta($pregunta, $documento, $contexto = []) {
    $helper = new IntencionHelper();
    $helper->setDocumento($documento);
    return $helper->esConsultaRelevante($pregunta, $documento, $contexto);
}
?>