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

// Excluir roles protegidos del registro público
$protectedRoles = ['admin', 'coordinador', 'mentor'];
$placeholders = implode(',', array_fill(0, count($protectedRoles), '?'));
$stmt = $db->prepare("SELECT name, description FROM content_groups WHERE name NOT IN ($placeholders) ORDER BY name ASC");
$stmt->execute($protectedRoles);
$groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(["success" => true, "groups" => $groups]);
?>
