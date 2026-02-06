<?php
// /api/analytics/evaluation-analytics.php
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
            $response = getEvaluationOverview($db, $document_id);
            break;
        case 'score_distribution':
            $response = getScoreDistribution($db, $document_id);
            break;
        case 'performance_trends':
            $response = getPerformanceTrends($db, $document_id);
            break;
        case 'attempts_analysis':
            $response = getAttemptsAnalysis($db, $document_id);
            break;
        case 'time_analysis':
            $response = getTimeAnalysis($db, $document_id);
            break;
        case 'item_analysis': // <--- AGREGAR ESTO
            $response = getItemDifficultyAnalysis($db, $document_id);
            break;
        default:
            $response = getEvaluationOverview($db, $document_id);
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
// FUNCIONES DE ANÁLISIS DE EVALUACIONES
// ==========================================

/**
 * Obtener resumen general de evaluaciones
 */
function getEvaluationOverview($db, $document_id) {
    try {
        // Estadísticas generales
        $query = "
            SELECT 
                COUNT(*) as total_evaluaciones,
                COUNT(DISTINCT user_id) as usuarios_evaluados,
                COUNT(CASE WHEN aprobado = 1 THEN 1 END) as evaluaciones_aprobadas,
                AVG(porcentaje_obtenido) as promedio_general,
                MAX(porcentaje_obtenido) as mejor_calificacion,
                MIN(porcentaje_obtenido) as peor_calificacion,
                AVG(numero_intento) as promedio_intentos,
                AVG(duracion_minutos) as duracion_promedio
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $overview = $stmt->fetch(PDO::FETCH_ASSOC);

        // Configuración de evaluación
        $query = "
            SELECT 
                preguntas_por_evaluacion,
                porcentaje_aprobacion,
                max_intentos,
                tiene_certificado
            FROM doc_evaluacion_configuracion
            WHERE document_id = :document_id
            LIMIT 1
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        // Evaluaciones recientes (últimos 7 días)
        $query = "
            SELECT COUNT(*) as evaluaciones_recientes
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            AND fecha_inicio >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $recent = $stmt->fetch(PDO::FETCH_ASSOC);

        $total = (int)$overview['total_evaluaciones'];
        $aprobadas = (int)$overview['evaluaciones_aprobadas'];
        $tasa_aprobacion = $total > 0 ? ($aprobadas / $total) * 100 : 0;

        // Observaciones de IA recientes
        $query = "
            SELECT 
                u.nombre,
                der.observaciones_ia,
                der.porcentaje_obtenido,
                der.aprobado,
                der.fecha_finalizacion
            FROM doc_evaluacion_resultados der
            INNER JOIN users u ON der.user_id = u.id
            WHERE der.document_id = :document_id
            AND der.observaciones_ia IS NOT NULL
            AND der.observaciones_ia != ''
            ORDER BY der.fecha_finalizacion DESC
            LIMIT 10
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $observaciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
    'overview' => [
        'total_evaluaciones' => $total,
        'usuarios_evaluados' => (int)$overview['usuarios_evaluados'],
        'evaluaciones_aprobadas' => $aprobadas,
        'tasa_aprobacion' => round($tasa_aprobacion, 1),
        'promedio_general' => round((float)$overview['promedio_general'], 1),
        'mejor_calificacion' => round((float)$overview['mejor_calificacion'], 1),
        'peor_calificacion' => round((float)$overview['peor_calificacion'], 1),
        'promedio_intentos' => round((float)$overview['promedio_intentos'], 1),
        'duracion_promedio' => round((float)$overview['duracion_promedio'], 1),
        'evaluaciones_recientes' => (int)$recent['evaluaciones_recientes'],
        'observaciones_ia' => array_map(function($row) {
            return [
                'usuario' => $row['nombre'],
                'observacion' => $row['observaciones_ia'],
                'calificacion' => round((float)$row['porcentaje_obtenido'], 1),
                'aprobado' => (bool)$row['aprobado'],
                'fecha' => $row['fecha_finalizacion']
            ];
        }, $observaciones)
    ],
    'configuracion' => [
        'preguntas_por_evaluacion' => (int)($config['preguntas_por_evaluacion'] ?? 10),
        'porcentaje_aprobacion' => (float)($config['porcentaje_aprobacion'] ?? 60),
        'max_intentos' => (int)($config['max_intentos'] ?? 3),
        'tiene_certificado' => (bool)($config['tiene_certificado'] ?? false)
    ]
];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo overview de evaluaciones: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener distribución de calificaciones
 */
function getScoreDistribution($db, $document_id) {
    try {
        $query = "
            SELECT 
                CASE 
                    WHEN porcentaje_obtenido >= 90 THEN '90-100%'
                    WHEN porcentaje_obtenido >= 80 THEN '80-89%'
                    WHEN porcentaje_obtenido >= 70 THEN '70-79%'
                    WHEN porcentaje_obtenido >= 60 THEN '60-69%'
                    WHEN porcentaje_obtenido >= 50 THEN '50-59%'
                    ELSE '0-49%'
                END as rango_calificacion,
                COUNT(*) as cantidad,
                AVG(porcentaje_obtenido) as promedio_rango
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            GROUP BY rango_calificacion
            ORDER BY promedio_rango DESC
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $distribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Distribución por aprobado/reprobado
        $query = "
            SELECT 
                CASE WHEN aprobado = 1 THEN 'Aprobado' ELSE 'Reprobado' END as estado,
                COUNT(*) as cantidad,
                AVG(porcentaje_obtenido) as promedio
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            GROUP BY aprobado
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $passFailData = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'score_ranges' => array_map(function($row) {
                return [
                    'rango' => $row['rango_calificacion'],
                    'cantidad' => (int)$row['cantidad'],
                    'promedio' => round((float)$row['promedio_rango'], 1)
                ];
            }, $distribution),
            'pass_fail' => array_map(function($row) {
                return [
                    'estado' => $row['estado'],
                    'cantidad' => (int)$row['cantidad'],
                    'promedio' => round((float)$row['promedio'], 1)
                ];
            }, $passFailData)
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo distribución de calificaciones: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener tendencias de rendimiento
 */
function getPerformanceTrends($db, $document_id) {
    try {
        $query = "
            SELECT 
                DATE(fecha_inicio) as fecha,
                COUNT(*) as total_evaluaciones,
                COUNT(CASE WHEN aprobado = 1 THEN 1 END) as aprobadas,
                AVG(porcentaje_obtenido) as promedio_dia,
                AVG(duracion_minutos) as duracion_promedio
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            AND fecha_inicio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(fecha_inicio)
            ORDER BY fecha ASC
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $trends = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($row) {
            $total = (int)$row['total_evaluaciones'];
            $aprobadas = (int)$row['aprobadas'];
            $tasa = $total > 0 ? ($aprobadas / $total) * 100 : 0;
            
            return [
                'fecha' => $row['fecha'],
                'total_evaluaciones' => $total,
                'aprobadas' => $aprobadas,
                'tasa_aprobacion' => round($tasa, 1),
                'promedio_dia' => round((float)$row['promedio_dia'], 1),
                'duracion_promedio' => round((float)$row['duracion_promedio'], 1)
            ];
        }, $trends);
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo tendencias: " . $e->getMessage()
        ];
    }
}

/**
 * Análisis de intentos
 */
function getAttemptsAnalysis($db, $document_id) {
    try {
        $query = "
            SELECT 
                numero_intento,
                COUNT(*) as cantidad,
                COUNT(CASE WHEN aprobado = 1 THEN 1 END) as aprobados,
                AVG(porcentaje_obtenido) as promedio_calificacion
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            GROUP BY numero_intento
            ORDER BY numero_intento
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $attempts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Usuarios que necesitaron múltiples intentos
        $query = "
            SELECT 
                user_id,
                COUNT(*) as total_intentos,
                MAX(porcentaje_obtenido) as mejor_calificacion,
                COUNT(CASE WHEN aprobado = 1 THEN 1 END) as intentos_aprobados
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            GROUP BY user_id
            HAVING total_intentos > 1
            ORDER BY total_intentos DESC
            LIMIT 10
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $multipleAttempts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'attempts_distribution' => array_map(function($row) {
                $total = (int)$row['cantidad'];
                $aprobados = (int)$row['aprobados'];
                $tasa = $total > 0 ? ($aprobados / $total) * 100 : 0;
                
                return [
                    'intento' => (int)$row['numero_intento'],
                    'cantidad' => $total,
                    'aprobados' => $aprobados,
                    'tasa_aprobacion' => round($tasa, 1),
                    'promedio_calificacion' => round((float)$row['promedio_calificacion'], 1)
                ];
            }, $attempts),
            'multiple_attempts' => array_map(function($row) {
                return [
                    'user_id' => (int)$row['user_id'],
                    'total_intentos' => (int)$row['total_intentos'],
                    'mejor_calificacion' => round((float)$row['mejor_calificacion'], 1),
                    'intentos_aprobados' => (int)$row['intentos_aprobados']
                ];
            }, $multipleAttempts)
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo análisis de intentos: " . $e->getMessage()
        ];
    }
}

