<?php
// /api/analytics/time-analytics.php
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

// Verificar autenticacion
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
    echo json_encode(["message" => "Metodo no permitido"]);
    exit();
}

// Obtener parametros
$document_id = isset($_GET['document_id']) ? (int)$_GET['document_id'] : 0;
$type = isset($_GET['type']) ? $_GET['type'] : 'daily';
$period = isset($_GET['period']) ? $_GET['period'] : '7days';

if ($document_id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "document_id es requerido"]);
    exit();
}

try {
    $response = [];

    switch ($type) {
        case 'activity_data':
            $response = getActivityData($db, $document_id, $period);
            break;
        case 'hourly':
            $response = getHourlyActivity($db, $document_id);
            break;
        case 'weekly':
            $response = getWeeklyActivity($db, $document_id);
            break;
        case 'monthly':
            $response = getMonthlyActivity($db, $document_id);
            break;
        case 'heatmap':
            $response = getHeatmapData($db, $document_id);
            break;
        default:
            $response = getActivityData($db, $document_id, $period);
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
// FUNCIONES DE DATOS REALES
// ==========================================

function getActivityData($db, $document_id, $period) {
    try {
        switch ($period) {
            case '24h':
                return getHourlyActivity($db, $document_id);
            case '7days':
                return getDailyActivity($db, $document_id, 7);
            case '30days':
                return getDailyActivity($db, $document_id, 30);
            case '90days':
                return getWeeklyActivity($db, $document_id, 12);
            default:
                return getDailyActivity($db, $document_id, 7);
        }
    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo datos de actividad: " . $e->getMessage()
        ];
    }
}

function getHourlyActivity($db, $document_id) {
    try {
        $query = "
            SELECT
                HOUR(dcs.started_at) as hora,
                COUNT(DISTINCT dcs.id) as sesiones,
                COUNT(DISTINCT dcs.user_id) as usuarios,
                COUNT(dcm.id) as mensajes,
                COALESCE(AVG(dcs.duracion_minutos), 0) as duracion_promedio
            FROM doc_conversacion_sesiones dcs
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            WHERE dcs.document_id = :document_id
            AND dcs.started_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY HOUR(dcs.started_at)
            ORDER BY hora ASC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        for ($i = 0; $i < 24; $i++) {
            $found = false;
            foreach ($results as $result) {
                if ((int)$result['hora'] === $i) {
                    $data[] = [
                        'time' => str_pad($i, 2, '0', STR_PAD_LEFT) . ':00',
                        'sesiones' => (int)$result['sesiones'],
                        'usuarios' => (int)$result['usuarios'],
                        'mensajes' => (int)$result['mensajes'],
                        'duracion_promedio' => round((float)$result['duracion_promedio'], 1)
                    ];
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $data[] = [
                    'time' => str_pad($i, 2, '0', STR_PAD_LEFT) . ':00',
                    'sesiones' => 0,
                    'usuarios' => 0,
                    'mensajes' => 0,
                    'duracion_promedio' => 0
                ];
            }
        }

        return $data;

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo actividad por hora: " . $e->getMessage()
        ];
    }
}

function getDailyActivity($db, $document_id, $days = 7) {
    try {
        $query = "
            SELECT
                DATE(dcs.started_at) as fecha,
                DAYNAME(dcs.started_at) as dia_nombre,
                DAY(dcs.started_at) as dia,
                MONTH(dcs.started_at) as mes,
                COUNT(DISTINCT dcs.id) as sesiones,
                COUNT(DISTINCT dcs.user_id) as usuarios,
                COUNT(dcm.id) as mensajes,
                COALESCE(AVG(dcs.duracion_minutos), 0) as duracion_promedio
            FROM doc_conversacion_sesiones dcs
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            WHERE dcs.document_id = :document_id
            AND dcs.started_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
            GROUP BY DATE(dcs.started_at)
            ORDER BY fecha ASC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':days', $days);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = date('Y-m-d', strtotime("-{$i} days"));
            $found = false;

            foreach ($results as $result) {
                if ($result['fecha'] === $date) {
                    $timeLabel = '';
                    if ($days <= 7) {
                        $dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
                        $timeLabel = $dayNames[date('w', strtotime($date))];
                    } else {
                        $timeLabel = date('j/n', strtotime($date));
                    }

                    $data[] = [
                        'time' => $timeLabel,
                        'sesiones' => (int)$result['sesiones'],
                        'usuarios' => (int)$result['usuarios'],
                        'mensajes' => (int)$result['mensajes'],
                        'duracion_promedio' => round((float)$result['duracion_promedio'], 1)
                    ];
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                $timeLabel = '';
                if ($days <= 7) {
                    $dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
                    $timeLabel = $dayNames[date('w', strtotime($date))];
                } else {
                    $timeLabel = date('j/n', strtotime($date));
                }

                $data[] = [
                    'time' => $timeLabel,
                    'sesiones' => 0,
                    'usuarios' => 0,
                    'mensajes' => 0,
                    'duracion_promedio' => 0
                ];
            }
        }

        return $data;

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo actividad diaria: " . $e->getMessage()
        ];
    }
}

