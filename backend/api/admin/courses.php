<?php
// backend/api/admin/courses.php
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
        // Si se proporciona ID, obtener un curso específico
        if (isset($_GET['id'])) {
            getCourseById($db, $_GET['id']);
        } else {
            // Si no, obtener todos los cursos
            getAllCourses($db);
        }
        break;
        
    case 'POST':
        // Crear un nuevo curso
        createCourse($db);
        break;
        
    case 'PUT':
        // Actualizar un curso existente
        updateCourse($db);
        break;
        
    case 'DELETE':
        // Eliminar un curso
        deleteCourse($db);
        break;
        
    default:
        http_response_code(405);
        echo json_encode(["message" => "Método no permitido"]);
        break;
}

// Función para obtener todos los cursos
function getAllCourses($db) {
    try {
        $query = "SELECT * FROM courses ORDER BY created DESC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        
        $courses = [];
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $course = $row;
            
            // Obtener módulos para cada curso
            $moduleQuery = "SELECT * FROM modules WHERE curso_id = ? ORDER BY orden ASC";
            $moduleStmt = $db->prepare($moduleQuery);
            $moduleStmt->execute([$row['id']]);
            
            $modules = [];
            
            while ($moduleRow = $moduleStmt->fetch(PDO::FETCH_ASSOC)) {
                $module = $moduleRow;
                
                // Obtener lecciones para cada módulo
                $lessonQuery = "SELECT * FROM lessons WHERE module_id = ? ORDER BY orden ASC";
                $lessonStmt = $db->prepare($lessonQuery);
                $lessonStmt->execute([$moduleRow['id']]);
                
                $module['lessons'] = $lessonStmt->fetchAll(PDO::FETCH_ASSOC);
                $modules[] = $module;
            }
            
            $course['modules'] = $modules;
            $courses[] = $course;
        }
        
        http_response_code(200);
        echo json_encode($courses);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["message" => "Error al obtener cursos", "error" => $e->getMessage()]);
    }
}

// Función para obtener un curso específico
function getCourseById($db, $id) {
    try {
        $query = "SELECT * FROM courses WHERE id = ?";
        $stmt = $db->prepare($query);
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Curso no encontrado"]);
            return;
        }
        
        $course = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Obtener módulos para el curso
        $moduleQuery = "SELECT * FROM modules WHERE curso_id = ? ORDER BY orden ASC";
        $moduleStmt = $db->prepare($moduleQuery);
        $moduleStmt->execute([$id]);
        
        $modules = [];
        
        while ($moduleRow = $moduleStmt->fetch(PDO::FETCH_ASSOC)) {
            $module = $moduleRow;
            
            // Obtener lecciones para cada módulo
            $lessonQuery = "SELECT * FROM lessons WHERE module_id = ? ORDER BY orden ASC";
            $lessonStmt = $db->prepare($lessonQuery);
            $lessonStmt->execute([$moduleRow['id']]);
            
            $module['lessons'] = $lessonStmt->fetchAll(PDO::FETCH_ASSOC);
            $modules[] = $module;
        }
        
        $course['modules'] = $modules;
        
        http_response_code(200);
        echo json_encode($course);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["message" => "Error al obtener el curso", "error" => $e->getMessage()]);
    }
}

