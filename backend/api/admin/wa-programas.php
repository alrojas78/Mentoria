<?php
// admin/wa-programas.php — CRUD de programas de WhatsApp Training (solo admin)
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
require_once '../../utils/WaTrainingService.php';

$userData = AuthMiddleware::requireAdmin();

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $id = intval($_GET['id'] ?? 0);

        if ($id) {
            // Obtener programa por ID con conteos
            $stmt = $db->prepare("
                SELECT wp.*,
                    (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = wp.id) as total_entregas,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id) as total_inscripciones,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id AND estado = 'activo') as inscripciones_activas,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id AND estado = 'completado') as inscripciones_completadas,
                    d.titulo as documento_titulo
                FROM wa_programas wp
                LEFT JOIN documentos d ON d.id = wp.documento_id
                WHERE wp.id = ?
            ");
            $stmt->execute([$id]);
            $programa = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$programa) {
                http_response_code(404);
                echo json_encode(['error' => 'Programa no encontrado']);
                exit;
            }

            if ($programa['config_json']) {
                $programa['config_json'] = json_decode($programa['config_json'], true);
            }

            echo json_encode(['success' => true, 'programa' => $programa]);
        } else {
            // Listar programas (opcionalmente filtrar por proyecto)
            $proyectoId = intval($_GET['proyecto_id'] ?? 0);

            $sql = "
                SELECT wp.*,
                    (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = wp.id) as total_entregas,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id) as total_inscripciones,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id AND estado = 'activo') as inscripciones_activas,
                    d.titulo as documento_titulo
                FROM wa_programas wp
                LEFT JOIN documentos d ON d.id = wp.documento_id
            ";

            $params = [];
            if ($proyectoId) {
                $sql .= " WHERE wp.proyecto_id = ?";
                $params[] = $proyectoId;
            }

            $sql .= " ORDER BY wp.created_at DESC";

            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $programas = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($programas as &$p) {
                if ($p['config_json']) {
                    $p['config_json'] = json_decode($p['config_json'], true);
                }
            }

            echo json_encode(['success' => true, 'programas' => $programas]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);

        $proyectoId = intval($input['proyecto_id'] ?? 0);
        $nombre = trim($input['nombre'] ?? '');

        if (!$proyectoId || !$nombre) {
            http_response_code(400);
            echo json_encode(['error' => 'proyecto_id y nombre son requeridos']);
            exit;
        }

        $descripcion = trim($input['descripcion'] ?? '') ?: null;
        $documentoId = !empty($input['documento_id']) ? intval($input['documento_id']) : null;
        $estado = $input['estado'] ?? 'borrador';
        $configJson = isset($input['config_json']) ? json_encode($input['config_json'], JSON_UNESCAPED_UNICODE) : null;

        // Validar estado
        $estadosValidos = ['borrador', 'activo', 'pausado', 'finalizado'];
        if (!in_array($estado, $estadosValidos)) {
            $estado = 'borrador';
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO wa_programas (proyecto_id, nombre, descripcion, documento_id, estado, config_json)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$proyectoId, $nombre, $descripcion, $documentoId, $estado, $configJson]);
            $programaId = $db->lastInsertId();

            echo json_encode([
                'success' => true,
                'message' => 'Programa creado exitosamente',
                'programa_id' => $programaId
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando programa: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de programa requerido']);
            exit;
        }

        // Verificar que el programa existe
        $stmtCheck = $db->prepare("SELECT id FROM wa_programas WHERE id = ?");
        $stmtCheck->execute([$id]);
        if (!$stmtCheck->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Programa no encontrado']);
            exit;
        }

        // Construir actualización dinámica
        $fields = [];
        $params = [];

        if (isset($input['nombre']) && trim($input['nombre'])) {
            $fields[] = 'nombre = ?';
            $params[] = trim($input['nombre']);
        }
        if (array_key_exists('descripcion', $input)) {
            $fields[] = 'descripcion = ?';
            $params[] = trim($input['descripcion'] ?? '') ?: null;
        }
        if (array_key_exists('documento_id', $input)) {
            $fields[] = 'documento_id = ?';
            $params[] = !empty($input['documento_id']) ? intval($input['documento_id']) : null;
        }
        if (isset($input['estado'])) {
            $estadosValidos = ['borrador', 'activo', 'pausado', 'finalizado'];
            if (in_array($input['estado'], $estadosValidos)) {
                $fields[] = 'estado = ?';
                $params[] = $input['estado'];
            }
        }
        if (isset($input['proyecto_id'])) {
            $fields[] = 'proyecto_id = ?';
            $params[] = intval($input['proyecto_id']);
        }
        if (isset($input['config_json'])) {
            // Merge con config existente
            $stmtCfg = $db->prepare("SELECT config_json FROM wa_programas WHERE id = ?");
            $stmtCfg->execute([$id]);
            $row = $stmtCfg->fetch(PDO::FETCH_ASSOC);
            $currentConfig = ($row && $row['config_json']) ? json_decode($row['config_json'], true) : [];
            $mergedConfig = array_merge($currentConfig, $input['config_json']);
            $fields[] = 'config_json = ?';
            $params[] = json_encode($mergedConfig, JSON_UNESCAPED_UNICODE);
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay campos para actualizar']);
            exit;
        }

        $params[] = $id;

        try {
            $sql = "UPDATE wa_programas SET " . implode(', ', $fields) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            // Auto-programar entregas cuando se activa el programa
            $programadas = 0;
            if (isset($input['estado']) && $input['estado'] === 'activo') {
                $waService = new WaTrainingService($db);
                $programadas = $waService->onProgramaActivado($id);
            }

            echo json_encode(['success' => true, 'message' => 'Programa actualizado', 'entregas_programadas' => $programadas]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error actualizando programa: ' . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);
        $hard = isset($_GET['hard']) && $_GET['hard'] === '1';

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de programa requerido']);
            exit;
        }

        try {
            if ($hard) {
                // Hard delete: eliminar programa y datos relacionados
                $db->beginTransaction();

                // Eliminar interacciones de inscripciones de este programa
                $db->prepare("
                    DELETE wi FROM wa_interacciones wi
                    INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                    WHERE wins.programa_id = ?
                ")->execute([$id]);

                // Eliminar inscripciones
                $db->prepare("DELETE FROM wa_inscripciones WHERE programa_id = ?")->execute([$id]);

                // Eliminar entregas
                $db->prepare("DELETE FROM wa_entregas WHERE programa_id = ?")->execute([$id]);

                // Eliminar programa
                $db->prepare("DELETE FROM wa_programas WHERE id = ?")->execute([$id]);

                $db->commit();
                echo json_encode(['success' => true, 'message' => 'Programa eliminado permanentemente']);
            } else {
                // Soft delete: marcar como finalizado
                $stmt = $db->prepare("UPDATE wa_programas SET estado = 'finalizado' WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode(['success' => true, 'message' => 'Programa finalizado']);
            }
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'Error eliminando programa: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
