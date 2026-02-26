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
        // Listar todos los grupos con conteo de usuarios y documentos
        $stmt = $db->query("
            SELECT cg.id, cg.name, cg.description, cg.created_at,
                   (SELECT COUNT(*) FROM users WHERE role = cg.name) as user_count,
                   (SELECT COUNT(DISTINCT dr.documento_id) FROM documento_roles dr WHERE dr.role = cg.name) as document_count
            FROM content_groups cg
            ORDER BY cg.name ASC
        ");
        $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'groups' => $groups,
            'system_roles' => ['admin', 'mentor', 'coordinador']
        ]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $name = trim($input['name'] ?? '');
        $description = trim($input['description'] ?? '');

        if (!$name) {
            http_response_code(400);
            echo json_encode(['error' => 'El nombre del grupo es requerido']);
            exit;
        }

        // Validar que no sea un rol del sistema
        $systemRoles = ['admin', 'mentor', 'coordinador'];
        if (in_array(strtolower($name), $systemRoles)) {
            http_response_code(400);
            echo json_encode(['error' => 'No se puede crear un grupo con nombre de rol del sistema']);
            exit;
        }

        // Normalizar nombre (minúsculas, sin espacios extra)
        $name = strtolower(preg_replace('/\s+/', '_', $name));

        try {
            $stmt = $db->prepare("INSERT INTO content_groups (name, description) VALUES (?, ?)");
            $stmt->execute([$name, $description]);
            echo json_encode([
                'success' => true,
                'message' => 'Grupo creado exitosamente',
                'group' => [
                    'id' => $db->lastInsertId(),
                    'name' => $name,
                    'description' => $description
                ]
            ]);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate') !== false) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya existe un grupo con ese nombre']);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Error creando grupo: ' . $e->getMessage()]);
            }
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        $description = trim($input['description'] ?? '');

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de grupo requerido']);
            exit;
        }

        $stmt = $db->prepare("UPDATE content_groups SET description = ? WHERE id = ?");
        $stmt->execute([$description, $id]);

        echo json_encode(['success' => true, 'message' => 'Grupo actualizado']);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de grupo requerido']);
            exit;
        }

        // Obtener nombre del grupo
        $stmt = $db->prepare("SELECT name FROM content_groups WHERE id = ?");
        $stmt->execute([$id]);
        $group = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$group) {
            http_response_code(404);
            echo json_encode(['error' => 'Grupo no encontrado']);
            exit;
        }

        // No permitir eliminar si tiene usuarios
        $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM users WHERE role = ?");
        $stmt->execute([$group['name']]);
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['cnt'];

        if ($count > 0) {
            http_response_code(400);
            echo json_encode(['error' => "No se puede eliminar: hay {$count} usuario(s) en este grupo. Reasígnelos primero."]);
            exit;
        }

        // Eliminar referencias en documento_roles
        $stmt = $db->prepare("DELETE FROM documento_roles WHERE role = ?");
        $stmt->execute([$group['name']]);

        // Eliminar grupo
        $stmt = $db->prepare("DELETE FROM content_groups WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Grupo eliminado']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
