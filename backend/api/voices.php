<?php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../config/config.php';

// Para depuración
error_log("Ejecutando voices.php. Método: " . $_SERVER['REQUEST_METHOD'] . ", Servicio solicitado: " . ($_GET['service'] ?? 'ninguno'));

// Verificar método
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Obtener servicio solicitado
$service = isset($_GET['service']) ? $_GET['service'] : 'polly';

// Obtener las voces disponibles según el servicio
if ($service === 'elevenlabs') {
    // Para ElevenLabs, definimos voces estáticas
    $result = [
        'success' => true,
        'voices' => [
            // Voces en inglés
            ['voice_id' => 'EXAVITQu4vr4xnSDxMaL', 'name' => 'Jina', 'language' => 'en-US'],
            ['voice_id' => '21m00Tcm4TlvDq8ikWAM', 'name' => 'Rachel', 'language' => 'en-US'],
            ['voice_id' => 'AZnzlk1XvdvUeBnXmlld', 'name' => 'Nicole', 'language' => 'en-US'],
            ['voice_id' => 'MF3mGyEYCl7XYWbV9V6O', 'name' => 'Elli', 'language' => 'en-US'],
            ['voice_id' => 'TxGEqnHWrfWFTfGW9XjX', 'name' => 'Jaime', 'language' => 'es-LATAM'],
            ['voice_id' => 'VR6AewLTigWG4xSOukaG', 'name' => 'Arnold One', 'language' => 'en-US'],
            ['voice_id' => 'pNInz6obpgDQGcFmaJgB', 'name' => 'Adam', 'language' => 'en-US'],
            
            // Voces en español latino
              ['voice_id' => '29vD33N1CtxCmqQRPOHJ', 'name' => 'Josh', 'language' => 'en-US'],
             ['voice_id' => 'jBpfuIE2acCO8z3wKNLl', 'name' => 'Isabella', 'language' => 'en-US'],
            ['voice_id' => 'IKne3meq5aSn9XLyUdCD', 'name' => 'Javier', 'language' => 'es-LATAM'],
            ['voice_id' => 'XB0fDUnXU5powFXDhCwa', 'name' => 'Valeria', 'language' => 'es-MX'],
            ['voice_id' => 'N2lVS1w4EtoT3dr4eOWO', 'name' => 'Arnold', 'language' => 'en-US'],
            ['voice_id' => 'JEzse6GMhKZ6wrVNFZTq', 'name' => 'Rosa Estela', 'language' => 'es-MX'],
            ['voice_id' => 'gbTn1bmCvNgk0QEAVyfM', 'name' => 'Enrique M. Nieto', 'language' => 'es-MX']
        ]
    ];
} else {
    // Para Polly, definimos voces estáticas
    $result = [
        'success' => true,
        'voices' => [
            ['name' => 'Lupe', 'language' => 'es-MX', 'gender' => 'Female'],
            ['name' => 'Miguel', 'language' => 'es-US', 'gender' => 'Male'],
            ['name' => 'Penélope', 'language' => 'es-ES', 'gender' => 'Female'],
            ['name' => 'Mia', 'language' => 'es-MX', 'gender' => 'Female'],
            ['name' => 'Joanna', 'language' => 'en-US', 'gender' => 'Female'],
            ['name' => 'Matthew', 'language' => 'en-US', 'gender' => 'Male']
        ]
    ];
}

// Para depuración
error_log("Respuesta a enviar: " . json_encode(['service' => $service, 'voices' => $result['voices']]));

// Responder
http_response_code(200);
echo json_encode([
    'service' => $service,
    'voices' => $result['voices']
]);
?>