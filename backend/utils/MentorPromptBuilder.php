<?php
/**
 * MentorPromptBuilder
 * 
 * Servicio especializado para construir prompts conversacionales del modo MENTOR
 * que mantienen el flujo estructurado pero permiten interacción natural.
 * 
 * Características:
 * - Fuzzy matching para preguntas del estudiante
 * - Comprensión semántica de intenciones
 * - Balance entre estructura guiada y libertad conversacional
 * - Detección de preguntas fuera del guion
 * 
 * @author MentorIA Team
 * @version 1.0
 */

class MentorPromptBuilder {
    private $db;
    private $conversationalBuilder;
    
    public function __construct($database, $conversationalBuilder = null) {
        $this->db = $database;
        $this->conversationalBuilder = $conversationalBuilder;
    }

    /**
     * Limpia la transcripción de timestamps para enviar a OpenAI
     */
    private function limpiarTranscripcionParaIA($transcripcion) {
        if (empty($transcripcion)) return '';
        
        // Eliminar números de línea
        $limpia = preg_replace('/^\d+\s*$/m', '', $transcripcion);
        
        // Eliminar timestamps (00:02:21,450 --> 00:02:26,000)
        $limpia = preg_replace('/\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{3}/m', '', $limpia);
        
        // Eliminar múltiples saltos de línea
        $limpia = preg_replace('/\n{3,}/', "\n\n", $limpia);
        
        // Eliminar espacios al inicio/final de líneas
        $limpia = preg_replace('/^[ \t]+|[ \t]+$/m', '', $limpia);
        
        return trim($limpia);
    }

    /**
     * Extrae el segmento de transcripción cercano al tiempo actual
     */
    private function extraerSegmentoRelevante($transcripcion, $tiempoActual, $ventanaSegundos = 30) {
        if (empty($transcripcion) || $tiempoActual <= 0) {
            return "Inicio del video";
        }
        
        // Regex para formato SRT: 00:02:21,450 --> 00:02:26,000
        $pattern = '/(\d{1,2}):(\d{2}):(\d{2})[,\.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,\.](\d{3})\s*\n(.+?)(?=\n\n|\n\d{1,2}:\d{2}:\d{2}|$)/s';
        
        if (preg_match_all($pattern, $transcripcion, $matches, PREG_SET_ORDER)) {
            $segmentos = [];
            
            foreach ($matches as $match) {
                // Convertir timestamp a segundos
                $horas = (int)$match[1];
                $minutos = (int)$match[2];
                $segundos = (int)$match[3];
                $inicioSegundos = ($horas * 3600) + ($minutos * 60) + $segundos;
                
                $texto = trim($match[9]);
                
                // Tomar segmentos en la ventana de tiempo
                if ($inicioSegundos >= ($tiempoActual - $ventanaSegundos) && 
                    $inicioSegundos <= ($tiempoActual + $ventanaSegundos)) {
                    $segmentos[] = $texto;
                }
            }
            
            if (!empty($segmentos)) {
                return implode(' ', $segmentos);
            }
        }
        
        // Fallback: texto cercano por posición
        $posicionEstimada = ($tiempoActual / 600) * strlen($transcripcion);
        $inicio = max(0, $posicionEstimada - 200);
        $segmento = substr($transcripcion, $inicio, 400);
        
        return $this->limpiarTranscripcionParaIA($segmento);
    }

    /**
     * 🔧 Extrae segmento de transcripción por tiempo (versión con timestamp info)
     * Compatible con código que espera formato con 'tiene_timestamp' y 'segmento'
     */
    private function extraerSegmentoPorTiempo($transcripcion, $tiempoActual, $ventanaSegundos = 30) {
        $segmento = $this->extraerSegmentoRelevante($transcripcion, $tiempoActual, $ventanaSegundos);
        
        // Determinar si tiene timestamps válidos
        $tieneTimestamp = preg_match('/\d{1,2}:\d{2}:\d{2}/', $transcripcion) ? true : false;
        
        return [
            'tiene_timestamp' => $tieneTimestamp,
            'segmento' => $segmento
        ];
    }
    
