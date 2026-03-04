<?php
// admin/wa-interacciones.php — Lectura de interacciones WhatsApp Training (solo admin, read-only)
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
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Solo se permite el método GET']);
    exit;
}

// Parámetros de paginación
$page = max(1, intval($_GET['page'] ?? 1));
$perPage = min(100, max(1, intval($_GET['per_page'] ?? 50)));
$offset = ($page - 1) * $perPage;

$inscripcionId = intval($_GET['inscripcion_id'] ?? 0);
$programaId = intval($_GET['programa_id'] ?? 0);

if (!$inscripcionId && !$programaId) {
    http_response_code(400);
    echo json_encode(['error' => 'inscripcion_id o programa_id es requerido']);
    exit;
}

try {
    if ($inscripcionId) {
        // Interacciones de una inscripción específica
        $countStmt = $db->prepare("
            SELECT COUNT(*) FROM wa_interacciones WHERE inscripcion_id = ?
        ");
        $countStmt->execute([$inscripcionId]);
        $total = intval($countStmt->fetchColumn());

        $stmt = $db->prepare("
            SELECT wi.*,
                we.titulo as entrega_titulo,
                we.tipo as entrega_tipo,
                we.orden as entrega_orden,
                wins.nombre as inscripcion_nombre,
                wins.telefono as inscripcion_telefono
            FROM wa_interacciones wi
            LEFT JOIN wa_entregas we ON we.id = wi.entrega_id
            LEFT JOIN wa_inscripciones wins ON wins.id = wi.inscripcion_id
            WHERE wi.inscripcion_id = ?
            ORDER BY wi.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->bindValue(1, $inscripcionId, PDO::PARAM_INT);
        $stmt->bindValue(2, $perPage, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
    } else {
        // Interacciones de todas las inscripciones de un programa
        $countStmt = $db->prepare("
            SELECT COUNT(*) FROM wa_interacciones wi
            INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
            WHERE wins.programa_id = ?
        ");
        $countStmt->execute([$programaId]);
        $total = intval($countStmt->fetchColumn());

        $stmt = $db->prepare("
            SELECT wi.*,
                we.titulo as entrega_titulo,
                we.tipo as entrega_tipo,
                we.orden as entrega_orden,
                wins.nombre as inscripcion_nombre,
                wins.telefono as inscripcion_telefono
            FROM wa_interacciones wi
            INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
            LEFT JOIN wa_entregas we ON we.id = wi.entrega_id
            WHERE wins.programa_id = ?
            ORDER BY wi.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->bindValue(1, $programaId, PDO::PARAM_INT);
        $stmt->bindValue(2, $perPage, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
    }

    $interacciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $totalPages = ceil($total / $perPage);

    echo json_encode([
        'success' => true,
        'interacciones' => $interacciones,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => $totalPages,
            'has_next' => $page < $totalPages,
            'has_prev' => $page > 1
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error obteniendo interacciones: ' . $e->getMessage()]);
}
?>
