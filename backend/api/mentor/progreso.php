<?php
/**
 * Endpoint: mentor/progreso.php
 * Obtiene el progreso del modo mentor para un usuario específico en un documento
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Rutas correctas: desde /api/mentor/ subir 2 niveles a /config/
include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$jwt = new JWTUtil();
$userData = $jwt->validate($token);

if (!$userData) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'No autorizado'
    ]);
    exit();
}

// Obtener parámetros
$document_id = isset($_GET['document_id']) ? intval($_GET['document_id']) : 0;
$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

if ($document_id === 0 || $user_id === 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Parámetros inválidos: document_id y user_id son requeridos'
    ]);
    exit();
}

try {
    // Consultar progreso del usuario
    $query = "SELECT 
                id,
                user_id,
                document_id,
                estructura_contenido,
                leccion_actual,
                modulo_actual,
                temas_completados,
                fecha_inicio,
                ultima_actualizacion,
                estado,
                notas_progreso
              FROM doc_mentor_progreso
              WHERE document_id = :document_id 
              AND user_id = :user_id
              LIMIT 1";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':document_id', $document_id, PDO::PARAM_INT);
    $stmt->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $progreso = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$progreso) {
        // No hay progreso registrado
        echo json_encode([
            'success' => true,
            'data' => null,
            'message' => 'No hay progreso registrado para este usuario en este documento'
        ]);
        exit();
    }
    
    // Decodificar JSONs
    if (!empty($progreso['estructura_contenido'])) {
        $progreso['estructura_contenido'] = json_decode($progreso['estructura_contenido'], true);
    }
    
    if (!empty($progreso['temas_completados'])) {
        $progreso['temas_completados'] = json_decode($progreso['temas_completados'], true);
    } else {
        $progreso['temas_completados'] = [];
    }
    
    // Convertir a enteros
    $progreso['id'] = intval($progreso['id']);
    $progreso['user_id'] = intval($progreso['user_id']);
    $progreso['document_id'] = intval($progreso['document_id']);
    $progreso['leccion_actual'] = intval($progreso['leccion_actual']);
    $progreso['modulo_actual'] = intval($progreso['modulo_actual']);
    
    // 🆕 CONSULTAR VIDEOS COMPLETADOS (si el programa tiene videos)
    $queryVideos = "
        SELECT COUNT(*) as total_videos,
               SUM(CASE WHEN completado = 1 THEN 1 ELSE 0 END) as videos_completados
        FROM doc_mentor_video_progreso
        WHERE document_id = :document_id 
        AND user_id = :user_id
    ";
    
    $stmtVideos = $db->prepare($queryVideos);
    $stmtVideos->bindParam(':document_id', $document_id, PDO::PARAM_INT);
    $stmtVideos->bindParam(':user_id', $user_id, PDO::PARAM_INT);
    $stmtVideos->execute();
    
    $videosInfo = $stmtVideos->fetch(PDO::FETCH_ASSOC);
    
    // Agregar información de videos al progreso
    $progreso['videos_info'] = [
        'total_videos' => intval($videosInfo['total_videos'] ?? 0),
        'videos_completados' => intval($videosInfo['videos_completados'] ?? 0),
        'tiene_videos' => intval($videosInfo['total_videos'] ?? 0) > 0
    ];
    
    // Respuesta exitosa
    echo json_encode([
        'success' => true,
        'data' => $progreso
    ]);
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error al obtener progreso del mentor',
        'error' => $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error interno del servidor',
        'error' => $e->getMessage()
    ]);
}
?>
