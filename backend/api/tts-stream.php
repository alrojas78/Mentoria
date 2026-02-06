<?php
// ✅ HEADERS ESPECÍFICOS PARA STREAMING
header("Content-Type: audio/mpeg");
header("Cache-Control: no-cache");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("X-Accel-Buffering: no"); // Nginx: desactivar buffering

// Responder a preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ✅ LOGGING DE DEBUG
error_log("🚀 tts-stream.php iniciado - Método: " . $_SERVER['REQUEST_METHOD']);

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../utils/jwt.php';
include_once '../utils/ElevenLabsStreamService.php';

// Verificar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Obtener datos enviados
$input = file_get_contents("php://input");
error_log("📥 Datos recibidos: " . $input);

$data = json_decode($input);

// Verificar datos
if (empty($data->text)) {
    http_response_code(400);
    echo json_encode(["message" => "Se requiere el texto para sintetizar"]);
    exit();
}

// ✅ AUTENTICACIÓN SIMPLIFICADA PARA STREAMING
$jwt = new JWTUtil();
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// ✅ PROCESAR STREAMING
$text = $data->text;
$voiceId = $data->voiceId ?? 'HiFRzF6BxSCjTfbRNfJa'; // Valeria por defecto

error_log("🎯 Iniciando streaming - VoiceID: {$voiceId}, Texto: " . substr($text, 0, 30) . "...");

// ✅ CREAR INSTANCIA Y HACER STREAMING
$streamService = new ElevenLabsStreamService();
$streamService->streamAudio($text, $voiceId);

// ✅ LOG DE FINALIZACIÓN
error_log("✅ Streaming finalizado");
?>