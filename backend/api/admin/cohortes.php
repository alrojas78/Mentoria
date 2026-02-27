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
        if (isset($_GET['id'])) {
            // Obtener una cohorte con estadísticas
            $id = intval($_GET['id']);
            $stmt = $db->prepare("
                SELECT c.*, d.titulo as documento_titulo,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id) as total_matriculas,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'registrado') as registrados,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'activo') as activos,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'completado') as completados
                FROM cohortes c
                LEFT JOIN documentos d ON c.documento_id = d.id
                WHERE c.id = ?
            ");
            $stmt->execute([$id]);
            $cohorte = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$cohorte) {
                http_response_code(404);
                echo json_encode(['error' => 'Cohorte no encontrada']);
                exit;
            }

            echo json_encode(['success' => true, 'cohorte' => $cohorte]);
        } else {
            // Listar todas las cohortes
            $stmt = $db->query("
                SELECT c.*, d.titulo as documento_titulo,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id) as total_matriculas,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado IN ('registrado','activo')) as activos,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'completado') as completados
                FROM cohortes c
                LEFT JOIN documentos d ON c.documento_id = d.id
                ORDER BY c.created_at DESC
            ");
            $cohortes = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'cohortes' => $cohortes]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $nombre = trim($input['nombre'] ?? '');
        $documento_id = intval($input['documento_id'] ?? 0);
        $rol_asignar = trim($input['rol_asignar'] ?? '');
        $descripcion = trim($input['descripcion'] ?? '');
        $fecha_inicio = $input['fecha_inicio'] ?? null;
        $fecha_fin = $input['fecha_fin'] ?? null;
        $estado = $input['estado'] ?? 'planificada';

        if (!$nombre || !$documento_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre y documento_id son requeridos']);
            exit;
        }

        // Verificar que el documento existe
        $stmt = $db->prepare("SELECT id FROM documentos WHERE id = ?");
        $stmt->execute([$documento_id]);
        if (!$stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Documento no encontrado']);
            exit;
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO cohortes (nombre, documento_id, rol_asignar, descripcion, fecha_inicio, fecha_fin, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$nombre, $documento_id, $rol_asignar ?: null, $descripcion, $fecha_inicio, $fecha_fin, $estado]);

            $cohorteId = $db->lastInsertId();

            // Crear reglas de recordatorio por defecto
            $reglasDefault = [
                ['no_registro', 1, 3, 'email'],
                ['no_registro', 2, 5, 'email'],
                ['no_registro', 3, 7, 'email'],
                ['no_registro', 4, 10, 'email'],
                ['no_inicia', 1, 6, 'email'],
                ['no_inicia', 2, 10, 'email'],
                ['no_inicia', 3, 14, 'email'],
                ['no_inicia', 4, 18, 'email'],
                ['no_avanza', 1, 7, 'email'],
                ['no_avanza', 2, 12, 'email'],
                ['no_avanza', 3, 17, 'email'],
                ['no_avanza', 4, 25, 'email'],
            ];

            $stmtRegla = $db->prepare("
                INSERT INTO reglas_recordatorio (cohorte_id, etapa, numero_recordatorio, dias_trigger, canal)
                VALUES (?, ?, ?, ?, ?)
            ");
            foreach ($reglasDefault as $regla) {
                $stmtRegla->execute([$cohorteId, $regla[0], $regla[1], $regla[2], $regla[3]]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Cohorte creada con reglas por defecto',
                'cohorte_id' => $cohorteId
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando cohorte: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de cohorte requerido']);
            exit;
        }

        $nombre = trim($input['nombre'] ?? '');
        $rol_asignar = trim($input['rol_asignar'] ?? '');
        $descripcion = trim($input['descripcion'] ?? '');
        $fecha_inicio = $input['fecha_inicio'] ?? null;
        $fecha_fin = $input['fecha_fin'] ?? null;
        $estado = $input['estado'] ?? 'planificada';

        if (!$nombre) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre es requerido']);
            exit;
        }

        $stmt = $db->prepare("
            UPDATE cohortes SET nombre = ?, rol_asignar = ?, descripcion = ?, fecha_inicio = ?, fecha_fin = ?, estado = ?
            WHERE id = ?
        ");
        $stmt->execute([$nombre, $rol_asignar ?: null, $descripcion, $fecha_inicio, $fecha_fin, $estado, $id]);

        echo json_encode(['success' => true, 'message' => 'Cohorte actualizada']);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de cohorte requerido']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM cohortes WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Cohorte no encontrada']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Cohorte eliminada']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
