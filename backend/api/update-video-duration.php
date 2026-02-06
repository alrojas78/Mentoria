<?php
// update-video-duration.php - Actualizar duración de videos
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include_once '../config/config.php';
include_once '../config/db.php';
include_once '../utils/jwt.php';

$database = new Database();
$db = $database->getConnection();
$jwt = new JWTUtil();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$videoId = $input['video_id'] ?? null;
$duration = $input['duration_seconds'] ?? null;  // ✅ CORRECTO

if (!$videoId || !$duration) {
    http_response_code(400);
    echo json_encode(['error' => 'video_id y duration_seconds son requeridos']);
    exit;
}

try {
    $stmt = $db->prepare("
        UPDATE doc_mentor_videos 
        SET duracion_segundos = ? 
        WHERE id = ?
    ");
    
    if ($stmt->execute([$duration, $videoId])) {
        echo json_encode([
            'success' => true,
            'message' => 'Duración actualizada correctamente',
            'video_id' => $videoId,
            'duration' => $duration
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar duración']);
    }
} catch (Exception $e) {
    error_log("Error actualizando duración: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error interno del servidor']);
}
?>