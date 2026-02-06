<?php
/**
 * Whisper API Endpoint
 * Transcribe audio usando OpenAI Whisper API
 * Optimizado para iOS Safari con MediaRecorder
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-session-token');

// Manejar preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Cargar configuración
require_once '../config/config.php';

// Solo permitir POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Método no permitido. Use POST.'
    ]);
    exit;
}

try {
    // Obtener datos del request
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validar que venga el audio
    if (!isset($input['audio']) || empty($input['audio'])) {
        throw new Exception('Audio no proporcionado');
    }
    
    // Obtener user_id (opcional, para logging)
    $userId = $input['user_id'] ?? 'anonymous';
    
    // Log del intento
    error_log("Whisper API - Usuario: $userId - Iniciando transcripción");
    
    // Decodificar audio base64
    $audioData = base64_decode($input['audio']);
    
    if ($audioData === false) {
        throw new Exception('Error al decodificar audio base64');
    }
    
    // Log del tamaño
    $audioSize = strlen($audioData);
    error_log("Whisper API - Tamaño audio: " . number_format($audioSize / 1024, 2) . " KB");
    
    // Crear archivo temporal
    $tmpDir = sys_get_temp_dir();
    $tmpFile = $tmpDir . '/whisper_' . $userId . '_' . time() . '.webm';
    
    $bytesWritten = file_put_contents($tmpFile, $audioData);
    
    if ($bytesWritten === false) {
        throw new Exception('Error al crear archivo temporal');
    }
    
    error_log("Whisper API - Archivo temporal creado: $tmpFile");
    
    // Preparar llamada a OpenAI Whisper API
    $ch = curl_init();
    
    $postFields = [
        'file' => new CURLFile($tmpFile, 'audio/webm', 'audio.webm'),
        'model' => 'whisper-1',
        'language' => 'es',
        'response_format' => 'json'
    ];
    
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://api.openai.com/v1/audio/transcriptions",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . OPENAI_API_KEY
        ],
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_TIMEOUT => 30
    ]);
    
    // Ejecutar request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    curl_close($ch);
    
    // Limpiar archivo temporal
    if (file_exists($tmpFile)) {
        unlink($tmpFile);
        error_log("Whisper API - Archivo temporal eliminado");
    }
    
    // Verificar respuesta de OpenAI
    if ($curlError) {
        throw new Exception("Error CURL: $curlError");
    }
    
    if ($httpCode !== 200) {
        error_log("Whisper API - Error HTTP $httpCode: $response");
        throw new Exception("Error de Whisper API (HTTP $httpCode): $response");
    }
    
    // Decodificar respuesta
    $result = json_decode($response, true);
    
    if (!isset($result['text'])) {
        throw new Exception("Respuesta inválida de Whisper API");
    }
    
   $transcription = $result['text'];

    // ==========================================
    // 🛠️ INICIO: CORRECCIÓN DE "VOZAMA"
    // ==========================================
    
    // Lista de confusiones comunes fonéticas
    $confusiones = [
        'Osama', 'osama',
        'Bosama', 'bosama', 
        'Bossama', 'bossama',
        'Bozama', 'bozama',
        'Voz ama', 'voz ama',
        'Vos ama', 'vos ama',
        'Hosama', 'hosama'
    ];
    
    // Reemplazar todas las variantes por "Vozama"
    // str_ireplace es insensible a mayúsculas/minúsculas
    $transcription = str_ireplace($confusiones, 'Vozama', $transcription);
    
    // Corrección extra: Si la frase termina en punto (ej: "Vozama.") asegurar formato
    // Esto es opcional, pero ayuda a la limpieza.
    
    // ==========================================
    // 🏁 FIN: CORRECCIÓN DE "VOZAMA"
    // ==========================================
    
   
    // Log de éxito
    error_log("Whisper API - Transcripción exitosa: $transcription");
    
    // Respuesta exitosa
    echo json_encode([
        'success' => true,
        'text' => $transcription,
        'language' => $result['language'] ?? 'es',
        'duration' => $result['duration'] ?? null
    ]);
    
} catch (Exception $e) {
    // Log del error
    error_log("Whisper API - ERROR: " . $e->getMessage());
    
    // Respuesta de error
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>