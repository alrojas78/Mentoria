<?php
// backend/api/analytics/dashboard-data.php

// Headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Para preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos de configuración
include_once '../../config/db.php';

// Verificar parámetros requeridos
if (!isset($_GET['document_id']) || !isset($_GET['type'])) {
    http_response_code(400);
    echo json_encode([
        "error" => true,
        "message" => "Parámetros requeridos: document_id y type"
    ]);
    exit();
}

$document_id = intval($_GET['document_id']);
$type = $_GET['type'];

// Crear conexión a base de datos
try {
    $database = new Database();
    $db = $database->getConnection();
    
    switch ($type) {
        case 'check_enabled':
            echo json_encode(checkAnalyticsEnabled($db, $document_id));
            break;
            
        case 'metrics':
            echo json_encode(getDocumentMetrics($db, $document_id));
            break;
            
        case 'user_activity':
            $period = isset($_GET['period']) ? $_GET['period'] : '30d';
            echo json_encode(getUserActivity($db, $document_id, $period));
            break;
            
        case 'question_ranking':
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
            echo json_encode(getQuestionRanking($db, $document_id, $limit));
            break;
            
        case 'mentor_progress':
            echo json_encode(getMentorProgress($db, $document_id));
            break;
            
        case 'evaluation_results':
            echo json_encode(getEvaluationResults($db, $document_id));
            break;
            
        default:
            http_response_code(400);
            echo json_encode([
                "error" => true,
                "message" => "Tipo de consulta no válido: $type"
            ]);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error de servidor: " . $e->getMessage()
    ]);
}

// ==========================================
// FUNCIONES DE DATOS
// ==========================================

/**
 * Verificar si las analíticas están habilitadas para un documento
 */
