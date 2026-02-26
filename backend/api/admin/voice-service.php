<?php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../models/SystemConfig.php';
include_once '../../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$systemConfig = new SystemConfig($db);
$jwt = new JWTUtil();

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData || $userData->role !== 'admin') {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Procesar según el método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Obtener configuración actual
        if ($systemConfig->getByKey('voice_service')) {
            $voiceConfig = json_decode($systemConfig->config_value, true);
            http_response_code(200);
            echo json_encode($voiceConfig);
        } else {
            // Si no existe, crear configuración por defecto con voice_mode
            $defaultConfig = [
                'service' => 'polly',
                'voice_id' => 'Lupe',
                'voice_mode' => 'realtime',
                'realtime_voice' => 'sage',
                'realtime_model' => 'gpt-4o-realtime-preview-2024-12-17'
            ];

            $systemConfig->config_key = 'voice_service';
            $systemConfig->config_value = json_encode($defaultConfig);

            if ($systemConfig->save()) {
                http_response_code(200);
                echo json_encode($defaultConfig);
            } else {
                http_response_code(500);
                echo json_encode(["message" => "Error al crear configuración por defecto"]);
            }
        }
        break;

    case 'POST':
        // Actualizar configuración
        $data = json_decode(file_get_contents("php://input"), true);

        if (!$data || !isset($data['service']) || !isset($data['voice_id'])) {
            http_response_code(400);
            echo json_encode(["message" => "Datos incompletos"]);
            exit();
        }

        // Validar servicio TTS (para modo texto)
        if (!in_array($data['service'], ['polly', 'elevenlabs'])) {
            http_response_code(400);
            echo json_encode(["message" => "Servicio TTS no válido"]);
            exit();
        }

        // Validar voice_mode si se envía
        $validModes = ['realtime', 'polly', 'elevenlabs'];
        if (isset($data['voice_mode']) && !in_array($data['voice_mode'], $validModes)) {
            http_response_code(400);
            echo json_encode(["message" => "Modo de voz no válido"]);
            exit();
        }

        // Validar voz realtime si se envía
        $validRealtimeVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];
        if (isset($data['realtime_voice']) && !in_array($data['realtime_voice'], $validRealtimeVoices)) {
            http_response_code(400);
            echo json_encode(["message" => "Voz realtime no válida"]);
            exit();
        }

        // Guardar configuración completa
        $systemConfig->config_key = 'voice_service';
        $systemConfig->config_value = json_encode($data);

        if ($systemConfig->save()) {
            http_response_code(200);
            echo json_encode([
                "message" => "Configuración actualizada con éxito",
                "config" => $data
            ]);
        } else {
            http_response_code(500);
            echo json_encode(["message" => "Error al actualizar configuración"]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Método no permitido"]);
        break;
}
?>
