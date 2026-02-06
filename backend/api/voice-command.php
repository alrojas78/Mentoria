<?php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../utils/jwt.php';
include_once '../utils/OpenAIService.php';

// Instanciar objetos
$jwt = new JWTUtil();
$openai = new OpenAIService();

// Para modo de desarrollo, podemos omitir la verificación del token
$skipAuth = false; // Cambiar a true si necesitas omitir autenticación durante desarrollo

// Verificar autenticación
if (!$skipAuth) {
    $headers = getallheaders();
    $token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

    $userData = $jwt->validate($token);
    if (!$userData) {
        http_response_code(401);
        echo json_encode(["message" => "No autorizado"]);
        exit();
    }
}

// Verificar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Obtener datos enviados
$data = json_decode(file_get_contents("php://input"));

// Verificar datos
if (empty($data->command)) {
    http_response_code(400);
    echo json_encode(["message" => "Se requiere el comando a interpretar"]);
    exit();
}

// Preparar contexto
$context = isset($data->context) ? $data->context : [];

// Interpretar comando
$result = $openai->interpretCommand($data->command, $context);

// Responder
if (isset($result['success']) && $result['success']) {
    http_response_code(200);
    echo json_encode($result);
} else {
    error_log("Error en voice-command: " . ($result['message'] ?? 'Error desconocido'));
    http_response_code(500);
    echo json_encode([
        "message" => isset($result['message']) ? $result['message'] : "Error al interpretar comando", 
        "details" => isset($result['raw_response']) ? $result['raw_response'] : null
    ]);
}
?>