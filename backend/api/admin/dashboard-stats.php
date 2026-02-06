<?php
// backend/api/admin/dashboard-stats.php
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
    // Obtener estadísticas generales
    $response = [
        'totalUsers' => 0,
        'totalCourses' => 0,
        'totalLessons' => 0,
        'activeUsers' => 0,
        'completedCourses' => 0
    ];
    
    // Total de usuarios
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM users");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['totalUsers'] = (int)$row['total'];
    
    // Total de cursos
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM courses");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['totalCourses'] = (int)$row['total'];
    
    // Total de lecciones
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM lessons");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['totalLessons'] = (int)$row['total'];
    
    // Usuarios activos (con alguna actividad en los últimos 30 días)
    $stmt = $db->prepare("
        SELECT COUNT(DISTINCT user_id) as total 
        FROM user_progress 
        WHERE fecha >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    ");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['activeUsers'] = (int)$row['total'];
    
    // Cursos completados
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM completed_courses");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $response['completedCourses'] = (int)$row['total'];
    
    // Responder con los datos
    http_response_code(200);
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error al obtener estadísticas", "error" => $e->getMessage()]);
}