<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config/config.php';
require_once '../config/db.php';
require_once '../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAuth();

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Obtener notificaciones activas pendientes para el usuario
        $userId = $userData->id;
        $userRole = $userData->role;

        $stmt = $db->prepare("
            SELECT n.id, n.titulo, n.mensaje, n.tipo, n.created_at
            FROM notificaciones n
            WHERE n.activa = 1
              AND (n.rol_destino IS NULL OR n.rol_destino = ?)
              AND n.id NOT IN (
                  SELECT nl.notificacion_id FROM notificaciones_leidas nl WHERE nl.user_id = ?
              )
            ORDER BY n.created_at DESC
        ");
        $stmt->execute([$userRole, $userId]);
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'notificaciones' => $notificaciones
        ]);
        break;

    case 'POST':
        // Marcar notificación como leída
        $input = json_decode(file_get_contents('php://input'), true);
        $notificacionId = intval($input['notificacion_id'] ?? 0);

        if (!$notificacionId) {
            http_response_code(400);
            echo json_encode(['error' => 'notificacion_id es requerido']);
            exit;
        }

        $userId = $userData->id;

        try {
            $stmt = $db->prepare("INSERT IGNORE INTO notificaciones_leidas (notificacion_id, user_id) VALUES (?, ?)");
            $stmt->execute([$notificacionId, $userId]);
            echo json_encode(['success' => true, 'message' => 'Notificación marcada como leída']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error marcando notificación: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
