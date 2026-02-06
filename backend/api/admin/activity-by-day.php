<?php
// backend/api/admin/activity-by-day.php
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
    // Obtener estadísticas de actividad por día (últimos 7 días)
    $query = "
        SELECT 
            DATE(fecha) as date,
            COUNT(*) as total_activities,
            COUNT(DISTINCT user_id) as unique_users,
            SUM(CASE WHEN completado = 1 THEN 1 ELSE 0 END) as lecciones_completadas
        FROM 
            user_progress
        WHERE 
            fecha >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY 
            DATE(fecha)
        ORDER BY 
            date ASC
    ";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $activityData = [];
    
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $activityData[] = [
            'date' => $row['date'],
            'lecciones' => (int)$row['lecciones_completadas'],
            'usuarios' => (int)$row['unique_users'],
            'actividades' => (int)$row['total_activities']
        ];
    }
    
    // Si no hay datos para algún día, añadir días con valor cero
    $daysToCheck = 7;
    $existingDates = array_column($activityData, 'date');
    
    for ($i = 0; $i < $daysToCheck; $i++) {
        $date = date('Y-m-d', strtotime("-$i days"));
        if (!in_array($date, $existingDates)) {
            $activityData[] = [
                'date' => $date,
                'lecciones' => 0,
                'usuarios' => 0,
                'actividades' => 0
            ];
        }
    }
    
    // Ordenar por fecha
    usort($activityData, function($a, $b) {
        return strtotime($a['date']) - strtotime($b['date']);
    });
    
    // Obtener estadísticas de evaluaciones por día
    $evalQuery = "
        SELECT 
            DATE(completed_at) as date,
            COUNT(*) as total_evaluations,
            AVG(score) as avg_score
        FROM 
            evaluations
        WHERE 
            completed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY 
            DATE(completed_at)
        ORDER BY 
            date ASC
    ";
    
    $evalStmt = $db->prepare($evalQuery);
    $evalStmt->execute();
    
    $evalData = [];
    while ($row = $evalStmt->fetch(PDO::FETCH_ASSOC)) {
        $evalData[$row['date']] = [
            'evaluaciones' => (int)$row['total_evaluations'],
            'calificacion_promedio' => round($row['avg_score'], 2)
        ];
    }
    
    // Combinar datos de actividad y evaluaciones
    foreach ($activityData as &$day) {
        $date = $day['date'];
        if (isset($evalData[$date])) {
            $day['evaluaciones'] = $evalData[$date]['evaluaciones'];
        } else {
            $day['evaluaciones'] = 0;
        }
    }
    
    // Responder con los datos
    http_response_code(200);
    echo json_encode($activityData);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error al obtener estadísticas de actividad", "error" => $e->getMessage()]);
}