/**
 * Análisis de tiempo
 */
function getTimeAnalysis($db, $document_id) {
    try {
        $query = "
            SELECT 
                CASE 
                    WHEN duracion_minutos <= 5 THEN '0-5 min'
                    WHEN duracion_minutos <= 10 THEN '6-10 min'
                    WHEN duracion_minutos <= 15 THEN '11-15 min'
                    WHEN duracion_minutos <= 20 THEN '16-20 min'
                    ELSE 'Más de 20 min'
                END as rango_tiempo,
                COUNT(*) as cantidad,
                AVG(porcentaje_obtenido) as promedio_calificacion,
                COUNT(CASE WHEN aprobado = 1 THEN 1 END) as aprobados
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            AND duracion_minutos > 0
            GROUP BY rango_tiempo
            ORDER BY AVG(duracion_minutos)
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $timeRanges = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($row) {
            $total = (int)$row['cantidad'];
            $aprobados = (int)$row['aprobados'];
            $tasa = $total > 0 ? ($aprobados / $total) * 100 : 0;
            
            return [
                'rango_tiempo' => $row['rango_tiempo'],
                'cantidad' => $total,
                'promedio_calificacion' => round((float)$row['promedio_calificacion'], 1),
                'aprobados' => $aprobados,
                'tasa_aprobacion' => round($tasa, 1)
            ];
        }, $timeRanges);
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo análisis de tiempo: " . $e->getMessage()
        ];
    }
}

