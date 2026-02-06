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
include_once '../config/db.php';
include_once '../utils/jwt.php';
include_once '../utils/PollyService.php';
include_once '../utils/ElevenLabsService.php';
include_once '../models/SystemConfig.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$jwt = new JWTUtil();
$polly = new PollyService();
$elevenlabs = new ElevenLabsService();
$systemConfig = new SystemConfig($db);

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
if (empty($data->text)) {
    http_response_code(400);
    echo json_encode(["message" => "Se requiere el texto para sintetizar"]);
    exit();
}

// 🆕 CAPTURAR sessionToken (nuevo parámetro)
$sessionToken = isset($data->sessionToken) ? $data->sessionToken : null;

if ($sessionToken) {
    error_log("🔑 TTS - SessionToken recibido: " . substr($sessionToken, 0, 8) . "...");
} else {
    error_log("⚠️ TTS - No se recibió sessionToken, usando carpeta global");
}

// Obtener configuración del sistema
$voiceConfig = null;
if ($systemConfig->getByKey('voice_service')) {
    $voiceConfig = json_decode($systemConfig->config_value, true);
} else {
    // Configuración por defecto si no existe
    $voiceConfig = [
        'service' => 'polly',
        'voice_id' => 'Lupe'
    ];
}

// Determinar qué servicio usar (config del admin o el que viene en la petición)
$service = $data->forceService ?? $voiceConfig['service'];
$voiceId = $data->voiceId ?? $voiceConfig['voice_id'];

error_log("🎙️ TTS - Servicio: $service, Voz: $voiceId");

// 🆕 Sintetizar voz con el servicio correspondiente (AHORA CON sessionToken)
if ($service === 'elevenlabs') {
    $result = $elevenlabs->synthesizeSpeech($data->text, $voiceId, $sessionToken);
} else {
    $result = $polly->synthesizeSpeech($data->text, $voiceId, $sessionToken);
}

// Responder
if ($result['success']) {
    error_log("✅ TTS - Audio generado exitosamente: " . ($result['file'] ?? 'sin nombre'));
    error_log("📁 TTS - URL del audio: " . ($result['url'] ?? 'sin URL'));
    error_log("📦 TTS - Desde caché: " . ($result['cached'] ? 'SÍ' : 'NO'));
    
    http_response_code(200);
    echo json_encode($result);
} else {
    error_log("❌ TTS - Error con servicio {$service}: " . $result['message']);
    
    // Si falla el servicio primario, intentar con el secundario
    if ($service === 'elevenlabs') {
        error_log("🔄 TTS - Intentando fallback con Polly");
        $result = $polly->synthesizeSpeech($data->text, 'Lupe', $sessionToken); // 🆕 Pasar sessionToken
    } else if ($service === 'polly') {
        error_log("🔄 TTS - Intentando fallback con ElevenLabs");
        $result = $elevenlabs->synthesizeSpeech($data->text, 'EXAVITQu4vr4xnSDxMaL', $sessionToken); // 🆕 Pasar sessionToken
    }
    
    if ($result['success']) {
        $result['fallback'] = true; // Indicar que se usó el servicio de respaldo
        error_log("✅ TTS - Fallback exitoso");
        http_response_code(200);
        echo json_encode($result);
    } else {
        error_log("❌ TTS - Todos los servicios fallaron");
        http_response_code(500);
        echo json_encode(["message" => "Todos los servicios de síntesis de voz fallaron"]);
    }
}
?>
