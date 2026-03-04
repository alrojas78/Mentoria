<?php
// admin/proyectos.php — CRUD de proyectos (solo admin)
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
// Soporte X-HTTP-Method-Override para FormData PUT
if ($method === 'POST' && !empty($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
    $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
}

// === Acciones de miembros (proyecto_miembros) ===
$action = $_GET['action'] ?? $_POST['action'] ?? null;
if ($action) {
    $input = ($method !== 'GET') ? json_decode(file_get_contents('php://input'), true) : [];

    switch ($action) {
        case 'miembros':
            if ($method === 'GET') {
                // Listar miembros de un proyecto
                $proyectoId = intval($_GET['proyecto_id'] ?? 0);
                if (!$proyectoId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'proyecto_id requerido']);
                    exit;
                }
                $stmt = $db->prepare("
                    SELECT pm.id, pm.proyecto_id, pm.user_id, pm.rol_proyecto, pm.created_at,
                           u.name as nombre, u.email, u.role as rol_global
                    FROM proyecto_miembros pm
                    INNER JOIN users u ON u.id = pm.user_id
                    WHERE pm.proyecto_id = ?
                    ORDER BY pm.rol_proyecto ASC, u.name ASC
                ");
                $stmt->execute([$proyectoId]);
                echo json_encode(['success' => true, 'miembros' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            } elseif ($method === 'POST') {
                // Agregar miembro
                $proyectoId = intval($input['proyecto_id'] ?? 0);
                $userId = intval($input['user_id'] ?? 0);
                $rolProyecto = in_array($input['rol_proyecto'] ?? '', ['coordinador', 'supervisor']) ? $input['rol_proyecto'] : 'supervisor';

                if (!$proyectoId || !$userId) {
                    http_response_code(400);
                    echo json_encode(['error' => 'proyecto_id y user_id requeridos']);
                    exit;
                }

                try {
                    $stmt = $db->prepare("
                        INSERT INTO proyecto_miembros (proyecto_id, user_id, rol_proyecto)
                        VALUES (?, ?, ?)
                        ON DUPLICATE KEY UPDATE rol_proyecto = VALUES(rol_proyecto)
                    ");
                    $stmt->execute([$proyectoId, $userId, $rolProyecto]);
                    echo json_encode(['success' => true, 'message' => 'Miembro agregado/actualizado']);
                } catch (PDOException $e) {
                    http_response_code(500);
                    echo json_encode(['error' => 'Error agregando miembro: ' . $e->getMessage()]);
                }
            } elseif ($method === 'DELETE') {
                $id = intval($_GET['id'] ?? 0);
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'ID de membresía requerido']);
                    exit;
                }
                $stmt = $db->prepare("DELETE FROM proyecto_miembros WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode(['success' => true, 'message' => 'Miembro eliminado']);
            }
            exit;

        case 'buscar_usuarios':
            $q = trim($_GET['q'] ?? '');
            if (strlen($q) < 2) {
                echo json_encode(['success' => true, 'usuarios' => []]);
                exit;
            }
            $like = "%{$q}%";
            $stmt = $db->prepare("
                SELECT id, name as nombre, email, role as rol_global
                FROM users
                WHERE (name LIKE ? OR email LIKE ?)
                ORDER BY name ASC
                LIMIT 20
            ");
            $stmt->execute([$like, $like]);
            echo json_encode(['success' => true, 'usuarios' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            exit;
    }
}

// Directorio para logos de proyectos
$uploadDir = __DIR__ . '/../../uploads/proyectos/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

switch ($method) {
    case 'GET':
        $id = intval($_GET['id'] ?? 0);

        if ($id) {
            // Obtener proyecto por ID con documentos
            $stmt = $db->prepare("SELECT * FROM proyectos WHERE id = ?");
            $stmt->execute([$id]);
            $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$proyecto) {
                http_response_code(404);
                echo json_encode(['error' => 'Proyecto no encontrado']);
                exit;
            }

            if ($proyecto['config_json']) {
                $proyecto['config_json'] = json_decode($proyecto['config_json'], true);
            }

            // Documentos asignados
            $stmt = $db->prepare("SELECT documento_id FROM proyecto_documentos WHERE proyecto_id = ? ORDER BY orden ASC");
            $stmt->execute([$id]);
            $proyecto['documento_ids'] = $stmt->fetchAll(PDO::FETCH_COLUMN);

            echo json_encode(['success' => true, 'proyecto' => $proyecto]);
        } else {
            // Listar todos los proyectos
            $stmt = $db->query("
                SELECT p.*,
                    (SELECT COUNT(*) FROM proyecto_documentos WHERE proyecto_id = p.id) as doc_count,
                    (SELECT COUNT(*) FROM proyecto_miembros WHERE proyecto_id = p.id) as member_count
                FROM proyectos p
                ORDER BY p.nombre ASC
            ");
            $proyectos = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($proyectos as &$p) {
                if ($p['config_json']) {
                    $p['config_json'] = json_decode($p['config_json'], true);
                }
            }

            echo json_encode(['success' => true, 'proyectos' => $proyectos]);
        }
        break;

    case 'POST':
        // Crear proyecto — acepta FormData (para logo upload) o JSON
        $isFormData = !empty($_POST);

        if ($isFormData) {
            $nombre = trim($_POST['nombre'] ?? '');
            $slug = trim($_POST['slug'] ?? '');
            $dominio = trim($_POST['dominio_personalizado'] ?? '') ?: null;
            $colorPrimario = trim($_POST['color_primario'] ?? '#0f355b');
            $colorSecundario = trim($_POST['color_secundario'] ?? '#14b6cb');
            $tituloLanding = trim($_POST['titulo_landing'] ?? '') ?: null;
            $subtituloLanding = trim($_POST['subtitulo_landing'] ?? '') ?: null;
            $rolDefault = trim($_POST['rol_default'] ?? '') ?: null;
            $registroAbierto = intval($_POST['registro_abierto'] ?? 1);
            $documentoIds = json_decode($_POST['documento_ids'] ?? '[]', true) ?: [];
        } else {
            $input = json_decode(file_get_contents('php://input'), true);
            $nombre = trim($input['nombre'] ?? '');
            $slug = trim($input['slug'] ?? '');
            $dominio = trim($input['dominio_personalizado'] ?? '') ?: null;
            $colorPrimario = trim($input['color_primario'] ?? '#0f355b');
            $colorSecundario = trim($input['color_secundario'] ?? '#14b6cb');
            $tituloLanding = trim($input['titulo_landing'] ?? '') ?: null;
            $subtituloLanding = trim($input['subtitulo_landing'] ?? '') ?: null;
            $rolDefault = trim($input['rol_default'] ?? '') ?: null;
            $registroAbierto = intval($input['registro_abierto'] ?? 1);
            $documentoIds = $input['documento_ids'] ?? [];
        }

        if (!$nombre || !$slug) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre y slug son requeridos']);
            exit;
        }

        // Normalizar slug
        $slug = strtolower(preg_replace('/[^a-z0-9\-]/', '', preg_replace('/\s+/', '-', $slug)));

        // Procesar logo si hay upload
        $logoPath = null;
        if (!empty($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
            if (in_array($ext, $allowed)) {
                $filename = $slug . '_logo_' . time() . '.' . $ext;
                if (move_uploaded_file($_FILES['logo']['tmp_name'], $uploadDir . $filename)) {
                    $logoPath = 'uploads/proyectos/' . $filename;
                }
            }
        }

        // Auto-crear content_group si rol_default no existe
        if ($rolDefault) {
            $stmtCheck = $db->prepare("SELECT COUNT(*) FROM content_groups WHERE name = ?");
            $stmtCheck->execute([$rolDefault]);
            if ($stmtCheck->fetchColumn() == 0) {
                $stmtCreate = $db->prepare("INSERT INTO content_groups (name, description) VALUES (?, ?)");
                $stmtCreate->execute([$rolDefault, "Grupo auto-creado para proyecto: {$nombre}"]);
            }
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO proyectos (nombre, slug, dominio_personalizado, logo, color_primario, color_secundario,
                    titulo_landing, subtitulo_landing, rol_default, registro_abierto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $nombre, $slug, $dominio, $logoPath, $colorPrimario, $colorSecundario,
                $tituloLanding, $subtituloLanding, $rolDefault, $registroAbierto
            ]);
            $proyectoId = $db->lastInsertId();

            // Asignar documentos
            if (!empty($documentoIds)) {
                $stmtDoc = $db->prepare("INSERT INTO proyecto_documentos (proyecto_id, documento_id, orden) VALUES (?, ?, ?)");
                foreach ($documentoIds as $i => $docId) {
                    $stmtDoc->execute([$proyectoId, intval($docId), $i]);
                }
            }

            echo json_encode([
                'success' => true,
                'message' => 'Proyecto creado exitosamente',
                'proyecto_id' => $proyectoId
            ]);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate') !== false) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya existe un proyecto con ese slug']);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Error creando proyecto: ' . $e->getMessage()]);
            }
        }
        break;

    case 'PUT':
        // Actualizar proyecto — acepta FormData o JSON
        $isFormData = !empty($_POST);

        if ($isFormData) {
            $id = intval($_POST['id'] ?? 0);
            $nombre = trim($_POST['nombre'] ?? '');
            $slug = trim($_POST['slug'] ?? '');
            $dominio = trim($_POST['dominio_personalizado'] ?? '') ?: null;
            $colorPrimario = trim($_POST['color_primario'] ?? '#0f355b');
            $colorSecundario = trim($_POST['color_secundario'] ?? '#14b6cb');
            $tituloLanding = trim($_POST['titulo_landing'] ?? '') ?: null;
            $subtituloLanding = trim($_POST['subtitulo_landing'] ?? '') ?: null;
            $rolDefault = trim($_POST['rol_default'] ?? '') ?: null;
            $registroAbierto = intval($_POST['registro_abierto'] ?? 1);
            $activo = intval($_POST['activo'] ?? 1);
            $documentoIds = json_decode($_POST['documento_ids'] ?? '[]', true) ?: [];
            $configJsonPatch = isset($_POST['config_json']) ? json_decode($_POST['config_json'], true) : null;
        } else {
            $input = json_decode(file_get_contents('php://input'), true);
            $id = intval($input['id'] ?? 0);
            $nombre = trim($input['nombre'] ?? '');
            $slug = trim($input['slug'] ?? '');
            $dominio = trim($input['dominio_personalizado'] ?? '') ?: null;
            $colorPrimario = trim($input['color_primario'] ?? '#0f355b');
            $colorSecundario = trim($input['color_secundario'] ?? '#14b6cb');
            $tituloLanding = trim($input['titulo_landing'] ?? '') ?: null;
            $subtituloLanding = trim($input['subtitulo_landing'] ?? '') ?: null;
            $rolDefault = trim($input['rol_default'] ?? '') ?: null;
            $registroAbierto = intval($input['registro_abierto'] ?? 1);
            $activo = intval($input['activo'] ?? 1);
            $documentoIds = $input['documento_ids'] ?? [];
            $configJsonPatch = $input['config_json'] ?? null;
        }

        // Modo parcial: solo actualizar config_json (para Landing Editor)
        if ($id && $configJsonPatch !== null && !$nombre && !$slug) {
            try {
                // Leer config_json actual
                $stmtCfg = $db->prepare("SELECT config_json FROM proyectos WHERE id = ?");
                $stmtCfg->execute([$id]);
                $row = $stmtCfg->fetch(PDO::FETCH_ASSOC);
                if (!$row) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Proyecto no encontrado']);
                    exit;
                }
                $currentConfig = $row['config_json'] ? json_decode($row['config_json'], true) : [];
                // Merge: configJsonPatch keys sobreescriben las existentes
                $mergedConfig = array_merge($currentConfig, $configJsonPatch);

                $stmtUpd = $db->prepare("UPDATE proyectos SET config_json = ? WHERE id = ?");
                $stmtUpd->execute([json_encode($mergedConfig, JSON_UNESCAPED_UNICODE), $id]);

                echo json_encode(['success' => true, 'message' => 'config_json actualizado', 'config_json' => $mergedConfig]);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Error actualizando config_json: ' . $e->getMessage()]);
            }
            break;
        }

        if (!$id || !$nombre || !$slug) {
            http_response_code(400);
            echo json_encode(['error' => 'ID, nombre y slug son requeridos']);
            exit;
        }

        $slug = strtolower(preg_replace('/[^a-z0-9\-]/', '', preg_replace('/\s+/', '-', $slug)));

        // Procesar logo si hay nuevo upload
        $logoUpdate = '';
        $logoParams = [];
        if (!empty($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
            if (in_array($ext, $allowed)) {
                $filename = $slug . '_logo_' . time() . '.' . $ext;
                if (move_uploaded_file($_FILES['logo']['tmp_name'], $uploadDir . $filename)) {
                    $logoUpdate = ', logo = ?';
                    $logoParams = ['uploads/proyectos/' . $filename];
                }
            }
        }

        // Auto-crear content_group si rol_default no existe
        if ($rolDefault) {
            $stmtCheck = $db->prepare("SELECT COUNT(*) FROM content_groups WHERE name = ?");
            $stmtCheck->execute([$rolDefault]);
            if ($stmtCheck->fetchColumn() == 0) {
                $stmtCreate = $db->prepare("INSERT INTO content_groups (name, description) VALUES (?, ?)");
                $stmtCreate->execute([$rolDefault, "Grupo auto-creado para proyecto: {$nombre}"]);
            }
        }

        // Merge config_json si se envió junto con el update completo
        $configUpdate = '';
        $configParams = [];
        if ($configJsonPatch !== null) {
            $stmtCfg = $db->prepare("SELECT config_json FROM proyectos WHERE id = ?");
            $stmtCfg->execute([$id]);
            $rowCfg = $stmtCfg->fetch(PDO::FETCH_ASSOC);
            $currentConfig = ($rowCfg && $rowCfg['config_json']) ? json_decode($rowCfg['config_json'], true) : [];
            $mergedConfig = array_merge($currentConfig, $configJsonPatch);
            $configUpdate = ', config_json = ?';
            $configParams = [json_encode($mergedConfig, JSON_UNESCAPED_UNICODE)];
        }

        try {
            $sql = "UPDATE proyectos SET nombre = ?, slug = ?, dominio_personalizado = ?,
                    color_primario = ?, color_secundario = ?, titulo_landing = ?,
                    subtitulo_landing = ?, rol_default = ?, registro_abierto = ?, activo = ?
                    {$logoUpdate}{$configUpdate} WHERE id = ?";

            $params = [
                $nombre, $slug, $dominio, $colorPrimario, $colorSecundario,
                $tituloLanding, $subtituloLanding, $rolDefault, $registroAbierto, $activo
            ];
            $params = array_merge($params, $logoParams, $configParams, [$id]);

            $stmt = $db->prepare($sql);
            $stmt->execute($params);

            // Reemplazar documentos asignados
            $db->prepare("DELETE FROM proyecto_documentos WHERE proyecto_id = ?")->execute([$id]);
            if (!empty($documentoIds)) {
                $stmtDoc = $db->prepare("INSERT INTO proyecto_documentos (proyecto_id, documento_id, orden) VALUES (?, ?, ?)");
                foreach ($documentoIds as $i => $docId) {
                    $stmtDoc->execute([$id, intval($docId), $i]);
                }
            }

            echo json_encode(['success' => true, 'message' => 'Proyecto actualizado']);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate') !== false) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya existe un proyecto con ese slug']);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Error actualizando proyecto: ' . $e->getMessage()]);
            }
        }
        break;

    case 'DELETE':
        $id = intval($_GET['id'] ?? 0);

        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de proyecto requerido']);
            exit;
        }

        // Soft delete (desactivar)
        $stmt = $db->prepare("UPDATE proyectos SET activo = 0 WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => true, 'message' => 'Proyecto desactivado']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}
?>
