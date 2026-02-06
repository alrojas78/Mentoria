<?php
// /api/analytics/question-ranking.php
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
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$mode = isset($_GET['mode']) ? $_GET['mode'] : 'all'; // all, consulta, mentor, evaluacion
$type = isset($_GET['type']) ? $_GET['type'] : 'ranking'; // ranking, question_users
$question = isset($_GET['question']) ? $_GET['question'] : ''; // Para buscar usuarios de una pregunta específica

if ($document_id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "document_id es requerido"]);
    exit();
}

try {
    $response = [];

    switch ($type) {
        case 'question_users':
            if (empty($question)) {
                http_response_code(400);
                echo json_encode(["message" => "question es requerido para type=question_users"]);
                exit();
            }
            $response = getQuestionUsers($db, $document_id, $question, $mode);
            break;
        default:
            $response = getQuestionRanking($db, $document_id, $limit, $mode);
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
// FUNCIÓN PRINCIPAL
// ==========================================

/**
 * Obtener ranking de preguntas más frecuentes
 */
function getQuestionRanking($db, $document_id, $limit, $mode) {
    try {
        // Construir filtro de modo
        $modeFilter = '';
        if ($mode !== 'all') {
            $modeFilter = "AND dcm.modo_activo = :mode";
        }

        $query = "
            SELECT 
                dcm.contenido as pregunta,
                COUNT(*) as frecuencia,
                dcm.modo_activo,
                MIN(dcm.timestamp) as primera_vez,
                MAX(dcm.timestamp) as ultima_vez,
                COUNT(DISTINCT dcs.user_id) as usuarios_diferentes,
                COUNT(DISTINCT dcs.id) as sesiones_diferentes,
                AVG(CHAR_LENGTH(dcm.contenido)) as longitud_promedio
            FROM doc_conversacion_mensajes dcm
            INNER JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id
            WHERE dcs.document_id = :document_id
            AND dcm.tipo = 'pregunta_usuario'
            AND CHAR_LENGTH(dcm.contenido) >= 10
            $modeFilter
            GROUP BY dcm.contenido, dcm.modo_activo
            HAVING frecuencia >= 2
            ORDER BY frecuencia DESC, usuarios_diferentes DESC
            LIMIT :limit
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
        
        if ($mode !== 'all') {
            $stmt->bindParam(':mode', $mode);
        }
        
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Procesar resultados
        $ranking = [];
        $position = 1;
        
        foreach ($results as $result) {
            $ranking[] = [
                'posicion' => $position++,
                'pregunta' => trim($result['pregunta']),
                'frecuencia' => (int)$result['frecuencia'],
                'modo_activo' => $result['modo_activo'],
                'primera_vez' => $result['primera_vez'],
                'ultima_vez' => $result['ultima_vez'],
                'usuarios_diferentes' => (int)$result['usuarios_diferentes'],
                'sesiones_diferentes' => (int)$result['sesiones_diferentes'],
                'longitud_promedio' => round((float)$result['longitud_promedio'], 0),
                'popularidad' => calculatePopularity($result),
                'categoria' => categorizeQuestion($result['pregunta'])
            ];
        }

        // Estadísticas adicionales
        $totalQuestions = getTotalQuestions($db, $document_id, $mode);
        $uniqueQuestions = count($ranking);
        
        return [
            'ranking' => $ranking,
            'estadisticas' => [
                'total_preguntas' => $totalQuestions,
                'preguntas_unicas' => $uniqueQuestions,
                'preguntas_repetidas' => $uniqueQuestions,
                'modo_filtro' => $mode,
                'ultima_actualizacion' => date('Y-m-d H:i:s')
            ]
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo ranking de preguntas: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener usuarios que hicieron una pregunta específica
 */
function getQuestionUsers($db, $document_id, $question, $mode) {
    try {
        // Construir filtro de modo
        $modeFilter = '';
        if ($mode !== 'all') {
            $modeFilter = "AND dcm.modo_activo = :mode";
        }

        $query = "
            SELECT 
                u.id as user_id,
                u.nombre as nombre,
                u.email as email,
                dcm.timestamp as fecha_pregunta,
                dcm.modo_activo,
                dcs.id as session_id
            FROM doc_conversacion_mensajes dcm
            INNER JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id
            INNER JOIN users u ON dcs.user_id = u.id
            WHERE dcs.document_id = :document_id
            AND dcm.tipo = 'pregunta_usuario'
            AND dcm.contenido = :question
            $modeFilter
            ORDER BY dcm.timestamp DESC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':question', $question);
        
        if ($mode !== 'all') {
            $stmt->bindParam(':mode', $mode);
        }
        
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Agrupar por usuario con lista de fechas
        $usersMap = [];
        foreach ($results as $result) {
            $userId = $result['user_id'];
            if (!isset($usersMap[$userId])) {
                $usersMap[$userId] = [
                    'user_id' => (int)$userId,
                    'nombre' => $result['nombre'],
                    'email' => $result['email'],
                    'veces_preguntado' => 0,
                    'fechas' => []
                ];
            }
            $usersMap[$userId]['veces_preguntado']++;
            $usersMap[$userId]['fechas'][] = [
                'fecha' => $result['fecha_pregunta'],
                'modo' => $result['modo_activo'],
                'session_id' => (int)$result['session_id']
            ];
        }

        // Convertir a array indexado
        $users = array_values($usersMap);

        // Ordenar por veces preguntado (descendente)
        usort($users, function($a, $b) {
            return $b['veces_preguntado'] - $a['veces_preguntado'];
        });

        return [
            'pregunta' => $question,
            'total_usuarios' => count($users),
            'total_veces' => count($results),
            'usuarios' => $users
        ];
        
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo usuarios de la pregunta: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener total de preguntas
 */
function getTotalQuestions($db, $document_id, $mode) {
    try {
        $modeFilter = '';
        if ($mode !== 'all') {
            $modeFilter = "AND dcm.modo_activo = :mode";
        }

        $query = "
            SELECT COUNT(*) as total
            FROM doc_conversacion_mensajes dcm
            INNER JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id
            WHERE dcs.document_id = :document_id
            AND dcm.tipo = 'pregunta_usuario'
            $modeFilter
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        
        if ($mode !== 'all') {
            $stmt->bindParam(':mode', $mode);
        }
        
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        return (int)$result['total'];
        
    } catch (Exception $e) {
        return 0;
    }
}

/**
 * Calcular popularidad (score compuesto)
 */
function calculatePopularity($data) {
    $frecuencia = (int)$data['frecuencia'];
    $usuarios = (int)$data['usuarios_diferentes'];
    $sesiones = (int)$data['sesiones_diferentes'];
    
    // Score basado en frecuencia, diversidad de usuarios y sesiones
    $score = ($frecuencia * 0.5) + ($usuarios * 0.3) + ($sesiones * 0.2);
    
    return round($score, 2);
}

/**
 * Categorizar pregunta basándose en palabras clave
 */
function categorizeQuestion($pregunta) {
    $pregunta_lower = strtolower($pregunta);
    
    // Definir categorías y palabras clave
    $categorias = [
        'Definiciones' => ['qué es', 'que es', 'define', 'definir', 'significa', 'concepto'],
        'Procedimientos' => ['cómo', 'como', 'pasos', 'proceso', 'hacer', 'realizar'],
        'Comparaciones' => ['diferencia', 'comparar', 'versus', 'vs', 'mejor', 'peor'],
        'Causas' => ['por qué', 'porque', 'causa', 'razón', 'motivo', 'origina'],
        'Síntomas' => ['síntoma', 'sintoma', 'señal', 'manifestación', 'presenta'],
        'Tratamiento' => ['tratamiento', 'terapia', 'medicamento', 'medicina', 'cura', 'tratar'],
        'Prevención' => ['prevenir', 'evitar', 'prevención', 'cuidado', 'proteger'],
        'Efectos' => ['efecto', 'consecuencia', 'resultado', 'impacto', 'produce']
    ];
    
    foreach ($categorias as $categoria => $palabras) {
        foreach ($palabras as $palabra) {
            if (strpos($pregunta_lower, $palabra) !== false) {
                return $categoria;
            }
        }
    }
    
    return 'General';
}

?>