    /**
     * Construye un system prompt para iniciar una lección
     * 
     * @param array $leccion Datos de la lección actual
     * @param array $estructura Estructura completa del programa
     * @param object $documento Documento completo
     * @param string $userName Nombre del usuario
     * @return string System prompt
     */
    public function buildInicioLeccionPrompt($leccion, $estructura, $documento, $userName) {
        $tituloLeccion = $leccion['titulo'];
        $contenidoClave = isset($leccion['contenido_clave']) 
            ? implode("\n- ", $leccion['contenido_clave'])
            : '';
        
        $prompt = "Eres un mentor educativo experto para {$userName}.

**TU ROL:**
- Guiar al estudiante a través del programa estructurado
- Explicar conceptos de manera clara y conversacional
- Permitir preguntas naturales en cualquier momento
- Usar ejemplos del documento original

**LECCIÓN ACTUAL:**
**{$tituloLeccion}**

**CONTENIDO CLAVE A CUBRIR:**
{$contenidoClave}

**DOCUMENTO COMPLETO (para referencias):**
" . substr($documento->contenido, 0, 3000) . "

**INSTRUCCIONES:**

1. **INICIO DE LECCIÓN:**
   - Presenta el tema de manera atractiva (2-3 oraciones)
   - Explica POR QUÉ es importante este tema
   - NO recites todo el contenido de una vez
   - Divide en 2-3 conceptos principales

2. **ESTILO CONVERSACIONAL:**
   - Usa el nombre {$userName} naturalmente
   - Haz preguntas de verificación: \"¿Tiene sentido hasta aquí?\"
   - Ofrece ejemplos del documento
   - Mantén explicaciones breves (máximo 150 palabras por concepto)

3. **PERMITIR INTERACCIÓN:**
   - Si {$userName} hace una pregunta, RESPÓNDELA
   - Si la pregunta es del tema actual, profundiza
   - Si la pregunta es de otro tema del documento, responde brevemente y ofrece retomar el tema
   - Si la pregunta está fuera del documento, redirige amablemente

4. **PROGRESIÓN:**
   - Después de explicar cada concepto, pregunta si hay dudas
   - Solo avanza cuando el estudiante esté listo
   - Al final de la lección, resume los puntos clave

**IMPORTANTE:**
- NO recites TODO el contenido en una sola respuesta
- Sé conversacional, no un robot leyendo un manual
- Permite que {$userName} haga preguntas EN CUALQUIER MOMENTO
- Usa el documento como fuente, pero explica con tus palabras

Comienza presentando el tema de esta lección de manera atractiva.";

        return $prompt;
    }
    