// Función para crear un nuevo curso
function createCourse($db) {
    try {
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Validar datos requeridos
        if (!isset($data->titulo) || !isset($data->descripcion)) {
            http_response_code(400);
            echo json_encode(["message" => "Datos incompletos. Se requieren título y descripción"]);
            return;
        }
        
        // Iniciar transacción
        $db->beginTransaction();
        
        // Insertar el curso
        $courseQuery = "INSERT INTO courses (titulo, descripcion, imagen, created) 
                       VALUES (?, ?, ?, NOW())";
        $courseStmt = $db->prepare($courseQuery);
        $courseStmt->execute([
            $data->titulo,
            $data->descripcion,
            $data->imagen ?? null
        ]);
        
        $courseId = $db->lastInsertId();
        
        // Insertar módulos y lecciones si existen
        if (isset($data->modules) && is_array($data->modules)) {
            foreach ($data->modules as $moduleIndex => $module) {
                $moduleQuery = "INSERT INTO modules (curso_id, titulo, descripcion, orden) 
                              VALUES (?, ?, ?, ?)";
                $moduleStmt = $db->prepare($moduleQuery);
                $moduleStmt->execute([
                    $courseId,
                    $module->titulo,
                    $module->descripcion ?? '',
                    $moduleIndex + 1
                ]);
                
                $moduleId = $db->lastInsertId();
                
                // Insertar lecciones si existen
                if (isset($module->lessons) && is_array($module->lessons)) {
                    foreach ($module->lessons as $lessonIndex => $lesson) {
                        $lessonQuery = "INSERT INTO lessons (curso_id, module_id, titulo, contenido, orden) 
                                      VALUES (?, ?, ?, ?, ?)";
                        $lessonStmt = $db->prepare($lessonQuery);
                        $lessonStmt->execute([
                            $courseId,
                            $moduleId,
                            $lesson->titulo,
                            $lesson->contenido ?? '',
                            $lessonIndex + 1
                        ]);
                    }
                }
            }
        }
        
        // Confirmar transacción
        $db->commit();
        
        // Obtener el curso completo con sus módulos y lecciones
        getCourseById($db, $courseId);
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Error al crear el curso", "error" => $e->getMessage()]);
    }
}

