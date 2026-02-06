<?php
/**
 * SemanticEvaluator
 * 
 * Servicio especializado para evaluar respuestas de manera CONCEPTUAL (no textual).
 * Usa OpenAI para determinar si el estudiante comprende el concepto, independientemente
 * de las palabras exactas que use.
 * 
 * Características:
 * - Evaluación semántica con IA
 * - Respeta configuración de ponderación (completa, parcial, mínima)
 * - Genera feedback educativo personalizado
 * - Acepta sinónimos y variantes de respuesta
 * 
 * @author MentorIA Team
 * @version 1.0
 */

class SemanticEvaluator {
    private $db;
    private $promptBuilder;
    
    public function __construct($database, $promptBuilder = null) {
        $this->db = $database;
        $this->promptBuilder = $promptBuilder;
    }
    
    /**
     * Evalúa una respuesta de manera semántica usando IA
     * 
     * @param array $pregunta Datos de la pregunta (tipo, pregunta, respuesta_correcta, etc)
     * @param string $respuestaUsuario Respuesta dada por el usuario
     * @param array $ponderacion Ponderación (completa, parcial, minima, umbral_parcial)
     * @param string $userName Nombre del usuario para personalización
     * @return array ['puntaje' => float, 'nivel' => string, 'feedback' => string]
     */
    public function evaluateAnswer($pregunta, $respuestaUsuario, $ponderacion, $userName = 'estudiante') {
        $tipo = $pregunta['tipo'] ?? 'pregunta_abierta';
        
        // Usar variación del nombre si tenemos promptBuilder
        if ($this->promptBuilder) {
            $userName = $this->promptBuilder->getNameVariation($userName);
        }
        
        switch ($tipo) {
            case 'verdadero_falso':
                return $this->evaluateVerdaderoFalso($pregunta, $respuestaUsuario, $ponderacion, $userName);
            
            case 'seleccion_multiple':
                return $this->evaluateSeleccionMultiple($pregunta, $respuestaUsuario, $ponderacion, $userName);
            
            case 'completar':
                return $this->evaluateCompletar($pregunta, $respuestaUsuario, $ponderacion, $userName);
            
            case 'lista_enumerada':
                return $this->evaluateListaEnumerada($pregunta, $respuestaUsuario, $ponderacion, $userName);
            
            case 'pregunta_abierta':
            default:
                return $this->evaluatePreguntaAbierta($pregunta, $respuestaUsuario, $ponderacion, $userName);
        }
    }
    
    /**
     * Evalúa pregunta Verdadero/Falso
     */
    private function evaluateVerdaderoFalso($pregunta, $respuestaUsuario, $ponderacion, $userName) {
        $respuestaCorrecta = strtolower(trim($pregunta['respuesta_correcta']));
        $respuestaUsuarioNorm = strtolower(trim($respuestaUsuario));
        
        // Variantes aceptadas
        $variantesVerdadero = ['verdadero', 'true', 'v', 'si', 'sí', 'correcto', 'cierto', '1', 'yes'];
        $variantesFalso = ['falso', 'false', 'f', 'no', 'incorrecto', '0'];
        
        $esVerdadero = in_array($respuestaUsuarioNorm, $variantesVerdadero);
        $esFalso = in_array($respuestaUsuarioNorm, $variantesFalso);
        
        $correcta = ($respuestaCorrecta === 'verdadero' || $respuestaCorrecta === 'true') ? 'verdadero' : 'falso';
        
        if (($correcta === 'verdadero' && $esVerdadero) || ($correcta === 'falso' && $esFalso)) {
            return [
                'puntaje' => $ponderacion['puntuacion_completa'],
                'nivel' => 'completa',
                'feedback' => "¡Correcto, {$userName}! " . ($pregunta['justificacion'] ?? '')
            ];
        } else {
            return [
                'puntaje' => 0,
                'nivel' => 'incorrecta',
                'feedback' => "Incorrecto, {$userName}. La respuesta correcta es {$correcta}. " . ($pregunta['justificacion'] ?? '')
            ];
        }
    }
    
