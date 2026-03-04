<?php
/**
 * WaEvaluator — Evaluación IA de respuestas de estudiantes por WhatsApp
 *
 * Modos:
 * - ia_semantica: GPT evalúa comprensión conceptual (0.00-1.00)
 * - exacta: match textual normalizado
 * - libre: solo registra, no evalúa
 *
 * @since Fase 11.7
 */

require_once __DIR__ . '/../config/config.php';

class WaEvaluator {

    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function evaluar(string $respuesta, string $pregunta, string $criterios, string $modo = 'ia_semantica', string $contexto = ''): array {
        switch ($modo) {
            case 'exacta':
                return $this->evaluarExacta($respuesta, $criterios);
            case 'libre':
                return $this->evaluarLibre($respuesta);
            case 'ia_semantica':
            default:
                return $this->evaluarSemantica($respuesta, $pregunta, $criterios, $contexto);
        }
    }

    private function evaluarSemantica(string $respuesta, string $pregunta, string $criterios, string $contexto): array {
        $apiKey = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '';

        if (empty($apiKey)) {
            error_log("WaEvaluator: OpenAI API key no configurada");
            return [
                'score' => 0.5,
                'aprobado' => false,
                'retroalimentacion' => 'Tu respuesta fue registrada. La evaluacion automatica no esta disponible en este momento.'
            ];
        }

        $ctxBlock = $contexto ? "\nCONTEXTO: {$contexto}\n" : "";

        $prompt = "Eres un evaluador educativo. Evalua la respuesta del estudiante de forma justa y constructiva.

PREGUNTA:
{$pregunta}

RESPUESTA ESPERADA / CRITERIOS:
{$criterios}
{$ctxBlock}
RESPUESTA DEL ESTUDIANTE:
{$respuesta}

INSTRUCCIONES:
- Evalua comprension CONCEPTUAL, no palabras exactas
- Acepta sinonimos, explicaciones alternativas y lenguaje coloquial
- El estudiante responde por WhatsApp, puede ser informal
- Se constructivo: si la respuesta es parcial, indica que falto
- Si la respuesta es incorrecta, explica brevemente por que

Responde SOLO con JSON valido (sin markdown):
{
  \"score\": 0.00-1.00,
  \"aprobado\": true/false,
  \"retroalimentacion\": \"texto breve y constructivo (max 200 palabras, formato WhatsApp sin markdown)\"
}

Score: 0.8-1.0 = excelente, 0.6-0.79 = bueno (aprobado), 0.4-0.59 = parcial, 0.0-0.39 = insuficiente.
aprobado = true si score >= 0.6";

        $data = [
            'model' => 'gpt-4o-mini',
            'messages' => [
                ['role' => 'system', 'content' => 'Eres un evaluador educativo preciso. Responde SOLO con JSON valido.'],
                ['role' => 'user', 'content' => $prompt]
            ],
            'temperature' => 0.3,
            'max_tokens' => 500
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                "Authorization: Bearer {$apiKey}"
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            error_log("WaEvaluator: OpenAI error HTTP $httpCode");
            return [
                'score' => 0.5,
                'aprobado' => false,
                'retroalimentacion' => 'Respuesta registrada. No pudimos evaluar automaticamente en este momento.'
            ];
        }

        $result = json_decode($response, true);
        $content = $result['choices'][0]['message']['content'] ?? '';

        $content = preg_replace('/^```json\s*/i', '', $content);
        $content = preg_replace('/\s*```$/', '', $content);

        $eval = json_decode($content, true);

        if (!$eval || !isset($eval['score'])) {
            error_log("WaEvaluator: No se pudo parsear respuesta GPT: " . substr($content, 0, 200));
            return [
                'score' => 0.5,
                'aprobado' => false,
                'retroalimentacion' => 'Respuesta registrada. La evaluacion no pudo completarse.'
            ];
        }

        return [
            'score' => max(0, min(1, (float)$eval['score'])),
            'aprobado' => (bool)($eval['aprobado'] ?? ($eval['score'] >= 0.6)),
            'retroalimentacion' => $eval['retroalimentacion'] ?? 'Evaluacion completada.'
        ];
    }

    private function evaluarExacta(string $respuesta, string $criterios): array {
        $respNorm = $this->normalizar($respuesta);
        $critNorm = $this->normalizar($criterios);

        if ($respNorm === $critNorm) {
            return ['score' => 1.0, 'aprobado' => true, 'retroalimentacion' => 'Correcto!'];
        }
        if (strpos($respNorm, $critNorm) !== false) {
            return ['score' => 0.9, 'aprobado' => true, 'retroalimentacion' => 'Correcto!'];
        }
        if (strlen($respNorm) > 3 && strpos($critNorm, $respNorm) !== false) {
            return ['score' => 0.7, 'aprobado' => true, 'retroalimentacion' => 'Parcialmente correcta. La respuesta completa es: ' . $criterios];
        }
        return ['score' => 0.0, 'aprobado' => false, 'retroalimentacion' => 'Incorrecto. La respuesta correcta es: ' . $criterios];
    }

    private function evaluarLibre(string $respuesta): array {
        return ['score' => 1.0, 'aprobado' => true, 'retroalimentacion' => 'Gracias por tu respuesta. Ha sido registrada.'];
    }

    private function normalizar(string $text): string {
        $text = mb_strtolower(trim($text));
        $text = preg_replace('/\s+/', ' ', $text);
        $text = str_replace(['a','e','i','o','u','n','u'], ['a','e','i','o','u','n','u'], $text);
        $text = preg_replace('/[.,;:!?\-_()"\']/', '', $text);
        return trim($text);
    }
}
