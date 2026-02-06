<?php
// backend/api/questions.php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Question.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$question = new Question($db);
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

// Verificar si es GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Verificar si se pide por módulo
if (isset($_GET['module_id'])) {
    $question->module_id = $_GET['module_id'];
    $stmt = $question->getByModule();
    $num = $stmt->rowCount();
    
    if ($num > 0) {
        $questions_arr = [];
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            extract($row);
            
            $question_item = [
                "id" => $id,
                "module_id" => $module_id,
                "question" => $question_text,
                "expectedAnswer" => $expected_answer,
                "orden" => $orden
            ];
            
            array_push($questions_arr, $question_item);
        }
        
        // Respuesta exitosa
        http_response_code(200);
        echo json_encode($questions_arr);
    } else {
        // No hay preguntas
        http_response_code(200);
        echo json_encode([]);
    }
} else {
    // Parámetros insuficientes
    http_response_code(400);
    echo json_encode(["message" => "Se requiere module_id"]);
}
?>