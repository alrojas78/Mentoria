<?php
/**
 * QuestionGenerator - VERSIÓN MEJORADA
 * 
 * Servicio especializado para generar preguntas de evaluación en formatos variados
 * SIN REPETIR conceptos/temas entre preguntas.
 * 
 * Tipos de preguntas soportados:
 * - Verdadero/Falso
 * - Selección Múltiple
 * - Completar
 * - Pregunta Abierta
 * - Lista Enumerada
 * 
 * @author MentorIA Team
 * @version 2.0 - Con prevención de repetición de conceptos
 */

class QuestionGenerator {
    private $db;
    private $conceptosUsados = []; // 🆕 Registro de conceptos ya preguntados
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Genera un pool de preguntas variadas para evaluación SIN REPETIR CONCEPTOS
     * 
     * @param object $documento Objeto documento con contenido
     * @param int $cantidadPreguntas Número de preguntas a generar
     * @param string $seed Semilla para aleatoriedad
     * @return array Array de preguntas en formato estructurado
     */
    public function generateQuestionPool($documento, $cantidadPreguntas, $seed) {
        $preguntas = [];
        $this->conceptosUsados = []; // 🆕 Resetear conceptos al inicio
        
        // Tipos de preguntas disponibles
        $tiposPreguntas = [
            'verdadero_falso',
            'seleccion_multiple',
            'completar',
            'pregunta_abierta',
            'lista_enumerada'
        ];
        
        // Asegurar variedad: distribuir tipos equitativamente
        $tiposDistribuidos = $this->distribuirTiposPregunta($cantidadPreguntas, $tiposPreguntas);
        
        // 🆕 Generar preguntas con contexto acumulativo
        $intentos = 0;
        $maxIntentos = $cantidadPreguntas * 3; // Permitir reintentos si hay repeticiones
        
        for ($i = 0; $i < $cantidadPreguntas && $intentos < $maxIntentos; $i++) {
            $tipoAsignado = $tiposDistribuidos[$i];
            
            $pregunta = $this->generateSingleQuestion(
                $documento,
                $tipoAsignado,
                $i + 1,
                $seed
            );
            
            if ($pregunta) {
                // 🆕 Verificar si el concepto ya fue usado
                if ($this->esConceptoNuevo($pregunta)) {
                    $this->registrarConcepto($pregunta);
                    $preguntas[] = $pregunta;
                } else {
                    // Si es concepto repetido, reintentar con otro tipo
                    error_log("⚠️ Concepto repetido detectado, reintentando pregunta {$i}...");
                    $i--; // Reintentar esta posición
                }
            }
            
            $intentos++;
        }
        
        // Si no se pudieron generar todas, rellenar con las que se pudieron
        if (count($preguntas) < $cantidadPreguntas) {
            error_log("⚠️ Solo se generaron " . count($preguntas) . " de {$cantidadPreguntas} preguntas únicas");
        }
        
        // Mezclar aleatoriamente
        shuffle($preguntas);
        
        return $preguntas;
    }
    
