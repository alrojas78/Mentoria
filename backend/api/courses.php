<?php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Course.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$course = new Course($db);
$jwt = new JWTUtil();

// Verificar autenticación (excepto para GET)
if ($_SERVER['REQUEST_METHOD'] != 'GET') {
    $headers = getallheaders();
    $token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';
    
    $userData = $jwt->validate($token);
    if (!$userData) {
        http_response_code(401);
        echo json_encode(["message" => "No autorizado"]);
        exit();
    }
}

// Procesar según el método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Verificar si se solicita un curso específico
        if (isset($_GET['id'])) {
            $course->id = $_GET['id'];
            
            if ($course->readOne()) {
                // Respuesta exitosa
                http_response_code(200);
                echo json_encode([
                    "id" => $course->id,
                    "titulo" => $course->titulo,
                    "descripcion" => $course->descripcion,
                    "imagen" => $course->imagen,
                    "created" => $course->created
                ]);
            } else {
                // Curso no encontrado
                http_response_code(404);
                echo json_encode(["message" => "Curso no encontrado"]);
            }
        } else {
            // Listar todos los cursos
          // Listar todos los cursos con módulos y lecciones
          $courses_arr = $course->readWithModulesAndLessons();
          http_response_code(200);
          echo json_encode($courses_arr);
          exit();
          
$num = $stmt->rowCount();

if ($num > 0) {
    $courses_arr = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        extract($row);
        $course_id = $id;

        // Obtener módulos de este curso
        $moduleQuery = "SELECT * FROM modules WHERE curso_id = ?";
        $moduleStmt = $db->prepare($moduleQuery);
        $moduleStmt->execute([$course_id]);
        $modules = [];

        while ($module = $moduleStmt->fetch(PDO::FETCH_ASSOC)) {
            $module_id = $module['id'];

            // Obtener lecciones de este módulo
            $lessonQuery = "SELECT * FROM lessons WHERE module = ?";
            $lessonStmt = $db->prepare($lessonQuery);
            $lessonStmt->execute([$module_id]);
            $lessons = $lessonStmt->fetchAll(PDO::FETCH_ASSOC);

            $module['lessons'] = $lessons;
            $modules[] = $module;
        }

        $course_item = [
            "id" => $course_id,
            "titulo" => $titulo,
            "descripcion" => $descripcion,
            "imagen" => $imagen,
            "created" => $created,
            "modules" => $modules
        ];

        array_push($courses_arr, $course_item);
    }

    http_response_code(200);
    echo json_encode($courses_arr);
} else {
    http_response_code(200);
    echo json_encode([]);
}

        }
        break;
        
    // Aquí irían los métodos POST, PUT y DELETE para gestionar cursos
    // (Los omitimos por brevedad pero son similares a los de auth.php)
    
    default:
        // Método no soportado
        http_response_code(405);
        echo json_encode(["message" => "Método no permitido"]);
        break;
}
?>