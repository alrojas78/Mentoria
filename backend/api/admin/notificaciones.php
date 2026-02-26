<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/config.php';
require_once '../../config/db.php';
require_once '../../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAdmin();

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Listar todas las notificaciones con conteo de leídas
        $stmt = $db->query("
            SELECT n.*,
                   (SELECT COUNT(*) FROM notificaciones_leidas nl WHERE nl.notificacion_id = n.id) as leidas_count
            FROM notificaciones n
            ORDER BY n.created_at DESC
        ");
        $notificaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'notificaciones' => $notificaciones
        ]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $titulo = trim($input['titulo'] ?? '');
        $mensaje = trim($input['mensaje'] ?? '');
        $tipo = $input['tipo'] ?? 'info';
        $rol_destino = $input['rol_destino'] ?? null;

        if (!$titulo || !$mensaje) {
            http_response_code(400);
            echo json_encode(['error' => 'Título y mensaje son requeridos']);
            exit;
        }

        if (!in_array($tipo, ['info', 'warning', 'success'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Tipo inválido. Use: info, warning, success']);
            exit;
        }

        // rol_destino vacío = NULL (todos)
        if ($rol_destino === '' || $rol_destino === 'todos') {
            $rol_destino = null;
        }

        try {
            $stmt = $db->prepare("INSERT INTO notificaciones (titulo, mensaje, tipo, rol_destino) VALUES (?, ?, ?, ?)");
            $stmt->execute([$titulo, $mensaje, $tipo, $rol_destino]);
            echo json_encode([
                'success' => true,
                'message' => 'Notificación creada exitosamente',
                'notificacion' => [
                    'id' => $db->lastInsertId(),
                    'titulo' => $titulo,
                    'mensaje' => $mensaje,
                    'tipo' => $tipo,
                    'rol_destino' => $rol_destino
                ]
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando notificación: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de notificación requerido']);
            exit;
        }

        // Toggle activa/inactiva
        if (isset($input['activa']) && count($input) === 2) {
            $activa = intval($input['activa']);
            $stmt = $db->prepare("UPDATE notificaciones SET activa = ? WHERE id = ?");
            $stmt->execute([$activa, $id]);
            echo json_encode(['success' => true, 'message' => $activa ? 'Notificación activada' : 'Notificación desactivada']);
            break;
        }

        // Actualización completa
        $titulo = trim($input['titulo'] ?? '');
        $mensaje = trim($input['mensaje'] ?? '');
        $tipo = $input['tipo'] ?? 'info';
        $rol_destino = $input['rol_destino'] ?? null;

        if (!$titulo || !$mensaje) {
            http_response_code(400);
            echo json_encode(['error' => 'Título y mensaje son requeridos']);
            exit;
        }

        if ($rol_destino === '' || $rol_destino === 'todos') {
            $rol_destino = null;
        }

        $stmt = $db->prepare("UPDATE notificaciones SET titulo = ?, mensaje = ?, tipo = ?, rol_destino = ? WHERE id = ?");
        $stmt->execute([$titulo, $mensaje, $tipo, $rol_destino, $id]);

        echo json_encode(['success' => true, 'message' => 'Notificación actualizada']);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de notificación requerido']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM notificaciones WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Notificación no encontrada']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Notificación eliminada']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
