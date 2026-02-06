<?php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/User.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$user = new User($db);
$jwt = new JWTUtil();

// Obtener datos enviados
$data = json_decode(file_get_contents("php://input"));

// Determinar la acción según la URL
$request_uri = $_SERVER['REQUEST_URI'];
$action = (strpos($request_uri, 'login') !== false) ? 'login' : 'register';

// Procesar según la acción
if ($action == 'login') {
    // Verificar que se proporcionen los datos necesarios
    if (empty($data->email) || empty($data->password)) {
        http_response_code(400);
        echo json_encode(["message" => "Se requieren email y password"]);
        exit();
    }
    
    // Asignar valores
    $user->email = $data->email;
    
    // Verificar si el usuario existe
    if ($user->emailExists()) {
        // Verificar la contraseña
        if (password_verify($data->password, $user->password)) {
            // Generar JWT
            $token = $jwt->generate(
                $user->id,
                $user->nombre,
                $user->email,
                $user->role
            );
            
            // Respuesta exitosa
            http_response_code(200);
            echo json_encode([
                "message" => "Login exitoso",
                "token" => $token,
                "user" => [
                    "id" => $user->id,
                    "nombre" => $user->nombre,
                    "email" => $user->email,
                    "role" => $user->role
                ]
            ]);
        } else {
            // Contraseña incorrecta
            http_response_code(401);
            echo json_encode(["message" => "Usuario o contraseña incorrectos"]);
        }
    } else {
        // Usuario no encontrado
        http_response_code(401);
        echo json_encode(["message" => "Usuario o contraseña incorrectos"]);
    }
} else if ($action == 'register') {
    // Verificar que se proporcionen los datos necesarios
    if (empty($data->nombre) || empty($data->email) || empty($data->password)) {
        http_response_code(400);
        echo json_encode(["message" => "Se requieren todos los campos"]);
        exit();
    }
    
    // Asignar valores
    $user->nombre = $data->nombre;
    $user->email = $data->email;
    $user->password = password_hash($data->password, PASSWORD_BCRYPT);
    $user->role = !empty($data->role) ? $data->role : 'user';
    $user->created = date('Y-m-d H:i:s');
    
    // Verificar si el email ya existe
    if ($user->emailExists()) {
        http_response_code(400);
        echo json_encode(["message" => "El email ya está registrado"]);
        exit();
    }
    
    // Crear el usuario
    if ($user->create()) {
        // Obtener el ID del usuario recién creado
        // Si usas PDO, puedes obtener el último ID insertado así:
        $last_inserted_id = $db->lastInsertId();
        $user->id = $last_inserted_id;
        
        // Para DEBUG: registrar el ID
        error_log("Usuario creado con ID: " . $user->id);
        
        // Generar JWT
        $token = $jwt->generate(
            $user->id,
            $user->nombre,
            $user->email,
            $user->role
        );
        
        // Respuesta exitosa con ID incluido
        http_response_code(201);
        echo json_encode([
            "message" => "Usuario creado exitosamente",
            "token" => $token,
            "user" => [
                "id" => $user->id,
                "nombre" => $user->nombre,
                "email" => $user->email,
                "role" => $user->role
            ]
        ]);
    } else {
        // Error al crear
        http_response_code(503);
        echo json_encode(["message" => "No se pudo crear el usuario"]);
    }
} else {
    // Acción no soportada
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
}
?>