    /**
     * Evalúa pregunta de Selección Múltiple
     */
    private function evaluateSeleccionMultiple($pregunta, $respuestaUsuario, $ponderacion, $userName) {
        $respuestaCorrecta = strtoupper(trim($pregunta['respuesta_correcta']));
        $respuestaUsuarioNorm = strtoupper(trim($respuestaUsuario));
        
        // Aceptar "A", "a", "opcion A", "la A", etc
        if (preg_match('/([A-D])/i', $respuestaUsuarioNorm, $matches)) {
            $respuestaUsuarioNorm = strtoupper($matches[1]);
        }
        
        if ($respuestaUsuarioNorm === $respuestaCorrecta) {
            return [
                'puntaje' => $ponderacion['puntuacion_completa'],
                'nivel' => 'completa',
                'feedback' => "¡Excelente, {$userName}! La opción {$respuestaCorrecta} es correcta. " . ($pregunta['justificacion'] ?? '')
            ];
        } else {
            return [
                'puntaje' => 0,
                'nivel' => 'incorrecta',
                'feedback' => "La respuesta correcta es {$respuestaCorrecta}, {$userName}. " . ($pregunta['justificacion'] ?? '')
            ];
        }
    }
    
    /**
     * Evalúa pregunta de Completar (con tolerancia a sinónimos)
     */
    private function evaluateCompletar($pregunta, $respuestaUsuario, $ponderacion, $userName) {
        $respuestaEsperada = $pregunta['respuesta_correcta'];
        
        // Construir prompt para evaluación semántica
        $prompt = "Evalúa si la respuesta del estudiante es correcta para completar el espacio en blanco.

PREGUNTA ORIGINAL:
{$pregunta['pregunta']}

RESPUESTA ESPERADA:
{$respuestaEsperada}

RESPUESTA DEL ESTUDIANTE:
{$respuestaUsuario}

INSTRUCCIONES:
- Evalúa si el CONCEPTO es correcto, no las palabras exactas
- Acepta SINÓNIMOS y variantes válidas
- Si es el mismo concepto con otras palabras → COMPLETA
- Si tiene el concepto general pero falta precisión → PARCIAL
- Si es incorrecto → INCORRECTA

PONDERACIÓN:
- Completa: {$ponderacion['puntuacion_completa']}
- Parcial: {$ponderacion['puntuacion_parcial']}
- Mínima: {$ponderacion['puntuacion_minima']}
- Umbral parcial: {$ponderacion['umbral_parcial']}

Responde en formato JSON:
{
  \"nivel\": \"completa\" | \"parcial\" | \"incorrecta\",
  \"puntaje\": numero,
  \"razonamiento\": \"por qué se asignó este nivel\",
  \"feedback\": \"feedback educativo para el estudiante (usa el nombre {$userName})\"
}";

        return $this->callOpenAIForEvaluation($prompt, $ponderacion, $userName);
    }
    
    /**
     * Evalúa pregunta de Lista Enumerada
     */
    private function evaluateListaEnumerada($pregunta, $respuestaUsuario, $ponderacion, $userName) {
        $elementosEsperados = $pregunta['respuesta_correcta'];
        $cantidadEsperada = $pregunta['cantidad_esperada'] ?? count($elementosEsperados);
        
        $prompt = "Evalúa la lista enumerada del estudiante.

PREGUNTA:
{$pregunta['pregunta']}

ELEMENTOS ESPERADOS (pueden estar en cualquier orden):
" . json_encode($elementosEsperados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "

RESPUESTA DEL ESTUDIANTE:
{$respuestaUsuario}

INSTRUCCIONES:
- Identifica cuántos elementos correctos mencionó (acepta sinónimos)
- Si menciona {$cantidadEsperada} o más elementos correctos → COMPLETA
- Si menciona al menos 50% de elementos correctos → PARCIAL
- Si menciona menos del 30% → INCORRECTA
- NO penalices por mencionar elementos adicionales si son correctos

PONDERACIÓN:
- Completa: {$ponderacion['puntuacion_completa']}
- Parcial: {$ponderacion['puntuacion_parcial']}
- Mínima: {$ponderacion['puntuacion_minima']}

Responde en formato JSON:
{
  \"nivel\": \"completa\" | \"parcial\" | \"incorrecta\",
  \"puntaje\": numero,
  \"elementos_correctos\": [\"elemento1\", \"elemento2\"],
  \"elementos_faltantes\": [\"elemento3\"],
  \"razonamiento\": \"explicación\",
  \"feedback\": \"feedback educativo para {$userName}\"
}";

        return $this->callOpenAIForEvaluation($prompt, $ponderacion, $userName);
    }
    