function checkAnalyticsEnabled($db, $document_id) {
    try {
        $query = "SELECT analytics_enabled FROM documentos WHERE id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            return [
                "enabled" => false,
                "error" => "Documento no encontrado"
            ];
        }
        
        return [
            "enabled" => (bool)$result['analytics_enabled']
        ];
        
    } catch (Exception $e) {
        return [
            "enabled" => false,
            "error" => "Error de base de datos: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener métricas generales del documento
 */
function getDocumentMetrics($db, $document_id) {
    try {
        // 1. Usuarios únicos
        $query = "SELECT COUNT(DISTINCT user_id) as count FROM doc_conversacion_sesiones WHERE document_id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $usuarios_unicos = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

        // 2. Sesiones totales
        $query = "SELECT COUNT(*) as count FROM doc_conversacion_sesiones WHERE document_id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $sesiones_totales = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

        // 3. Total de mensajes (todos los mensajes)
        $query = "SELECT COUNT(*) as count 
                  FROM doc_conversacion_mensajes dcm 
                  JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id 
                  WHERE dcs.document_id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $total_mensajes = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

        // 4. Solo preguntas de usuarios (tipo = pregunta_usuario)
        $query = "SELECT COUNT(*) as count 
                  FROM doc_conversacion_mensajes dcm 
                  JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id 
                  WHERE dcs.document_id = :document_id AND dcm.tipo = 'pregunta_usuario'";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $total_preguntas = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

        // 5. Tiempo promedio de sesión (en minutos)
        $query = "SELECT AVG(duracion_minutos) as promedio
                  FROM doc_conversacion_sesiones 
                  WHERE document_id = :document_id AND duracion_minutos > 0";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $tiempo_promedio_result = $stmt->fetch(PDO::FETCH_ASSOC);
        $tiempo_promedio_sesion = $tiempo_promedio_result['promedio'] ?? 0;

        // 6. Usuarios en modo mentor
        $query = "SELECT COUNT(DISTINCT user_id) as count 
                  FROM doc_mentor_progreso 
                  WHERE document_id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $usuarios_mentor = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

        // 7. Total evaluaciones
        $query = "SELECT COUNT(*) as count 
                  FROM doc_evaluacion_resultados 
                  WHERE document_id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $total_evaluaciones = $stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;

        // 8. Tasa de aprobación de evaluaciones
        $query = "SELECT 
                    COUNT(*) as total_intentos,
                    SUM(CASE WHEN aprobado = 1 THEN 1 ELSE 0 END) as aprobados
                  FROM doc_evaluacion_resultados 
                  WHERE document_id = :document_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $evaluacion_stats = $stmt->fetch(PDO::FETCH_ASSOC);
        $total_intentos = $evaluacion_stats['total_intentos'] ?? 0;
        $aprobados = $evaluacion_stats['aprobados'] ?? 0;
        $tasa_aprobacion = $total_intentos > 0 ? ($aprobados / $total_intentos) * 100 : 0;

        // 9. Puntuación promedio de evaluaciones
        $query = "SELECT AVG(porcentaje_obtenido) as promedio 
                  FROM doc_evaluacion_resultados 
                  WHERE document_id = :document_id AND porcentaje_obtenido > 0";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $puntuacion_result = $stmt->fetch(PDO::FETCH_ASSOC);
        $puntuacion_promedio = $puntuacion_result['promedio'] ?? 0;

        return [
            "usuarios_unicos" => intval($usuarios_unicos),
            "sesiones_totales" => intval($sesiones_totales),
            "total_preguntas" => intval($total_preguntas),
            "total_mensajes" => intval($total_mensajes),
            "tiempo_promedio_sesion" => round(floatval($tiempo_promedio_sesion), 2),
            "usuarios_mentor" => intval($usuarios_mentor),
            "total_evaluaciones" => intval($total_evaluaciones),
            "tasa_aprobacion" => round(floatval($tasa_aprobacion), 2),
            "puntuacion_promedio" => round(floatval($puntuacion_promedio), 2)
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo métricas: " . $e->getMessage(),
            "query_error" => $e->getTraceAsString()
        ];
    }
}

/**
 * Obtener actividad de usuarios (datos reales)
 */
function getUserActivity($db, $document_id, $period) {
    try {
        $days = 30;
        if ($period === '7d') $days = 7;
        elseif ($period === '90d') $days = 90;
        elseif ($period === '365d') $days = 365;

        $query = "
            SELECT
                DATE(dcs.started_at) as fecha,
                COUNT(DISTINCT dcs.user_id) as usuarios_activos,
                COUNT(DISTINCT dcs.id) as sesiones,
                COALESCE(SUM(CASE WHEN dcm.tipo = 'pregunta_usuario' THEN 1 ELSE 0 END), 0) as preguntas
            FROM doc_conversacion_sesiones dcs
            LEFT JOIN doc_conversacion_mensajes dcm ON dcm.session_id = dcs.id
            WHERE dcs.document_id = :document_id
            AND dcs.started_at >= DATE_SUB(NOW(), INTERVAL $days DAY)
            GROUP BY DATE(dcs.started_at)
            ORDER BY fecha ASC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($row) {
            return [
                "fecha" => $row['fecha'],
                "usuarios_activos" => (int)$row['usuarios_activos'],
                "sesiones" => (int)$row['sesiones'],
                "preguntas" => (int)$row['preguntas']
            ];
        }, $results);

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo actividad: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener ranking de preguntas (datos reales)
 */
function getQuestionRanking($db, $document_id, $limit) {
    try {
        $query = "
            SELECT
                dcm.contenido as pregunta,
                COUNT(*) as frecuencia,
                MIN(dcm.timestamp) as primera_vez,
                MAX(dcm.timestamp) as ultima_vez,
                COUNT(DISTINCT dcs.user_id) as usuarios_diferentes
            FROM doc_conversacion_mensajes dcm
            INNER JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id
            WHERE dcs.document_id = :document_id
            AND dcm.tipo = 'pregunta_usuario'
            AND CHAR_LENGTH(dcm.contenido) >= 10
            GROUP BY dcm.contenido
            ORDER BY frecuencia DESC, usuarios_diferentes DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($row) {
            return [
                "pregunta" => trim($row['pregunta']),
                "frecuencia" => (int)$row['frecuencia'],
                "primera_vez" => $row['primera_vez'],
                "ultima_vez" => $row['ultima_vez'],
                "usuarios_diferentes" => (int)$row['usuarios_diferentes']
            ];
        }, $results);

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo ranking: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener progreso modo mentor (datos reales)
 */
function getMentorProgress($db, $document_id) {
    try {
        $query = "
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN estado = 'completado' THEN 1 ELSE 0 END) as completados,
                SUM(CASE WHEN estado = 'en_progreso' THEN 1 ELSE 0 END) as en_progreso,
                SUM(CASE WHEN estado = 'iniciado' THEN 1 ELSE 0 END) as iniciados
            FROM doc_mentor_progreso
            WHERE document_id = :document_id
        ";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            [
                "total_usuarios" => (int)($row['total'] ?? 0),
                "en_progreso" => (int)($row['en_progreso'] ?? 0) + (int)($row['iniciados'] ?? 0),
                "completados" => (int)($row['completados'] ?? 0)
            ]
        ];
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo progreso mentor: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener resultados evaluaciones (datos reales)
 */
function getEvaluationResults($db, $document_id) {
    try {
        $query = "
            SELECT
                COUNT(*) as total_evaluaciones,
                SUM(CASE WHEN aprobado = 1 THEN 1 ELSE 0 END) as aprobados,
                SUM(CASE WHEN aprobado = 0 THEN 1 ELSE 0 END) as reprobados,
                COALESCE(AVG(porcentaje_obtenido), 0) as promedio
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
        ";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            [
                "fecha" => date('Y-m-d'),
                "total_evaluaciones" => (int)($row['total_evaluaciones'] ?? 0),
                "aprobados" => (int)($row['aprobados'] ?? 0),
                "reprobados" => (int)($row['reprobados'] ?? 0),
                "promedio" => round((float)($row['promedio'] ?? 0), 2)
            ]
        ];
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo resultados evaluaciones: " . $e->getMessage()
        ];
    }
}

?>