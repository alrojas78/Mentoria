<?php
/**
 * Conectar WhatsApp Business a un proyecto de Mentoria
 * POST /api/operatix/connect-whatsapp.php
 * Body: { proyecto_id, code }
 *
 * Flujo:
 * 1. Recibe el authorization code del Meta Embedded Signup (del frontend)
 * 2. Busca/crea proyecto en Operatix via Bridge
 * 3. Envía el code a Operatix embedded-callback con project_id
 * 4. Operatix procesa OAuth completo (token, WABA, webhooks)
 * 5. Guarda referencia en proyectos.config_json de Mentoria
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$proyectoId = (int)($input['proyecto_id'] ?? 0);
$code = $input['code'] ?? null;

if (!$proyectoId || !$code) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'proyecto_id y code son requeridos']);
    exit;
}

try {
    $db = Database::getConnection();

    // 1. Obtener proyecto de Mentoria
    $stmt = $db->prepare("SELECT id, nombre, slug, config_json FROM proyectos WHERE id = ? AND activo = 1");
    $stmt->execute([$proyectoId]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Proyecto no encontrado']);
        exit;
    }

    $configJson = $proyecto['config_json'] ? json_decode($proyecto['config_json'], true) : [];
    $bridge = OperatixBridge::getInstance();

    // 2. Buscar/crear proyecto en Operatix
    $operatixProjectId = $configJson['operatix_project_id'] ?? null;

    if (!$operatixProjectId) {
        $opProject = $bridge->getOrCreateProject(
            "Mentoria: {$proyecto['nombre']}",
            "Proyecto vinculado desde Mentoria (ID: {$proyecto['id']}, slug: {$proyecto['slug']})"
        );

        if (!$opProject || !isset($opProject['id'])) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error creando proyecto en Operatix']);
            exit;
        }

        $operatixProjectId = (int)$opProject['id'];
    }

    // 3. Enviar code a Operatix para procesar OAuth
    $result = $bridge->connectWhatsApp($code, $operatixProjectId);

    if (!$result || empty($result['success'])) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $result['error'] ?? 'Error conectando WhatsApp en Operatix'
        ]);
        exit;
    }

    // 4. Guardar referencia en config_json del proyecto de Mentoria
    $configJson['operatix_project_id'] = $operatixProjectId;
    $configJson['whatsapp_connected'] = true;
    $configJson['whatsapp_number'] = $result['whatsapp']['phone'] ?? null;
    $configJson['whatsapp_display_name'] = $result['whatsapp']['display_name'] ?? null;
    $configJson['whatsapp_business_name'] = $result['business_name'] ?? null;
    $configJson['whatsapp_token_id'] = $result['token_id'] ?? null;
    $configJson['whatsapp_connected_at'] = date('Y-m-d H:i:s');

    $stmt = $db->prepare("UPDATE proyectos SET config_json = ? WHERE id = ?");
    $stmt->execute([json_encode($configJson, JSON_UNESCAPED_UNICODE), $proyectoId]);

    // 5. Configurar webhook forward en Operatix para recibir respuestas
    try {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'mentoria.ateneo.co';
        $forwardUrl = "{$protocol}://{$host}/backend/api/webhook/wa-respuesta.php";

        $bridge->updateProjectSettings($operatixProjectId, [
            'webhook_forward_url' => $forwardUrl
        ]);
    } catch (Exception $whErr) {
        error_log('connect-whatsapp: Error configurando webhook forward: ' . $whErr->getMessage());
    }

    echo json_encode([
        'success' => true,
        'message' => 'WhatsApp conectado exitosamente',
        'whatsapp' => [
            'connected' => true,
            'phone_number' => $configJson['whatsapp_number'],
            'display_name' => $configJson['whatsapp_display_name'],
            'business_name' => $configJson['whatsapp_business_name']
        ]
    ]);

} catch (Exception $e) {
    error_log('connect-whatsapp.php Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error interno: ' . $e->getMessage()]);
}