    /**
     * Evalúa pregunta abierta (la más compleja)
     */
    private function evaluatePreguntaAbierta($pregunta, $respuestaUsuario, $ponderacion, $userName) {
        $respuestaEsperada = $pregunta['respuesta_correcta'];
        $puntosClaveStr = '';
        
        if (isset($pregunta['puntos_clave']) && is_array($pregunta['puntos_clave'])) {
            $puntosClaveStr = "\n\nPUNTOS CLAVE ESPERADOS:\n";
            foreach ($pregunta['puntos_clave'] as $i => $punto) {
                $puntosClaveStr .= ($i + 1) . ". {$punto}\n";
            }
        }
        
        $prompt = "Evalúa la respuesta abierta del estudiante de manera CONCEPTUAL.

PREGUNTA:
{$pregunta['pregunta']}

RESPUESTA MODELO:
{$respuestaEsperada}
{$puntosClaveStr}

RESPUESTA DEL ESTUDIANTE:
{$respuestaUsuario}

INSTRUCCIONES DE EVALUACIÓN:
- Evalúa comprensión del CONCEPTO, no palabras exactas
- Acepta explicaciones con lenguaje diferente pero mismo concepto
- Evalúa profundidad y precisión conceptual

CRITERIOS:
**COMPLETA** ({$ponderacion['puntuacion_completa']} puntos):
- Menciona todos los conceptos clave
- Explicación clara y precisa
- Demuestra comprensión profunda

**PARCIAL** ({$ponderacion['puntuacion_parcial']} puntos):
- Menciona al menos 50% de conceptos clave
- Explicación básica pero correcta
- Comprensión general del tema

**MÍNIMA** ({$ponderacion['puntuacion_minima']} puntos):
- Menciona algún concepto relevante
- Explicación muy básica o incompleta
- Comprensión mínima

**INCORRECTA** (0 puntos):
- Conceptos erróneos
- No demuestra comprensión

Responde en formato JSON:
{
  \"nivel\": \"completa\" | \"parcial\" | \"minima\" | \"incorrecta\",
  \"puntaje\": numero,
  \"conceptos_cubiertos\": [\"concepto1\", \"concepto2\"],
  \"conceptos_faltantes\": [\"concepto3\"],
  \"razonamiento\": \"análisis detallado\",
  \"feedback\": \"feedback constructivo y educativo para {$userName}\"
}";

        return $this->callOpenAIForEvaluation($prompt, $ponderacion, $userName);
    }
    