    /**
     * Construye prompt para manejar pregunta del estudiante durante la lección
     * 
     * @param string $preguntaEstudiante Pregunta del estudiante
     * @param array $leccion Lección actual
     * @param object $documento Documento completo
     * @param string $userName Nombre del usuario
     * @param array $contextReciente Mensajes recientes (opcional)
     * @return string System prompt
     */
    public function buildRespuestaPreguntaPrompt($preguntaEstudiante, $leccion, $documento, $userName, $contextReciente = []) {
        $tituloLeccion = $leccion['titulo'];
        
        $contextoStr = '';
        if (!empty($contextReciente)) {
            $contextoStr = "\n\n**CONTEXTO RECIENTE:**\n";
            foreach ($contextReciente as $msg) {
                $rol = $msg['role'] === 'user' ? $userName : 'Tú (Mentor)';
                $contextoStr .= "- {$rol}: " . substr($msg['content'], 0, 150) . "\n";
            }
        }
        
        $prompt = "Eres un mentor educativo experto respondiendo a {$userName}.

**CONTEXTO:**
- Están en la lección: **{$tituloLeccion}**
- {$userName} hizo una pregunta durante la lección
{$contextoStr}

**PREGUNTA DE {$userName}:**
\"{$preguntaEstudiante}\"

**DOCUMENTO COMPLETO (extracto relevante):**
" . substr($documento->contenido, 0, 3000) . "

**INSTRUCCIONES:**

1. **ANALIZAR LA PREGUNTA:**
   - ¿Está relacionada con {$tituloLeccion}? → Responde profundamente
   - ¿Está relacionada con otro tema del documento? → Responde brevemente y ofrece verlo después
   - ¿Está fuera del documento? → Redirige amablemente

2. **RESPONDER CONVERSACIONALMENTE:**
   - Usa fuzzy matching: si menciona términos similares, entiende el concepto
   - Acepta variaciones de la misma pregunta
   - Responde de manera clara y directa (máximo 150 palabras)
   - Usa ejemplos del documento si ayuda

3. **MANTENER EL FLUJO:**
   - Después de responder, pregunta si quedó claro
   - Ofrece profundizar si es necesario
   - Sugiere continuar con la lección cuando esté listo

4. **PERSONALIZACIÓN:**
   - Usa el nombre {$userName} naturalmente
   - No uses frases como \"según el documento\" - habla directamente
   - Sé empático si la pregunta muestra confusión

**EJEMPLOS DE BUENAS RESPUESTAS:**

Pregunta: \"¿Qué es el potasio en la bomba?\"
Buena: \"{$userName}, el potasio juega un rol clave en la bomba de protones. Básicamente, la bomba intercambia iones: saca hidrógeno y mete potasio. Pero el potasio luego sale de nuevo por sus propios canales - solo se usa para permitir que el hidrógeno salga. ¿Tiene sentido ese intercambio?\"

Mala: \"Según el documento, el potasio entra por la bomba H+/K+ ATPasa y luego sale por canales de potasio. La función del potasio es permitir la salida del hidrógeno.\"

Responde la pregunta de manera conversacional y natural.";

        return $prompt;
    }
    
    /**
     * Construye prompt para verificar comprensión
     * 
     * @param array $leccion Lección actual
     * @param string $conceptoExplicado Concepto que se acaba de explicar
     * @param string $userName Nombre del usuario
     * @return string System prompt
     */
    public function buildVerificacionComprensionPrompt($leccion, $conceptoExplicado, $userName) {
        $prompt = "Genera UNA pregunta breve y natural para verificar si {$userName} comprendió: \"{$conceptoExplicado}\"

**REQUISITOS:**
- Pregunta conversacional (como hablaría un mentor real)
- No debe ser trivial ni obvia
- Permite respuesta abierta
- Máximo 20 palabras

**EJEMPLOS:**
✅ \"¿Te quedó claro cómo el hidrógeno sale de la célula?\"
✅ \"¿Entiendes por qué el potasio es necesario en este proceso?\"
✅ \"¿Tiene sentido la diferencia entre IBP y P-CAB?\"

❌ \"¿Cuál es la función de la bomba de protones?\" (muy formal)
❌ \"Explícame todo lo que aprendiste\" (muy amplio)

Responde SOLO con la pregunta, sin explicaciones adicionales.";

        return $prompt;
    }
    
    /**
     * Construye prompt para resumir lección completada
     * 
     * @param array $leccion Lección completada
     * @param string $userName Nombre del usuario
     * @return string System prompt
     */
    public function buildResumenLeccionPrompt($leccion, $userName) {
        $tituloLeccion = $leccion['titulo'];
        $contenidoClave = isset($leccion['contenido_clave']) 
            ? implode("\n- ", $leccion['contenido_clave'])
            : '';
        
        $prompt = "Genera un resumen breve y motivador de la lección completada.

**LECCIÓN:** {$tituloLeccion}

**PUNTOS CUBIERTOS:**
{$contenidoClave}

**REQUISITOS:**
- Máximo 100 palabras
- Resalta los 2-3 conceptos MÁS importantes
- Usa lenguaje motivador
- Usa el nombre {$userName}
- Termina preguntando si quiere continuar o profundizar algo

**FORMATO:**
\"¡Excelente, {$userName}! Acabamos de cubrir [concepto 1], [concepto 2] y [concepto 3]. 
Lo más importante que debes recordar es [punto clave].
¿Listo para continuar con la siguiente lección o quieres profundizar en algo de esto?\"

Genera el resumen:";

        return $prompt;
    }
    
