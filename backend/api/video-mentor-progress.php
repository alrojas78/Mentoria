<?php
// backend/api/video-mentor-progress.php

// ✅ PASO 1: Cargar dependencias y variables de entorno.
require_once '../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable('../');
$dotenv->load(); // Carga las variables del .env a $_ENV

// ✅ PASO 2: Incluir los archivos de configuración y utilidades en el orden correcto.
// config.php es CRÍTICO aquí, ya que probablemente define la constante JWT_SECRET.
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../utils/jwt.php';

// --- Cabeceras y manejo de método ---
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
    exit();
}

// ✅ PASO 3: Instanciar los objetos DESPUÉS de que todo esté incluido y configurado.
$database = new Database();
$db = $database->getConnection();
$jwt = new JWTUtil(); // Ahora el constructor de JWTUtil encontrará la constante JWT_SECRET

// --- Autenticación ---
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';
$userData = $jwt->validate($token);

if (!$userData) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "No autorizado"]);
    exit();
}

// --- Obtener y validar datos ---
$data = json_decode(file_get_contents("php://input"));

if (!isset($data->video_id) || !isset($data->document_id) || !isset($data->timestamp_actual)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Faltan datos requeridos (video_id, document_id, timestamp_actual)."]);
    exit();
}

$userId = $userData->id; // El ID de usuario viene del token, es más seguro.
$videoId = filter_var($data->video_id, FILTER_SANITIZE_NUMBER_INT);
$documentId = filter_var($data->document_id, FILTER_SANITIZE_NUMBER_INT);
$timestampActual = filter_var($data->timestamp_actual, FILTER_SANITIZE_NUMBER_INT);
$completado = isset($data->completado) ? filter_var($data->completado, FILTER_SANITIZE_NUMBER_INT) : 0;

try {
    // --- Lógica de Base de Datos con INSERT ... ON DUPLICATE KEY UPDATE ---
    // Este método es atómico: crea la fila si no existe, o la actualiza si ya existe.
    // Es la forma correcta y más eficiente de manejar el progreso.
    
// Obtener timestamp_maximo del request o usar timestamp_actual como fallback
$timestampMaximo = isset($data->timestamp_maximo) 
    ? filter_var($data->timestamp_maximo, FILTER_SANITIZE_NUMBER_INT) 
    : $timestampActual;

$query = "
    INSERT INTO doc_mentor_video_progreso 
        (user_id, video_id, document_id, timestamp_actual, timestamp_maximo, completado, fecha_inicio, ultima_actualizacion)
    VALUES 
        (:user_id, :video_id, :document_id, :timestamp_actual, :timestamp_maximo, :completado, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
        timestamp_actual = VALUES(timestamp_actual),
        timestamp_maximo = GREATEST(timestamp_maximo, VALUES(timestamp_maximo)),
        completado = GREATEST(completado, VALUES(completado)),
        ultima_actualizacion = NOW()
";

$stmt = $db->prepare($query);

$stmt->bindParam(':user_id', $userId);
$stmt->bindParam(':video_id', $videoId);
$stmt->bindParam(':document_id', $documentId);
$stmt->bindParam(':timestamp_actual', $timestampActual);
$stmt->bindParam(':timestamp_maximo', $timestampMaximo); // 🔥 AHORA LO USA
$stmt->bindParam(':completado', $completado);

    if ($stmt->execute()) {
        http_response_code(200);
        echo json_encode([
            "success" => true, 
            "message" => "Progreso guardado.",
            "data" => ["user_id" => $userId, "video_id" => $videoId, "timestamp" => $timestampActual]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al ejecutar la consulta en la base de datos."]);
    }

} catch (Exception $e) {
    http_response_code(500);
    error_log("Error en video-mentor-progress.php: " . $e->getMessage());
    echo json_encode(["success" => false, "message" => "Error interno del servidor: " . $e->getMessage()]);
}
?>