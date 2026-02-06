<?php
// backend/api/admin/progress-stats.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir archivos necesarios
include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../utils/jwt.php';

// Verificar autenticación y rol de administrador
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$jwt = new JWTUtil();
$userData = $jwt->validate($token);

if (!$userData || $userData->role !== 'admin') {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

try {
    // Estadísticas de progreso
    $response = [
        'activeUsers' => 0,
        'completedCourses' => 0,
        'averageCompletion' => 0,
        'lessonsCompleted' => 0,
        'averageScore' => 0
    ];
    
    // Usuarios activos (con al menos una lección completada)
    $stmt = $db->prepare("
        SELECT COUNT(DISTINCT user_id) as total 
        FROM user_progress 
        WHERE completado = 1
    ");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['activeUsers'] = (int)$row['total'];
    
    // Cursos completados
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM completed_courses");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['completedCourses'] = (int)$row['total'];
    
    // Total de lecciones completadas
    $stmt = $db->prepare("
        SELECT COUNT(*) as total 
        FROM user_progress 
        WHERE completado = 1
    ");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['lessonsCompleted'] = (int)$row['total'];
    
    // Calificación promedio en evaluaciones
    $stmt = $db->prepare("
        SELECT AVG(score) as avg_score 
        FROM evaluations
    ");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['averageScore'] = round($row['avg_score'] ?? 0, 2);
    
    // Tasa de completitud promedio
    // Calculamos el porcentaje promedio de lecciones completadas por los usuarios
    $stmt = $db->prepare("
        WITH LessonCounts AS (
            SELECT COUNT(*) as total_lessons FROM lessons
        ),
        UserProgress AS (
            SELECT 
                user_id, 
                COUNT(*) as completed_lessons 
            FROM user_progress 
            WHERE completado = 1 
            GROUP BY user_id
        )
        SELECT 
            AVG(UP.completed_lessons * 100.0 / LC.total_lessons) as avg_completion
        FROM 
            UserProgress UP, 
            LessonCounts LC
    ");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['averageCompletion'] = round($row['avg_completion'] ?? 0, 2);
    
    // Responder con los datos
    http_response_code(200);
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error al obtener estadísticas de progreso", "error" => $e->getMessage()]);
}