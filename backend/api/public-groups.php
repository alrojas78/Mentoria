<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }

require_once "../config/config.php";
require_once "../config/db.php";

$database = new Database();
$db = $database->getConnection();

// Detectar proyecto por dominio
$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
$host = preg_replace('/:\d+$/', '', $host);
$proyectoRol = null;
if ($host) {
    $stmtProy = $db->prepare("SELECT rol_default FROM proyectos WHERE (dominio_personalizado = ? OR (slug = ? AND ? LIKE '%.ateneomentoria.com')) AND activo = 1 AND rol_default IS NOT NULL LIMIT 1");
    $subdomain = preg_match('/^([a-z0-9\-]+)\.ateneomentoria\.com$/', $host, $m) ? $m[1] : '';
    $stmtProy->execute([$host, $subdomain, $host]);
    $proyectoRol = $stmtProy->fetchColumn();
}

if ($proyectoRol) {
    // Si hay proyecto con rol_default, devolver solo ese grupo
    $stmt = $db->prepare("SELECT name, description FROM content_groups WHERE name = ?");
    $stmt->execute([$proyectoRol]);
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
} else {
    // Excluir roles protegidos del registro público
    $protectedRoles = ['admin', 'coordinador', 'mentor'];
    $placeholders = implode(',', array_fill(0, count($protectedRoles), '?'));
    $stmt = $db->prepare("SELECT name, description FROM content_groups WHERE name NOT IN ($placeholders) ORDER BY name ASC");
    $stmt->execute($protectedRoles);
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

echo json_encode(["success" => true, "groups" => $groups]);
?>