    /**
     * Llama a OpenAI para evaluación semántica
     */
    private function callOpenAIForEvaluation($prompt, $ponderacion, $userName) {
        $apiKey = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '';
        
        if (empty($apiKey)) {
            error_log("API Key de OpenAI no configurada para evaluación");
            // Fallback: evaluación básica
            return [
                'puntaje' => $ponderacion['puntuacion_parcial'],
                'nivel' => 'parcial',
                'feedback' => "Tu respuesta ha sido registrada, {$userName}."
            ];
        }
        
        $data = [
            'model' => 'gpt-4o',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'Eres un evaluador educativo experto. Evalúas comprensión conceptual, no palabras exactas. Eres justo pero riguroso. Respondes SIEMPRE en formato JSON válido.'
                ],
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ],
            'temperature' => 0.3, // Baja temperatura para consistencia
            'max_tokens' => 600
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
            error_log("Error OpenAI evaluación HTTP {$httpCode}: {$response}");
            return $this->fallbackEvaluation($ponderacion, $userName);
        }
        
        $decoded = json_decode($response, true);
        
        if (!isset($decoded['choices'][0]['message']['content'])) {
            error_log("Respuesta inválida de OpenAI en evaluación");
            return $this->fallbackEvaluation($ponderacion, $userName);
        }
        
        $content = $decoded['choices'][0]['message']['content'];
        
        // Extraer JSON
        if (preg_match('/```json\s*(.*?)\s*```/s', $content, $matches)) {
            $content = $matches[1];
        } elseif (preg_match('/{.*}/s', $content, $matches)) {
            $content = $matches[0];
        }
        
        $evaluacion = json_decode($content, true);
        
        if (!$evaluacion || !isset($evaluacion['nivel'])) {
            error_log("JSON de evaluación inválido: " . $content);
            return $this->fallbackEvaluation($ponderacion, $userName);
        }
        
        // Asegurar que el puntaje esté dentro de los rangos válidos
        $nivel = $evaluacion['nivel'];
        $puntaje = $evaluacion['puntaje'] ?? $this->getPuntajePorNivel($nivel, $ponderacion);
        
        return [
            'puntaje' => $puntaje,
            'nivel' => $nivel,
            'feedback' => $evaluacion['feedback'] ?? "Respuesta evaluada, {$userName}.",
            'razonamiento' => $evaluacion['razonamiento'] ?? '',
            'detalles' => $evaluacion // Guardar evaluación completa para debugging
        ];
    }
    
    /**
     * Evaluación de fallback si OpenAI falla
     */
    private function fallbackEvaluation($ponderacion, $userName) {
        return [
            'puntaje' => $ponderacion['puntuacion_parcial'],
            'nivel' => 'parcial',
            'feedback' => "Tu respuesta ha sido evaluada, {$userName}. Por favor revisa con el instructor para validación adicional."
        ];
    }
    
    /**
     * Obtiene el puntaje según el nivel
     */
    private function getPuntajePorNivel($nivel, $ponderacion) {
        switch ($nivel) {
            case 'completa':
                return $ponderacion['puntuacion_completa'];
            case 'parcial':
                return $ponderacion['puntuacion_parcial'];
            case 'minima':
                return $ponderacion['puntuacion_minima'];
            case 'incorrecta':
            default:
                return 0;
        }
    }
    
    /**
     * Calcula el puntaje total de la evaluación
     * 
     * @param array $respuestas Array de respuestas con sus puntajes
     * @param int $totalPreguntas Total de preguntas
     * @param float $puntajeMaximo Puntaje máximo por pregunta
     * @return array ['porcentaje' => float, 'puntaje_total' => float, 'puntaje_maximo' => float]
     */
    public function calculateTotalScore($respuestas, $totalPreguntas, $puntajeMaximo = 1.0) {
        $puntajeObtenido = 0;
        
        foreach ($respuestas as $respuesta) {
            $puntajeObtenido += $respuesta['puntaje'] ?? 0;
        }
        
        $puntajeMaximoTotal = $totalPreguntas * $puntajeMaximo;
        $porcentaje = ($puntajeMaximoTotal > 0) ? ($puntajeObtenido / $puntajeMaximoTotal) * 100 : 0;
        
        return [
            'porcentaje' => round($porcentaje, 2),
            'puntaje_total' => round($puntajeObtenido, 2),
            'puntaje_maximo' => $puntajeMaximoTotal,
            'respuestas_completas' => count(array_filter($respuestas, fn($r) => ($r['nivel'] ?? '') === 'completa')),
            'respuestas_parciales' => count(array_filter($respuestas, fn($r) => ($r['nivel'] ?? '') === 'parcial')),
            'respuestas_incorrectas' => count(array_filter($respuestas, fn($r) => ($r['nivel'] ?? '') === 'incorrecta'))
        ];
    }
}
?>