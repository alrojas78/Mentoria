<?php
/**
 * Desconectar WhatsApp de un proyecto
 * POST /api/operatix/disconnect-whatsapp.php
 * Body: { proyecto_id }
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../middleware/AuthMiddleware.php';
require_once __DIR__ . '/../../utils/OperatixBridge.php';

$userData = AuthMiddleware::requireAdmin();

$input = json_decode(file_get_contents('php://input'), true);
$proyectoId = (int)($input['proyecto_id'] ?? 0);

if (!$proyectoId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'proyecto_id requerido']);
    exit;
}

try {
    $db = Database::getConnection();
    $stmt = $db->prepare("SELECT id, config_json FROM proyectos WHERE id = ? AND activo = 1");
    $stmt->execute([$proyectoId]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Proyecto no encontrado']);
        exit;
    }

    $config = $proyecto['config_json'] ? json_decode($proyecto['config_json'], true) : [];

    // Intentar desconectar en Operatix (best effort)
    if (!empty($config['operatix_project_id'])) {
        try {
            $bridge = OperatixBridge::getInstance();
            $bridge->disconnectWhatsApp();
        } catch (Exception $e) {
            error_log('disconnect-whatsapp: Error en Operatix (no critico): ' . $e->getMessage());
        }
    }

    // Limpiar datos de WhatsApp en config_json
    $config['whatsapp_connected'] = false;
    $config['whatsapp_number'] = null;
    $config['whatsapp_display_name'] = null;
    $config['whatsapp_business_name'] = null;
    $config['whatsapp_token_id'] = null;
    $config['whatsapp_connected_at'] = null;
    // Mantener operatix_project_id para reutilizar

    $stmt = $db->prepare("UPDATE proyectos SET config_json = ? WHERE id = ?");
    $stmt->execute([json_encode($config, JSON_UNESCAPED_UNICODE), $proyectoId]);

    echo json_encode([
        'success' => true,
        'message' => 'WhatsApp desconectado'
    ]);

} catch (Exception $e) {
    error_log('disconnect-whatsapp.php Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
