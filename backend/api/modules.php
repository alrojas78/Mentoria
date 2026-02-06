<?php
// backend/api/modules.php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Module.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$module = new Module($db);
$jwt = new JWTUtil();

// Verificar autenticación
//$headers = getallheaders();
//$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

//$userData = $jwt->validate($token);
//if (!$userData) {
//    http_response_code(401);
//    echo json_encode(["message" => "No autorizado"]);
//    exit();
//}

// Procesar solicitud GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Obtener un módulo específico o módulos por curso
if (isset($_GET['id'])) {
    // Obtener un módulo específico
    $module->id = $_GET['id'];

    if ($module->getOne()) {
        // Obtener lecciones del módulo
        $lessons_stmt = $module->getLessons();
        $lessons = [];

        while ($row = $lessons_stmt->fetch(PDO::FETCH_ASSOC)) {
            array_push($lessons, [
                "id" => $row['id'],
                "curso_id" => $row['curso_id'],
                "titulo" => $row['titulo'],
                "contenido" => $row['contenido'],
                "orden" => $row['orden'],
                "module_id" => $row['module_id']
            ]);
        }

        // Respuesta exitosa
        http_response_code(200);
        echo json_encode([
            "id" => $module->id,
            "course_id" => $module->course_id,
            "title" => $module->title,
            "description" => $module->description,
            "orden" => $module->orden,
            "lessons" => $lessons
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Módulo no encontrado"]);
    }


} else if (isset($_GET['course_id'])) {
    // Obtener módulos por curso
    $module->course_id = $_GET['course_id'];
    $stmt = $module->getByCourse();
    $num = $stmt->rowCount();
    
    if ($num > 0) {
        $modules_arr = [];
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                   
            // Obtener lecciones del módulo
            $module_id = $row['id'];
            $course_id = $row['curso_id'];
            $title = $row['titulo'];
            $description = $row['descripcion'];
            $orden = $row['orden'];

            $module->id = $module_id;
            $lessons_stmt = $module->getLessons();
            $lessons = [];
            
            while ($lesson_row = $lessons_stmt->fetch(PDO::FETCH_ASSOC)) {
                array_push($lessons, [
                    "id" => $lesson_row['id'],
                    "curso_id" => $lesson_row['curso_id'],
                    "titulo" => $lesson_row['titulo'],
                    "contenido" => $lesson_row['contenido'],
                    "orden" => $lesson_row['orden'],
                    "module_id" => $lesson_row['module_id']
                ]);
            }

            $id = $row['id'];
            
            $module_item = [
                
                "id" => $id,
                "course_id" => $course_id,
                "title" => $title,
                "description" => $description,
                "orden" => $orden,
                "lessons" => $lessons
            ];
            
            array_push($modules_arr, $module_item);
        }
        
        // Respuesta exitosa
        http_response_code(200);
        echo json_encode($modules_arr);
    } else {
        // No hay módulos
        http_response_code(200);
        echo json_encode([]);
    }
} else {
    // Parámetros insuficientes
    http_response_code(400);
    echo json_encode(["message" => "Se requiere id o course_id"]);
}
?>