<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Lesson.php';

$database = new Database();
$db = $database->getConnection();
$lesson = new Lesson($db);

// Validar parámetros
if (isset($_GET['current_lesson_id']) && isset($_GET['module_id'])) {
    $currentId = intval($_GET['current_lesson_id']);
    $moduleId = intval($_GET['module_id']);

    $result = $lesson->getNextActivity($currentId, $moduleId);
    echo json_encode($result);
} else {
    http_response_code(400);
    echo json_encode(["message" => "Parámetros faltantes"]);
}
