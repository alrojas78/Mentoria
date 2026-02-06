<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once '../config/db.php';

$input = json_decode(file_get_contents("php://input"), true);

if (!isset($input['user_id']) || !isset($input['evaluation_id']) || !isset($input['score'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Faltan parámetros requeridos"]);
    exit;
}

$userId = intval($input['user_id']);
$evaluationId = intval($input['evaluation_id']);
$score = intval($input['score']);

$db = (new Database())->getConnection();

// 1. Obtener configuración de la evaluación
$settingQuery = "SELECT passing_score, max_attempts FROM evaluation_settings WHERE evaluation_id = :id";
$stmt = $db->prepare($settingQuery);
$stmt->bindParam(':id', $evaluationId);
$stmt->execute();
$settings = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$settings) {
    http_response_code(404);
    echo json_encode(["success" => false, "message" => "Configuración de evaluación no encontrada"]);
    exit;
}

$passingScore = intval($settings['passing_score']);
$maxAttempts = intval($settings['max_attempts']);

// 2. Contar intentos realizados
$countQuery = "SELECT COUNT(*) FROM user_evaluations WHERE user_id = :user AND evaluation_id = :eval";
$stmt = $db->prepare($countQuery);
$stmt->bindParam(':user', $userId);
$stmt->bindParam(':eval', $evaluationId);
$stmt->execute();
$attemptsUsed = $stmt->fetchColumn();

if ($attemptsUsed >= $maxAttempts) {
    echo json_encode([
        "success" => false,
        "approved" => false,
        "message" => "Has alcanzado el máximo de intentos permitidos.",
        "attempts_left" => 0
    ]);
    exit;
}

// 3. Registrar el nuevo intento
$approved = $score >= $passingScore ? 1 : 0;

$insert = "INSERT INTO user_evaluations (user_id, evaluation_id, score, approved) 
           VALUES (:user_id, :eval_id, :score, :approved)";
$stmt = $db->prepare($insert);
$stmt->bindParam(':user_id', $userId);
$stmt->bindParam(':eval_id', $evaluationId);
$stmt->bindParam(':score', $score);
$stmt->bindParam(':approved', $approved);
$stmt->execute();

$attemptsLeft = $maxAttempts - ($attemptsUsed + 1);

echo json_encode([
    "success" => true,
    "approved" => boolval($approved),
    "score" => $score,
    "attempts_left" => $attemptsLeft,
    "message" => $approved
        ? "¡Felicidades! Has aprobado esta evaluación."
        : "Has reprobado. Te quedan $attemptsLeft intento(s)."
]);
