<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/config.php';
require_once '../../config/db.php';
require_once '../../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAdmin();

$database = new Database();
$db = $database->getConnection();

$cohorte_id = intval($_GET['cohorte_id'] ?? 0);

// Estadísticas generales
$where = $cohorte_id ? "WHERE m.cohorte_id = ?" : "";
$params = $cohorte_id ? [$cohorte_id] : [];

// Funnel de estados
$stmt = $db->prepare("
    SELECT m.estado, COUNT(*) as total
    FROM matriculas m {$where}
    GROUP BY m.estado
    ORDER BY FIELD(m.estado, 'invitado','registrado','activo','pausado','suspendido','completado','excluido')
");
$stmt->execute($params);
$funnel = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $funnel[$row['estado']] = intval($row['total']);
}

// Funnel por etapa
$stmt = $db->prepare("
    SELECT m.etapa_actual, COUNT(*) as total
    FROM matriculas m {$where}
    GROUP BY m.etapa_actual
");
$stmt->execute($params);
$etapas = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $etapas[$row['etapa_actual']] = intval($row['total']);
}

// Total recordatorios enviados
$stmt = $db->prepare("
    SELECT SUM(m.recordatorios_enviados) as total_recordatorios
    FROM matriculas m {$where}
");
$stmt->execute($params);
$totalRecordatorios = intval($stmt->fetchColumn() ?: 0);

// Actividad reciente (últimos 10 eventos)
$logWhere = $cohorte_id ? "WHERE sl.matricula_id IN (SELECT id FROM matriculas WHERE cohorte_id = ?)" : "";
$logParams = $cohorte_id ? [$cohorte_id] : [];

$stmt = $db->prepare("
    SELECT sl.*, c.nombre as contacto_nombre
    FROM seguimiento_log sl
    INNER JOIN matriculas m ON sl.matricula_id = m.id
    INNER JOIN contactos c ON m.contacto_id = c.id
    {$logWhere}
    ORDER BY sl.fecha DESC
    LIMIT 20
");
$stmt->execute($logParams);
$actividad = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Resumen de cohortes
$stmt = $db->query("
    SELECT c.id, c.nombre, c.estado, d.titulo as documento_titulo,
        (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id) as total,
        (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'invitado') as invitados,
        (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado IN ('registrado','activo')) as activos,
        (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'completado') as completados,
        (SELECT COUNT(*) FROM matriculas m WHERE m.cohorte_id = c.id AND m.estado = 'suspendido') as suspendidos
    FROM cohortes c
    LEFT JOIN documentos d ON c.documento_id = d.id
    ORDER BY c.created_at DESC
");
$cohortes = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'funnel' => $funnel,
    'etapas' => $etapas,
    'total_recordatorios' => $totalRecordatorios,
    'actividad_reciente' => $actividad,
    'cohortes' => $cohortes
]);
?>