    /**
     * Detecta la intención del estudiante en su mensaje
     * 
     * @param string $mensajeEstudiante Mensaje del estudiante
     * @param array $contextReciente Contexto reciente
     * @return array ['intencion' => string, 'confianza' => float]
     */
    public function detectarIntencion($mensajeEstudiante, $contextReciente = []) {
        $mensajeLower = strtolower(trim($mensajeEstudiante));
        
        // Patrones de intenciones comunes
        $patrones = [
            'avanzar' => [
                '/^(sí|si|ok|vale|dale|listo|adelante|siguiente|continuar|continuemos)$/i',
                '/estoy listo/i',
                '/podemos (seguir|continuar|avanzar)/i'
            ],
            'pregunta_especifica' => [
                '/^(qué|que|cómo|como|cuál|cual|por qué|porque|dónde|donde|cuándo|cuando)/i',
                '/explica(me)?/i',
                '/no entiendo/i',
                '/puedes (decir|explicar|aclarar)/i'
            ],
            'solicitud_pausa' => [
                '/espera/i',
                '/momento/i',
                '/para(r|mos)?$/i',
                '/no estoy listo/i'
            ],
            'solicitud_ejemplo' => [
                '/ejemplo/i',
                '/dame (un )?caso/i',
                '/en la práctica/i'
            ],
            'solicitud_profundizar' => [
                '/más (sobre|de|información)/i',
                '/profundiza/i',
                '/detalla/i',
                '/explica mejor/i'
            ],
            'confirmacion_entendimiento' => [
                '/entiendo/i',
                '/entendido/i',
                '/claro/i',
                '/tiene sentido/i',
                '/ya veo/i'
            ],
            'confusion' => [
                '/no entiendo/i',
                '/confundido/i',
                '/no me queda claro/i',
                '/perdido/i'
            ]
        ];
        
        foreach ($patrones as $intencion => $regexList) {
            foreach ($regexList as $regex) {
                if (preg_match($regex, $mensajeLower)) {
                    $confianza = 0.8;
                    
                    // Ajustar confianza según longitud del mensaje
                    if (strlen($mensajeLower) < 10 && $intencion === 'avanzar') {
                        $confianza = 0.9;
                    }
                    
                    return [
                        'intencion' => $intencion,
                        'confianza' => $confianza,
                        'mensaje_original' => $mensajeEstudiante
                    ];
                }
            }
        }
        
        // Si no coincide con ningún patrón
        if (strlen($mensajeLower) < 15) {
            return [
                'intencion' => 'confirmacion_entendimiento',
                'confianza' => 0.5,
                'mensaje_original' => $mensajeEstudiante
            ];
        }
        
        return [
            'intencion' => 'pregunta_especifica',
            'confianza' => 0.6,
            'mensaje_original' => $mensajeEstudiante
        ];
    }
    
    /**
     * Verifica si una pregunta está relacionada con el tema de la lección
     * 
     * @param string $pregunta Pregunta del estudiante
     * @param array $leccion Lección actual
     * @param object $documento Documento completo
     * @return array ['relacionada' => bool, 'relevancia' => float]
     */
    public function verificarRelevanciaConLeccion($pregunta, $leccion, $documento) {
        $tituloLeccion = strtolower($leccion['titulo']);
        $preguntaLower = strtolower($pregunta);
        
        // Extraer palabras clave del título de la lección
       $palabrasClaveLeccion = explode(' ', $tituloLeccion);
        $palabrasClaveDocumento = isset($leccion['contenido_clave']) 
            ? array_map('strtolower', $leccion['contenido_clave'])
            : [];
        
        $coincidencias = 0;
        $totalPalabras = 0;
        
       foreach ($palabrasClaveLeccion as $palabra) {
            if (strlen($palabra) > 3) {
                $totalPalabras++;
                if (strpos($preguntaLower, $palabra) !== false) {
                    $coincidencias++;
                }
            }
        }
        
        foreach ($palabrasClaveDocumento as $contenido) {
            $palabras = explode(' ', strtolower($contenido));
            foreach ($palabras as $palabra) {
                if (strlen($palabra) > 4) {
                    $totalPalabras++;
                    if (strpos($preguntaLower, $palabra) !== false) {
                        $coincidencias += 0.5;
                    }
                }
            }
        }
        
        $relevancia = $totalPalabras > 0 ? ($coincidencias / $totalPalabras) : 0;
        
        return [
            'relacionada' => $relevancia > 0.3,
            'relevancia' => $relevancia,
            'coincidencias' => $coincidencias
        ];
    }
    
