<?php
// /api/analytics/user-rankings.php
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
$type = isset($_GET['type']) ? $_GET['type'] : 'general_ranking';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;

if ($document_id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "document_id es requerido"]);
    exit();
}

try {
    $response = [];

    $user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

    switch ($type) {
        case 'general_ranking':
            $response = getGeneralUserRanking($db, $document_id, $limit);
            break;
        case 'top_performers':
            $response = getTopPerformers($db, $document_id, $limit);
            break;
        case 'most_active':
            $response = getMostActiveUsers($db, $document_id, $limit);
            break;
        case 'mentor_progress':
            $response = getMentorProgressRanking($db, $document_id, $limit);
            break;
        case 'evaluation_scores':
            $response = getEvaluationScoresRanking($db, $document_id, $limit);
            break;
        case 'retention_stats':
            $response = getUserRetentionStats($db, $document_id);
            break;
        case 'user_questions':
            if ($user_id <= 0) {
                http_response_code(400);
                echo json_encode(["message" => "user_id es requerido para user_questions"]);
                exit();
            }
            $response = getUserQuestions($db, $document_id, $user_id, $limit);
            break;
        default:
            $response = getGeneralUserRanking($db, $document_id, $limit);
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
// FUNCIONES DE RANKINGS
// ==========================================

/**
 * Ranking general de usuarios (más completo)
 */
function getGeneralUserRanking($db, $document_id, $limit) {
    try {
        // Primero calculamos los tiempos por sesión en una subconsulta
        $query = "
            SELECT
                u.id,
                u.nombre,
                u.email,
                COUNT(DISTINCT dcs.id) as total_sesiones,
                COUNT(DISTINCT CASE WHEN dcm.tipo = 'pregunta_usuario' THEN dcm.id END) as total_preguntas,
                COALESCE((
                    SELECT SUM(
                        GREATEST(1, COALESCE(
                            TIMESTAMPDIFF(MINUTE, s.started_at,
                                (SELECT MAX(m.timestamp) FROM doc_conversacion_mensajes m WHERE m.session_id = s.id)
                            ), 1)
                        )
                    )
                    FROM doc_conversacion_sesiones s
                    WHERE s.user_id = u.id AND s.document_id = :document_id
                ), 0) as tiempo_total_minutos,
                MAX(dcs.started_at) as ultima_actividad,
                COUNT(DISTINCT CASE WHEN dcs.modo = 'mentor' THEN dcs.id END) as sesiones_mentor,
                COUNT(DISTINCT CASE WHEN dcs.modo = 'evaluacion' THEN dcs.id END) as sesiones_evaluacion,
                COALESCE(AVG(der.porcentaje_obtenido), 0) as promedio_evaluaciones,
                COUNT(DISTINCT CASE WHEN der.aprobado = 1 THEN der.id END) as evaluaciones_aprobadas
            FROM users u
            LEFT JOIN doc_conversacion_sesiones dcs ON u.id = dcs.user_id AND dcs.document_id = :document_id
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            LEFT JOIN doc_evaluacion_resultados der ON u.id = der.user_id AND der.document_id = :document_id
            WHERE EXISTS (
                SELECT 1 FROM doc_conversacion_sesiones dcs2
                WHERE dcs2.user_id = u.id AND dcs2.document_id = :document_id
            )
            GROUP BY u.id, u.nombre, u.email
            ORDER BY
                total_sesiones DESC,
                total_preguntas DESC,
                tiempo_total_minutos DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $ranking = [];
        $position = 1;
        foreach ($results as $result) {
            $ranking[] = [
                'posicion' => $position++,
                'usuario_id' => (int)$result['id'],
                'nombre' => $result['nombre'],
                'email' => $result['email'],
                'total_sesiones' => (int)$result['total_sesiones'],
                'total_preguntas' => (int)$result['total_preguntas'],
                'tiempo_total_horas' => round((float)$result['tiempo_total_minutos'] / 60, 1),
                'ultima_actividad' => $result['ultima_actividad'],
                'sesiones_mentor' => (int)$result['sesiones_mentor'],
                'sesiones_evaluacion' => (int)$result['sesiones_evaluacion'],
                'promedio_evaluaciones' => round((float)$result['promedio_evaluaciones'], 1),
                'evaluaciones_aprobadas' => (int)$result['evaluaciones_aprobadas'],
                'modo_preferido' => determineModoPreferido($result)
            ];
        }

        return $ranking;
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo ranking general: " . $e->getMessage()
        ];
    }
}

/**
 * Top performers (usuarios con mejor rendimiento)
 */
function getTopPerformers($db, $document_id, $limit) {
    try {
        $query = "
            SELECT 
                u.id,
                u.nombre,
                u.email,
                COUNT(DISTINCT dcs.id) as total_sesiones,
                COUNT(DISTINCT CASE WHEN dcm.tipo = 'pregunta_usuario' THEN dcm.id END) as total_preguntas,
                COALESCE(AVG(der.porcentaje_obtenido), 0) as promedio_evaluaciones,
                COUNT(DISTINCT CASE WHEN der.aprobado = 1 THEN der.id END) as evaluaciones_aprobadas,
                COUNT(DISTINCT der.id) as total_evaluaciones,
                MAX(dcs.started_at) as ultima_actividad
            FROM users u
            INNER JOIN doc_conversacion_sesiones dcs ON u.id = dcs.user_id AND dcs.document_id = :document_id
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            LEFT JOIN doc_evaluacion_resultados der ON u.id = der.user_id AND der.document_id = :document_id
            GROUP BY u.id, u.nombre, u.email
            HAVING total_evaluaciones > 0
            ORDER BY 
                promedio_evaluaciones DESC,
                evaluaciones_aprobadas DESC,
                total_sesiones DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $ranking = [];
        $position = 1;
        foreach ($results as $result) {
            $tasa_aprobacion = $result['total_evaluaciones'] > 0 ? 
                ($result['evaluaciones_aprobadas'] / $result['total_evaluaciones']) * 100 : 0;
                
            $ranking[] = [
                'posicion' => $position++,
                'usuario_id' => (int)$result['id'],
                'nombre' => $result['nombre'],
                'email' => $result['email'],
                'promedio_evaluaciones' => round((float)$result['promedio_evaluaciones'], 1),
                'evaluaciones_aprobadas' => (int)$result['evaluaciones_aprobadas'],
                'total_evaluaciones' => (int)$result['total_evaluaciones'],
                'tasa_aprobacion' => round($tasa_aprobacion, 1),
                'total_sesiones' => (int)$result['total_sesiones'],
                'total_preguntas' => (int)$result['total_preguntas'],
                'ultima_actividad' => $result['ultima_actividad']
            ];
        }

        return $ranking;
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo top performers: " . $e->getMessage()
        ];
    }
}

