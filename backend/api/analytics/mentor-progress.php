<?php
// /api/analytics/mentor-progress.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../utils/jwt.php';

$database = new Database();
$db = $database->getConnection();
$jwt = new JWTUtil();

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Solo permitir GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Obtener parámetros
$document_id = isset($_GET['document_id']) ? (int)$_GET['document_id'] : 0;
$type = isset($_GET['type']) ? $_GET['type'] : 'overview';

if ($document_id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "document_id es requerido"]);
    exit();
}

try {
    $response = [];

    switch ($type) {
        case 'overview':
            $response = getMentorOverview($db, $document_id);
            break;
        case 'detailed_progress':
            $response = getDetailedProgress($db, $document_id);
            break;
        case 'completion_stats':
            $response = getCompletionStats($db, $document_id);
            break;
        case 'learning_paths':
            $response = getLearningPaths($db, $document_id);
            break;
        default:
            $response = getMentorOverview($db, $document_id);
            break;
    }

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error del servidor: " . $e->getMessage()
    ]);
}

// ==========================================
// FUNCIONES DE PROGRESO MENTOR
// ==========================================

/**
 * Obtener resumen general del progreso mentor
 */
function getMentorOverview($db, $document_id) {
    try {
        // Estadísticas generales
        $query = "
            SELECT 
                COUNT(DISTINCT dmp.user_id) as total_estudiantes,
                COUNT(DISTINCT CASE WHEN dmp.leccion_actual > 1 THEN dmp.user_id END) as estudiantes_activos,
                AVG(dmp.leccion_actual) as promedio_leccion,
                AVG(dmp.modulo_actual) as promedio_modulo,
                COUNT(DISTINCT CASE WHEN dmp.leccion_actual >= 10 AND dmp.modulo_actual >= 3 THEN dmp.user_id END) as completados
            FROM doc_mentor_progreso dmp
            WHERE dmp.document_id = :document_id
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $overview = $stmt->fetch(PDO::FETCH_ASSOC);

        // Distribución por módulos
        $query = "
            SELECT 
                dmp.modulo_actual,
                COUNT(*) as estudiantes,
                AVG(dmp.leccion_actual) as promedio_leccion_modulo
            FROM doc_mentor_progreso dmp
            WHERE dmp.document_id = :document_id
            GROUP BY dmp.modulo_actual
            ORDER BY dmp.modulo_actual
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $moduleDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Progreso semanal
        $query = "
            SELECT 
                YEARWEEK(dmp.ultima_actualizacion) as semana,
                COUNT(DISTINCT dmp.user_id) as estudiantes_activos,
                SUM(JSON_LENGTH(COALESCE(dmp.temas_completados, '[]'))) as temas_completados
            FROM doc_mentor_progreso dmp
            WHERE dmp.document_id = :document_id
            AND dmp.ultima_actualizacion >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
            GROUP BY YEARWEEK(dmp.ultima_actualizacion)
            ORDER BY semana DESC
            LIMIT 8
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $weeklyProgress = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));

        return [
            'overview' => [
                'total_estudiantes' => (int)$overview['total_estudiantes'],
                'estudiantes_activos' => (int)$overview['estudiantes_activos'],
                'promedio_leccion' => round((float)$overview['promedio_leccion'], 1),
                'promedio_modulo' => round((float)$overview['promedio_modulo'], 1),
                'completados' => (int)$overview['completados'],
                'tasa_finalizacion' => $overview['total_estudiantes'] > 0 ? 
                    round(($overview['completados'] / $overview['total_estudiantes']) * 100, 1) : 0
            ],
            'module_distribution' => array_map(function($row) {
                return [
                    'modulo' => (int)$row['modulo_actual'],
                    'estudiantes' => (int)$row['estudiantes'],
                    'promedio_leccion' => round((float)$row['promedio_leccion_modulo'], 1)
                ];
            }, $moduleDistribution),
            'weekly_progress' => array_map(function($row) {
                return [
                    'semana' => $row['semana'],
                    'estudiantes_activos' => (int)$row['estudiantes_activos'],
                    'temas_completados' => (int)$row['temas_completados']
                ];
            }, $weeklyProgress)
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo overview mentor: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener progreso detallado por usuario
 */
function getDetailedProgress($db, $document_id) {
    try {
        $query = "
            SELECT 
                u.id,
                u.nombre,
                u.email,
                dmp.modulo_actual,
                dmp.leccion_actual,
                dmp.fecha_inicio,
                dmp.ultima_actualizacion,
                JSON_LENGTH(COALESCE(dmp.temas_completados, '[]')) as temas_completados,
                dmp.estructura_contenido,
                DATEDIFF(COALESCE(dmp.ultima_actualizacion, NOW()), dmp.fecha_inicio) as dias_transcurridos,
                COUNT(DISTINCT dcs.id) as sesiones_mentor
            FROM doc_mentor_progreso dmp
            INNER JOIN users u ON dmp.user_id = u.id
            LEFT JOIN doc_conversacion_sesiones dcs ON u.id = dcs.user_id 
                AND dcs.document_id = :document_id AND dcs.modo = 'mentor'
            WHERE dmp.document_id = :document_id
            GROUP BY u.id, u.nombre, u.email, dmp.modulo_actual, dmp.leccion_actual,
                     dmp.fecha_inicio, dmp.ultima_actualizacion, dmp.temas_completados, dmp.estructura_contenido
            ORDER BY dmp.modulo_actual DESC, dmp.leccion_actual DESC
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $detailed = [];
        foreach ($results as $result) {
            $progreso_porcentaje = calculateDetailedProgress($result);
            
            $detailed[] = [
                'user_id' => (int)$result['id'],
                'nombre' => $result['nombre'],
                'email' => $result['email'],
                'modulo_actual' => (int)$result['modulo_actual'],
                'leccion_actual' => (int)$result['leccion_actual'],
                'temas_completados' => (int)$result['temas_completados'],
                'progreso_porcentaje' => $progreso_porcentaje,
                'sesiones_mentor' => (int)$result['sesiones_mentor'],
                'dias_transcurridos' => (int)$result['dias_transcurridos'],
                'fecha_inicio' => $result['fecha_inicio'],
                'ultima_actividad' => $result['ultima_actualizacion'],
                'estado' => determineEstadoProgress($result, $progreso_porcentaje),
                'velocidad_aprendizaje' => calculateLearningSpeed($result)
            ];
        }

        return $detailed;
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo progreso detallado: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener estadísticas de finalización
 */
function getCompletionStats($db, $document_id) {
    try {
        // Stats por tiempo de finalización
        $query = "
            SELECT 
                CASE 
                    WHEN DATEDIFF(ultima_actualizacion, fecha_inicio) <= 7 THEN '1 semana'
                    WHEN DATEDIFF(ultima_actualizacion, fecha_inicio) <= 30 THEN '1 mes'
                    WHEN DATEDIFF(ultima_actualizacion, fecha_inicio) <= 90 THEN '3 meses'
                    ELSE 'Más de 3 meses'
                END as tiempo_categoria,
                COUNT(*) as estudiantes
            FROM doc_mentor_progreso dmp
            WHERE dmp.document_id = :document_id
            AND dmp.leccion_actual >= 10 AND dmp.modulo_actual >= 3
            GROUP BY tiempo_categoria
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $completionTimes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Abandono por módulo
        $query = "
            SELECT 
                dmp.modulo_actual,
                COUNT(*) as estudiantes,
                AVG(DATEDIFF(NOW(), dmp.ultima_actualizacion)) as dias_inactivo_promedio
            FROM doc_mentor_progreso dmp
            WHERE dmp.document_id = :document_id
            AND dmp.ultima_actualizacion < DATE_SUB(NOW(), INTERVAL 14 DAY)
            GROUP BY dmp.modulo_actual
            ORDER BY dmp.modulo_actual
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $dropoutByModule = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'completion_times' => $completionTimes,
            'dropout_by_module' => array_map(function($row) {
                return [
                    'modulo' => (int)$row['modulo_actual'],
                    'estudiantes_inactivos' => (int)$row['estudiantes'],
                    'dias_inactivo_promedio' => round((float)$row['dias_inactivo_promedio'], 1)
                ];
            }, $dropoutByModule)
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo stats de finalización: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener rutas de aprendizaje
 */
function getLearningPaths($db, $document_id) {
    try {
        // Simular rutas de aprendizaje basadas en el progreso
        $query = "
            SELECT 
                modulo_actual,
                leccion_actual,
                COUNT(*) as estudiantes,
                AVG(JSON_LENGTH(COALESCE(temas_completados, '[]'))) as promedio_temas
            FROM doc_mentor_progreso 
            WHERE document_id = :document_id
            GROUP BY modulo_actual, leccion_actual
            ORDER BY modulo_actual, leccion_actual
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $pathData = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Crear estructura de rutas
        $paths = [];
        foreach ($pathData as $data) {
            $moduleKey = "modulo_" . $data['modulo_actual'];
            if (!isset($paths[$moduleKey])) {
                $paths[$moduleKey] = [
                    'modulo' => (int)$data['modulo_actual'],
                    'nombre' => "Módulo " . $data['modulo_actual'],
                    'lecciones' => []
                ];
            }
            
            $paths[$moduleKey]['lecciones'][] = [
                'leccion' => (int)$data['leccion_actual'],
                'estudiantes' => (int)$data['estudiantes'],
                'promedio_temas' => round((float)$data['promedio_temas'], 1)
            ];
        }

        return array_values($paths);
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo rutas de aprendizaje: " . $e->getMessage()
        ];
    }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Calcular progreso detallado
 */
function calculateDetailedProgress($data) {
    $modulo = (int)$data['modulo_actual'];
    $leccion = (int)$data['leccion_actual'];
    $temas = (int)$data['temas_completados'];
    
    // Estimación: 5 módulos, 10 lecciones por módulo, peso por temas completados
    $max_modulos = 5;
    $lecciones_por_modulo = 10;
    $max_lecciones = $max_modulos * $lecciones_por_modulo;
    
    $progreso_lecciones = (($modulo - 1) * $lecciones_por_modulo + $leccion) / $max_lecciones;
    $bonus_temas = ($temas * 0.01); // 1% por cada tema completado
    
    $progreso_total = ($progreso_lecciones + $bonus_temas) * 100;
    
    return min(100, max(0, round($progreso_total, 1)));
}

/**
 * Determinar estado del progreso
 */
function determineEstadoProgress($data, $progreso) {
    $dias_inactivo = time() - strtotime($data['ultima_actualizacion']);
    $dias_inactivo = floor($dias_inactivo / (60 * 60 * 24));
    
    if ($progreso >= 100) return 'completado';
    if ($dias_inactivo > 30) return 'inactivo';
    if ($dias_inactivo > 14) return 'en_pausa';
    if ($progreso > 0) return 'activo';
    return 'iniciando';
}

/**
 * Calcular velocidad de aprendizaje
 */
function calculateLearningSpeed($data) {
    $dias = (int)$data['dias_transcurridos'];
    $leccion = (int)$data['leccion_actual'];
    $modulo = (int)$data['modulo_actual'];
    
    if ($dias <= 0) return 0;
    
    $total_progress_points = (($modulo - 1) * 10) + $leccion;
    $speed = $total_progress_points / $dias;
    
    return round($speed, 2);
}

?>