// Función para actualizar un curso existente
function updateCourse($db) {
    try {
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Validar datos requeridos
        if (!isset($data->id) || !isset($data->titulo) || !isset($data->descripcion)) {
            http_response_code(400);
            echo json_encode(["message" => "Datos incompletos. Se requieren id, título y descripción"]);
            return;
        }
        
        // Verificar que el curso existe
        $checkQuery = "SELECT id FROM courses WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$data->id]);
        
        if ($checkStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Curso no encontrado"]);
            return;
        }
        
        // Iniciar transacción
        $db->beginTransaction();
        
        // Actualizar el curso
        $courseQuery = "UPDATE courses 
                       SET titulo = ?, descripcion = ?, imagen = ? 
                       WHERE id = ?";
        $courseStmt = $db->prepare($courseQuery);
        $courseStmt->execute([
            $data->titulo,
            $data->descripcion,
            $data->imagen ?? null,
            $data->id
        ]);
        
        // Actualizar módulos y lecciones
        if (isset($data->modules) && is_array($data->modules)) {
            // Primero, eliminar módulos que ya no están
            $existingModuleIds = [];
            foreach ($data->modules as $module) {
                if (isset($module->id) && substr($module->id, 0, 5) !== 'temp-') {
                    $existingModuleIds[] = $module->id;
                }
            }
            
            $placeholders = count($existingModuleIds) > 0 ? str_repeat('?,', count($existingModuleIds) - 1) . '?' : '';
            $deleteModulesQuery = "DELETE FROM modules WHERE curso_id = ? " . 
                                 (count($existingModuleIds) > 0 ? "AND id NOT IN ($placeholders)" : "");
            
            $deleteParams = [$data->id];
            if (count($existingModuleIds) > 0) {
                $deleteParams = array_merge($deleteParams, $existingModuleIds);
            }
            
            $deleteModulesStmt = $db->prepare($deleteModulesQuery);
            $deleteModulesStmt->execute($deleteParams);
            
            // Luego, actualizar o insertar módulos
            foreach ($data->modules as $moduleIndex => $module) {
                if (isset($module->id) && substr($module->id, 0, 5) !== 'temp-') {
                    // Actualizar módulo existente
                    $moduleQuery = "UPDATE modules 
                                  SET titulo = ?, descripcion = ?, orden = ? 
                                  WHERE id = ?";
                    $moduleStmt = $db->prepare($moduleQuery);
                    $moduleStmt->execute([
                        $module->titulo,
                        $module->descripcion ?? '',
                        $moduleIndex + 1,
                        $module->id
                    ]);
                    
                    $moduleId = $module->id;
                } else {
                    // Insertar nuevo módulo
                    $moduleQuery = "INSERT INTO modules (curso_id, titulo, descripcion, orden) 
                                  VALUES (?, ?, ?, ?)";
                    $moduleStmt = $db->prepare($moduleQuery);
                    $moduleStmt->execute([
                        $data->id,
                        $module->titulo,
                        $module->descripcion ?? '',
                        $moduleIndex + 1
                    ]);
                    
                    $moduleId = $db->lastInsertId();
                }
                
                // Actualizar o insertar lecciones
                if (isset($module->lessons) && is_array($module->lessons)) {
                    // Eliminar lecciones que ya no están
                    $existingLessonIds = [];
                    foreach ($module->lessons as $lesson) {
                        if (isset($lesson->id) && substr($lesson->id, 0, 11) !== 'temp-lesson') {
                            $existingLessonIds[] = $lesson->id;
                        }
                    }
                    
                    $lessonPlaceholders = count($existingLessonIds) > 0 ? str_repeat('?,', count($existingLessonIds) - 1) . '?' : '';
                    $deleteLessonsQuery = "DELETE FROM lessons WHERE module_id = ? " . 
                                         (count($existingLessonIds) > 0 ? "AND id NOT IN ($lessonPlaceholders)" : "");
                    
                    $deleteLessonParams = [$moduleId];
                    if (count($existingLessonIds) > 0) {
                        $deleteLessonParams = array_merge($deleteLessonParams, $existingLessonIds);
                    }
                    
                    $deleteLessonsStmt = $db->prepare($deleteLessonsQuery);
                    $deleteLessonsStmt->execute($deleteLessonParams);
                    
                    // Actualizar o insertar lecciones
                    foreach ($module->lessons as $lessonIndex => $lesson) {
                        if (isset($lesson->id) && substr($lesson->id, 0, 11) !== 'temp-lesson') {
                            // Actualizar lección existente
                            $lessonQuery = "UPDATE lessons 
                                          SET titulo = ?, contenido = ?, orden = ? 
                                          WHERE id = ?";
                            $lessonStmt = $db->prepare($lessonQuery);
                            $lessonStmt->execute([
                                $lesson->titulo,
                                $lesson->contenido ?? '',
                                $lessonIndex + 1,
                                $lesson->id
                            ]);
                        } else {
                            // Insertar nueva lección
                            $lessonQuery = "INSERT INTO lessons (curso_id, module_id, titulo, contenido, orden) 
                                          VALUES (?, ?, ?, ?, ?)";
                            $lessonStmt = $db->prepare($lessonQuery);
                            $lessonStmt->execute([
                                $data->id,
                                $moduleId,
                                $lesson->titulo,
                                $lesson->contenido ?? '',
                                $lessonIndex + 1
                            ]);
                        }
                    }
                } else {
                    // Si no hay lecciones, eliminar todas las existentes para este módulo
                    $deleteLessonsQuery = "DELETE FROM lessons WHERE module_id = ?";
                    $deleteLessonsStmt = $db->prepare($deleteLessonsQuery);
                    $deleteLessonsStmt->execute([$moduleId]);
                }
            }
        } else {
            // Si no hay módulos, eliminar todos los existentes para este curso
            $deleteModulesQuery = "DELETE FROM modules WHERE curso_id = ?";
            $deleteModulesStmt = $db->prepare($deleteModulesQuery);
            $deleteModulesStmt->execute([$data->id]);
        }
        
        // Confirmar transacción
        $db->commit();
        
        // Obtener el curso actualizado
        getCourseById($db, $data->id);
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Error al actualizar el curso", "error" => $e->getMessage()]);
    }
}

// Función para eliminar un curso
function deleteCourse($db) {
    try {
        // Obtener datos enviados
        $data = json_decode(file_get_contents("php://input"));
        
        // Validar datos requeridos
        if (!isset($data->id)) {
            http_response_code(400);
            echo json_encode(["message" => "ID de curso requerido"]);
            return;
        }
        
        // Verificar que el curso existe
        $checkQuery = "SELECT id FROM courses WHERE id = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$data->id]);
        
        if ($checkStmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(["message" => "Curso no encontrado"]);
            return;
        }
        
        // Iniciar transacción
        $db->beginTransaction();
        
        // Las restricciones de clave externa con ON DELETE CASCADE deberían encargarse 
        // de eliminar los módulos, lecciones y progreso relacionados
        
        // Eliminar el curso
        $deleteQuery = "DELETE FROM courses WHERE id = ?";
        $deleteStmt = $db->prepare($deleteQuery);
        $deleteStmt->execute([$data->id]);
        
        // Confirmar transacción
        $db->commit();
        
        http_response_code(200);
        echo json_encode(["message" => "Curso eliminado correctamente"]);
    } catch (Exception $e) {
        // Revertir transacción en caso de error
        $db->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Error al eliminar el curso", "error" => $e->getMessage()]);
    }
}