/**
 * Análisis de dificultad de preguntas (Item Analysis) - CORREGIDO JSON
 */
function getItemDifficultyAnalysis($db, $document_id) {
    try {
        $query = "
            SELECT detalle_respuestas
            FROM doc_evaluacion_resultados
            WHERE document_id = :document_id
            AND detalle_respuestas IS NOT NULL
        ";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stats = [];

        foreach ($rows as $row) {
            $jsonCompleto = json_decode($row['detalle_respuestas'], true);
            
            // 1. DETECTAR DÓNDE ESTÁN LAS PREGUNTAS
            // En tu estructura, parece estar dentro de 'pool_preguntas'
            $listaItems = [];
            
            if (isset($jsonCompleto['pool_preguntas']) && is_array($jsonCompleto['pool_preguntas']) && count($jsonCompleto['pool_preguntas']) > 0) {
                $listaItems = $jsonCompleto['pool_preguntas'];
            } elseif (isset($jsonCompleto['respuestas']) && is_array($jsonCompleto['respuestas']) && count($jsonCompleto['respuestas']) > 0) {
                // Fallback por si en versiones viejas se guardaba aquí
                $listaItems = $jsonCompleto['respuestas'];
            } elseif (is_array($jsonCompleto) && isset($jsonCompleto[0])) {
                // Fallback por si es un array plano directo
                $listaItems = $jsonCompleto;
            }

            // 2. RECORRER LA LISTA REAL DE ÍTEMS
            foreach ($listaItems as $index => $item) {
                
                // Intentar obtener un nombre legible para la pregunta
                // Buscamos 'enunciado', 'pregunta', 'texto' o usamos el ID
// Intentar obtener un nombre legible para la pregunta
$nombrePregunta = "Pregunta " . ($index + 1);

if (!empty($item['enunciado'])) {
    // ANTES: mb_strimwidth($item['enunciado'], 0, 40, "...");  <-- ESTO CORTABA MUCHO
    // AHORA: Aumentamos a 150 caracteres para enviar el texto completo
    $nombrePregunta = mb_strimwidth($item['enunciado'], 0, 150, "..."); 
} elseif (!empty($item['pregunta'])) {
    $nombrePregunta = mb_strimwidth($item['pregunta'], 0, 150, "...");
} elseif (isset($item['id'])) {
    $nombrePregunta = "Pregunta ID " . $item['id'];
}

                if (!isset($stats[$nombrePregunta])) {
                    $stats[$nombrePregunta] = ['total' => 0, 'errores' => 0];
                }
                
                $stats[$nombrePregunta]['total']++;
                
                // 3. DETERMINAR SI ES CORRECTA
                // Buscamos banderas comunes de éxito
                $esCorrecta = false;
                
                // Opción A: Tiene campo 'es_correcta' o 'correcta' explícito
                if (isset($item['es_correcta']) && $item['es_correcta'] == true) $esCorrecta = true;
                if (isset($item['correcta']) && $item['correcta'] == true) $esCorrecta = true;
                
                // Opción B: Tiene puntos asignados (mayor a 0)
                if (isset($item['puntos']) && $item['puntos'] > 0) $esCorrecta = true;
                if (isset($item['score']) && $item['score'] > 0) $esCorrecta = true;
                
                // Opción C: Comparar respuesta usuario vs correcta (si existen esos campos)
                if (isset($item['respuesta_usuario']) && isset($item['respuesta_correcta'])) {
                    if ($item['respuesta_usuario'] == $item['respuesta_correcta']) $esCorrecta = true;
                }

                if (!$esCorrecta) {
                    $stats[$nombrePregunta]['errores']++;
                }
            }
        }

        // Formatear para el gráfico
        $output = [];
        foreach ($stats as $pregunta => $data) {
            if ($data['total'] > 0) {
                $tasaError = ($data['errores'] / $data['total']) * 100;
                $output[] = [
                    'pregunta' => $pregunta,
                    'tasa_error' => round($tasaError, 1),
                    'total_intentos' => $data['total']
                ];
            }
        }

        // Ordenar por las más difíciles (mayor tasa de error)
        usort($output, function($a, $b) {
            return $b['tasa_error'] <=> $a['tasa_error'];
        });

        return array_slice($output, 0, 10);
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error en análisis de ítems: " . $e->getMessage()
        ];
    }
}

?>