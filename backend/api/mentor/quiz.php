<?php
/**
 * Endpoint: mentor/quiz.php
 * POST - Genera o evalúa preguntas de retroalimentación post-video.
 * action: "generate" → genera 3 preguntas
 * action: "evaluate" → evalúa respuesta del estudiante
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
include_once '../../utils/VideoRetroalimentacionHelper.php';

$database = new Database();
$db = $database->getConnection();

$userData = AuthMiddleware::requireAuth();
$userId = $userData->id;
$userName = $userData->nombre ?? $userData->name ?? 'Estudiante';

$data = json_decode(file_get_contents("php://input"));
$action = $data->action ?? '';
$documentId = intval($data->document_id ?? 0);
$videoId = intval($data->video_id ?? 0);

if (!$action || !$documentId || !$videoId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'action, document_id y video_id son requeridos']);
    exit();
}

// Session ID para la tabla temporal (determinístico por usuario+doc)
$sessionId = "mentor2_{$userId}_{$documentId}";

$openai = new OpenAIService();
$promptBuilder = new ConversationalPromptBuilder($db);
$mentorPromptBuilder = new MentorPromptBuilder($db, $promptBuilder);
$contextManager = new ContextManager($db);

try {
    if ($action === 'generate') {
        // Obtener datos del video
        $stmtVideo = $db->prepare("SELECT * FROM doc_mentor_videos WHERE id = ? AND document_id = ?");
        $stmtVideo->execute([$videoId, $documentId]);
        $videoData = $stmtVideo->fetch(PDO::FETCH_ASSOC);

        if (!$videoData) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Video no encontrado']);
            exit();
        }

        // Limpiar \r de transcripción que rompe JSON de OpenAI
        if (!empty($videoData['transcripcion'])) {
            $videoData['transcripcion'] = str_replace("\r", "", $videoData['transcripcion']);
        }

        $resultado = VideoRetroalimentacionHelper::iniciarRetroalimentacion(
            $videoData, $userName, $sessionId, $db,
            $mentorPromptBuilder, $openai, $contextManager
        );

        echo json_encode([
            'success' => true,
            'data' => [
                'pregunta_actual' => 1,
                'total_preguntas' => 3,
                'mensaje' => $resultado['response'],
                'video_id' => $videoId
            ]
        ]);

    } else if ($action === 'evaluate') {
        $numeroPregunta = intval($data->numero_pregunta ?? 0);
        $respuesta = trim($data->respuesta ?? '');

        if (!$numeroPregunta || !$respuesta) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'numero_pregunta y respuesta son requeridos']);
            exit();
        }

        $resultado = VideoRetroalimentacionHelper::procesarRespuesta(
            $respuesta, $numeroPregunta, $sessionId, $videoId,
            $userName, $db, $mentorPromptBuilder, $openai, $contextManager
        );

        $quizCompleto = !empty($resultado['retroalimentacion_completa']);

        echo json_encode([
            'success' => true,
            'data' => [
                'pregunta_actual' => $quizCompleto ? 3 : ($resultado['numero_pregunta'] ?? $numeroPregunta),
                'total_preguntas' => 3,
                'mensaje' => $resultado['response'],
                'quiz_completo' => $quizCompleto,
                'video_id' => $videoId
            ]
        ]);

    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'action debe ser "generate" o "evaluate"']);
    }

} catch (Exception $e) {
    error_log("Error en mentor/quiz.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno del servidor']);
}
