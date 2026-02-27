<?php
/**
 * Endpoint: mentor/chat.php
 * POST - Chat contextual sobre el video actual.
 * Carga transcripción, extrae segmento relevante y responde con GPT-4o.
 */

require_once '../../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable('../../');
$dotenv->load();

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit();
}

include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../middleware/AuthMiddleware.php';
include_once '../../utils/OpenAIService.php';
include_once '../../utils/MentorPromptBuilder.php';
include_once '../../utils/ConversationalPromptBuilder.php';
include_once '../../utils/ContextManager.php';

$database = new Database();
$db = $database->getConnection();

$userData = AuthMiddleware::requireAuth();
$userId = $userData->id;
$userName = $userData->nombre ?? $userData->name ?? 'Estudiante';

$data = json_decode(file_get_contents("php://input"));
$documentId = intval($data->document_id ?? 0);
$videoId = intval($data->video_id ?? 0);
$pregunta = trim($data->pregunta ?? '');
$currentTime = floatval($data->current_time ?? 0);

if (!$documentId || !$videoId || !$pregunta) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'document_id, video_id y pregunta son requeridos']);
    exit();
}

$sessionId = "mentor2_{$userId}_{$documentId}";

try {
    // 1. Cargar datos del video (con transcripción)
    $stmtVideo = $db->prepare("SELECT * FROM doc_mentor_videos WHERE id = ? AND document_id = ?");
    $stmtVideo->execute([$videoId, $documentId]);
    $videoData = $stmtVideo->fetch(PDO::FETCH_ASSOC);

    if (!$videoData) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Video no encontrado']);
        exit();
    }

    // 2. Limpiar transcripción de \r que puede romper JSON de OpenAI
    if (!empty($videoData['transcripcion'])) {
        $videoData['transcripcion'] = str_replace("\r", "", $videoData['transcripcion']);
    }

    // 3. Obtener contexto conversacional reciente (sin FK — best effort)
    $contextManager = new ContextManager($db);
    $contextReciente = [];
    try {
        $contextReciente = $contextManager->getRecentContext($sessionId, 6) ?? [];
    } catch (Exception $e) {
        // Session may not exist yet — skip context
    }

    // 4. Construir prompt con MentorPromptBuilder
    $promptBuilder = new ConversationalPromptBuilder($db);
    $mentorPromptBuilder = new MentorPromptBuilder($db, $promptBuilder);

    $prompt = $mentorPromptBuilder->buildVideoQuestionPrompt(
        $pregunta, $videoData, $userName, $contextReciente, $currentTime
    );

    // 5. Llamar a OpenAI
    $openai = new OpenAIService();
    $messages = [
        ['role' => 'system', 'content' => 'Eres un mentor educativo amigable que ayuda a estudiantes a comprender videos educativos. Responde en español.'],
        ['role' => 'user', 'content' => $prompt]
    ];

    $responseData = $openai->chat($messages, [
        'model' => 'gpt-4o',
        'temperature' => 0.7,
        'max_tokens' => 500
    ]);

    if (!$responseData || !isset($responseData['choices'][0]['message']['content'])) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error al generar respuesta']);
        exit();
    }

    $respuesta = $responseData['choices'][0]['message']['content'];

    // 6. Guardar en contexto (best effort — session may not exist)
    try {
        $contextManager->saveMessage($sessionId, 'user', $pregunta);
        $contextManager->saveMessage($sessionId, 'assistant', $respuesta);
    } catch (Exception $e) {
        error_log("mentor/chat: No se pudo guardar contexto (FK): " . $e->getMessage());
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'respuesta' => $respuesta,
            'video_id' => $videoId
        ]
    ]);

} catch (Exception $e) {
    error_log("Error en mentor/chat.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno del servidor']);
}
