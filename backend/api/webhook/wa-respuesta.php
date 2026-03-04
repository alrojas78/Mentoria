<?php
/**
 * Webhook receptor de respuestas WhatsApp desde Operatix
 *
 * Recibe mensajes entrantes reenviados por Operatix cuando un estudiante
 * responde por WhatsApp. Identifica la inscripción por teléfono + proyecto,
 * guarda la respuesta, y si hay una pregunta pendiente la marca para evaluación.
 *
 * NO requiere JWT — validación por header X-Operatix-Webhook
 *
 * @since Fase 11.6
 */

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Operatix-Webhook");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Solo POST']);
    exit;
}

// Validar que viene de Operatix
$webhookHeader = $_SERVER['HTTP_X_OPERATIX_WEBHOOK'] ?? '';
if ($webhookHeader !== '1') {
    http_response_code(403);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../utils/WaEvaluator.php';
require_once __DIR__ . '/../../utils/OperatixBridge.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['from']) || empty($input['project_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos incompletos']);
    exit;
}

$from = $input['from'];                    // Teléfono del estudiante
$content = $input['content'] ?? '';         // Texto del mensaje
$type = $input['type'] ?? 'text';          // Tipo: text, image, audio, etc.
$mediaUrl = $input['media_url'] ?? null;   // URL de media si aplica
$messageId = $input['message_id'] ?? null; // ID del mensaje en Meta
$operatixProjectId = $input['project_id']; // ID del proyecto en Operatix
$contactName = $input['contact_name'] ?? '';

