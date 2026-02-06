<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/CompletedCourse.php';

$database = new Database();
$db = $database->getConnection();
$completed = new CompletedCourse($db);

$data = json_decode(file_get_contents("php://input"));

if (!empty($data->user_id) && !empty($data->curso_id)) {
    $completed->user_id = $data->user_id;
    $completed->curso_id = $data->curso_id;

    if ($completed->markCompleted()) {
        http_response_code(200);
        echo json_encode(["message" => "Curso marcado como completado"]);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "No se pudo marcar como completado"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["message" => "Faltan datos"]);
}
?>
