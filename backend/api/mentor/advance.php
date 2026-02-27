<?php
/**
 * Endpoint: mentor/advance.php
 * POST - Avanza a la siguiente lección del programa mentor.
 * Retorna el mismo shape que start.php (estado completo actualizado).
 */

require_once '../../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable('../../');
$dotenv->load();

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit();
}

include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../middleware/AuthMiddleware.php';

$database = new Database();
$db = $database->getConnection();

$userData = AuthMiddleware::requireAuth();
$userId = $userData->id;

$data = json_decode(file_get_contents("php://input"));
$documentId = isset($data->document_id) ? intval($data->document_id) : 0;

if ($documentId === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'document_id es requerido']);
    exit();
}

try {
    // 1. Obtener progreso actual
    $stmtProg = $db->prepare("SELECT * FROM doc_mentor_progreso WHERE user_id = ? AND document_id = ?");
    $stmtProg->execute([$userId, $documentId]);
    $progreso = $stmtProg->fetch(PDO::FETCH_ASSOC);

    if (!$progreso) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No hay progreso para este documento']);
        exit();
    }

    if ($progreso['estado'] === 'completado') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'El programa ya está completado']);
        exit();
    }

    $estructura = json_decode($progreso['estructura_contenido'], true);
    $moduloActual = intval($progreso['modulo_actual']);
    $leccionActual = intval($progreso['leccion_actual']);

    $moduloInfo = $estructura['modulos'][$moduloActual - 1] ?? null;
    if (!$moduloInfo) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error en estructura del módulo']);
        exit();
    }

    $totalLeccionesModulo = count($moduloInfo['lecciones']);
    $totalModulos = count($estructura['modulos']);
    $nuevoModulo = $moduloActual;
    $nuevaLeccion = $leccionActual;
    $nuevoEstado = 'iniciado';
    $evento = '';

    // CASO 1: Hay más lecciones en este módulo
    if ($leccionActual < $totalLeccionesModulo) {
        $nuevaLeccion = $leccionActual + 1;
        $evento = 'siguiente_leccion';
    }
    // CASO 2: Terminó el módulo, hay más módulos
    else if ($moduloActual < $totalModulos) {
        $nuevoModulo = $moduloActual + 1;
        $nuevaLeccion = 1;
        $evento = 'siguiente_modulo';
    }
    // CASO 3: Programa completo
    else {
        $nuevoEstado = 'completado';
        $evento = 'programa_completado';
    }

    // 2. Actualizar progreso en DB
    $stmtUpdate = $db->prepare("
        UPDATE doc_mentor_progreso
        SET modulo_actual = ?, leccion_actual = ?, estado = ?, ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmtUpdate->execute([$nuevoModulo, $nuevaLeccion, $nuevoEstado, $userId, $documentId]);

    // 3. Retornar estado actualizado (delegar a start.php via include interno)
    // Re-leer todo para consistencia
    $stmtProg->execute([$userId, $documentId]);
    $progresoActualizado = $stmtProg->fetch(PDO::FETCH_ASSOC);

    $estActualizada = json_decode($progresoActualizado['estructura_contenido'], true);

    // Video actual (completado: también si timestamp_maximo >= 90% duración)
    $stmtVideo = $db->prepare("
        SELECT
            mv.id, mv.document_id, mv.anexo_id, mv.modulo_numero, mv.leccion_numero,
            mv.titulo_completo, mv.vimeo_id, mv.hash_privacidad, mv.transcripcion,
            mv.duracion_segundos, mv.orden_secuencial,
            COALESCE(mvp.timestamp_actual, 0) as timestamp_actual,
            COALESCE(mvp.timestamp_maximo, 0) as timestamp_maximo,
            CASE WHEN mvp.completado = 1
                 OR (mv.duracion_segundos > 0 AND COALESCE(mvp.timestamp_maximo, 0) >= mv.duracion_segundos * 0.9)
                 THEN 1 ELSE 0 END as completado
        FROM doc_mentor_videos mv
        LEFT JOIN doc_mentor_video_progreso mvp ON mv.id = mvp.video_id AND mvp.user_id = ?
        WHERE mv.document_id = ? AND mv.modulo_numero = ? AND mv.leccion_numero = ?
        ORDER BY mv.orden_secuencial ASC
        LIMIT 1
    ");
    $stmtVideo->execute([$userId, $documentId, $nuevoModulo, $nuevaLeccion]);
    $videoActual = $stmtVideo->fetch(PDO::FETCH_ASSOC);

    if ($videoActual) {
        $videoActual['timestamp_actual'] = intval($videoActual['timestamp_actual'] ?? 0);
        $videoActual['timestamp_maximo'] = intval($videoActual['timestamp_maximo'] ?? 0);
        $videoActual['completado'] = intval($videoActual['completado'] ?? 0);
    }

    // Todos los videos (completado: también si timestamp_maximo >= 90% duración)
    $stmtAll = $db->prepare("
        SELECT mv.id as video_id, mv.modulo_numero, mv.leccion_numero, mv.titulo_completo,
               mv.vimeo_id, mv.hash_privacidad, mv.duracion_segundos, mv.orden_secuencial,
               COALESCE(mvp.timestamp_actual, 0) as timestamp_actual,
               COALESCE(mvp.timestamp_maximo, 0) as timestamp_maximo,
               CASE WHEN mvp.completado = 1
                    OR (mv.duracion_segundos > 0 AND COALESCE(mvp.timestamp_maximo, 0) >= mv.duracion_segundos * 0.9)
                    THEN 1 ELSE 0 END as completado
        FROM doc_mentor_videos mv
        LEFT JOIN doc_mentor_video_progreso mvp ON mv.id = mvp.video_id AND mvp.user_id = ?
        WHERE mv.document_id = ?
        ORDER BY mv.orden_secuencial ASC
    ");
    $stmtAll->execute([$userId, $documentId]);
    $todosLosVideos = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

    foreach ($todosLosVideos as &$v) {
        $v['video_id'] = intval($v['video_id']);
        $v['modulo_numero'] = intval($v['modulo_numero']);
        $v['leccion_numero'] = intval($v['leccion_numero']);
        $v['duracion_segundos'] = intval($v['duracion_segundos']);
        $v['orden_secuencial'] = intval($v['orden_secuencial']);
        $v['timestamp_actual'] = intval($v['timestamp_actual']);
        $v['timestamp_maximo'] = intval($v['timestamp_maximo']);
        $v['completado'] = intval($v['completado']);
    }
    unset($v);

    // Totales
    $totalLecciones = 0;
    foreach ($estActualizada['modulos'] as $mod) {
        $totalLecciones += count($mod['lecciones']);
    }
    $leccionesCompletadas = 0;
    foreach ($todosLosVideos as $v) {
        if ($v['completado']) $leccionesCompletadas++;
    }
    $porcentaje = $totalLecciones > 0 ? round(($leccionesCompletadas / $totalLecciones) * 100, 0) : 0;

    // Título documento
    $stmtDoc = $db->prepare("SELECT titulo FROM documentos WHERE id = ?");
    $stmtDoc->execute([$documentId]);
    $docTitulo = $stmtDoc->fetchColumn();

    echo json_encode([
        'success' => true,
        'evento' => $evento,
        'data' => [
            'document_id' => intval($documentId),
            'document_title' => $docTitulo,
            'estado' => $nuevoEstado,
            'modulo_actual' => $nuevoModulo,
            'leccion_actual' => $nuevaLeccion,
            'estructura' => $estActualizada,
            'video_actual' => $videoActual,
            'videos' => $todosLosVideos,
            'totales' => [
                'total_modulos' => count($estActualizada['modulos']),
                'total_lecciones' => $totalLecciones,
                'lecciones_completadas' => $leccionesCompletadas,
                'porcentaje' => $porcentaje
            ]
        ]
    ]);

} catch (Exception $e) {
    error_log("Error en mentor/advance.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno del servidor']);
}
