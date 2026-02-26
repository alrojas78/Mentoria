<?php
require_once '../config/config.php';
require_once '../config/db.php';
require_once '../models/User.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$database = new Database();
$db = $database->getConnection();
$user = new User($db);

// Obtener todos los usuarios
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->prepare("SELECT id, nombre, email, role, created FROM users ORDER BY created DESC");
    $stmt->execute();
    $usuarios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($usuarios);
    exit;
}

// Eliminar usuario
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $data = json_decode(file_get_contents("php://input"));
    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$data->id]);

    echo json_encode(["message" => "Usuario eliminado"]);
    exit;
}

// Actualizar usuario
// Actualizar usuario
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));
    
    // Validar que los datos requeridos estén presentes
    if (!isset($data->id) || !isset($data->nombre) || !isset($data->email) || !isset($data->role)) {
        http_response_code(400);
        echo json_encode(["message" => "Datos incompletos"]);
        exit;
    }
    
    // Validar rol dinámicamente
    $system_roles = ['admin', 'mentor'];
    $stmt_roles = $db->query("SELECT name FROM content_groups");
    $group_roles = $stmt_roles->fetchAll(PDO::FETCH_COLUMN);
    $roles_validos = array_merge($system_roles, $group_roles);
    if (!in_array($data->role, $roles_validos)) {
        http_response_code(400);
        echo json_encode(["message" => "Rol no válido"]);
        exit;
    }
    
    $stmt = $db->prepare("UPDATE users SET nombre = ?, email = ?, role = ? WHERE id = ?");
    $stmt->execute([$data->nombre, $data->email, $data->role, $data->id]);

    echo json_encode(["message" => "Usuario actualizado correctamente"]);
    exit;
}
?>