/**
 * Usuarios más activos (por actividad)
 */
function getMostActiveUsers($db, $document_id, $limit) {
    try {
        $query = "
            SELECT
                u.id,
                u.nombre,
                u.email,
                COUNT(DISTINCT dcs.id) as total_sesiones,
                COUNT(DISTINCT CASE WHEN dcm.tipo = 'pregunta_usuario' THEN dcm.id END) as total_preguntas,
                COALESCE((
                    SELECT SUM(
                        GREATEST(1, COALESCE(
                            TIMESTAMPDIFF(MINUTE, s.started_at,
                                (SELECT MAX(m.timestamp) FROM doc_conversacion_mensajes m WHERE m.session_id = s.id)
                            ), 1)
                        )
                    )
                    FROM doc_conversacion_sesiones s
                    WHERE s.user_id = u.id AND s.document_id = :document_id
                ), 0) as tiempo_total_minutos,
                MAX(dcs.started_at) as ultima_actividad,
                MIN(dcs.started_at) as primera_actividad,
                COUNT(DISTINCT DATE(dcs.started_at)) as dias_activos
            FROM users u
            INNER JOIN doc_conversacion_sesiones dcs ON u.id = dcs.user_id AND dcs.document_id = :document_id
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            GROUP BY u.id, u.nombre, u.email
            ORDER BY
                total_sesiones DESC,
                total_preguntas DESC,
                tiempo_total_minutos DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $ranking = [];
        $position = 1;
        foreach ($results as $result) {
            $ranking[] = [
                'posicion' => $position++,
                'usuario_id' => (int)$result['id'],
                'nombre' => $result['nombre'],
                'email' => $result['email'],
                'total_sesiones' => (int)$result['total_sesiones'],
                'total_preguntas' => (int)$result['total_preguntas'],
                'tiempo_total_horas' => round((float)$result['tiempo_total_minutos'] / 60, 1),
                'dias_activos' => (int)$result['dias_activos'],
                'primera_actividad' => $result['primera_actividad'],
                'ultima_actividad' => $result['ultima_actividad'],
                'promedio_sesiones_por_dia' => $result['dias_activos'] > 0 ? 
                    round($result['total_sesiones'] / $result['dias_activos'], 1) : 0
            ];
        }

        return $ranking;
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo usuarios más activos: " . $e->getMessage()
        ];
    }
}

