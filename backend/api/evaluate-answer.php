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
include_once '../utils/EvaluationService.php';

// Instanciar objetos
$jwt = new JWTUtil();
$evaluationService = new EvaluationService();

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
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
if (empty($data->question) || empty($data->expectedAnswer) || empty($data->userAnswer)) {
    http_response_code(400);
    echo json_encode(["message" => "Se requieren todos los campos"]);
    exit();
}

// Evaluar respuesta
$result = $evaluationService->evaluateAnswer(
    $data->question,
    $data->expectedAnswer,
    $data->userAnswer
);

// Responder
if ($result['success']) {
    http_response_code(200);
    echo json_encode($result);
} else {
    error_log("Error en evaluación: " . ($result['message'] ?? 'Error desconocido'));
    http_response_code(500);
    echo json_encode([
        "message" => isset($result['message']) ? $result['message'] : "Error al evaluar respuesta"
    ]);
}
?>