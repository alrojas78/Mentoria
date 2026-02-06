<?php
require_once __DIR__ . '/../config/config.php';

class EvaluationService {
    private $apiKey;
    private $apiEndpoint = 'https://api.openai.com/v1/chat/completions';

    public function __construct() {
        if (defined('OPENAI_API_KEY')) {
            $this->apiKey = OPENAI_API_KEY;
        }
    }

    public function evaluateAnswer($question, $expectedAnswer, $userAnswer) {
        file_put_contents(__DIR__ . '/../logs/debug.log', "Entró a evaluateAnswer con pregunta: $question\n", FILE_APPEND);

        if (empty($this->apiKey)) {
            return $this->evaluateAnswerLocal($question, $expectedAnswer, $userAnswer);
        }

        $systemPrompt = <<<EOT
Eres un evaluador médico automático. Evalúas si una respuesta es correcta aunque tenga errores menores, sinónimos, parafraseo o errores fonéticos comunes.
Tu tarea es comparar la respuesta del estudiante con la esperada y determinar si es conceptualmente correcta, incluso si usa otras palabras o se expresa distinto.
Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura:
{
  "isCorrect": true o false,
  "feedback": "explicación breve y constructiva"
}

**PRIORIZA LA CORRECCIÓN CONCEPTUAL SOBRE LA EXACTITUD LITERAL.**

Debes ser flexible y considerar la respuesta como CORRECTA incluso si contiene:
Ejemplo:
- Errores fonéticos evidentes (ej. 'bildagliptina' en lugar de 'vildagliptina', 'metformina' con 'v', confusión b/v, s/c/z).
- Esperada: "Comprimidos recubiertos"
- Estudiante: "pastillas recubiertas"
→ Respuesta: { "isCorrect": true, "feedback": "Usaste un sinónimo válido" }
No incluyas texto fuera del objeto JSON. No expliques nada antes o después. Solo responde con JSON puro.
EOT;

        $data = [
            'model' => 'gpt-4o',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => "Pregunta: $question\nRespuesta esperada: $expectedAnswer\nRespuesta del estudiante: $userAnswer"]
            ],
            'temperature' => 0.4,
            'max_tokens' => 400
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
            $error = curl_error($ch);
            curl_close($ch);

            file_put_contents(__DIR__ . '/../logs/debug.log', "KEY: {$this->apiKey}\nDATA: " . json_encode($data) . "\n\n", FILE_APPEND);

            if ($error) {
                error_log("Error en OpenAI CURL: " . $error);
                return $this->evaluateAnswerLocal($question, $expectedAnswer, $userAnswer);
            }

            $decoded = json_decode($response, true);
            file_put_contents(__DIR__ . '/../logs/debug.log', "RESPUESTA JSON COMPLETA:\n" . print_r($decoded, true) . "\n\n", FILE_APPEND);

            if (isset($decoded['choices'][0]['message']['content'])) {
                $content = trim($decoded['choices'][0]['message']['content']);

                // Extraer JSON puro
                $jsonStart = strpos($content, '{');
                $jsonEnd = strrpos($content, '}');

                if ($jsonStart !== false && $jsonEnd !== false) {
                    $jsonString = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
                    $responseJson = json_decode($jsonString, true);

                    if (json_last_error() !== JSON_ERROR_NONE) {
                        file_put_contents(__DIR__ . '/../logs/debug.log', "Error al decodificar JSON: " . json_last_error_msg() . "\nRAW:\n$jsonString\n\n", FILE_APPEND);
                        $responseJson = null;
                    }
                } else {
                    $responseJson = null;
                }

                // Validar contenido JSON antes de usarlo
                if ($responseJson && is_array($responseJson) && isset($responseJson['isCorrect'])) {
                    $isCorrect = filter_var($responseJson['isCorrect'], FILTER_VALIDATE_BOOLEAN);
                    return [
                        'success' => true,
                        'data' => [
                            'isCorrect' => $isCorrect,
                            'feedback' => $responseJson['feedback'] ?? ''
                        ]
                    ];
                }
            }

            return $this->evaluateAnswerLocal($question, $expectedAnswer, $userAnswer);
        } catch (Exception $e) {
            error_log("Excepción en OpenAI: " . $e->getMessage());
            return $this->evaluateAnswerLocal($question, $expectedAnswer, $userAnswer);
        }
    }

    private function evaluateAnswerLocal($question, $expectedAnswer, $userAnswer) {
        $expectedLower = strtolower($expectedAnswer);
        $userLower = strtolower($userAnswer);

        $score = 0;
        $keywords = preg_split('/\s+/', $expectedLower);
        foreach ($keywords as $keyword) {
            if (strlen($keyword) > 3 && strpos($userLower, $keyword) !== false) {
                $score++;
            }
        }

        $threshold = count($keywords) * 0.6;
        $isCorrect = $score >= $threshold;

        $feedback = $isCorrect
            ? "Respuesta correcta. Has comprendido los conceptos clave."
            : "Tu respuesta no es del todo correcta. La respuesta esperada era: $expectedAnswer";

        return [
            'success' => true,
            'data' => [
                'isCorrect' => $isCorrect,
                'feedback' => $feedback
            ]
        ];
    }
}
?>