/**
 * Ranking de progreso en modo mentor
 */
function getMentorProgressRanking($db, $document_id, $limit) {
    try {
        $query = "
            SELECT
                u.id,
                u.nombre,
                u.email,
                dmp.leccion_actual,
                dmp.modulo_actual,
                dmp.fecha_inicio,
                dmp.ultima_actualizacion,
                COUNT(DISTINCT dcs.id) as sesiones_mentor,
                COALESCE((
                    SELECT SUM(
                        GREATEST(1, COALESCE(
                            TIMESTAMPDIFF(MINUTE, s.started_at,
                                (SELECT MAX(m.timestamp) FROM doc_conversacion_mensajes m WHERE m.session_id = s.id)
                            ), 1)
                        )
                    )
                    FROM doc_conversacion_sesiones s
                    WHERE s.user_id = u.id AND s.document_id = :document_id AND s.modo = 'mentor'
                ), 0) as tiempo_mentor_minutos,
                JSON_LENGTH(COALESCE(dmp.temas_completados, '[]')) as temas_completados
            FROM users u
            INNER JOIN doc_mentor_progreso dmp ON u.id = dmp.user_id AND dmp.document_id = :document_id
            LEFT JOIN doc_conversacion_sesiones dcs ON u.id = dcs.user_id
                AND dcs.document_id = :document_id AND dcs.modo = 'mentor'
            GROUP BY u.id, u.nombre, u.email, dmp.leccion_actual, dmp.modulo_actual,
                     dmp.fecha_inicio, dmp.ultima_actualizacion, dmp.temas_completados
            ORDER BY
                dmp.modulo_actual DESC,
                dmp.leccion_actual DESC,
                temas_completados DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $ranking = [];
        $position = 1;
        foreach ($results as $result) {
            $ranking[] = [
                'posicion' => $position++,
                'usuario_id' => (int)$result['id'],
                'nombre' => $result['nombre'],
                'email' => $result['email'],
                'modulo_actual' => (int)$result['modulo_actual'],
                'leccion_actual' => (int)$result['leccion_actual'],
                'temas_completados' => (int)$result['temas_completados'],
                'sesiones_mentor' => (int)$result['sesiones_mentor'],
                'tiempo_mentor_horas' => round((float)$result['tiempo_mentor_minutos'] / 60, 1),
                'fecha_inicio' => $result['fecha_inicio'],
                'ultima_actualizacion' => $result['ultima_actualizacion'],
                'progreso_estimado' => calculateProgressPercentage($result)
            ];
        }

        return $ranking;
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo ranking de mentor: " . $e->getMessage()
        ];
    }
}

/**
 * Ranking por calificaciones de evaluaciones
 */
function getEvaluationScoresRanking($db, $document_id, $limit) {
    try {
        $query = "
            SELECT 
                u.id,
                u.nombre,
                u.email,
                COUNT(der.id) as total_evaluaciones,
                COUNT(CASE WHEN der.aprobado = 1 THEN 1 END) as evaluaciones_aprobadas,
                AVG(der.porcentaje_obtenido) as promedio_calificaciones,
                MAX(der.porcentaje_obtenido) as mejor_calificacion,
                MIN(der.porcentaje_obtenido) as peor_calificacion,
                AVG(der.numero_intento) as promedio_intentos,
                MAX(der.fecha_finalizacion) as ultima_evaluacion
            FROM users u
            INNER JOIN doc_evaluacion_resultados der ON u.id = der.user_id AND der.document_id = :document_id
            GROUP BY u.id, u.nombre, u.email
            ORDER BY 
                promedio_calificaciones DESC,
                evaluaciones_aprobadas DESC,
                total_evaluaciones DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $ranking = [];
        $position = 1;
        foreach ($results as $result) {
            $tasa_aprobacion = $result['total_evaluaciones'] > 0 ? 
                ($result['evaluaciones_aprobadas'] / $result['total_evaluaciones']) * 100 : 0;
                
            $ranking[] = [
                'posicion' => $position++,
                'usuario_id' => (int)$result['id'],
                'nombre' => $result['nombre'],
                'email' => $result['email'],
                'promedio_calificaciones' => round((float)$result['promedio_calificaciones'], 1),
                'mejor_calificacion' => round((float)$result['mejor_calificacion'], 1),
                'peor_calificacion' => round((float)$result['peor_calificacion'], 1),
                'total_evaluaciones' => (int)$result['total_evaluaciones'],
                'evaluaciones_aprobadas' => (int)$result['evaluaciones_aprobadas'],
                'tasa_aprobacion' => round($tasa_aprobacion, 1),
                'promedio_intentos' => round((float)$result['promedio_intentos'], 1),
                'ultima_evaluacion' => $result['ultima_evaluacion']
            ];
        }

        return $ranking;
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo ranking de evaluaciones: " . $e->getMessage()
        ];
    }
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

