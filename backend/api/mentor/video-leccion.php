<?php
/**
 * API: Obtener video de una lección específica
 * GET /api/mentor/video-leccion.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

include_once '../../config/config.php';
include_once '../../config/db.php';

try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception('Error de conexión a la base de datos');
    }

    $documentId = isset($_GET['document_id']) ? intval($_GET['document_id']) : 0;
    $modulo = isset($_GET['modulo']) ? intval($_GET['modulo']) : 0;
    $leccion = isset($_GET['leccion']) ? intval($_GET['leccion']) : 0;

    if (!$documentId || !$modulo || !$leccion) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Parámetros requeridos: document_id, modulo, leccion'
        ]);
        exit;
    }

    $query = "SELECT
                id,
                titulo_completo,
                vimeo_id,
                hash_privacidad,
                modulo_numero,
                leccion_numero,
                duracion_segundos
              FROM doc_mentor_videos
              WHERE document_id = :document_id
                AND modulo_numero = :modulo
                AND leccion_numero = :leccion
                AND es_activo = 1
              LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':document_id', $documentId, PDO::PARAM_INT);
    $stmt->bindParam(':modulo', $modulo, PDO::PARAM_INT);
    $stmt->bindParam(':leccion', $leccion, PDO::PARAM_INT);
    $stmt->execute();

    $video = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($video) {
        echo json_encode([
            'success' => true,
            'video' => [
                'id' => intval($video['id']),
                'titulo' => $video['titulo_completo'],
                'vimeo_id' => $video['vimeo_id'],
                'hash_privacidad' => $video['hash_privacidad'],
                'modulo_numero' => intval($video['modulo_numero']),
                'leccion_numero' => intval($video['leccion_numero']),
                'duracion_segundos' => intval($video['duracion_segundos'] ?? 0),
                'timestamp_actual' => 0,
                'timestamp_maximo' => 0,
                'completado' => false
            ]
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'No se encontró video para esta lección',
            'video' => null
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error de base de datos: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error interno: ' . $e->getMessage()
    ]);
}
