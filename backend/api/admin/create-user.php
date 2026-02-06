<?php
// backend/api/admin/create-user.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../utils/jwt.php';

// Verificar autenticación y rol de administrador
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$jwt = new JWTUtil();
$userData = $jwt->validate($token);

if (!$userData || $userData->role !== 'admin') {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Procesar solicitud POST para crear usuario
try {
    // Obtener datos enviados
    $data = json_decode(file_get_contents("php://input"));
    
    // Validar datos requeridos
    if (!isset($data->nombre) || !isset($data->email) || !isset($data->password) || !isset($data->role)) {
        http_response_code(400);
        echo json_encode(["message" => "Datos incompletos. Se requieren nombre, email, password y role"]);
        exit();
    }
    
    // Validar formato de email
    if (!filter_var($data->email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(["message" => "Formato de email inválido"]);
        exit();
    }
    
    // Validar rol (solo permitir 'user' o 'admin')
    if ($data->role !== 'user' && $data->role !== 'admin') {
        http_response_code(400);
        echo json_encode(["message" => "Rol no válido. Solo se permite 'user' o 'admin'"]);
        exit();
    }
    
    // Verificar si el email ya existe
    $checkQuery = "SELECT id FROM users WHERE email = ?";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->execute([$data->email]);
    
    if ($checkStmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode(["message" => "El email ya está registrado"]);
        exit();
    }
    
    // Hashear la contraseña
    $hashedPassword = password_hash($data->password, PASSWORD_BCRYPT);
    
    // Insertar el nuevo usuario
    $query = "INSERT INTO users (nombre, email, password, role, created) 
              VALUES (?, ?, ?, ?, NOW())";
    $stmt = $db->prepare($query);
    $stmt->execute([
        $data->nombre,
        $data->email,
        $hashedPassword,
        $data->role
    ]);
    
    // Obtener el ID del usuario creado
    $userId = $db->lastInsertId();
    
    // Obtener los datos del usuario creado (sin la contraseña)
    $queryUser = "SELECT id, nombre, email, role, created FROM users WHERE id = ?";
    $stmtUser = $db->prepare($queryUser);
    $stmtUser->execute([$userId]);
    
    $newUser = $stmtUser->fetch(PDO::FETCH_ASSOC);
    
    // Responder con los datos del usuario creado
    http_response_code(201);
    echo json_encode([
        "message" => "Usuario creado exitosamente",
        "data" => $newUser
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error al crear usuario", "error" => $e->getMessage()]);
}