<?php
// backend/api/progress.php

// Configuración de encabezados
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
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
include_once '../models/Progress.php';
include_once '../utils/jwt.php';

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Instanciar objetos
$progress = new Progress($db);
$jwt = new JWTUtil();

// Procesar según el método HTTP
switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Si se solicita la siguiente actividad
        if (isset($_GET['next_activity']) && isset($_GET['curso_id']) && isset($_GET['user_id'])) {
            $progress->user_id = $_GET['user_id'];
            $progress->curso_id = $_GET['curso_id'];

            $next = $progress->getNextActivity();

            http_response_code(200);
            echo json_encode($next ?: null);
            exit();
        }

        // Obtener progreso del usuario
        if (isset($_GET['user_id'])) {
            $progress->user_id = $_GET['user_id'];

            // Verificar si se solicita la última actividad
            if (isset($_GET['last_activity']) && $_GET['last_activity'] === 'true') {
                $lastActivity = $progress->getLastActivity();

                http_response_code(200);
                echo json_encode($lastActivity ?: ["message" => "No hay actividad registrada para este usuario"]);
            } else {
                // Obtener todo el progreso del usuario
                $stmt = $progress->getUserProgress();
                $num = $stmt->rowCount();

                if ($num > 0) {
                    $progress_arr = [];

                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        extract($row);

                        $progress_item = [
                            "id" => $id,
                            "user_id" => $user_id,
                            "lesson_id" => $lesson_id,
                            "completado" => $completado,
                            "fecha" => $fecha,
                            "lesson_title" => $lesson_title,
                            "curso_id" => $curso_id,
                            "course_title" => $course_title
                        ];

                        array_push($progress_arr, $progress_item);
                    }

                    http_response_code(200);
                    echo json_encode($progress_arr);
                } else {
                    http_response_code(200);
                    echo json_encode([]);
                }
            }
        } else {
            http_response_code(400);
            echo json_encode(["message" => "Se requiere user_id"]);
        }
        break;

        case 'POST':
            $raw = file_get_contents("php://input");
            error_log("Datos recibidos en progress.php: " . $raw);
            $data = json_decode($raw);
        
            // Verificación flexible (permitir que user_id sea recuperado del token)
            if (is_object($data) && property_exists($data, 'lesson_id') && !empty($data->lesson_id)) {
                // Si no hay user_id, intentar obtenerlo del token
                if (empty($data->user_id) && isset($headers['Authorization'])) {
                    $token = str_replace('Bearer ', '', $headers['Authorization']);
                    $userData = $jwt->validate($token);
                    
                    if ($userData && isset($userData->id)) {
                        $data->user_id = $userData->id;
                        error_log("user_id recuperado del token: " . $data->user_id);
                    }
                }
                
                // Verificar nuevamente si tenemos user_id
                if (empty($data->user_id)) {
                    error_log("No se pudo obtener user_id válido");
                    http_response_code(400);
                    echo json_encode([
                        "message" => "No se encontró un ID de usuario válido", 
                        "success" => false
                    ]);
                    exit();
                }
        
                // Continuar con el procesamiento normal
                $progress->user_id = intval($data->user_id);
                $progress->lesson_id = intval($data->lesson_id);
                $progress->completado = isset($data->completado) ? intval($data->completado) : 1;
                $progress->fecha = date('Y-m-d H:i:s');
        
                error_log("Procesando progreso: user_id={$progress->user_id}, lesson_id={$progress->lesson_id}, completado={$progress->completado}");
        
                if ($progress->updateProgress()) {
                    http_response_code(200);
                    echo json_encode(["message" => "Progreso actualizado correctamente", "success" => true]);
                } else {
                    http_response_code(503);
                    echo json_encode(["message" => "Error al actualizar progreso", "success" => false]);
                }
            } else {
                error_log("Datos incompletos en progress.php: " . $raw);
                http_response_code(400);
                echo json_encode([
                    "message" => "Datos incompletos o inválidos", 
                    "received" => $data,
                    "success" => false
                ]);
            }
            break;
}
