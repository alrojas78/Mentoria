<?php
/**
 * Test de conexión Mentoria → Operatix
 * GET /api/operatix/test-connection.php
 * Requiere auth admin
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../../utils/OperatixBridge.php';

// Solo admin puede testear la conexión
$userData = AuthMiddleware::requireAdmin();

try {
    $bridge = OperatixBridge::getInstance();

    // Test 1: Conexión básica
    $connectionTest = $bridge->testConnection();

    // Test 2: Crear/buscar proyecto de prueba
    $projectTest = null;
    if ($connectionTest['connected']) {
        $projectTest = $bridge->getOrCreateProject('Mentoria Test');
    }

    echo json_encode([
        'success' => true,
        'connection' => $connectionTest,
        'project_test' => $projectTest ? [
            'id' => $projectTest['id'] ?? null,
            'name' => $projectTest['name'] ?? null
        ] : null,
        'config' => [
            'base_url' => OPERATIX_BASE_URL,
            'api_key_configured' => !empty(OPERATIX_API_KEY),
            'service_email' => OPERATIX_SERVICE_EMAIL
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
