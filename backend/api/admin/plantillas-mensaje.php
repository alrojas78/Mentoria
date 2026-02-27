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
        $canal = $_GET['canal'] ?? '';
        $tipo = $_GET['tipo'] ?? '';

        $where = "WHERE 1=1";
        $params = [];

        if ($canal) {
            $where .= " AND canal = ?";
            $params[] = $canal;
        }
        if ($tipo) {
            $where .= " AND tipo = ?";
            $params[] = $tipo;
        }

        $stmt = $db->prepare("
            SELECT * FROM plantillas_mensaje {$where}
            ORDER BY tipo, canal, nombre
        ");
        $stmt->execute($params);
        $plantillas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'plantillas' => $plantillas]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($input['nombre'] ?? '');
        $tipo = $input['tipo'] ?? 'custom';
        $canal = $input['canal'] ?? 'email';
        $asunto = trim($input['asunto'] ?? '');
        $cuerpo = trim($input['cuerpo'] ?? '');
        $variables = $input['variables_disponibles'] ?? null;

        if (!$nombre || !$cuerpo) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre y cuerpo son requeridos']);
            exit;
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO plantillas_mensaje (nombre, tipo, canal, asunto, cuerpo, variables_disponibles)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $nombre, $tipo, $canal,
                $asunto ?: null,
                $cuerpo,
                $variables ? json_encode($variables) : null
            ]);

            echo json_encode([
                'success' => true,
                'message' => 'Plantilla creada',
                'plantilla_id' => $db->lastInsertId()
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando plantilla: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de plantilla requerido']);
            exit;
        }

        $nombre = trim($input['nombre'] ?? '');
        $tipo = $input['tipo'] ?? 'custom';
        $canal = $input['canal'] ?? 'email';
        $asunto = trim($input['asunto'] ?? '');
        $cuerpo = trim($input['cuerpo'] ?? '');
        $variables = $input['variables_disponibles'] ?? null;

        if (!$nombre || !$cuerpo) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre y cuerpo son requeridos']);
            exit;
        }

        $stmt = $db->prepare("
            UPDATE plantillas_mensaje SET nombre = ?, tipo = ?, canal = ?, asunto = ?, cuerpo = ?, variables_disponibles = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $nombre, $tipo, $canal,
            $asunto ?: null,
            $cuerpo,
            $variables ? json_encode($variables) : null,
            $id
        ]);

        echo json_encode(['success' => true, 'message' => 'Plantilla actualizada']);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de plantilla requerido']);
            exit;
        }

        // No permitir eliminar plantillas en uso
        $stmt = $db->prepare("SELECT COUNT(*) FROM reglas_recordatorio WHERE plantilla_id = ?");
        $stmt->execute([$id]);
        if ($stmt->fetchColumn() > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'No se puede eliminar: plantilla en uso por reglas de recordatorio']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM plantillas_mensaje WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Plantilla no encontrada']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Plantilla eliminada']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
