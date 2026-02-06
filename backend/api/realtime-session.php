<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config/config.php';
require_once '../config/db.php';
require_once '../middleware/AuthMiddleware.php';
require_once '../utils/PollyService.php';

// Validate authentication
$userData = AuthMiddleware::requireAuth();

$input = json_decode(file_get_contents('php://input'), true);
$documentId = $input['document_id'] ?? null;
$mode = $input['mode'] ?? 'consulta'; // consulta, mentor, evaluacion

// Get database connection
$database = new Database();
$db = $database->getConnection();

// Get document context if provided
$documentContext = '';
if ($documentId) {
    $stmt = $db->prepare("SELECT titulo, descripcion, contenido FROM documentos WHERE id = ?");
    $stmt->execute([$documentId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($doc) {
        $documentContext = "Documento: {$doc['titulo']}\n{$doc['descripcion']}\n\nContenido: {$doc['contenido']}";
    }
}

// Build medical glossary for pronunciation instructions
$medicalGlossary = PollyService::getMedicalGlossaryForInstructions();

// Build system instructions based on mode
$systemInstructions = buildSystemInstructions($mode, $documentContext, $medicalGlossary);

// Create ephemeral session with OpenAI
$ch = curl_init('https://api.openai.com/v1/realtime/sessions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . OPENAI_API_KEY,
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'model' => 'gpt-4o-realtime-preview-2024-12-17',
        'voice' => 'sage',
        'instructions' => $systemInstructions,
        'input_audio_format' => 'pcm16',
        'output_audio_format' => 'pcm16',
        'input_audio_transcription' => [
            'model' => 'whisper-1'
        ],
        'turn_detection' => [
            'type' => 'server_vad',
            'threshold' => 0.5,
            'prefix_padding_ms' => 300,
            'silence_duration_ms' => 500
        ]
    ])
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Error creando sesion Realtime',
        'details' => json_decode($response, true)
    ]);
    exit;
}

$sessionData = json_decode($response, true);

// Log session for monitoring
logRealtimeSession($db, $userData->id, $documentId, $mode, $sessionData['id'] ?? null);

echo json_encode([
    'success' => true,
    'client_secret' => $sessionData['client_secret'],
    'session_id' => $sessionData['id'] ?? null,
    'expires_at' => $sessionData['expires_at'] ?? null
]);

// === HELPER FUNCTIONS ===

function buildSystemInstructions($mode, $documentContext, $glossary) {
    $baseInstructions = "Eres MentorIA, un asistente de mentoria educativa medica.
Hablas espanol latinoamericano de forma clara y profesional.

PRONUNCIACION DE TERMINOS MEDICOS:
{$glossary}

CONTEXTO DEL DOCUMENTO:
{$documentContext}";

    switch ($mode) {
        case 'mentor':
            return $baseInstructions . "\n\nMODO MENTOR ACTIVO:
- Guia al estudiante a traves del contenido de forma estructurada
- Presenta videos y lecciones en orden
- Haz preguntas de verificacion despues de cada concepto
- Se paciente y ofrece explicaciones adicionales si es necesario
- Usa un tono amigable pero profesional";

        case 'evaluacion':
            return $baseInstructions . "\n\nMODO EVALUACION ACTIVO:
- Genera preguntas basadas en el contenido del documento
- Evalua las respuestas del estudiante de forma justa
- Proporciona retroalimentacion constructiva
- Manten un registro del progreso
- No des las respuestas directamente, guia al estudiante";

        default: // consulta
            return $baseInstructions . "\n\nMODO CONSULTA LIBRE:
- Responde preguntas sobre el contenido del documento
- Ofrece explicaciones claras y ejemplos
- Si no conoces algo, indicalo honestamente
- Sigue el hilo de la conversacion de forma natural";
    }
}

function logRealtimeSession($db, $userId, $documentId, $mode, $sessionId) {
    try {
        // Check if table exists first
        $tableCheck = $db->query("SHOW TABLES LIKE 'realtime_sessions'");
        if ($tableCheck->rowCount() === 0) {
            // Table doesn't exist yet, skip logging
            error_log("realtime_sessions table does not exist, skipping log");
            return;
        }
        
        $stmt = $db->prepare("
            INSERT INTO realtime_sessions (user_id, document_id, mode, openai_session_id, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$userId, $documentId, $mode, $sessionId]);
    } catch (Exception $e) {
        error_log("Error logging realtime session: " . $e->getMessage());
    }
}
?>
