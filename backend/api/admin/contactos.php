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
        $search = $_GET['search'] ?? '';
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(10, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $cohorte_id = intval($_GET['cohorte_id'] ?? 0);

        if ($cohorte_id) {
            // Contactos de una cohorte específica (con estado de matrícula)
            $where = "WHERE m.cohorte_id = ?";
            $params = [$cohorte_id];

            if ($search) {
                $where .= " AND (c.nombre LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)";
                $searchParam = "%{$search}%";
                $params = array_merge($params, [$searchParam, $searchParam, $searchParam]);
            }

            $countStmt = $db->prepare("SELECT COUNT(*) FROM contactos c INNER JOIN matriculas m ON c.id = m.contacto_id {$where}");
            $countStmt->execute($params);
            $total = $countStmt->fetchColumn();

            $stmt = $db->prepare("
                SELECT c.*, m.estado as estado_matricula, m.etapa_actual, m.id as matricula_id,
                       m.fecha_invitacion, m.fecha_registro, m.recordatorios_enviados
                FROM contactos c
                INNER JOIN matriculas m ON c.id = m.contacto_id
                {$where}
                ORDER BY c.nombre ASC
                LIMIT {$limit} OFFSET {$offset}
            ");
            $stmt->execute($params);
        } else {
            // Todos los contactos
            $where = "WHERE 1=1";
            $params = [];

            if ($search) {
                $where .= " AND (c.nombre LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)";
                $searchParam = "%{$search}%";
                $params = [$searchParam, $searchParam, $searchParam];
            }

            $countStmt = $db->prepare("SELECT COUNT(*) FROM contactos c {$where}");
            $countStmt->execute($params);
            $total = $countStmt->fetchColumn();

            $stmt = $db->prepare("
                SELECT c.*,
                    (SELECT COUNT(*) FROM matriculas m WHERE m.contacto_id = c.id) as total_matriculas
                FROM contactos c
                {$where}
                ORDER BY c.nombre ASC
                LIMIT {$limit} OFFSET {$offset}
            ");
            $stmt->execute($params);
        }

        $contactos = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'contactos' => $contactos,
            'total' => intval($total),
            'page' => $page,
            'pages' => ceil($total / $limit)
        ]);
        break;

    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);

        // Importación masiva CSV
        if (isset($input['importar']) && $input['importar'] === true) {
            $contactos = $input['contactos'] ?? [];
            $cohorte_id = intval($input['cohorte_id'] ?? 0);

            if (empty($contactos)) {
                http_response_code(400);
                echo json_encode(['error' => 'Lista de contactos vacía']);
                exit;
            }

            $importados = 0;
            $duplicados = 0;
            $errores = 0;
            $detalles = [];

            $db->beginTransaction();
            try {
                foreach ($contactos as $idx => $contacto) {
                    $nombre = trim($contacto['nombre'] ?? '');
                    $email = trim($contacto['email'] ?? '');
                    $telefono = trim($contacto['telefono'] ?? '');
                    $whatsapp = trim($contacto['whatsapp'] ?? $telefono);
                    $institucion = trim($contacto['institucion'] ?? '');
                    $convenio = trim($contacto['convenio'] ?? '');
                    $cargo = trim($contacto['cargo'] ?? '');

                    if (!$nombre) {
                        $errores++;
                        $detalles[] = "Fila {$idx}: nombre vacío";
                        continue;
                    }

                    // Verificar duplicado por email o teléfono
                    $existente = null;
                    if ($email) {
                        $stmt = $db->prepare("SELECT id FROM contactos WHERE email = ?");
                        $stmt->execute([$email]);
                        $existente = $stmt->fetch(PDO::FETCH_ASSOC);
                    }
                    if (!$existente && $telefono) {
                        $stmt = $db->prepare("SELECT id FROM contactos WHERE telefono = ?");
                        $stmt->execute([$telefono]);
                        $existente = $stmt->fetch(PDO::FETCH_ASSOC);
                    }

                    if ($existente) {
                        $contactoId = $existente['id'];
                        $duplicados++;
                    } else {
                        // Generar token único de registro
                        $token = bin2hex(random_bytes(32));

                        $stmt = $db->prepare("
                            INSERT INTO contactos (nombre, email, telefono, whatsapp, institucion, convenio, cargo, token_registro)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                        $stmt->execute([$nombre, $email ?: null, $telefono ?: null, $whatsapp ?: null, $institucion ?: null, $convenio ?: null, $cargo ?: null, $token]);
                        $contactoId = $db->lastInsertId();
                        $importados++;
                    }

                    // Si hay cohorte, crear matrícula
                    if ($cohorte_id) {
                        $stmt = $db->prepare("SELECT id FROM matriculas WHERE contacto_id = ? AND cohorte_id = ?");
                        $stmt->execute([$contactoId, $cohorte_id]);
                        if (!$stmt->fetch()) {
                            $stmt = $db->prepare("
                                INSERT INTO matriculas (contacto_id, cohorte_id, estado, etapa_actual)
                                VALUES (?, ?, 'invitado', 'pre_registro')
                            ");
                            $stmt->execute([$contactoId, $cohorte_id]);
                        }
                    }
                }
                $db->commit();

                echo json_encode([
                    'success' => true,
                    'message' => "Importación completada",
                    'importados' => $importados,
                    'duplicados' => $duplicados,
                    'errores' => $errores,
                    'detalles' => $detalles
                ]);
            } catch (PDOException $e) {
                $db->rollBack();
                http_response_code(500);
                echo json_encode(['error' => 'Error en importación: ' . $e->getMessage()]);
            }
            break;
        }

        // Crear contacto individual
        $nombre = trim($input['nombre'] ?? '');
        $email = trim($input['email'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $whatsapp = trim($input['whatsapp'] ?? $telefono);
        $institucion = trim($input['institucion'] ?? '');
        $convenio = trim($input['convenio'] ?? '');
        $cargo = trim($input['cargo'] ?? '');
        $cohorte_id = intval($input['cohorte_id'] ?? 0);

        if (!$nombre) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre es requerido']);
            exit;
        }

        $token = bin2hex(random_bytes(32));

        try {
            $stmt = $db->prepare("
                INSERT INTO contactos (nombre, email, telefono, whatsapp, institucion, convenio, cargo, token_registro)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$nombre, $email ?: null, $telefono ?: null, $whatsapp ?: null, $institucion ?: null, $convenio ?: null, $cargo ?: null, $token]);

            $contactoId = $db->lastInsertId();

            // Si hay cohorte, crear matrícula
            if ($cohorte_id) {
                $stmt = $db->prepare("
                    INSERT INTO matriculas (contacto_id, cohorte_id, estado, etapa_actual)
                    VALUES (?, ?, 'invitado', 'pre_registro')
                ");
                $stmt->execute([$contactoId, $cohorte_id]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Contacto creado',
                'contacto_id' => $contactoId
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error creando contacto: ' . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de contacto requerido']);
            exit;
        }

        $nombre = trim($input['nombre'] ?? '');
        $email = trim($input['email'] ?? '');
        $telefono = trim($input['telefono'] ?? '');
        $whatsapp = trim($input['whatsapp'] ?? '');
        $institucion = trim($input['institucion'] ?? '');
        $convenio = trim($input['convenio'] ?? '');
        $cargo = trim($input['cargo'] ?? '');

        if (!$nombre) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre es requerido']);
            exit;
        }

        $stmt = $db->prepare("
            UPDATE contactos SET nombre = ?, email = ?, telefono = ?, whatsapp = ?, institucion = ?, convenio = ?, cargo = ?
            WHERE id = ?
        ");
        $stmt->execute([$nombre, $email ?: null, $telefono ?: null, $whatsapp ?: null, $institucion ?: null, $convenio ?: null, $cargo ?: null, $id]);

        echo json_encode(['success' => true, 'message' => 'Contacto actualizado']);
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de contacto requerido']);
            exit;
        }

        $stmt = $db->prepare("DELETE FROM contactos WHERE id = ?");
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Contacto no encontrado']);
            exit;
        }

        echo json_encode(['success' => true, 'message' => 'Contacto eliminado']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