/**
 * Determinar modo preferido del usuario
 */
function determineModoPreferido($data) {
    $consulta = (int)$data['total_sesiones'] - (int)$data['sesiones_mentor'] - (int)$data['sesiones_evaluacion'];
    $mentor = (int)$data['sesiones_mentor'];
    $evaluacion = (int)$data['sesiones_evaluacion'];
    
    if ($mentor > $consulta && $mentor > $evaluacion) {
        return 'mentor';
    } elseif ($evaluacion > $consulta && $evaluacion > $mentor) {
        return 'evaluacion';
    } else {
        return 'consulta';
    }
}

/**
 * Calcular porcentaje estimado de progreso
 */
function calculateProgressPercentage($data) {
    // Estimación simple: cada módulo tiene 10 lecciones
    $lecciones_por_modulo = 10;
    $modulo = (int)$data['modulo_actual'];
    $leccion = (int)$data['leccion_actual'];
    $temas = (int)$data['temas_completados'];
    
    // Estimación básica de progreso
    $progreso = (($modulo - 1) * $lecciones_por_modulo + $leccion + ($temas * 0.1)) / ($lecciones_por_modulo * 5) * 100;
    
    return min(100, max(0, round($progreso, 1)));
}

/**
 * Estadísticas de Retención (Recurrentes vs Nuevos)
 */
function getUserRetentionStats($db, $document_id) {
    try {
        // Usuarios Nuevos (Su primera sesión fue en los últimos 30 días)
        $queryNuevos = "
            SELECT COUNT(DISTINCT user_id) as total
            FROM doc_conversacion_sesiones
            WHERE document_id = :document_id
            AND user_id IN (
                SELECT user_id 
                FROM doc_conversacion_sesiones 
                WHERE document_id = :document_id
                GROUP BY user_id 
                HAVING MIN(started_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            )
        ";
        
        // Usuarios Recurrentes (Tuvieron sesión en últimos 30 días Y antes de eso)
        $queryRecurrentes = "
            SELECT COUNT(DISTINCT user_id) as total
            FROM doc_conversacion_sesiones
            WHERE document_id = :document_id
            AND started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND user_id IN (
                SELECT user_id 
                FROM doc_conversacion_sesiones 
                WHERE document_id = :document_id
                GROUP BY user_id 
                HAVING MIN(started_at) < DATE_SUB(NOW(), INTERVAL 30 DAY)
            )
        ";

        $stmt = $db->prepare($queryNuevos);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $nuevos = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        $stmt = $db->prepare($queryRecurrentes);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $recurrentes = $stmt->fetch(PDO::FETCH_ASSOC)['total'];

        return [
            [
                'name' => 'Nuevos',
                'value' => (int)$nuevos,
                'color' => '#10b981' // Verde
            ],
            [
                'name' => 'Recurrentes',
                'value' => (int)$recurrentes,
                'color' => '#4f46e5' // Azul
            ]
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo retención: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener preguntas de un usuario específico
 */
function getUserQuestions($db, $document_id, $user_id, $limit = 50) {
    try {
        $query = "
            SELECT
                dcm.id,
                dcm.contenido as pregunta,
                dcm.timestamp as fecha,
                dcs.modo
            FROM doc_conversacion_mensajes dcm
            INNER JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id
            WHERE dcs.document_id = :document_id
                AND dcs.user_id = :user_id
                AND dcm.tipo = 'pregunta_usuario'
            ORDER BY dcm.timestamp DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $preguntas = [];
        foreach ($results as $result) {
            $preguntas[] = [
                'id' => (int)$result['id'],
                'pregunta' => $result['pregunta'],
                'fecha' => $result['fecha'],
                'modo' => $result['modo']
            ];
        }

        return $preguntas;

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo preguntas del usuario: " . $e->getMessage()
        ];
    }
}
?>