    /**
     * Construye prompt para detectar si el estudiante quiere salir del modo mentor
     * 
     * @param string $mensaje Mensaje del estudiante
     * @return bool True si quiere salir
     */
    public function detectarSalidaMentor($mensaje) {
        $mensajeLower = strtolower(trim($mensaje));
        
        $patronesSalida = [
            '/salir (del )?modo mentor/i',
            '/desactivar (el )?modo mentor/i',
            '/terminar (el )?programa/i',
            '/volver a consulta/i',
            '/cambiar a consulta/i',
            '/no quiero (seguir|continuar)/i'
        ];
        
        foreach ($patronesSalida as $patron) {
            if (preg_match($patron, $mensajeLower)) {
                return true;
            }
        }
        
        return false;
    }

        /**
     * ========================================
     * FUNCIONES ESPECIALIZADAS PARA MODO VIDEO
     * ========================================
     */
    
    /**
     * Construye prompt para responder preguntas sobre un video
     */
    public function buildVideoQuestionPrompt($pregunta, $videoData, $userName, $contextReciente = [], $tiempoActualVideo = 0) {
        $tituloVideo = $videoData['titulo_completo'] ?? 'el video actual';
        
        // ✅ LIMPIAR Y USAR TRANSCRIPCIÓN COMPLETA (no solo 3000 chars)
        $transcripcionOriginal = $videoData['transcripcion'] ?? '';
        $transcripcionLimpia = $this->limpiarTranscripcionParaIA($transcripcionOriginal);
        
        // 🔍 DEBUG - Logs para verificar
        error_log("🔍 DEBUG MentorPromptBuilder - Longitud transcripción limpia: " . strlen($transcripcionLimpia));
        error_log("🔍 DEBUG MentorPromptBuilder - ¿Contiene 'amilasa'?: " . (strpos($transcripcionLimpia, 'amilasa') !== false ? 'SÍ' : 'NO'));
        error_log("🔍 DEBUG MentorPromptBuilder - Primeros 300 chars: " . substr($transcripcionLimpia, 0, 300));
        
        // ✅ CALCULAR CONTEXTO TEMPORAL
        $minutosActuales = floor($tiempoActualVideo / 60);
        $segundosActuales = floor($tiempoActualVideo % 60);
        $tiempoFormateado = sprintf("%d:%02d", $minutosActuales, $segundosActuales);
        
        // ✅ EXTRAER SEGMENTO ACTUAL (últimos 30 segundos)
        $segmentoActual = '';
        $segmentoContexto = $this->extraerSegmentoPorTiempo($transcripcionLimpia, $tiempoActualVideo);
        
        if ($segmentoContexto['tiene_timestamp']) {
            $segmentoActual = $segmentoContexto['segmento'];
        } else {
            // Si no hay timestamps, tomamos un bloque cercano en texto (últimos ~600 chars)
            $segmentoActual = substr($transcripcionLimpia, max(0, strlen($transcripcionLimpia) - 600));
        }
        
        // ✅ CONTEXTO CONVERSACIONAL RECIENTE
        $contextoStr = '';
        if (!empty($contextReciente)) {
            $contextoStr = "\n\n**CONVERSACIÓN PREVIA (resumen):**\n";
            foreach (array_slice($contextReciente, -3) as $msg) {
                $rol = $msg['role'] === 'user' ? $userName : 'Mentor';
                $contextoStr .= "- {$rol}: " . substr($msg['content'], 0, 120) . "\n";
            }
        }
        
        $prompt = "Eres un mentor educativo explicando el contenido de un video a {$userName}.
        
**TUS OBJETIVOS:**
- Responder la pregunta del estudiante de forma clara y conversacional
- Basarte SIEMPRE en el contenido del video
- Mantener un tono amigable y pedagógico
- Evitar decir que te basas en 'la transcripción'; siempre habla del 'video'

**INFORMACIÓN DEL VIDEO:**
- Título: {$tituloVideo}
- Tiempo actual aproximado: {$tiempoFormateado}

**SEGMENTO RELEVANTE CERCA DEL TIEMPO ACTUAL:**
\"\"\"
{$segmentoActual}
\"\"\"

{$contextoStr}

❓ **PREGUNTA DE {$userName}:**
\"{$pregunta}\"

🎯 **TU TAREA:**
1. Identificar si la pregunta se responde con el contenido del video
2. Si está en el video, explicarlo de manera clara y amigable
3. Si NO está en el video, decirlo con honestidad pero ofreciendo ayuda adicional

⚠️ **REGLAS IMPORTANTES:**
- NO digas \"en la transcripción\" → di siempre \"en el video\"
- NO inventes información que no aparece en el video
- Si el concepto no aparece, puedes dar una explicación breve general, pero aclara que ese tema no se ve en el video
- Máximo 120 palabras
- Termina SIEMPRE con: \"¿Quedó claro?\" o \"¿Quieres que profundice en algo?\"";

        return $prompt;
    }
    
