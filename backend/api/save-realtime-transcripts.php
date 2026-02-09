<?php
/**
 * save-realtime-transcripts.php
 * Guarda transcripciones de sesiones Realtime en las tablas de analytics existentes.
 * Aplica EstadisticasFilter para clasificar preguntas reales vs filler/comandos.
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit;
}

require_once '../config/config.php';
require_once '../config/db.php';
require_once '../middleware/AuthMiddleware.php';
require_once '../utils/EstadisticasFilter.php';
require_once '../models/SystemConfig.php';

// Autenticación
$userData = AuthMiddleware::requireAuth();
$userId = $userData->id;

// Leer input
$input = json_decode(file_get_contents('php://input'), true);

$documentId = $input['document_id'] ?? null;
$transcripts = $input['transcripts'] ?? [];
$durationSeconds = $input['duration_seconds'] ?? 0;
$mode = $input['mode'] ?? 'consulta';

if (!$documentId || empty($transcripts)) {
    http_response_code(400);
    echo json_encode(["message" => "Se requieren document_id y transcripts"]);
    exit;
}

// Validar modo contra enum de la tabla
$validModes = ['consulta', 'mentor', 'evaluacion'];
if (!in_array($mode, $validModes)) {
    $mode = 'consulta';
}

$database = new Database();
$db = $database->getConnection();

try {
    $db->beginTransaction();

    // 1. Crear sesión en doc_conversacion_sesiones
    $sessionToken = bin2hex(random_bytes(32));
    $duracionMinutos = max(1, round($durationSeconds / 60));

    $stmt = $db->prepare("
        INSERT INTO doc_conversacion_sesiones
        (user_id, document_id, modo, session_token, started_at, ended_at, estado, total_mensajes, duracion_minutos)
        VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? SECOND), NOW(), 'completada', ?, ?)
    ");
    $stmt->execute([
        $userId,
        $documentId,
        $mode,
        $sessionToken,
        $durationSeconds,
        count($transcripts),
        $duracionMinutos
    ]);
    $sessionId = $db->lastInsertId();

    // 2. Iterar transcripts y aplicar filtro
    $savedQuestions = 0;
    $filteredOut = 0;

    $stmtInsert = $db->prepare("
        INSERT INTO doc_conversacion_mensajes
        (session_id, tipo, contenido, modo_activo, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    // Cargar correcciones STT desde system_config (administrables desde el panel)
    $sttCorrections = [];
    $sttConfig = new SystemConfig($db);
    if ($sttConfig->getByKey('stt_corrections')) {
        $sttCorrections = json_decode($sttConfig->config_value, true) ?: [];
    }

    foreach ($transcripts as $index => $transcript) {
        $text = trim($transcript['text'] ?? '');
        if (empty($text)) continue;

        // Corregir términos mal transcritos por STT (case-insensitive, word boundary)
        foreach ($sttCorrections as $corr) {
            $incorrecto = preg_quote($corr['incorrecto'], '/');
            $text = preg_replace('/\b' . $incorrecto . '\b/iu', $corr['correcto'], $text);
        }

        // Calcular timestamp aproximado distribuido en la duración
        $offsetSeconds = ($durationSeconds > 0 && count($transcripts) > 1)
            ? round(($index / (count($transcripts) - 1)) * $durationSeconds)
            : 0;

        $timestamp = date('Y-m-d H:i:s', time() - $durationSeconds + $offsetSeconds);

        // Aplicar filtro de estadísticas
        $esValida = EstadisticasFilter::esPreguntaValidaParaEstadisticas($text);
        $tipo = $esValida ? 'pregunta_usuario' : 'comando';

        $metadata = json_encode([
            'source' => 'realtime',
            'voice_transcription' => true,
            'filtered' => !$esValida
        ]);

        $stmtInsert->execute([
            $sessionId,
            $tipo,
            $text,
            $mode,
            $metadata,
            $timestamp
        ]);

        if ($esValida) {
            $savedQuestions++;
        } else {
            $filteredOut++;
        }
    }

    $db->commit();

    echo json_encode([
        'success' => true,
        'session_id' => $sessionId,
        'saved_questions' => $savedQuestions,
        'total_transcripts' => count($transcripts),
        'filtered_out' => $filteredOut
    ]);

} catch (Exception $e) {
    $db->rollBack();
    error_log("Error guardando transcripciones realtime: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error guardando transcripciones',
        'error' => $e->getMessage()
    ]);
}