try {
    $database = new Database();
    $db = $database->getConnection();

    // =========================================================================
    // 1. Identificar el proyecto de Mentoria por operatix_project_id
    // =========================================================================

    $stmt = $db->prepare("
        SELECT id, config_json FROM proyectos
        WHERE JSON_EXTRACT(config_json, '$.operatix_project_id') = ?
        LIMIT 1
    ");
    $stmt->execute([$operatixProjectId]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proyecto) {
        // Intentar búsqueda como string (JSON puede guardar como string o int)
        $stmt = $db->prepare("
            SELECT id, config_json FROM proyectos
            WHERE JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.operatix_project_id')) = ?
            LIMIT 1
        ");
        $stmt->execute([(string)$operatixProjectId]);
        $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$proyecto) {
        http_response_code(404);
        echo json_encode(['error' => 'Proyecto no encontrado para operatix_project_id: ' . $operatixProjectId]);
        exit;
    }

    $proyectoId = $proyecto['id'];

    // =========================================================================
    // 2. Buscar inscripción activa del estudiante por teléfono
    // =========================================================================

    // Normalizar teléfono (quitar espacios, guiones, +)
    $telefonoNorm = preg_replace('/[\s\-\+]/', '', $from);

    $stmt = $db->prepare("
        SELECT ins.*, wp.nombre AS programa_nombre
        FROM wa_inscripciones ins
        JOIN wa_programas wp ON ins.programa_id = wp.id
        WHERE wp.proyecto_id = ?
          AND ins.estado = 'activo'
          AND (
              REPLACE(REPLACE(REPLACE(ins.telefono, ' ', ''), '-', ''), '+', '') = ?
              OR ins.telefono = ?
          )
        ORDER BY ins.created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$proyectoId, $telefonoNorm, $from]);
    $inscripcion = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$inscripcion) {
        // No hay inscripción activa para este número — ignorar silenciosamente
        echo json_encode(['success' => true, 'action' => 'ignored', 'reason' => 'No active inscription for this phone']);
        exit;
    }

    $inscripcionId = $inscripcion['id'];

    // =========================================================================
    // 3. Guardar la respuesta en wa_interacciones
    // =========================================================================

    $stmt = $db->prepare("
        INSERT INTO wa_interacciones
        (inscripcion_id, tipo, contenido, media_url, operatix_message_id, estado_envio, fecha_respuesta)
        VALUES (?, 'respuesta_estudiante', ?, ?, ?, 'entregado', NOW())
    ");
    $stmt->execute([$inscripcionId, $content, $mediaUrl, $messageId]);
    $respuestaId = $db->lastInsertId();

    // Actualizar fecha_ultima_interaccion
    $stmt = $db->prepare("UPDATE wa_inscripciones SET fecha_ultima_interaccion = NOW() WHERE id = ?");
    $stmt->execute([$inscripcionId]);

    // =========================================================================
    // 4. Buscar si hay una pregunta pendiente de respuesta
    // =========================================================================

    $stmt = $db->prepare("
        SELECT i.id AS interaccion_id, i.entrega_id, e.pregunta, e.respuesta_esperada, e.evaluacion_modo
        FROM wa_interacciones i
        JOIN wa_entregas e ON i.entrega_id = e.id
        WHERE i.inscripcion_id = ?
          AND i.tipo = 'envio_pregunta'
          AND i.estado_envio IN ('enviado', 'entregado', 'leido')
          AND NOT EXISTS (
              SELECT 1 FROM wa_interacciones resp
              WHERE resp.inscripcion_id = i.inscripcion_id
                AND resp.entrega_id = i.entrega_id
                AND resp.tipo = 'respuesta_estudiante'
                AND resp.id < ?
          )
        ORDER BY i.fecha_enviado DESC
        LIMIT 1
    ");
    $stmt->execute([$inscripcionId, $respuestaId]);
    $preguntaPendiente = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($preguntaPendiente) {
        // Vincular la respuesta con la entrega de la pregunta
        $stmt = $db->prepare("UPDATE wa_interacciones SET entrega_id = ? WHERE id = ?");
        $stmt->execute([$preguntaPendiente['entrega_id'], $respuestaId]);

        // =====================================================================
        // 5. Evaluar respuesta con IA
        // =====================================================================

        $evaluator = new WaEvaluator($db);
        $eval = $evaluator->evaluar(
            $content,
            $preguntaPendiente['pregunta'] ?? '',
            $preguntaPendiente['respuesta_esperada'] ?? '',
            $preguntaPendiente['evaluacion_modo'] ?? 'ia_semantica',
            "Programa: {$inscripcion['programa_nombre']}"
        );

        // Guardar evaluación en la interacción de respuesta
        $stmt = $db->prepare("
            UPDATE wa_interacciones
            SET evaluacion_score = ?, evaluacion_detalle = ?
            WHERE id = ?
        ");
        $stmt->execute([$eval['score'], $eval['retroalimentacion'], $respuestaId]);

        // =====================================================================
        // 6. Enviar retroalimentación al estudiante por WhatsApp
        // =====================================================================

        $retroEnviada = false;
        try {
            $bridge = OperatixBridge::getInstance();
            $retroTexto = $eval['retroalimentacion'];

            // Agregar indicador de score
            $scorePercent = round($eval['score'] * 100);
            $emoji = $eval['aprobado'] ? '' : '';
            $retroMensaje = "{$emoji} Evaluacion: {$scorePercent}%\n\n{$retroTexto}";

            $sendResult = $bridge->sendTextMessage($from, $retroMensaje);

            if ($sendResult && !empty($sendResult['success'])) {
                // Registrar la retroalimentación como interacción
                $stmt = $db->prepare("
                    INSERT INTO wa_interacciones
                    (inscripcion_id, entrega_id, tipo, contenido, operatix_message_id, estado_envio, fecha_enviado)
                    VALUES (?, ?, 'retroalimentacion_texto', ?, ?, 'enviado', NOW())
                ");
                $stmt->execute([
                    $inscripcionId,
                    $preguntaPendiente['entrega_id'],
                    $retroMensaje,
                    $sendResult['message_id'] ?? null
                ]);
                $retroEnviada = true;
            }
        } catch (Exception $retroErr) {
            error_log("wa-respuesta: Error enviando retroalimentacion: " . $retroErr->getMessage());
        }

        echo json_encode([
            'success' => true,
            'action' => 'response_evaluated',
            'inscripcion_id' => $inscripcionId,
            'respuesta_id' => $respuestaId,
            'pregunta_pendiente' => true,
            'entrega_id' => $preguntaPendiente['entrega_id'],
            'evaluacion' => [
                'score' => $eval['score'],
                'aprobado' => $eval['aprobado'],
                'modo' => $preguntaPendiente['evaluacion_modo']
            ],
            'retroalimentacion_enviada' => $retroEnviada
        ]);
    } else {
        // Respuesta libre (no vinculada a pregunta)
        echo json_encode([
            'success' => true,
            'action' => 'response_saved',
            'inscripcion_id' => $inscripcionId,
            'respuesta_id' => $respuestaId,
            'pregunta_pendiente' => false
        ]);
    }

} catch (Exception $e) {
    error_log("wa-respuesta webhook error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error interno: ' . $e->getMessage()]);
}