    /**
     * Detecta si una pregunta hace referencia a un timestamp específico
     * Devuelve un array con:
     * - 'tiene_timestamp' => bool
     * - 'minutos' => int|null
     * - 'segundos' => int|null
     * - 'descripcion' => string|null
     */
    public function detectarTimestampEnPregunta($pregunta) {
        $patrones = [
            '/minuto\s+(\d+)\s*(?:y\s*(\d+)\s*segundos)?/i',
            '/(\d+):(\d{2})/i',
            '/en el segundo\s+(\d+)/i'
        ];
        
        foreach ($patrones as $patron) {
            if (preg_match($patron, $pregunta, $matches)) {
                if (count($matches) === 3) {
                    $min = intval($matches[1]);
                    $seg = intval($matches[2] ?? 0);
                    
                    return [
                        'tiene_timestamp' => true,
                        'minutos' => $min,
                        'segundos' => $seg,
                        'descripcion' => $matches[0]
                    ];
                } elseif (count($matches) === 2) {
                    $segTotal = intval($matches[1]);
                    $min = floor($segTotal / 60);
                    $seg = $segTotal % 60;
                    
                    return [
                        'tiene_timestamp' => true,
                        'minutos' => $min,
                        'segundos' => $seg,
                        'descripcion' => $matches[0]
                    ];
                }
            }
        }
        
        return ['tiene_timestamp' => false];
    }
    
    /**
     * Genera un resumen breve de un video basado en su transcripción
     */
    public function generarResumenVideo($videoData) {
        $transcripcion = isset($videoData['transcripcion']) ? substr($videoData['transcripcion'], 0, 3000) : '';
        $titulo = $videoData['titulo_completo'] ?? 'el video';
        
        return "Resume en 2-3 oraciones los puntos clave del video: '{$titulo}'

TRANSCRIPCIÓN:
{$transcripcion}

INSTRUCCIONES:
- 2-3 oraciones máximo
- Menciona solo los conceptos MÁS importantes
- Lenguaje claro y directo
- Sin introducción como 'El video trata de...' - ve directo al contenido

Responde SOLO con el resumen.";
    }
    
