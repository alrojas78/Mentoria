<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }

require_once "../config/config.php";
require_once "../config/db.php";
require_once "../utils/jwt.php";

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$jwt = new JWTUtil();
$userData = $jwt->validate($token);

if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

$database = new Database();
$db = $database->getConnection();

// Roles del sistema
$roles = [
    ["name" => "admin", "label" => "Administrador", "type" => "system"],
    ["name" => "mentor", "label" => "Mentor", "type" => "system"],
];

// Roles desde content_groups
$stmt = $db->query("SELECT name, description FROM content_groups ORDER BY name ASC");
$groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($groups as $group) {
    $roles[] = [
        "name" => $group["name"],
        "label" => ucfirst($group["name"]),
        "type" => "group"
    ];
}

echo json_encode(["roles" => $roles]);
?>
