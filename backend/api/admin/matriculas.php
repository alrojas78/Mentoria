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
        $cohorte_id = intval($_GET['cohorte_id'] ?? 0);
        $estado = $_GET['estado'] ?? '';
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(10, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $where = "WHERE 1=1";
        $params = [];

        if ($cohorte_id) {
            $where .= " AND m.cohorte_id = ?";
            $params[] = $cohorte_id;
        }
        if ($estado) {
            $where .= " AND m.estado = ?";
            $params[] = $estado;
        }

        $countStmt = $db->prepare("SELECT COUNT(*) FROM matriculas m {$where}");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        $stmt = $db->prepare("
            SELECT m.*, c.nombre as contacto_nombre, c.email as contacto_email,
                   c.telefono as contacto_telefono, c.whatsapp as contacto_whatsapp,
                   co.nombre as cohorte_nombre, d.titulo as documento_titulo,
                   u.nombre as usuario_nombre,
                   (SELECT COUNT(*) FROM seguimiento_log sl WHERE sl.matricula_id = m.id) as total_eventos
            FROM matriculas m
            INNER JOIN contactos c ON m.contacto_id = c.id
            INNER JOIN cohortes co ON m.cohorte_id = co.id
            LEFT JOIN documentos d ON co.documento_id = d.id
            LEFT JOIN users u ON m.user_id = u.id
            {$where}
            ORDER BY m.updated_at DESC
            LIMIT {$limit} OFFSET {$offset}
        ");
        $stmt->execute($params);
        $matriculas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Estadísticas por estado
        $statsStmt = $db->prepare("
            SELECT m.estado, COUNT(*) as total
            FROM matriculas m
            " . ($cohorte_id ? "WHERE m.cohorte_id = ?" : "") . "
            GROUP BY m.estado
        ");
        $statsStmt->execute($cohorte_id ? [$cohorte_id] : []);
        $stats = [];
        while ($row = $statsStmt->fetch(PDO::FETCH_ASSOC)) {
            $stats[$row['estado']] = intval($row['total']);
        }

        echo json_encode([
            'success' => true,
            'matriculas' => $matriculas,
            'stats' => $stats,
            'total' => intval($total),
            'page' => $page,
            'pages' => ceil($total / $limit)
        ]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);

        // Asignación masiva de contactos a cohorte
        if (isset($input['asignar_masivo'])) {
            $cohorte_id = intval($input['cohorte_id'] ?? 0);
            $contacto_ids = $input['contacto_ids'] ?? [];

            if (!$cohorte_id || empty($contacto_ids)) {
                http_response_code(400);
                echo json_encode(['error' => 'cohorte_id y contacto_ids son requeridos']);
                exit;
            }

            $creadas = 0;
            $existentes = 0;

            foreach ($contacto_ids as $cid) {
                $cid = intval($cid);
                $stmt = $db->prepare("SELECT id FROM matriculas WHERE contacto_id = ? AND cohorte_id = ?");
                $stmt->execute([$cid, $cohorte_id]);
                if ($stmt->fetch()) {
                    $existentes++;
                    continue;
                }
                $stmt = $db->prepare("
                    INSERT INTO matriculas (contacto_id, cohorte_id, estado, etapa_actual)
                    VALUES (?, ?, 'invitado', 'pre_registro')
                ");
                $stmt->execute([$cid, $cohorte_id]);
                $creadas++;
            }

            echo json_encode([
                'success' => true,
                'message' => "{$creadas} matrículas creadas, {$existentes} ya existían"
            ]);
            break;
        }

        // Crear matrícula individual
        $contacto_id = intval($input['contacto_id'] ?? 0);
        $cohorte_id = intval($input['cohorte_id'] ?? 0);

        if (!$contacto_id || !$cohorte_id) {
            http_response_code(400);
            echo json_encode(['error' => 'contacto_id y cohorte_id son requeridos']);
            exit;
        }

        // Verificar que no exista
        $stmt = $db->prepare("SELECT id FROM matriculas WHERE contacto_id = ? AND cohorte_id = ?");
        $stmt->execute([$contacto_id, $cohorte_id]);
        if ($stmt->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Esta matrícula ya existe']);
            exit;
        }

        $stmt = $db->prepare("
            INSERT INTO matriculas (contacto_id, cohorte_id, estado, etapa_actual)
            VALUES (?, ?, 'invitado', 'pre_registro')
        ");
        $stmt->execute([$contacto_id, $cohorte_id]);

        echo json_encode([
            'success' => true,
            'message' => 'Matrícula creada',
            'matricula_id' => $db->lastInsertId()
        ]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de matrícula requerido']);
            exit;
        }

        $estado = $input['estado'] ?? null;
        $notas = $input['notas'] ?? null;

        $sets = [];
        $params = [];

        if ($estado) {
            $validEstados = ['invitado','registrado','activo','pausado','suspendido','completado','excluido'];
            if (!in_array($estado, $validEstados)) {
                http_response_code(400);
                echo json_encode(['error' => 'Estado inválido']);
                exit;
            }
            $sets[] = "estado = ?";
            $params[] = $estado;

            // Actualizar fechas según estado
            if ($estado === 'suspendido') {
                $sets[] = "fecha_suspension = NOW()";
            } elseif ($estado === 'completado') {
                $sets[] = "fecha_completado = NOW()";
            } elseif ($estado === 'excluido') {
                $sets[] = "etapa_actual = 'excluido'";
            }
        }
        if ($notas !== null) {
            $sets[] = "notas = ?";
            $params[] = $notas;
        }

        if (empty($sets)) {
            http_response_code(400);
            echo json_encode(['error' => 'Nada que actualizar']);
            exit;
        }

        $params[] = $id;
        $sql = "UPDATE matriculas SET " . implode(', ', $sets) . " WHERE id = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // Registrar en log
        if ($estado) {
            $stmtLog = $db->prepare("
                INSERT INTO seguimiento_log (matricula_id, tipo_evento, canal, detalle)
                VALUES (?, 'reactivacion', 'sistema', ?)
            ");
            $stmtLog->execute([$id, "Estado cambiado a: {$estado} (manual por admin)"]);
        }

        echo json_encode(['success' => true, 'message' => 'Matrícula actualizada']);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de matrícula requerido']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM matriculas WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Matrícula no encontrada']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Matrícula eliminada']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
