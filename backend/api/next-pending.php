<?php
require_once '../config/database.php';
require_once '../models/Progress.php';
require_once '../models/Lesson.php';
require_once '../models/Evaluation.php';

header('Content-Type: application/json');

if (!isset($_GET['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'user_id is required']);
    exit;
}

$userId = intval($_GET['user_id']);
$db = Database::connect();

$progress = new Progress($db);
$lessonModel = new Lesson($db);
$evaluationModel = new Evaluation($db);

// 1. Buscar todas las lecciones y evaluaciones con orden lógico
$allLessons = $lessonModel->getAllOrdered(); // debes tener este método en tu modelo
$allEvals = $evaluationModel->getAllOrdered();

// 2. Buscar progreso del usuario
$userProgress = $progress->getUserProgressMap($userId); // deberías mapear por tipo + id

// 3. Buscar la primera lección no completada
foreach ($allLessons as $lesson) {
    $key = "lesson_{$lesson['id']}";
    if (!isset($userProgress[$key]) || !$userProgress[$key]['completado']) {
        echo json_encode([
            'success' => true,
            'next' => [
                'type' => 'lesson',
                'id' => $lesson['id'],
                'course_id' => $lesson['course_id'],
                'module_id' => $lesson['module_id'],
                'title' => $lesson['titulo'],
                'course_title' => $lesson['course_titulo']
            ]
        ]);
        exit;
    }
}

// 4. Si todas las lecciones están hechas, buscar evaluación pendiente
foreach ($allEvals as $eval) {
    $key = "evaluation_{$eval['module_id']}";
    if (!isset($userProgress[$key]) || !$userProgress[$key]['completado']) {
        echo json_encode([
            'success' => true,
            'next' => [
                'type' => 'evaluation',
                'module_id' => $eval['module_id'],
                'course_id' => $eval['course_id'],
                'title' => "Evaluación del módulo",
                'course_title' => $eval['course_titulo']
            ]
        ]);
        exit;
    }
}

// 5. Si todo está completo
echo json_encode(['success' => true, 'next' => null]);
exit;
