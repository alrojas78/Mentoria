<?php
// backend/api/admin/evaluations.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../utils/jwt.php';

// Verificar autenticación y rol de administrador
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$jwt = new JWTUtil();
$userData = $jwt->validate($token);

if (!$userData || $userData->role !== 'admin') {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Crear conexión a la base de datos
$database = new Database();
$db = $database->getConnection();

// Procesar solicitud según el método HTTP
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Si se proporciona ID, obtener una evaluación específica
        if (isset($_GET['id'])) {
            getEvaluationById($db, $_GET['id'], isset($_GET['include_questions']) && $_GET['include_questions'] === 'true');
        } else {
            // Si no, obtener todas las evaluaciones
            getAllEvaluations($db);
        }
        break;
        
    case 'POST':
        // Crear una nueva evaluación
        createEvaluation($db);
        break;
        
    case 'PUT':
        // Actualizar una evaluación existente
        updateEvaluation($db);
        break;
        
    case 'DELETE':
        // Eliminar una evaluación
        deleteEvaluation($db);
        break;
        
    default:
        http_response_code(405);
        echo json_encode(["message" => "Método no permitido"]);
        break;
}

// Función para obtener todas las evaluaciones
function getAllEvaluations($db) {
    try {
        // Obtener evaluaciones con datos básicos
        $query = "
            SELECT 
                es.*, 
                (SELECT COUNT(*) FROM questions WHERE module_id = es.module_id) AS question_count
            FROM 
                evaluation_settings es
            ORDER BY 
                es.id DESC
        ";
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $evaluations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Para cada evaluación, añadir información del módulo
        foreach ($evaluations as &$evaluation) {
            // Obtener información del módulo
            $moduleQuery = "
                SELECT m.id, m.titulo, m.descripcion, c.id as course_id, c.titulo as course_title
                FROM modules m
                JOIN courses c ON m.curso_id = c.id
                WHERE m.id = ?
            ";
            $moduleStmt = $db->prepare($moduleQuery);
            $moduleStmt->execute([$evaluation['module_id']]);
            
            $module = $moduleStmt->fetch(PDO::FETCH_ASSOC);
            if ($module) {
                $evaluation['module'] = $module;
            }
        }
        
        http_response_code(200);
        echo json_encode($evaluations);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["message" => "Error al obtener evaluaciones", "error" => $e->getMessage()]);
    }
}

// Función para obtener una evaluación específica
function getEvaluationById($db, $id, $includeQuestions = false) {
    try {
        // Obtener datos de la evaluación
        $query = "SELECT * FROM evaluation_settings WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Evaluación no encontrada"]);
            return;
        }
        
        $evaluation = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Obtener información del módulo
        $moduleQuery = "
            SELECT m.id, m.titulo, m.descripcion, c.id as course_id, c.titulo as course_title
            FROM modules m
            JOIN courses c ON m.curso_id = c.id
            WHERE m.id = ?
        ";
        $moduleStmt = $db->prepare($moduleQuery);
        $moduleStmt->execute([$evaluation['module_id']]);
        
        $module = $moduleStmt->fetch(PDO::FETCH_ASSOC);
        if ($module) {
            $evaluation['module'] = $module;
        }
        
        // Si se solicitan preguntas, obtenerlas
        if ($includeQuestions) {
            $questionQuery = "
                SELECT * FROM questions 
                WHERE module_id = ? 
                ORDER BY orden ASC
            ";
            $questionStmt = $db->prepare($questionQuery);
            $questionStmt->execute([$evaluation['module_id']]);
            
            $evaluation['questions'] = $questionStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        http_response_code(200);
        echo json_encode($evaluation);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["message" => "Error al obtener la evaluación", "error" => $e->getMessage()]);
    }
}

// Función para crear una nueva evaluación
function createEvaluation($db) {
    try {
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Validar datos requeridos
        if (!isset($data->moduleId)) {
            http_response_code(400);
            echo json_encode(["message" => "Datos incompletos. Se requiere moduleId"]);
            return;
        }
        
        // Iniciar transacción
        $db->beginTransaction();
        
        // Verificar si ya existe una evaluación para este módulo
        $checkQuery = "SELECT id FROM evaluation_settings WHERE module_id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$data->moduleId]);
        
        if ($checkStmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(["message" => "Ya existe una evaluación para este módulo"]);
            $db->rollBack();
            return;
        }
        
        // Insertar la configuración de evaluación
        $evalQuery = "INSERT INTO evaluation_settings 
                      (module_id, passing_score, max_attempts, time_limit, randomize_questions, show_feedback) 
                      VALUES (?, ?, ?, ?, ?, ?)";
        $evalStmt = $db->prepare($evalQuery);
        $evalStmt->execute([
            $data->moduleId,
            $data->passingScore ?? 70,
            $data->maxAttempts ?? 3,
            $data->timeLimit ?? 0,
            $data->randomizeQuestions ? 1 : 0,
            $data->showFeedback ? 1 : 0
        ]);
        
        $evaluationId = $db->lastInsertId();
        
        // Insertar preguntas si existen
        if (isset($data->questions) && is_array($data->questions)) {
            foreach ($data->questions as $index => $question) {
                $questionQuery = "INSERT INTO questions 
                                (module_id, question_text, expected_answer, orden) 
                                VALUES (?, ?, ?, ?)";
                $questionStmt = $db->prepare($questionQuery);
                $questionStmt->execute([
                    $data->moduleId,
                    $question->question_text,
                    $question->expected_answer,
                    $index + 1
                ]);
            }
        }
        
        // Confirmar transacción
        $db->commit();
        
        // Obtener la evaluación completa
        getEvaluationById($db, $evaluationId, true);
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Error al crear la evaluación", "error" => $e->getMessage()]);
    }
}

