<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/config.php';
require_once '../../config/db.php';
require_once '../../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAdmin();

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $cohorte_id = intval($_GET['cohorte_id'] ?? 0);

        if (!$cohorte_id) {
            http_response_code(400);
            echo json_encode(['error' => 'cohorte_id es requerido']);
            exit;
        }

        $stmt = $db->prepare("
            SELECT r.*, p.nombre as plantilla_nombre
            FROM reglas_recordatorio r
            LEFT JOIN plantillas_mensaje p ON r.plantilla_id = p.id
            WHERE r.cohorte_id = ?
            ORDER BY r.etapa, r.numero_recordatorio
        ");
        $stmt->execute([$cohorte_id]);
        $reglas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'reglas' => $reglas]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);

        // Actualización masiva de reglas de una cohorte
        if (isset($input['reglas']) && is_array($input['reglas'])) {
            $cohorte_id = intval($input['cohorte_id'] ?? 0);
            if (!$cohorte_id) {
                http_response_code(400);
                echo json_encode(['error' => 'cohorte_id es requerido']);
                exit;
            }

            $db->beginTransaction();
            try {
                foreach ($input['reglas'] as $regla) {
                    $id = intval($regla['id'] ?? 0);
                    if (!$id) continue;

                    $stmt = $db->prepare("
                        UPDATE reglas_recordatorio
                        SET dias_trigger = ?, canal = ?, plantilla_id = ?, activa = ?
                        WHERE id = ? AND cohorte_id = ?
                    ");
                    $stmt->execute([
                        intval($regla['dias_trigger']),
                        $regla['canal'] ?? 'email',
                        $regla['plantilla_id'] ? intval($regla['plantilla_id']) : null,
                        intval($regla['activa'] ?? 1),
                        $id,
                        $cohorte_id
                    ]);
                }
                $db->commit();
                echo json_encode(['success' => true, 'message' => 'Reglas actualizadas']);
            } catch (PDOException $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode(['error' => 'Error actualizando reglas: ' . $e->getMessage()]);
            }
            break;
        }

        // Actualización individual
        $id = intval($input['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de regla requerido']);
            exit;
        }

        $stmt = $db->prepare("
            UPDATE reglas_recordatorio
            SET dias_trigger = ?, canal = ?, plantilla_id = ?, activa = ?
            WHERE id = ?
        ");
        $stmt->execute([
            intval($input['dias_trigger']),
            $input['canal'] ?? 'email',
            isset($input['plantilla_id']) ? intval($input['plantilla_id']) : null,
            intval($input['activa'] ?? 1),
            $id
        ]);

        echo json_encode(['success' => true, 'message' => 'Regla actualizada']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
