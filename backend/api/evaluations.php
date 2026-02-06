<?php
// backend/api/evaluations.php
// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Evaluation.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$evaluation = new Evaluation($db);
$jwt = new JWTUtil();

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Procesar según el método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Obtener evaluaciones del usuario
        if (isset($_GET['user_id'])) {
            $evaluation->user_id = $_GET['user_id'];
            $stmt = $evaluation->getByUser();
            $num = $stmt->rowCount();
            
            if ($num > 0) {
                $evaluations_arr = [];
                
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    extract($row);
                    
                    $evaluation_item = [
                        "id" => $id,
                        "module_id" => $module_id,
                        "score" => $score,
                        "completed_at" => $completed_at
                    ];
                    
                    array_push($evaluations_arr, $evaluation_item);
                }
                
                // Respuesta exitosa
                http_response_code(200);
                echo json_encode($evaluations_arr);
            } else {
                // No hay evaluaciones
                http_response_code(200);
                echo json_encode([]);
            }
        } 
        // Obtener una evaluación específica
        else if (isset($_GET['id'])) {
            $evaluation->id = $_GET['id'];
            
            if ($evaluation->getOne()) {
                // Respuesta exitosa
                http_response_code(200);
                echo json_encode([
                    "id" => $evaluation->id,
                    "user_id" => $evaluation->user_id,
                    "module_id" => $evaluation->module_id,
                    "score" => $evaluation->score,
                    "answers" => json_decode($evaluation->answers),
                    "completed_at" => $evaluation->completed_at
                ]);
            } else {
                // Evaluación no encontrada
                http_response_code(404);
                echo json_encode(["message" => "Evaluación no encontrada"]);
            }
        } else {
            // Parámetros insuficientes
            http_response_code(400);
            echo json_encode(["message" => "Se requiere id o user_id"]);
        }
        break;
        
    case 'POST':
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Verificar datos requeridos
        if (
            isset($data->user_id) &&
            isset($data->module_id) &&
            isset($data->score) &&
            isset($data->answers)
        ) {
            // Asignar valores
            $evaluation->user_id = $data->user_id;
            $evaluation->module_id = $data->module_id;
            $evaluation->score = $data->score;
            $evaluation->answers = json_encode($data->answers);
            $evaluation->completed_at = date('Y-m-d H:i:s');
            
            // Crear evaluación
            if ($evaluation->create()) {
                // Respuesta exitosa
                http_response_code(201);
                echo json_encode(["message" => "Evaluación creada exitosamente"]);
            } else {
                // Error al crear
                http_response_code(503);
                echo json_encode(["message" => "No se pudo crear la evaluación"]);
            }
        } else {
            // Datos incompletos
            http_response_code(400);
            echo json_encode(["message" => "Datos incompletos"]);
        }
        break;
        
    default:
        // Método no soportado
        http_response_code(405);
        echo json_encode(["message" => "Método no permitido"]);
        break;
}
?>