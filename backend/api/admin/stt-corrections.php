<?php
/**
 * stt-corrections.php
 * CRUD para correcciones de transcripción STT (Speech-to-Text).
 * Almacena en system_config key='stt_corrections' un JSON array de {incorrecto, correcto}.
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/config.php';
require_once '../../config/db.php';
require_once '../../middleware/AuthMiddleware.php';
require_once '../../models/SystemConfig.php';

// Solo admin
$userData = AuthMiddleware::requireAdmin();

$database = new Database();
$db = $database->getConnection();
$systemConfig = new SystemConfig($db);

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        $corrections = [];
        if ($systemConfig->getByKey('stt_corrections')) {
            $corrections = json_decode($systemConfig->config_value, true) ?: [];
        }
        echo json_encode(['success' => true, 'corrections' => $corrections]);
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $corrections = $data['corrections'] ?? null;

        if (!is_array($corrections)) {
            http_response_code(400);
            echo json_encode(['message' => 'Se requiere un array de corrections']);
            exit;
        }

        // Validar estructura
        $clean = [];
        foreach ($corrections as $c) {
            $inc = trim($c['incorrecto'] ?? '');
            $cor = trim($c['correcto'] ?? '');
            if ($inc !== '' && $cor !== '') {
                $clean[] = ['incorrecto' => $inc, 'correcto' => $cor];
            }
        }

        $systemConfig->config_key = 'stt_corrections';
        $systemConfig->config_value = json_encode($clean);

        if ($systemConfig->save()) {
            echo json_encode([
                'success' => true,
                'message' => 'Correcciones guardadas',
                'total' => count($clean)
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Error al guardar']);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['message' => 'Método no permitido']);
}