function getWeeklyActivity($db, $document_id, $weeks = 12) {
    try {
        $query = "
            SELECT
                YEARWEEK(dcs.started_at, 1) as semana_year,
                WEEK(dcs.started_at, 1) as semana,
                COUNT(DISTINCT dcs.id) as sesiones,
                COUNT(DISTINCT dcs.user_id) as usuarios,
                COUNT(dcm.id) as mensajes,
                COALESCE(AVG(dcs.duracion_minutos), 0) as duracion_promedio
            FROM doc_conversacion_sesiones dcs
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            WHERE dcs.document_id = :document_id
            AND dcs.started_at >= DATE_SUB(NOW(), INTERVAL :weeks WEEK)
            GROUP BY YEARWEEK(dcs.started_at, 1)
            ORDER BY semana_year ASC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':weeks', $weeks);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        for ($i = $weeks - 1; $i >= 0; $i--) {
            $weekStart = date('Y-m-d', strtotime("-{$i} weeks"));
            $weekNumber = date('W', strtotime($weekStart));
            $found = false;

            foreach ($results as $result) {
                if ((int)$result['semana'] === (int)$weekNumber) {
                    $data[] = [
                        'time' => 'Sem ' . $weekNumber,
                        'sesiones' => (int)$result['sesiones'],
                        'usuarios' => (int)$result['usuarios'],
                        'mensajes' => (int)$result['mensajes'],
                        'duracion_promedio' => round((float)$result['duracion_promedio'], 1)
                    ];
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                $data[] = [
                    'time' => 'Sem ' . $weekNumber,
                    'sesiones' => 0,
                    'usuarios' => 0,
                    'mensajes' => 0,
                    'duracion_promedio' => 0
                ];
            }
        }

        return $data;

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo actividad semanal: " . $e->getMessage()
        ];
    }
}

function getMonthlyActivity($db, $document_id) {
    try {
        $query = "
            SELECT
                YEAR(dcs.started_at) as anio,
                MONTH(dcs.started_at) as mes,
                MONTHNAME(dcs.started_at) as mes_nombre,
                COUNT(DISTINCT dcs.id) as sesiones,
                COUNT(DISTINCT dcs.user_id) as usuarios,
                COUNT(dcm.id) as mensajes,
                COALESCE(AVG(dcs.duracion_minutos), 0) as duracion_promedio
            FROM doc_conversacion_sesiones dcs
            LEFT JOIN doc_conversacion_mensajes dcm ON dcs.id = dcm.session_id
            WHERE dcs.document_id = :document_id
            AND dcs.started_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY YEAR(dcs.started_at), MONTH(dcs.started_at)
            ORDER BY anio ASC, mes ASC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        foreach ($results as $result) {
            $monthNames = [
                1 => 'Ene', 2 => 'Feb', 3 => 'Mar', 4 => 'Abr',
                5 => 'May', 6 => 'Jun', 7 => 'Jul', 8 => 'Ago',
                9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dic'
            ];

            $data[] = [
                'time' => $monthNames[(int)$result['mes']],
                'sesiones' => (int)$result['sesiones'],
                'usuarios' => (int)$result['usuarios'],
                'mensajes' => (int)$result['mensajes'],
                'duracion_promedio' => round((float)$result['duracion_promedio'], 1)
            ];
        }

        return $data;

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo actividad mensual: " . $e->getMessage()
        ];
    }
}

/**
 * Obtener datos para mapa de calor (dia x hora)
 */
function getHeatmapData($db, $document_id) {
    try {
        $query = "
            SELECT
                DAYOFWEEK(dcs.started_at) as dia_semana,
                HOUR(dcs.started_at) as hora,
                COUNT(DISTINCT dcs.id) as sesiones,
                COUNT(DISTINCT dcs.user_id) as usuarios
            FROM doc_conversacion_sesiones dcs
            WHERE dcs.document_id = :document_id
            AND dcs.started_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DAYOFWEEK(dcs.started_at), HOUR(dcs.started_at)
            ORDER BY dia_semana ASC, hora ASC
        ";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();

        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Nombres de dias (DAYOFWEEK retorna 1=Dom, 2=Lun, etc.)
        $dayNames = [1 => 'Dom', 2 => 'Lun', 3 => 'Mar', 4 => 'Mie', 5 => 'Jue', 6 => 'Vie', 7 => 'Sab'];

        // Crear matriz completa de 7 dias x 24 horas
        $data = [];

        for ($dia = 1; $dia <= 7; $dia++) {
            for ($hora = 0; $hora < 24; $hora++) {
                $valor = 0;

                foreach ($results as $result) {
                    if ((int)$result['dia_semana'] === $dia && (int)$result['hora'] === $hora) {
                        $valor = (int)$result['sesiones'];
                        break;
                    }
                }

                $data[] = [
                    'dia' => $dayNames[$dia],
                    'hora' => $hora,
                    'valor' => $valor
                ];
            }
        }

        return $data;

    } catch (Exception $e) {
        return [
            "error" => true,
            "message" => "Error obteniendo datos de heatmap: " . $e->getMessage()
        ];
    }
}

?>
