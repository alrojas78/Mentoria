<?php
// admin/wa-inscripciones.php — CRUD de inscripciones WhatsApp Training (solo admin)
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
            // Obtener inscripción por ID con progreso
            $stmt = $db->prepare("
                SELECT wins.*,
                    wp.nombre as programa_nombre,
                    wp.estado as programa_estado,
                    (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = wins.programa_id AND activo = 1) as total_entregas,
                    (SELECT COUNT(DISTINCT wi.entrega_id) FROM wa_interacciones wi
                     WHERE wi.inscripcion_id = wins.id AND wi.tipo IN ('envio_contenido', 'envio_pregunta')
                     AND wi.estado_envio IN ('enviado', 'entregado', 'leido')) as entregas_enviadas,
                    (SELECT COUNT(DISTINCT wi.entrega_id) FROM wa_interacciones wi
                     WHERE wi.inscripcion_id = wins.id AND wi.tipo = 'respuesta_estudiante') as entregas_respondidas,
                    (SELECT AVG(wi.evaluacion_score) FROM wa_interacciones wi
                     WHERE wi.inscripcion_id = wins.id AND wi.evaluacion_score IS NOT NULL) as promedio_score
                FROM wa_inscripciones wins
                LEFT JOIN wa_programas wp ON wp.id = wins.programa_id
                WHERE wins.id = ?
            ");
            $stmt->execute([$id]);
            $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$inscripcion) {
                http_response_code(404);
                echo json_encode(['error' => 'Inscripción no encontrada']);
                exit;
            }

            echo json_encode(['success' => true, 'inscripcion' => $inscripcion]);
        } else {
            // Listar inscripciones por programa
            $programaId = intval($_GET['programa_id'] ?? 0);

            if (!$programaId) {
                http_response_code(400);
                echo json_encode(['error' => 'programa_id es requerido']);
                exit;
            }

            $stmt = $db->prepare("
                SELECT wins.*,
                    (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = wins.programa_id AND activo = 1) as total_entregas,
                    (SELECT COUNT(DISTINCT wi.entrega_id) FROM wa_interacciones wi
                     WHERE wi.inscripcion_id = wins.id AND wi.tipo IN ('envio_contenido', 'envio_pregunta')
                     AND wi.estado_envio IN ('enviado', 'entregado', 'leido')) as entregas_enviadas,
                    (SELECT COUNT(DISTINCT wi.entrega_id) FROM wa_interacciones wi
                     WHERE wi.inscripcion_id = wins.id AND wi.tipo = 'respuesta_estudiante') as entregas_respondidas,
                    (SELECT AVG(wi.evaluacion_score) FROM wa_interacciones wi
                     WHERE wi.inscripcion_id = wins.id AND wi.evaluacion_score IS NOT NULL) as promedio_score
                FROM wa_inscripciones wins
                WHERE wins.programa_id = ?
                ORDER BY wins.created_at DESC
            ");
            $stmt->execute([$programaId]);
            $inscripciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'inscripciones' => $inscripciones]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);

        // Acción especial: importación masiva
        $action = $input['action'] ?? '';
        if ($action === 'import_bulk') {
            $programaId = intval($input['programa_id'] ?? 0);
            $contactos = $input['contactos'] ?? [];

            if (!$programaId || empty($contactos)) {
                http_response_code(400);
                echo json_encode(['error' => 'programa_id y contactos son requeridos']);
                exit;
            }

            // Verificar que el programa existe
            $stmtCheck = $db->prepare("SELECT id FROM wa_programas WHERE id = ?");
            $stmtCheck->execute([$programaId]);
            if (!$stmtCheck->fetch()) {
                http_response_code(404);
                echo json_encode(['error' => 'Programa no encontrado']);
                exit;
            }

            $fechaInicio = $input['fecha_inicio'] ?? date('Y-m-d');
            $insertados = 0;
            $duplicados = 0;
            $errores = [];

            $stmtInsert = $db->prepare("
                INSERT INTO wa_inscripciones (programa_id, contacto_id, telefono, nombre, email, fecha_inicio)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmtDup = $db->prepare("
                SELECT id FROM wa_inscripciones WHERE programa_id = ? AND telefono = ?
            ");

            foreach ($contactos as $i => $contacto) {
                $telefono = trim($contacto['telefono'] ?? '');
                if (!$telefono) {
                    $errores[] = "Contacto #" . ($i + 1) . ": teléfono vacío";
                    continue;
                }

                // Verificar duplicado
                $stmtDup->execute([$programaId, $telefono]);
                if ($stmtDup->fetch()) {
                    $duplicados++;
                    continue;
                }

                try {
                    $stmtInsert->execute([
                        $programaId,
                        !empty($contacto['contacto_id']) ? intval($contacto['contacto_id']) : null,
                        $telefono,
                        trim($contacto['nombre'] ?? '') ?: null,
                        trim($contacto['email'] ?? '') ?: null,
                        $contacto['fecha_inicio'] ?? $fechaInicio
                    ]);
                    $insertados++;
                } catch (PDOException $e) {
                    $errores[] = "Contacto #" . ($i + 1) . " ({$telefono}): " . $e->getMessage();
                }
            }

            echo json_encode([
                'success' => true,
                'message' => "Importación completada: {$insertados} insertados, {$duplicados} duplicados",
                'insertados' => $insertados,
                'duplicados' => $duplicados,
                'errores' => $errores
            ]);
            break;
        }

        // Creación individual
        $programaId = intval($input['programa_id'] ?? 0);
        $telefono = trim($input['telefono'] ?? '');

        if (!$programaId || !$telefono) {
            http_response_code(400);
            echo json_encode(['error' => 'programa_id y telefono son requeridos']);
            exit;
        }

        // Verificar que el programa existe
        $stmtCheck = $db->prepare("SELECT id FROM wa_programas WHERE id = ?");
        $stmtCheck->execute([$programaId]);
        if (!$stmtCheck->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Programa no encontrado']);
            exit;
        }

        // Verificar duplicado
        $stmtDup = $db->prepare("SELECT id FROM wa_inscripciones WHERE programa_id = ? AND telefono = ?");
        $stmtDup->execute([$programaId, $telefono]);
        if ($stmtDup->fetch()) {
            http_response_code(409);
            echo json_encode(['error' => 'Este teléfono ya está inscrito en este programa']);
            exit;
        }

        $contactoId = !empty($input['contacto_id']) ? intval($input['contacto_id']) : null;
        $nombre = trim($input['nombre'] ?? '') ?: null;
        $email = trim($input['email'] ?? '') ?: null;
        $fechaInicio = $input['fecha_inicio'] ?? date('Y-m-d');

        try {
            $stmt = $db->prepare("
                INSERT INTO wa_inscripciones (programa_id, contacto_id, telefono, nombre, email, fecha_inicio)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$programaId, $contactoId, $telefono, $nombre, $email, $fechaInicio]);
            $inscripcionId = $db->lastInsertId();

            // Auto-programar entregas si el programa está activo
            $programadas = 0;
            $waService = new WaTrainingService($db);
            $programadas = $waService->onNuevaInscripcion($inscripcionId);

            echo json_encode([
                'success' => true,
                'message' => 'Inscripción creada exitosamente',
                'inscripcion_id' => $inscripcionId,
                'entregas_programadas' => $programadas
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando inscripción: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de inscripción requerido']);
            exit;
        }

        // Verificar que la inscripción existe
        $stmtCheck = $db->prepare("SELECT id FROM wa_inscripciones WHERE id = ?");
        $stmtCheck->execute([$id]);
        if (!$stmtCheck->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Inscripción no encontrada']);
            exit;
        }

        // Construir actualización dinámica
        $fields = [];
        $params = [];

        if (isset($input['estado'])) {
            $estadosValidos = ['activo', 'pausado', 'completado', 'abandonado'];
            if (in_array($input['estado'], $estadosValidos)) {
                $fields[] = 'estado = ?';
                $params[] = $input['estado'];
            }
        }
        if (array_key_exists('notas', $input)) {
            $fields[] = 'notas = ?';
            $params[] = trim($input['notas'] ?? '') ?: null;
        }
        if (isset($input['fecha_inicio'])) {
            $fields[] = 'fecha_inicio = ?';
            $params[] = $input['fecha_inicio'];
        }
        if (array_key_exists('nombre', $input)) {
            $fields[] = 'nombre = ?';
            $params[] = trim($input['nombre'] ?? '') ?: null;
        }
        if (array_key_exists('email', $input)) {
            $fields[] = 'email = ?';
            $params[] = trim($input['email'] ?? '') ?: null;
        }
        if (array_key_exists('telefono', $input)) {
            $fields[] = 'telefono = ?';
            $params[] = trim($input['telefono'] ?? '');
        }
        if (isset($input['entrega_actual'])) {
            $fields[] = 'entrega_actual = ?';
            $params[] = intval($input['entrega_actual']);
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay campos para actualizar']);
            exit;
        }

        $params[] = $id;

        try {
            $sql = "UPDATE wa_inscripciones SET " . implode(', ', $fields) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            echo json_encode(['success' => true, 'message' => 'Inscripción actualizada']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error actualizando inscripción: ' . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de inscripción requerido']);
            exit;
        }

        try {
            $db->beginTransaction();

            // Eliminar interacciones asociadas
            $db->prepare("DELETE FROM wa_interacciones WHERE inscripcion_id = ?")->execute([$id]);

            // Eliminar inscripción
            $db->prepare("DELETE FROM wa_inscripciones WHERE id = ?")->execute([$id]);

            $db->commit();

            echo json_encode(['success' => true, 'message' => 'Inscripción eliminada']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'Error eliminando inscripción: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