// Función para actualizar una evaluación existente
function updateEvaluation($db) {
    try {
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Validar datos requeridos
        if (!isset($data->id) || !isset($data->moduleId)) {
            http_response_code(400);
            echo json_encode(["message" => "Datos incompletos. Se requieren id y moduleId"]);
            return;
        }
        
        // Verificar que la evaluación existe
        $checkQuery = "SELECT id FROM evaluation_settings WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$data->id]);
        
        if ($checkStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Evaluación no encontrada"]);
            return;
        }
        
        // Iniciar transacción
        $db->beginTransaction();
        
        // Si se cambia el módulo, verificar que no existe otra evaluación para ese módulo
        $currentModuleQuery = "SELECT module_id FROM evaluation_settings WHERE id = ?";
        $currentModuleStmt = $db->prepare($currentModuleQuery);
        $currentModuleStmt->execute([$data->id]);
        $currentModule = $currentModuleStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($currentModule['module_id'] != $data->moduleId) {
            $checkDuplicateQuery = "SELECT id FROM evaluation_settings WHERE module_id = ? AND id != ?";
            $checkDuplicateStmt = $db->prepare($checkDuplicateQuery);
            $checkDuplicateStmt->execute([$data->moduleId, $data->id]);
            
            if ($checkDuplicateStmt->rowCount() > 0) {
                http_response_code(400);
                echo json_encode(["message" => "Ya existe una evaluación para este módulo"]);
                $db->rollBack();
                return;
            }
        }
        
        // Actualizar la configuración de evaluación
        $evalQuery = "UPDATE evaluation_settings 
                      SET module_id = ?, passing_score = ?, max_attempts = ?, 
                          time_limit = ?, randomize_questions = ?, show_feedback = ? 
                      WHERE id = ?";
        $evalStmt = $db->prepare($evalQuery);
        $evalStmt->execute([
            $data->moduleId,
            $data->passingScore ?? 70,
            $data->maxAttempts ?? 3,
            $data->timeLimit ?? 0,
            $data->randomizeQuestions ? 1 : 0,
            $data->showFeedback ? 1 : 0,
            $data->id
        ]);
        
        // Actualizar preguntas
        if (isset($data->questions)) {
            // Primero, eliminar todas las preguntas existentes para este módulo
            $deleteQuestionsQuery = "DELETE FROM questions WHERE module_id = ?";
            $deleteQuestionsStmt = $db->prepare($deleteQuestionsQuery);
            $deleteQuestionsStmt->execute([$data->moduleId]);
            
            // Luego, insertar las nuevas preguntas
            foreach ($data->questions as $index => $question) {
                $questionQuery = "INSERT INTO questions 
                                (module_id, question_text, expected_answer, orden) 
                                VALUES (?, ?, ?, ?)";
                $questionStmt = $db->prepare($questionQuery);
                $questionStmt->execute([
                    $data->moduleId,
                    $question->question_text,
                    $question->expected_answer,
                    $index + 1
                ]);
            }
        }
        
        // Confirmar transacción
        $db->commit();
        
        // Obtener la evaluación actualizada
        getEvaluationById($db, $data->id, true);
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Error al actualizar la evaluación", "error" => $e->getMessage()]);
    }
}

// Función para eliminar una evaluación
function deleteEvaluation($db) {
    try {
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Validar datos requeridos
        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "ID de evaluación requerido"]);
            return;
        }
        
        // Verificar que la evaluación existe
        $checkQuery = "SELECT module_id FROM evaluation_settings WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$data->id]);
        
        if ($checkStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Evaluación no encontrada"]);
            return;
        }
        
        $evaluation = $checkStmt->fetch(PDO::FETCH_ASSOC);
        $moduleId = $evaluation['module_id'];
        
        // Iniciar transacción
        $db->beginTransaction();
        
        // Eliminar todas las preguntas relacionadas
        $deleteQuestionsQuery = "DELETE FROM questions WHERE module_id = ?";
        $deleteQuestionsStmt = $db->prepare($deleteQuestionsQuery);
        $deleteQuestionsStmt->execute([$moduleId]);
        
        // Eliminar la configuración de evaluación
        $deleteEvalQuery = "DELETE FROM evaluation_settings WHERE id = ?";
        $deleteEvalStmt = $db->prepare($deleteEvalQuery);
        $deleteEvalStmt->execute([$data->id]);
        
        // Confirmar transacción
        $db->commit();
        
        http_response_code(200);
        echo json_encode(["message" => "Evaluación eliminada correctamente"]);
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Error al eliminar la evaluación", "error" => $e->getMessage()]);
    }
}