    /**
     * 🆕 Verifica si el concepto de la pregunta es nuevo (no repetido)
     * 
     * @param array $pregunta Pregunta generada
     * @return bool True si es concepto nuevo, False si ya fue usado
     */
    private function esConceptoNuevo($pregunta) {
        $textoPregunta = strtolower($pregunta['pregunta']);
        
        // Extraer palabras clave (sustantivos importantes)
        $palabrasClave = $this->extraerPalabrasClave($textoPregunta);
        
        // Verificar si alguna combinación de palabras clave ya fue usada
        foreach ($this->conceptosUsados as $conceptoUsado) {
            $similitud = $this->calcularSimilitud($palabrasClave, $conceptoUsado);
            
            // Si similitud > 70%, considerar concepto repetido
            if ($similitud > 0.7) {
                error_log("   Similitud detectada: " . ($similitud * 100) . "%");
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 🆕 Registra el concepto de una pregunta como usado
     * 
     * @param array $pregunta Pregunta a registrar
     */
    private function registrarConcepto($pregunta) {
        $textoPregunta = strtolower($pregunta['pregunta']);
        $palabrasClave = $this->extraerPalabrasClave($textoPregunta);
        
        $this->conceptosUsados[] = $palabrasClave;
        
        error_log("✅ Concepto registrado: " . implode(", ", array_slice($palabrasClave, 0, 3)));
    }
    
    /**
     * 🆕 Extrae palabras clave importantes de una pregunta
     * 
     * @param string $texto Texto de la pregunta
     * @return array Array de palabras clave
     */
    private function extraerPalabrasClave($texto) {
        // Palabras comunes a ignorar (stop words en español)
        $stopWords = [
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'a', 'al', 'en', 'con', 'por', 'para',
            'es', 'son', 'está', 'están', 'ser', 'estar',
            'qué', 'cuál', 'cuáles', 'cómo', 'dónde', 'cuándo',
            'que', 'cual', 'como', 'donde', 'cuando',
            'y', 'o', 'pero', 'si', 'no'
        ];
        
        // Limpiar y dividir en palabras
        $texto = preg_replace('/[^\w\sáéíóúñü]/u', '', $texto);
        $palabras = explode(' ', $texto);
        
        // Filtrar palabras significativas
        $palabrasClave = [];
        foreach ($palabras as $palabra) {
            $palabra = trim($palabra);
            // Mantener palabras de más de 4 letras que no sean stop words
            if (strlen($palabra) > 4 && !in_array($palabra, $stopWords)) {
                $palabrasClave[] = $palabra;
            }
        }
        
        return array_unique($palabrasClave);
    }
    
    /**
     * 🆕 Calcula similitud entre dos conjuntos de palabras clave
     * 
     * @param array $palabras1 Primer conjunto
     * @param array $palabras2 Segundo conjunto
     * @return float Valor entre 0 y 1 (0 = diferentes, 1 = idénticos)
     */
    private function calcularSimilitud($palabras1, $palabras2) {
        if (empty($palabras1) || empty($palabras2)) {
            return 0;
        }
        
        // Calcular intersección
        $comunes = array_intersect($palabras1, $palabras2);
        $union = array_unique(array_merge($palabras1, $palabras2));
        
        // Índice de Jaccard: |A ∩ B| / |A ∪ B|
        return count($comunes) / count($union);
    }
    
    /**
     * Distribuye tipos de pregunta equitativamente para variedad
     * 
     * @param int $cantidad Número total de preguntas
     * @param array $tipos Tipos disponibles
     * @return array Array con tipos asignados
     */
    private function distribuirTiposPregunta($cantidad, $tipos) {
        $distribucion = [];
        $numTipos = count($tipos);
        
        for ($i = 0; $i < $cantidad; $i++) {
            $distribucion[] = $tipos[$i % $numTipos];
        }
        
        // Mezclar para que no sea predecible
        shuffle($distribucion);
        
        return $distribucion;
    }
    
    /**
     * Genera una sola pregunta del tipo especificado
     * 
     * @param object $documento Documento fuente
     * @param string $tipo Tipo de pregunta
     * @param int $numero Número de pregunta
     * @param string $seed Semilla
     * @return array|null Pregunta generada o null si falla
     */
    private function generateSingleQuestion($documento, $tipo, $numero, $seed) {
        $prompt = $this->buildPromptForType($tipo, $documento, $numero, $seed);
        
        // Llamar a OpenAI
        $response = $this->callOpenAI($prompt);
        
        if (!$response) {
            error_log("❌ Error generando pregunta tipo {$tipo}, número {$numero}");
            return null;
        }
        
        // Parsear JSON
        $preguntaData = json_decode($response, true);
        
        if (!$preguntaData || !isset($preguntaData['pregunta'])) {
            error_log("❌ Respuesta inválida de OpenAI para pregunta {$numero}");
            return null;
        }
        
        // Asegurar campos requeridos
        $preguntaData['id'] = $numero;
        $preguntaData['tipo'] = $tipo;
        
        return $preguntaData;
    }
    
    /**
     * Construye el prompt específico para cada tipo de pregunta
     * 🆕 INCLUYE CONTEXTO DE PREGUNTAS ANTERIORES
     * 
     * @param string $tipo Tipo de pregunta
     * @param object $documento Documento fuente
     * @param int $numero Número de pregunta
     * @param string $seed Semilla
     * @return string Prompt construido
     */
    private function buildPromptForType($tipo, $documento, $numero, $seed) {
        $contenido = substr($documento->contenido, 0, 4000); // Límite para token efficiency
        
        // 🆕 Agregar contexto de conceptos ya usados
        $contextoPrevio = $this->construirContextoPrevio();
        
        switch ($tipo) {
            case 'verdadero_falso':
                return $this->buildVerdaderoFalsoPrompt($contenido, $numero, $seed, $contextoPrevio);
            
            case 'seleccion_multiple':
                return $this->buildSeleccionMultiplePrompt($contenido, $numero, $seed, $contextoPrevio);
            
            case 'completar':
                return $this->buildCompletarPrompt($contenido, $numero, $seed, $contextoPrevio);
            
            case 'pregunta_abierta':
                return $this->buildPreguntaAbiertaPrompt($contenido, $numero, $seed, $contextoPrevio);
            
            case 'lista_enumerada':
                return $this->buildListaEnumeradaPrompt($contenido, $numero, $seed, $contextoPrevio);
            
            default:
                return $this->buildPreguntaAbiertaPrompt($contenido, $numero, $seed, $contextoPrevio);
        }
    }
    
    /**
     * 🆕 Construye contexto de conceptos ya preguntados
     * 
     * @return string Texto con conceptos usados
     */
    private function construirContextoPrevio() {
        if (empty($this->conceptosUsados)) {
            return "";
        }
        
        $contexto = "\n\n🚫 CONCEPTOS YA PREGUNTADOS (NO REPETIR):\n";
        
        foreach ($this->conceptosUsados as $index => $palabrasClave) {
            $conceptoTexto = implode(", ", array_slice($palabrasClave, 0, 5));
            $contexto .= "- Pregunta anterior " . ($index + 1) . ": {$conceptoTexto}\n";
        }
        
        $contexto .= "\n⚠️ IMPORTANTE: Genera una pregunta sobre un tema/concepto COMPLETAMENTE DIFERENTE a los anteriores.\n";
        $contexto .= "No repitas beneficios, características, funciones o temas ya mencionados.\n";
        
        return $contexto;
    }
    
    /**
     * Prompt para preguntas Verdadero/Falso
     * 🆕 CON CONTEXTO DE PREGUNTAS PREVIAS
     */
    private function buildVerdaderoFalsoPrompt($contenido, $numero, $seed, $contextoPrevio) {
        return "Genera UNA pregunta de tipo VERDADERO/FALSO basada en el documento médico.

INSTRUCCIONES:
- Formula una AFIRMACIÓN que pueda ser verdadera o falsa
- La afirmación debe ser clara y sin ambigüedades
- Debe evaluar comprensión de conceptos clave
- IMPORTANTE: Alterna entre verdadero y falso (no todas verdaderas)
{$contextoPrevio}

FORMATO DE RESPUESTA (JSON):
{
  \"id\": {$numero},
  \"tipo\": \"verdadero_falso\",
  \"pregunta\": \"La afirmación aquí (sin preguntar si es V o F)\",
  \"respuesta_correcta\": \"verdadero\" o \"falso\",
  \"justificacion\": \"Explicación clara de por qué\"
}

EJEMPLOS:
✅ BUENO: \"Las células parietales producen ácido clorhídrico y factor intrínseco\"
❌ MALO: \"¿Es verdadero que las células parietales producen ácido?\"

CONTENIDO DEL DOCUMENTO:
{$contenido}

Seed: {$seed}{$numero}
Genera la pregunta en formato JSON válido.";
    }
    
    /**
     * Prompt para Selección Múltiple
     * 🆕 CON CONTEXTO DE PREGUNTAS PREVIAS
     */
    private function buildSeleccionMultiplePrompt($contenido, $numero, $seed, $contextoPrevio) {
        return "Genera UNA pregunta de SELECCIÓN MÚLTIPLE basada en el documento médico.

INSTRUCCIONES:
- Formula una pregunta clara con 4 opciones (A, B, C, D)
- SOLO UNA opción debe ser correcta
- Las opciones incorrectas deben ser plausibles (no obvias)
- Enfócate en conceptos importantes del documento
{$contextoPrevio}

FORMATO DE RESPUESTA (JSON):
{
  \"id\": {$numero},
  \"tipo\": \"seleccion_multiple\",
  \"pregunta\": \"¿La pregunta aquí?\",
  \"opciones\": [
    {\"letra\": \"A\", \"texto\": \"Opción A\"},
    {\"letra\": \"B\", \"texto\": \"Opción B\"},
    {\"letra\": \"C\", \"texto\": \"Opción C\"},
    {\"letra\": \"D\", \"texto\": \"Opción D\"}
  ],
  \"respuesta_correcta\": \"A\",
  \"justificacion\": \"Por qué A es correcta\"
}

EJEMPLO:
Pregunta: \"¿Qué sustancia producen las células principales del estómago?\"
A) Ácido clorhídrico
B) Pepsinógeno
C) Gastrina
D) Bicarbonato
Correcta: B

CONTENIDO DEL DOCUMENTO:
{$contenido}

Seed: {$seed}{$numero}
Genera la pregunta en formato JSON válido.";
    }
    
    /**
     * Prompt para Completar
     * 🆕 CON CONTEXTO DE PREGUNTAS PREVIAS
     */
    private function buildCompletarPrompt($contenido, $numero, $seed, $contextoPrevio) {
        return "Genera UNA pregunta de COMPLETAR (llenar el espacio en blanco) basada en el documento.

INSTRUCCIONES:
- Crea una oración con UN espacio en blanco (_______)
- El espacio debe estar en una palabra/concepto clave
- La respuesta debe ser específica (no demasiado genérica)
- Debe poder completarse con 1-3 palabras
{$contextoPrevio}

FORMATO DE RESPUESTA (JSON):
{
  \"id\": {$numero},
  \"tipo\": \"completar\",
  \"pregunta\": \"La frase con _______ en el espacio a completar\",
  \"respuesta_correcta\": \"palabra o frase correcta\",
  \"justificacion\": \"Por qué esta es la respuesta\"
}

EJEMPLOS:
✅ BUENO: \"El _______ es producido por las células principales y se activa en presencia de HCl\"
   Respuesta: \"pepsinógeno\"

✅ BUENO: \"La bomba de protones intercambia iones de hidrógeno por iones de _______\"
   Respuesta: \"potasio\"

❌ MALO: \"Las células parietales producen _______\" (demasiado genérico - muchas respuestas posibles)

CONTENIDO DEL DOCUMENTO:
{$contenido}

Seed: {$seed}{$numero}
Genera la pregunta en formato JSON válido.";
    }
    
    /**
     * Prompt para Pregunta Abierta
     * 🆕 CON CONTEXTO DE PREGUNTAS PREVIAS
     */
    private function buildPreguntaAbiertaPrompt($contenido, $numero, $seed, $contextoPrevio) {
        return "Genera UNA pregunta ABIERTA que requiera explicación basada en el documento.

INSTRUCCIONES:
- Formula una pregunta que requiera respuesta explicativa (no sí/no)
- Debe evaluar comprensión profunda, no solo memorización
- La respuesta esperada debe tener 2-4 puntos clave
- Usa verbos como: explica, describe, analiza, compara
{$contextoPrevio}

FORMATO DE RESPUESTA (JSON):
{
  \"id\": {$numero},
  \"tipo\": \"pregunta_abierta\",
  \"pregunta\": \"¿La pregunta abierta aquí?\",
  \"respuesta_correcta\": \"Respuesta modelo con puntos clave\",
  \"puntos_clave\": [\"Punto 1\", \"Punto 2\", \"Punto 3\"],
  \"justificacion\": \"Explicación adicional\"
}

EJEMPLOS:
✅ \"¿Cómo se produce el ácido clorhídrico en las células parietales?\"
✅ \"Explica el mecanismo de acción de la bomba de protones\"
✅ \"Describe las diferencias entre un IBP y un P-CAB\"

❌ \"¿Qué es el ácido clorhídrico?\" (demasiado simple)

CONTENIDO DEL DOCUMENTO:
{$contenido}

Seed: {$seed}{$numero}
Genera la pregunta en formato JSON válido.";
    }
    
    /**
     * Prompt para Lista Enumerada
     * 🆕 CON CONTEXTO DE PREGUNTAS PREVIAS
     */
    private function buildListaEnumeradaPrompt($contenido, $numero, $seed, $contextoPrevio) {
        return "Genera UNA pregunta que requiera ENUMERAR elementos basada en el documento.

INSTRUCCIONES:
- Pide enumerar 3-5 elementos relacionados
- Debe ser verificable en el documento
- No pidas \"todos\" si hay muchos (específica cantidad)
- Los elementos deben estar claramente en el documento
{$contextoPrevio}

FORMATO DE RESPUESTA (JSON):
{
  \"id\": {$numero},
  \"tipo\": \"lista_enumerada\",
  \"pregunta\": \"Enumera [cantidad] [elementos] que...\",
  \"respuesta_correcta\": [\"Elemento 1\", \"Elemento 2\", \"Elemento 3\"],
  \"cantidad_esperada\": 3,
  \"justificacion\": \"Dónde se encuentran en el documento\"
}

EJEMPLOS:
✅ \"Enumera 3 funciones principales del ácido clorhídrico en el estómago\"
✅ \"Menciona 4 tipos de células presentes en las glándulas gástricas\"
✅ \"Lista 3 hormonas que regulan la secreción gástrica\"

❌ \"Enumera todas las partes del sistema digestivo\" (demasiado amplio)

CONTENIDO DEL DOCUMENTO:
{$contenido}

Seed: {$seed}{$numero}
Genera la pregunta en formato JSON válido.";
    }
    
    /**
     * Llama a OpenAI para generar la pregunta
     * 
     * @param string $prompt Prompt construido
     * @return string|null Respuesta JSON o null si falla
     */
    private function callOpenAI($prompt) {
        $apiKey = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '';
        
        if (empty($apiKey)) {
            error_log("❌ API Key de OpenAI no configurada");
            return null;
        }
        
        $data = [
            'model' => 'gpt-4o',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un experto en crear preguntas de evaluación médica. Respondes SIEMPRE en formato JSON válido. NUNCA repites conceptos o temas de preguntas anteriores.'
                ],
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ],
            'temperature' => 0.8, // 🆕 Aumentado para más variedad
            'max_tokens' => 800
        ];
        
        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            error_log("❌ Error OpenAI HTTP {$httpCode}: {$response}");
            return null;
        }
        
        $decoded = json_decode($response, true);
        
        if (!isset($decoded['choices'][0]['message']['content'])) {
            error_log("❌ Respuesta inválida de OpenAI");
            return null;
        }
        
        $content = $decoded['choices'][0]['message']['content'];
        
        // Extraer JSON si está envuelto en markdown
        if (preg_match('/```json\s*(.*?)\s*```/s', $content, $matches)) {
            return $matches[1];
        }
        
        // Extraer JSON si está en el texto
        if (preg_match('/{.*}/s', $content, $matches)) {
            return $matches[0];
        }
        
        return $content;
    }
}
?>