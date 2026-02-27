<?php
/**
 * Endpoint: mentor/start.php
 * GET - Inicializa o retoma el programa mentor para un documento.
 * Retorna estado completo: estructura, progreso, video actual, totales.
 */

require_once '../../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable('../../');
$dotenv->load();

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit();
}

include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../middleware/AuthMiddleware.php';
include_once '../../models/Anexo.php';
include_once '../../utils/VideoMentorService.php';
include_once '../../models/Documento.php';

$database = new Database();
$db = $database->getConnection();

$userData = AuthMiddleware::requireAuth();
$userId = $userData->id;
$userName = $userData->nombre ?? $userData->name ?? 'Estudiante';

$documentId = isset($_GET['document_id']) ? intval($_GET['document_id']) : 0;

if ($documentId === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'document_id es requerido']);
    exit();
}

try {
    // 1. Verificar que el documento existe
    $stmtDoc = $db->prepare("SELECT id, titulo FROM documentos WHERE id = ?");
    $stmtDoc->execute([$documentId]);
    $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);

    if (!$doc) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Documento no encontrado']);
        exit();
    }

    // 2. Buscar progreso existente
    $stmtProg = $db->prepare("SELECT * FROM doc_mentor_progreso WHERE user_id = ? AND document_id = ?");
    $stmtProg->execute([$userId, $documentId]);
    $progreso = $stmtProg->fetch(PDO::FETCH_ASSOC);

    // 3. Si no hay progreso, detectar videos y crear estructura
    if (!$progreso) {
        $videoService = new VideoMentorService($db);
        $videosPrograma = $videoService->detectarVideosProgramaMentor($documentId);

        if (empty($videosPrograma)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Este documento no tiene videos de mentor configurados'
            ]);
            exit();
        }

        // Crear estructura
        $estructura = [
            'titulo_programa' => "Programa de Video: " . $doc['titulo'],
            'tipo_programa' => 'video_estructurado',
            'modulos' => []
        ];

        $modulosAgrupados = [];
        foreach ($videosPrograma as $video) {
            $modulosAgrupados[$video['modulo']][] = $video;
        }

        foreach ($modulosAgrupados as $numeroModulo => $videosModulo) {
            $modulo = [
                'numero' => $numeroModulo,
                'titulo' => "Módulo $numeroModulo",
                'tipo' => 'video',
                'lecciones' => []
            ];
            foreach ($videosModulo as $video) {
                $modulo['lecciones'][] = [
                    'numero' => $video['leccion'],
                    'titulo' => $video['titulo'],
                    'tipo' => 'video',
                    'vimeo_id' => $video['vimeo_id'],
                    'anexo_id' => $video['anexo_id']
                ];
            }
            $estructura['modulos'][] = $modulo;
        }

        // Insertar progreso
        $stmtInsert = $db->prepare("
            INSERT INTO doc_mentor_progreso (user_id, document_id, estructura_contenido, estado, modulo_actual, leccion_actual)
            VALUES (?, ?, ?, 'iniciado', 1, 1)
            ON DUPLICATE KEY UPDATE estructura_contenido = VALUES(estructura_contenido)
        ");
        $stmtInsert->execute([$userId, $documentId, json_encode($estructura)]);

        // Re-leer progreso
        $stmtProg->execute([$userId, $documentId]);
        $progreso = $stmtProg->fetch(PDO::FETCH_ASSOC);
    }

    // 4. Decodificar estructura
    $estructura = json_decode($progreso['estructura_contenido'], true);
    $moduloActual = intval($progreso['modulo_actual']);
    $leccionActual = intval($progreso['leccion_actual']);
    $estado = $progreso['estado'];

    // 5. Obtener video actual
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
        LEFT JOIN doc_mentor_video_progreso mvp ON mv.id = mvp.video_id AND mvp.user_id = :user_id
        WHERE mv.document_id = :document_id
          AND mv.modulo_numero = :modulo
          AND mv.leccion_numero = :leccion
        ORDER BY mv.orden_secuencial ASC
        LIMIT 1
    ");
    $stmtVideo->execute([
        ':user_id' => $userId,
        ':document_id' => $documentId,
        ':modulo' => $moduloActual,
        ':leccion' => $leccionActual
    ]);
    $videoActual = $stmtVideo->fetch(PDO::FETCH_ASSOC);

    if ($videoActual) {
        $videoActual['timestamp_actual'] = intval($videoActual['timestamp_actual'] ?? 0);
        $videoActual['timestamp_maximo'] = intval($videoActual['timestamp_maximo'] ?? 0);
        $videoActual['completado'] = intval($videoActual['completado'] ?? 0);
    }

    // 6. Cargar progreso de TODOS los videos (para sidebar)
    // completado: también marcar si timestamp_maximo >= 90% duración (fallback robusto)
    $stmtAllProgress = $db->prepare("
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
    $stmtAllProgress->execute([$userId, $documentId]);
    $todosLosVideos = $stmtAllProgress->fetchAll(PDO::FETCH_ASSOC);

    // Convertir tipos
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

    // 7. Calcular totales
    $totalLecciones = 0;
    foreach ($estructura['modulos'] as $mod) {
        $totalLecciones += count($mod['lecciones']);
    }

    $leccionesCompletadas = 0;
    foreach ($todosLosVideos as $v) {
        if ($v['completado']) $leccionesCompletadas++;
    }

    $porcentaje = $totalLecciones > 0 ? round(($leccionesCompletadas / $totalLecciones) * 100, 0) : 0;

    // 8. Respuesta
    echo json_encode([
        'success' => true,
        'data' => [
            'document_id' => intval($documentId),
            'document_title' => $doc['titulo'],
            'estado' => $estado,
            'modulo_actual' => $moduloActual,
            'leccion_actual' => $leccionActual,
            'estructura' => $estructura,
            'video_actual' => $videoActual,
            'videos' => $todosLosVideos,
            'totales' => [
                'total_modulos' => count($estructura['modulos']),
                'total_lecciones' => $totalLecciones,
                'lecciones_completadas' => $leccionesCompletadas,
                'porcentaje' => $porcentaje
            ],
            'user_name' => $userName
        ]
    ]);

} catch (Exception $e) {
    error_log("Error en mentor/start.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error interno del servidor']);
}
