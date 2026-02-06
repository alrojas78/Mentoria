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
include_once '../models/Lesson.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$lesson = new Lesson($db);
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

// Procesar según el método HTTP
// Procesar según el método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Verificar si se solicita una lección específica
        if (isset($_GET['id'])) {
            $lesson->id = $_GET['id'];
            
            if ($lesson->readOne()) {
                http_response_code(200);
                echo json_encode([
                    "id" => $lesson->id,
                    "curso_id" => $lesson->curso_id,
                    "module_id" => $lesson->module_id,
                    "titulo" => $lesson->titulo,
                    "contenido" => $lesson->contenido,
                    "orden" => $lesson->orden
                ]);
            } else {
                http_response_code(404);
                echo json_encode(["message" => "Lección no encontrada"]);
            }
        } 

        // ✅ ESTE BLOQUE SE MUEVE AQUI
        else if (
            isset($_GET['action']) && $_GET['action'] === 'next_activity' &&
            isset($_GET['module_id']) && isset($_GET['current_lesson_id'])
        ) {
            $module_id = intval($_GET['module_id']);
            $current_lesson_id = intval($_GET['current_lesson_id']);

            $stmt = $lesson->getNextLessonInModule($module_id, $current_lesson_id);
            $nextLesson = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($nextLesson) {
                http_response_code(200);
                echo json_encode([
                    "type" => "lesson",
                    "id" => $nextLesson['id'],
                    "title" => $nextLesson['titulo']
                ]);
            } else {
                http_response_code(200);
                echo json_encode([
                    "type" => "evaluation",
                    "module_id" => $module_id
                ]);
            }
        }

        // Verificar si se solicitan lecciones por curso
        else if (isset($_GET['curso_id'])) {
            $lesson->curso_id = $_GET['curso_id'];
            $stmt = $lesson->readByCourse();
            $num = $stmt->rowCount();
            
            if ($num > 0) {
                $lessons_arr = [];

                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    extract($row);
                    $lesson_item = [
                        "id" => $id,
                        "curso_id" => $curso_id,
                        "module_id" => $lesson->module_id, 
                        "titulo" => $titulo,
                        "contenido" => $contenido,
                        "orden" => $orden
                    ];
                    array_push($lessons_arr, $lesson_item);
                }

                http_response_code(200);
                echo json_encode($lessons_arr);
            } else {
                http_response_code(200);
                echo json_encode([]);
            }
        } 

        else {
            http_response_code(400);
            echo json_encode(["message" => "Se requiere id, curso_id o parámetros válidos"]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Método no permitido"]);
        break;
}

?>