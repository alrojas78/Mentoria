<?php
// admin/wa-entregas.php — CRUD de entregas de programas WhatsApp Training (solo admin)
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
        $id = intval($_GET['id'] ?? 0);

        if ($id) {
            // Obtener entrega por ID
            $stmt = $db->prepare("
                SELECT we.*, wp.nombre as programa_nombre
                FROM wa_entregas we
                LEFT JOIN wa_programas wp ON wp.id = we.programa_id
                WHERE we.id = ?
            ");
            $stmt->execute([$id]);
            $entrega = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$entrega) {
                http_response_code(404);
                echo json_encode(['error' => 'Entrega no encontrada']);
                exit;
            }

            if ($entrega['template_variables']) {
                $entrega['template_variables'] = json_decode($entrega['template_variables'], true);
            }

            echo json_encode(['success' => true, 'entrega' => $entrega]);
        } else {
            // Listar entregas por programa
            $programaId = intval($_GET['programa_id'] ?? 0);

            if (!$programaId) {
                http_response_code(400);
                echo json_encode(['error' => 'programa_id es requerido']);
                exit;
            }

            $stmt = $db->prepare("
                SELECT we.*,
                    (SELECT COUNT(*) FROM wa_interacciones wi
                     INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                     WHERE wi.entrega_id = we.id AND wi.tipo = 'respuesta_estudiante') as total_respuestas,
                    (SELECT AVG(wi.evaluacion_score) FROM wa_interacciones wi
                     INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                     WHERE wi.entrega_id = we.id AND wi.evaluacion_score IS NOT NULL) as promedio_score
                FROM wa_entregas we
                WHERE we.programa_id = ?
                ORDER BY we.orden ASC, we.id ASC
            ");
            $stmt->execute([$programaId]);
            $entregas = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($entregas as &$e) {
                if ($e['template_variables']) {
                    $e['template_variables'] = json_decode($e['template_variables'], true);
                }
            }

            echo json_encode(['success' => true, 'entregas' => $entregas]);
        }
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);

        $programaId = intval($input['programa_id'] ?? 0);

        if (!$programaId) {
            http_response_code(400);
            echo json_encode(['error' => 'programa_id es requerido']);
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

        $tipo = $input['tipo'] ?? 'contenido';
        $tiposValidos = ['contenido', 'pregunta', 'retroalimentacion'];
        if (!in_array($tipo, $tiposValidos)) {
            http_response_code(400);
            echo json_encode(['error' => 'Tipo inválido. Valores válidos: contenido, pregunta, retroalimentacion']);
            exit;
        }

        // Auto-calcular orden si no se envía
        $orden = isset($input['orden']) ? intval($input['orden']) : null;
        if ($orden === null) {
            $stmtMax = $db->prepare("SELECT COALESCE(MAX(orden), 0) + 1 FROM wa_entregas WHERE programa_id = ?");
            $stmtMax->execute([$programaId]);
            $orden = intval($stmtMax->fetchColumn());
        }

        $titulo = trim($input['titulo'] ?? '') ?: null;
        $texto = trim($input['texto'] ?? '') ?: null;
        $mediaUrl = trim($input['media_url'] ?? '') ?: null;
        $mediaTipo = $input['media_tipo'] ?? null;
        $pregunta = trim($input['pregunta'] ?? '') ?: null;
        $respuestaEsperada = trim($input['respuesta_esperada'] ?? '') ?: null;
        $evaluacionModo = $input['evaluacion_modo'] ?? 'ia_semantica';
        $diasDespues = intval($input['dias_despues'] ?? 0);
        $horaEnvio = $input['hora_envio'] ?? '09:00:00';
        $templateName = trim($input['template_name'] ?? '') ?: null;
        $templateVariables = isset($input['template_variables']) ? json_encode($input['template_variables'], JSON_UNESCAPED_UNICODE) : null;
        $activo = isset($input['activo']) ? intval($input['activo']) : 1;

        // Validar media_tipo si se envía
        if ($mediaTipo) {
            $mediaTiposValidos = ['pdf', 'imagen', 'audio', 'video', 'documento'];
            if (!in_array($mediaTipo, $mediaTiposValidos)) {
                $mediaTipo = null;
            }
        }

        // Validar evaluacion_modo
        $evalModosValidos = ['ia_semantica', 'exacta', 'libre'];
        if (!in_array($evaluacionModo, $evalModosValidos)) {
            $evaluacionModo = 'ia_semantica';
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO wa_entregas (programa_id, orden, tipo, titulo, texto, media_url, media_tipo,
                    pregunta, respuesta_esperada, evaluacion_modo, dias_despues, hora_envio,
                    template_name, template_variables, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $programaId, $orden, $tipo, $titulo, $texto, $mediaUrl, $mediaTipo,
                $pregunta, $respuestaEsperada, $evaluacionModo, $diasDespues, $horaEnvio,
                $templateName, $templateVariables, $activo
            ]);
            $entregaId = $db->lastInsertId();

            echo json_encode([
                'success' => true,
                'message' => 'Entrega creada exitosamente',
                'entrega_id' => $entregaId
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando entrega: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);

        // Acción especial: reordenar entregas
        $action = $input['action'] ?? '';
        if ($action === 'reorder') {
            $programaId = intval($input['programa_id'] ?? 0);
            $orden = $input['orden'] ?? [];

            if (!$programaId || empty($orden)) {
                http_response_code(400);
                echo json_encode(['error' => 'programa_id y orden son requeridos']);
                exit;
            }

            try {
                $stmt = $db->prepare("UPDATE wa_entregas SET orden = ? WHERE id = ? AND programa_id = ?");
                foreach ($orden as $item) {
                    $stmt->execute([intval($item['orden']), intval($item['id']), $programaId]);
                }
                echo json_encode(['success' => true, 'message' => 'Orden actualizado']);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Error reordenando entregas: ' . $e->getMessage()]);
            }
            break;
        }

        // Actualización normal
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de entrega requerido']);
            exit;
        }

        // Verificar que la entrega existe
        $stmtCheck = $db->prepare("SELECT id FROM wa_entregas WHERE id = ?");
        $stmtCheck->execute([$id]);
        if (!$stmtCheck->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Entrega no encontrada']);
            exit;
        }

        // Construir actualización dinámica
        $fields = [];
        $params = [];

        if (isset($input['orden'])) {
            $fields[] = 'orden = ?';
            $params[] = intval($input['orden']);
        }
        if (isset($input['tipo'])) {
            $tiposValidos = ['contenido', 'pregunta', 'retroalimentacion'];
            if (in_array($input['tipo'], $tiposValidos)) {
                $fields[] = 'tipo = ?';
                $params[] = $input['tipo'];
            }
        }
        if (array_key_exists('titulo', $input)) {
            $fields[] = 'titulo = ?';
            $params[] = trim($input['titulo'] ?? '') ?: null;
        }
        if (array_key_exists('texto', $input)) {
            $fields[] = 'texto = ?';
            $params[] = trim($input['texto'] ?? '') ?: null;
        }
        if (array_key_exists('media_url', $input)) {
            $fields[] = 'media_url = ?';
            $params[] = trim($input['media_url'] ?? '') ?: null;
        }
        if (array_key_exists('media_tipo', $input)) {
            $fields[] = 'media_tipo = ?';
            $mediaTipo = $input['media_tipo'];
            if ($mediaTipo) {
                $mediaTiposValidos = ['pdf', 'imagen', 'audio', 'video', 'documento'];
                if (!in_array($mediaTipo, $mediaTiposValidos)) {
                    $mediaTipo = null;
                }
            }
            $params[] = $mediaTipo;
        }
        if (array_key_exists('pregunta', $input)) {
            $fields[] = 'pregunta = ?';
            $params[] = trim($input['pregunta'] ?? '') ?: null;
        }
        if (array_key_exists('respuesta_esperada', $input)) {
            $fields[] = 'respuesta_esperada = ?';
            $params[] = trim($input['respuesta_esperada'] ?? '') ?: null;
        }
        if (isset($input['evaluacion_modo'])) {
            $evalModosValidos = ['ia_semantica', 'exacta', 'libre'];
            if (in_array($input['evaluacion_modo'], $evalModosValidos)) {
                $fields[] = 'evaluacion_modo = ?';
                $params[] = $input['evaluacion_modo'];
            }
        }
        if (isset($input['dias_despues'])) {
            $fields[] = 'dias_despues = ?';
            $params[] = intval($input['dias_despues']);
        }
        if (isset($input['hora_envio'])) {
            $fields[] = 'hora_envio = ?';
            $params[] = $input['hora_envio'];
        }
        if (array_key_exists('template_name', $input)) {
            $fields[] = 'template_name = ?';
            $params[] = trim($input['template_name'] ?? '') ?: null;
        }
        if (isset($input['template_variables'])) {
            $fields[] = 'template_variables = ?';
            $params[] = json_encode($input['template_variables'], JSON_UNESCAPED_UNICODE);
        }
        if (isset($input['activo'])) {
            $fields[] = 'activo = ?';
            $params[] = intval($input['activo']);
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay campos para actualizar']);
            exit;
        }

        $params[] = $id;

        try {
            $sql = "UPDATE wa_entregas SET " . implode(', ', $fields) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            echo json_encode(['success' => true, 'message' => 'Entrega actualizada']);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error actualizando entrega: ' . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de entrega requerido']);
            exit;
        }

        try {
            // Obtener programa_id antes de eliminar para reordenar
            $stmtInfo = $db->prepare("SELECT programa_id, orden FROM wa_entregas WHERE id = ?");
            $stmtInfo->execute([$id]);
            $info = $stmtInfo->fetch(PDO::FETCH_ASSOC);

            if (!$info) {
                http_response_code(404);
                echo json_encode(['error' => 'Entrega no encontrada']);
                exit;
            }

            $db->beginTransaction();

            // Eliminar interacciones asociadas
            $db->prepare("DELETE FROM wa_interacciones WHERE entrega_id = ?")->execute([$id]);

            // Eliminar la entrega
            $db->prepare("DELETE FROM wa_entregas WHERE id = ?")->execute([$id]);

            // Reordenar las entregas restantes
            $db->prepare("
                UPDATE wa_entregas SET orden = orden - 1
                WHERE programa_id = ? AND orden > ?
            ")->execute([$info['programa_id'], $info['orden']]);

            $db->commit();

            echo json_encode(['success' => true, 'message' => 'Entrega eliminada']);
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'Error eliminando entrega: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
