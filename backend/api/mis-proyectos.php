<?php
/**
 * mis-proyectos.php — Fase 11.8b: Membresías del usuario actual
 * GET → Lista proyectos donde el usuario es miembro (coordinador/supervisor)
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAuth();
$database = new Database();
$db = $database->getConnection();

$stmt = $db->prepare("
    SELECT pm.proyecto_id, pm.rol_proyecto,
           p.nombre, p.slug, p.config_json
    FROM proyecto_miembros pm
    INNER JOIN proyectos p ON p.id = pm.proyecto_id
    WHERE pm.user_id = ? AND p.activo = 1
    ORDER BY pm.rol_proyecto ASC, p.nombre ASC
");
$stmt->execute([$userData->id]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$memberships = [];
foreach ($rows as $row) {
    $config = $row['config_json'] ? json_decode($row['config_json'], true) : [];
    $memberships[] = [
        'proyecto_id' => (int)$row['proyecto_id'],
        'rol_proyecto' => $row['rol_proyecto'],
        'nombre' => $row['nombre'],
        'slug' => $row['slug'],
        'whatsapp_connected' => !empty($config['whatsapp_connected']),
    ];
}

echo json_encode(['success' => true, 'memberships' => $memberships]);