    /**
     * 🆕 Genera 3 preguntas específicas basadas en el contenido del video
     * Estas preguntas se usan para la retroalimentación conversacional
     * 
     * @param array $videoData Datos del video con transcripción
     * @param string $userName Nombre del usuario
     * @return string Prompt para OpenAI que genera las 3 preguntas
     */
    public function generarPreguntasRetroalimentacion($videoData, $userName) {
        $tituloVideo = $videoData['titulo_completo'] ?? 'el video';
        $transcripcion = isset($videoData['transcripcion']) ? $this->limpiarTranscripcionParaIA($videoData['transcripcion']) : '';
        $conceptosClave = isset($videoData['conceptos_clave']) ? $videoData['conceptos_clave'] : '';
        
        // Limitar transcripción si es muy larga
        $transcripcionLimitada = strlen($transcripcion) > 4000 ? substr($transcripcion, 0, 4000) . '...' : $transcripcion;
        
$prompt = "Acabas de ver el video **'{$tituloVideo}'** junto con {$userName}.

**CONTENIDO COMPLETO DEL VIDEO:**
\"\"\"
{$transcripcionLimitada}
\"\"\"

**CONCEPTOS CLAVE:**
{$conceptosClave}

**TU TAREA:**
Genera exactamente 3 preguntas específicas basadas ÚNICAMENTE en el contenido del video que acabas de leer arriba.

Las preguntas deben:
1. Ser sobre información que SÍ se menciona explícitamente en la transcripción del video
2. Evaluar comprensión de conceptos clave mencionados
3. Ser claras y directas
4. Estar redactadas de forma conversacional

**FORMATO DE RESPUESTA (CRÍTICO):**
Responde ÚNICAMENTE con un JSON en este formato exacto (sin ```json, sin comentarios, SOLO el JSON):

{
  \"pregunta1\": \"texto de la primera pregunta\",
  \"pregunta2\": \"texto de la segunda pregunta\",
  \"pregunta3\": \"texto de la tercera pregunta\"
}

**IMPORTANTE:**
- NO agregues ```json ni ```
- NO agregues texto adicional antes o después del JSON
- SOLO el JSON puro con las 3 preguntas
- Las preguntas DEBEN ser sobre contenido que SÍ aparece en la transcripción del video";

        return $prompt;

         }

    /**
     * 🆕 Busca menciones relevantes en la transcripción basándose en la respuesta del estudiante
     * Esto ayuda a dar contexto específico a la IA para evaluar mejor
     * 
     * @param string $respuestaEstudiante Respuesta del estudiante
     * @param string $transcripcion Transcripción completa del video
     * @param int $maxCaracteres Máximo de caracteres a retornar
     * @return string Segmento relevante de la transcripción
     */
    private function buscarContextoRelevante($respuestaEstudiante, $transcripcion, $maxCaracteres = 3000) {
        if (empty($transcripcion) || empty($respuestaEstudiante)) {
            return substr($transcripcion, 0, $maxCaracteres);
        }
        
        // Extraer palabras clave de la respuesta (ignorar palabras comunes)
        $palabrasComunes = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'es', 'que', 'se', 'por', 'con', 'para'];
        $palabras = preg_split('/\s+/', strtolower($respuestaEstudiante));
        $palabrasClave = array_diff($palabras, $palabrasComunes);
        
        // Buscar la mejor posición en la transcripción
        $mejorPosicion = 0;
        $mejorScore = 0;
        $transcripcionLower = strtolower($transcripcion);
        
        // Buscar cada palabra clave
        foreach ($palabrasClave as $palabra) {
            if (strlen($palabra) < 3) continue; // Ignorar palabras muy cortas
            
            $posicion = strpos($transcripcionLower, $palabra);
            if ($posicion !== false) {
                // Si encontramos la palabra, este es un buen punto de inicio
                $mejorPosicion = max(0, $posicion - 500); // Contexto antes
                $mejorScore++;
                
                error_log("🔍 Encontrada palabra clave '{$palabra}' en posición {$posicion}");
            }
        }
        
        // Si encontramos contexto relevante, usar ese segmento
        if ($mejorScore > 0) {
            $segmento = substr($transcripcion, $mejorPosicion, $maxCaracteres);
            error_log("✅ Usando contexto relevante desde posición {$mejorPosicion} ({$mejorScore} coincidencias)");
            return $segmento;
        }
        
        // Fallback: retornar inicio de transcripción
        error_log("⚠️ No se encontró contexto específico, usando inicio de transcripción");
        return substr($transcripcion, 0, $maxCaracteres);
    }

    /**
     * 🆕 Evalúa una respuesta del estudiante de forma conversacional
     * 
     * @param string $pregunta Pregunta que se hizo al estudiante
     * @param string $respuestaEstudiante Respuesta del estudiante
     * @param array $videoData Datos del video con transcripción
     * @param string $userName Nombre del usuario
     * @param int $numeroPregunta Número de pregunta (1, 2 o 3)
     * @return string Prompt para OpenAI que evalúa y da feedback
     */
    public function evaluarRespuestaConversacional($pregunta, $respuestaEstudiante, $videoData, $userName, $numeroPregunta) {
        $tituloVideo = $videoData['titulo_completo'] ?? 'el video';
        $transcripcion = isset($videoData['transcripcion']) ? $this->limpiarTranscripcionParaIA($videoData['transcripcion']) : '';
        
        // 🆕 Buscar segmento relevante basándose en la respuesta del estudiante
        // Esto ayuda a que la IA tenga el contexto correcto para evaluar
        $transcripcionLimitada = $this->buscarContextoRelevante($respuestaEstudiante, $transcripcion, 8000);
        
        error_log("📊 Transcripción para evaluación: " . strlen($transcripcionLimitada) . " caracteres");
        error_log("📝 Respuesta a evaluar: " . substr($respuestaEstudiante, 0, 100));
        
        $prompt = "Eres un mentor educativo evaluando la respuesta de {$userName} sobre el video **'{$tituloVideo}'**.

**CONTENIDO DEL VIDEO (REFERENCIA COMPLETA):**
\"\"\"
{$transcripcionLimitada}
\"\"\"

**PREGUNTA QUE HICISTE (pregunta {$numeroPregunta} de 3):**
\"{$pregunta}\"

**RESPUESTA DE {$userName}:**
\"{$respuestaEstudiante}\"

**TU TAREA:**
Evaluar si la respuesta es correcta basándote ÚNICAMENTE en el contenido del video mostrado arriba.

**PROCESO DE EVALUACIÓN (IMPORTANTE):**

1. **PRIMERO**: Busca cuidadosamente en el contenido del video si la información mencionada por {$userName} está presente
2. **Si la información SÍ aparece en el video**: Da feedback positivo y reconoce la respuesta correcta
3. **Si la información NO aparece en el video**: Explica qué información del video sí es correcta
4. **Si la respuesta es parcial**: Reconoce lo correcto y complementa lo que faltó

⚠️ **REGLAS CRÍTICAS:**
- BUSCA CUIDADOSAMENTE en toda la transcripción del video antes de decir que algo \"no se menciona\"
- Si encuentras la información en el video, SIEMPRE reconócelo como correcto
- NO digas \"en la transcripción\" → siempre di \"en el video\"
- NO des calificaciones numéricas
- Máximo 3-4 oraciones
- Tono amigable y motivador

🎯 **FORMATO DEL FEEDBACK:**

Si es correcto:
\"¡Muy bien, {$userName}! Exactamente, en el video se menciona [concepto]. [Breve refuerzo]\"

Si es parcial:
\"Vas por buen camino, {$userName}. Mencionaste [parte correcta], pero también se habla de [parte faltante].\"

Si es incorrecto:
\"Entiendo tu idea, {$userName}, pero en el video se explica que en realidad [concepto correcto].\"

**RECUERDA**: Siempre VERIFICA primero en el contenido del video antes de decir que algo no está. La información podría estar expresada de forma diferente.

Responde ahora SOLO con el feedback (máximo 3-4 oraciones):";

        return $prompt;
    }
    
    /**
     * 🔧 Alias para compatibilidad con código existente
     * Llama a detectarTimestampEnPregunta()
     */
    public function detectarTimestamp($pregunta) {
        return $this->detectarTimestampEnPregunta($pregunta);
    }
}



?>