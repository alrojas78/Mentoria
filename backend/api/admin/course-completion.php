<?php
// backend/api/admin/course-completion.php
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
    // Verificar si se solicita un curso específico
    $courseId = isset($_GET['course_id']) ? intval($_GET['course_id']) : null;
    
    if ($courseId) {
        // Estadísticas para un curso específico
        getCourseCompletionById($db, $courseId);
    } else {
        // Estadísticas para todos los cursos
        getAllCoursesCompletion($db);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error al obtener estadísticas de completitud", "error" => $e->getMessage()]);
}

// Función para obtener estadísticas de completitud de un curso específico
function getCourseCompletionById($db, $courseId) {
    // Verificar que el curso existe
    $checkQuery = "SELECT id, titulo FROM courses WHERE id = ?";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->execute([$courseId]);
    
    if ($checkStmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(["message" => "Curso no encontrado"]);
        return;
    }
    
    $course = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    // Obtener total de lecciones en el curso
    $lessonQuery = "SELECT COUNT(*) as total FROM lessons WHERE curso_id = ?";
    $lessonStmt = $db->prepare($lessonQuery);
    $lessonStmt->execute([$courseId]);
    $lessonRow = $lessonStmt->fetch(PDO::FETCH_ASSOC);
    $totalLessons = (int)$lessonRow['total'];
    
    // Obtener total de estudiantes que han iniciado el curso
    $activeStudentsQuery = "
        SELECT COUNT(DISTINCT up.user_id) as total
        FROM user_progress up
        JOIN lessons l ON up.lesson_id = l.id
        WHERE l.curso_id = ?
    ";
    $activeStmt = $db->prepare($activeStudentsQuery);
    $activeStmt->execute([$courseId]);
    $activeRow = $activeStmt->fetch(PDO::FETCH_ASSOC);
    $studentCount = (int)$activeRow['total'];
    
    // Obtener cursos completados
    $completedQuery = "SELECT COUNT(*) as total FROM completed_courses WHERE curso_id = ?";
    $completedStmt = $db->prepare($completedQuery);
    $completedStmt->execute([$courseId]);
    $completedRow = $completedStmt->fetch(PDO::FETCH_ASSOC);
    $completedCount = (int)$completedRow['total'];
    
    // Calcular tasa de completitud
    $completionRate = $studentCount > 0 ? round(($completedCount / $studentCount) * 100, 2) : 0;
    
    // Obtener progreso promedio
    $progressQuery = "
        WITH UserLessonCounts AS (
            SELECT 
                up.user_id,
                COUNT(DISTINCT up.lesson_id) AS completed_lessons
            FROM 
                user_progress up
            JOIN 
                lessons l ON up.lesson_id = l.id
            WHERE 
                l.curso_id = ? AND up.completado = 1
            GROUP BY 
                up.user_id
        )
        SELECT AVG(completed_lessons * 100.0 / ?) as avg_progress
        FROM UserLessonCounts
    ";
    
    $progressStmt = $db->prepare($progressQuery);
    $progressStmt->execute([$courseId, $totalLessons]);
    $progressRow = $progressStmt->fetch(PDO::FETCH_ASSOC);
    $averageProgress = $progressRow ? round($progressRow['avg_progress'] ?? 0, 2) : 0;
    
    // Construir respuesta
    $response = [
        "courseId" => $courseId,
        "courseTitle" => $course['titulo'],
        "totalLessons" => $totalLessons,
        "studentCount" => $studentCount,
        "completedCount" => $completedCount,
        "completionRate" => $completionRate,
        "averageProgress" => $averageProgress
    ];
    
    http_response_code(200);
    echo json_encode($response);
}

// Función para obtener estadísticas de completitud de todos los cursos
function getAllCoursesCompletion($db) {
    // Obtener todos los cursos
    $courseQuery = "SELECT id, titulo FROM courses";
    $courseStmt = $db->prepare($courseQuery);
    $courseStmt->execute();
    
    $courses = $courseStmt->fetchAll(PDO::FETCH_ASSOC);
    $response = [];
    
    foreach ($courses as $course) {
        $courseId = $course['id'];
        
        // Obtener total de lecciones en el curso
        $lessonQuery = "SELECT COUNT(*) as total FROM lessons WHERE curso_id = ?";
        $lessonStmt = $db->prepare($lessonQuery);
        $lessonStmt->execute([$courseId]);
        $lessonRow = $lessonStmt->fetch(PDO::FETCH_ASSOC);
        $totalLessons = (int)$lessonRow['total'];
        
        // Obtener total de estudiantes que han iniciado el curso
        $activeStudentsQuery = "
            SELECT COUNT(DISTINCT up.user_id) as total
            FROM user_progress up
            JOIN lessons l ON up.lesson_id = l.id
            WHERE l.curso_id = ?
        ";
        $activeStmt = $db->prepare($activeStudentsQuery);
        $activeStmt->execute([$courseId]);
        $activeRow = $activeStmt->fetch(PDO::FETCH_ASSOC);
        $studentCount = (int)$activeRow['total'];
        
        // Obtener cursos completados
        $completedQuery = "SELECT COUNT(*) as total FROM completed_courses WHERE curso_id = ?";
        $completedStmt = $db->prepare($completedQuery);
        $completedStmt->execute([$courseId]);
        $completedRow = $completedStmt->fetch(PDO::FETCH_ASSOC);
        $completedCount = (int)$completedRow['total'];
        
        // Calcular tasa de completitud
        $completionRate = $studentCount > 0 ? round(($completedCount / $studentCount) * 100, 2) : 0;
        
        $response[] = [
            "courseId" => $courseId,
            "courseTitle" => $course['titulo'],
            "totalLessons" => $totalLessons,
            "studentCount" => $studentCount,
            "completedCount" => $completedCount,
            "completionRate" => $completionRate
        ];
    }
    
    http_response_code(200);
    echo json_encode($response);
}