<?php
require_once '../config/db.php';
require_once '../models/CompletedCourse.php';

header("Content-Type: application/json");

$user_id = $_GET['user_id'] ?? null;
if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'Falta user_id']);
    exit;
}

$db = (new Database())->getConnection();
$model = new CompletedCourse($db);

$result = $model->getCompletedByUser($user_id);

echo json_encode($result);
