<?php
/**
 * Estado de conexión WhatsApp de un proyecto
 * GET /api/operatix/whatsapp-status.php?proyecto_id=X
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAdmin();

$proyectoId = (int)($_GET['proyecto_id'] ?? 0);
if (!$proyectoId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'proyecto_id requerido']);
    exit;
}

try {
    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT config_json FROM proyectos WHERE id = ? AND activo = 1");
    $stmt->execute([$proyectoId]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Proyecto no encontrado']);
        exit;
    }

    $config = $proyecto['config_json'] ? json_decode($proyecto['config_json'], true) : [];

    echo json_encode([
        'success' => true,
        'whatsapp' => [
            'connected' => !empty($config['whatsapp_connected']),
            'phone_number' => $config['whatsapp_number'] ?? null,
            'display_name' => $config['whatsapp_display_name'] ?? null,
            'business_name' => $config['whatsapp_business_name'] ?? null,
            'connected_at' => $config['whatsapp_connected_at'] ?? null
        ],
        'operatix_project_id' => $config['operatix_project_id'] ?? null
    ]);

} catch (Exception $e) {
    error_log('whatsapp-status.php Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
