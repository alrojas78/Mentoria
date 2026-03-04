<?php
/**
 * wa-dashboard.php — Dashboard WA Training para clientes (no-admin)
 * Fase 11.8: Acceso cliente a métricas y conexión WA
 *
 * GET  ?action=status          → Estado conexión WA del proyecto
 * GET  ?action=programas       → Programas con conteos
 * GET  ?action=inscripciones&programa_id=X → Estudiantes con progreso
 * GET  ?action=interacciones&programa_id=X → Log paginado
 * GET  ?action=metricas        → Resumen consolidado
 * POST action=connect-whatsapp → Procesar OAuth code
 * POST action=disconnect-whatsapp → Desconectar WA
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAuth();
$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// --- Detectar proyecto del usuario por membresía ---
$proyectoId = null;
$memberRole = null; // 'coordinador' o 'supervisor'
$isAdmin = ($userData->role === 'admin');

$requestedPid = intval($_GET['proyecto_id'] ?? 0);

if ($isAdmin) {
    // Admin: acepta cualquier proyecto_id, siempre coordinador
    $proyectoId = $requestedPid ?: null;
    $memberRole = 'coordinador';
} else {
    if ($requestedPid) {
        // Verificar membresía en el proyecto solicitado
        $stmt = $db->prepare("SELECT rol_proyecto FROM proyecto_miembros WHERE user_id = ? AND proyecto_id = ?");
        $stmt->execute([$userData->id, $requestedPid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $proyectoId = $requestedPid;
            $memberRole = $row['rol_proyecto'];
        }
    }

    // Si no se encontró, buscar primer proyecto donde es miembro (priorizar coordinador)
    if (!$proyectoId) {
        $stmt = $db->prepare("
            SELECT pm.proyecto_id, pm.rol_proyecto
            FROM proyecto_miembros pm
            INNER JOIN proyectos p ON p.id = pm.proyecto_id
            WHERE pm.user_id = ? AND p.activo = 1
            ORDER BY FIELD(pm.rol_proyecto, 'coordinador', 'supervisor') ASC
            LIMIT 1
        ");
        $stmt->execute([$userData->id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $proyectoId = (int)$row['proyecto_id'];
            $memberRole = $row['rol_proyecto'];
        }
    }

    // Fallback legacy: detección por rol_default
    if (!$proyectoId) {
        $stmt = $db->prepare("SELECT id FROM proyectos WHERE rol_default = ? AND activo = 1 LIMIT 1");
        $stmt->execute([$userData->role]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $proyectoId = (int)$row['id'];
            $memberRole = 'supervisor'; // legacy access = read-only
        }
    }
}

$canManage = ($memberRole === 'coordinador');

if (!$proyectoId && !$isAdmin) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'No se encontró proyecto asociado a tu cuenta']);
    exit;
}

// === GET handlers ===
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'status';

    switch ($action) {

        case 'status':
            // Estado de conexión WA del proyecto
            if (!$proyectoId) {
                echo json_encode(['success' => true, 'status' => ['connected' => false]]);
                exit;
            }
            $stmt = $db->prepare("SELECT config_json FROM proyectos WHERE id = ? AND activo = 1");
            $stmt->execute([$proyectoId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $config = $row && $row['config_json'] ? json_decode($row['config_json'], true) : [];

            echo json_encode([
                'success' => true,
                'proyecto_id' => $proyectoId,
                'member_role' => $memberRole,
                'can_manage' => $canManage,
                'status' => [
                    'connected' => !empty($config['whatsapp_connected']),
                    'phone_number' => $config['whatsapp_number'] ?? null,
                    'display_name' => $config['whatsapp_display_name'] ?? null,
                    'business_name' => $config['whatsapp_business_name'] ?? null,
                    'connected_at' => $config['whatsapp_connected_at'] ?? null
                ]
            ]);
            break;

        case 'programas':
            // Programas del proyecto con conteos
            $sql = "
                SELECT wp.*,
                    d.titulo as documento_titulo,
                    (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = wp.id AND activo = 1) as total_entregas,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id) as total_inscripciones,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id AND estado = 'activo') as inscripciones_activas,
                    (SELECT COUNT(*) FROM wa_inscripciones WHERE programa_id = wp.id AND estado = 'completado') as inscripciones_completadas,
                    (SELECT AVG(sub.avg_score) FROM (
                        SELECT AVG(wi.evaluacion_score) as avg_score
                        FROM wa_interacciones wi
                        INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                        WHERE wins.programa_id = wp.id AND wi.evaluacion_score IS NOT NULL
                        GROUP BY wi.inscripcion_id
                    ) sub) as promedio_score
                FROM wa_programas wp
                LEFT JOIN documentos d ON d.id = wp.documento_id
                WHERE wp.proyecto_id = ?
                ORDER BY wp.created_at DESC
            ";
            $stmt = $db->prepare($sql);
            $stmt->execute([$proyectoId]);
            $programas = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($programas as &$p) {
                if ($p['config_json']) {
                    $p['config_json'] = json_decode($p['config_json'], true);
                }
                $p['promedio_score'] = $p['promedio_score'] ? round((float)$p['promedio_score'], 1) : null;
            }

            echo json_encode(['success' => true, 'programas' => $programas]);
            break;

        case 'inscripciones':
            // Estudiantes de un programa con progreso
            $programaId = intval($_GET['programa_id'] ?? 0);
            if (!$programaId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'programa_id requerido']);
                exit;
            }

            // Verificar que el programa pertenece al proyecto
            $stmtCheck = $db->prepare("SELECT id FROM wa_programas WHERE id = ? AND proyecto_id = ?");
            $stmtCheck->execute([$programaId, $proyectoId]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Programa no pertenece a tu proyecto']);
                exit;
            }

            $sql = "
                SELECT wins.*,
                    (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = wins.programa_id AND activo = 1) as total_entregas,
                    (SELECT COUNT(DISTINCT wi.entrega_id) FROM wa_interacciones wi
                        WHERE wi.inscripcion_id = wins.id
                        AND wi.tipo IN ('envio_contenido', 'envio_pregunta')
                        AND wi.estado_envio IN ('enviado', 'entregado', 'leido')) as entregas_enviadas,
                    (SELECT COUNT(DISTINCT wi.entrega_id) FROM wa_interacciones wi
                        WHERE wi.inscripcion_id = wins.id
                        AND wi.tipo = 'respuesta_estudiante') as entregas_respondidas,
                    (SELECT AVG(wi.evaluacion_score) FROM wa_interacciones wi
                        WHERE wi.inscripcion_id = wins.id
                        AND wi.evaluacion_score IS NOT NULL) as promedio_score
                FROM wa_inscripciones wins
                WHERE wins.programa_id = ?
                ORDER BY wins.created_at DESC
            ";
            $stmt = $db->prepare($sql);
            $stmt->execute([$programaId]);
            $inscripciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($inscripciones as &$ins) {
                $ins['promedio_score'] = $ins['promedio_score'] ? round((float)$ins['promedio_score'], 1) : null;
            }

            echo json_encode(['success' => true, 'inscripciones' => $inscripciones]);
            break;

        case 'interacciones':
            // Log paginado de interacciones
            $programaId = intval($_GET['programa_id'] ?? 0);
            if (!$programaId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'programa_id requerido']);
                exit;
            }

            // Verificar pertenencia
            $stmtCheck = $db->prepare("SELECT id FROM wa_programas WHERE id = ? AND proyecto_id = ?");
            $stmtCheck->execute([$programaId, $proyectoId]);
            if (!$stmtCheck->fetch()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Programa no pertenece a tu proyecto']);
                exit;
            }

            $page = max(1, intval($_GET['page'] ?? 1));
            $perPage = min(100, max(10, intval($_GET['per_page'] ?? 50)));
            $offset = ($page - 1) * $perPage;

            // Total
            $stmtCount = $db->prepare("
                SELECT COUNT(*) as total FROM wa_interacciones wi
                INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                WHERE wins.programa_id = ?
            ");
            $stmtCount->execute([$programaId]);
            $total = (int)$stmtCount->fetch(PDO::FETCH_ASSOC)['total'];

            $sql = "
                SELECT wi.*,
                    we.titulo as entrega_titulo, we.tipo as entrega_tipo, we.orden as entrega_orden,
                    wins.nombre as inscripcion_nombre, wins.telefono as inscripcion_telefono
                FROM wa_interacciones wi
                INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                LEFT JOIN wa_entregas we ON we.id = wi.entrega_id
                WHERE wins.programa_id = ?
                ORDER BY wi.created_at DESC
                LIMIT ? OFFSET ?
            ";
            $stmt = $db->prepare($sql);
            $stmt->execute([$programaId, $perPage, $offset]);
            $interacciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $totalPages = ceil($total / $perPage);
            echo json_encode([
                'success' => true,
                'interacciones' => $interacciones,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage,
                    'total_pages' => $totalPages,
                    'has_next' => $page < $totalPages,
                    'has_prev' => $page > 1
                ]
            ]);
            break;

        case 'metricas':
            // Resumen consolidado del proyecto
            $sql = "
                SELECT
                    (SELECT COUNT(*) FROM wa_programas WHERE proyecto_id = ? AND estado = 'activo') as programas_activos,
                    (SELECT COUNT(*) FROM wa_programas WHERE proyecto_id = ?) as programas_total,
                    (SELECT COUNT(*) FROM wa_inscripciones wins
                        INNER JOIN wa_programas wp ON wins.programa_id = wp.id
                        WHERE wp.proyecto_id = ?) as total_estudiantes,
                    (SELECT COUNT(*) FROM wa_inscripciones wins
                        INNER JOIN wa_programas wp ON wins.programa_id = wp.id
                        WHERE wp.proyecto_id = ? AND wins.estado = 'activo') as estudiantes_activos,
                    (SELECT COUNT(*) FROM wa_inscripciones wins
                        INNER JOIN wa_programas wp ON wins.programa_id = wp.id
                        WHERE wp.proyecto_id = ? AND wins.estado = 'completado') as estudiantes_completados,
                    (SELECT COUNT(*) FROM wa_interacciones wi
                        INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                        INNER JOIN wa_programas wp ON wins.programa_id = wp.id
                        WHERE wp.proyecto_id = ?) as total_interacciones,
                    (SELECT AVG(wi.evaluacion_score) FROM wa_interacciones wi
                        INNER JOIN wa_inscripciones wins ON wi.inscripcion_id = wins.id
                        INNER JOIN wa_programas wp ON wins.programa_id = wp.id
                        WHERE wp.proyecto_id = ? AND wi.evaluacion_score IS NOT NULL) as promedio_score_global
            ";
            $stmt = $db->prepare($sql);
            $stmt->execute([$proyectoId, $proyectoId, $proyectoId, $proyectoId, $proyectoId, $proyectoId, $proyectoId]);
            $metricas = $stmt->fetch(PDO::FETCH_ASSOC);

            // Tasa de completados
            $totalEst = (int)$metricas['total_estudiantes'];
            $completados = (int)$metricas['estudiantes_completados'];
            $metricas['tasa_completados'] = $totalEst > 0 ? round(($completados / $totalEst) * 100, 1) : 0;
            $metricas['promedio_score_global'] = $metricas['promedio_score_global'] ? round((float)$metricas['promedio_score_global'], 1) : null;

            echo json_encode(['success' => true, 'metricas' => $metricas]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no válida']);
    }
    exit;
}

// === POST handlers ===
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';

    // Para POST, el proyecto_id puede venir en el body (admin only)
    if ($isAdmin && !empty($input['proyecto_id'])) {
        $proyectoId = intval($input['proyecto_id']);
    }

    if (!$proyectoId) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'No se encontró proyecto asociado']);
        exit;
    }

    switch ($action) {

        case 'connect-whatsapp':
            // Solo coordinadores y admin pueden conectar
            if (!$canManage) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Solo coordinadores pueden conectar WhatsApp']);
                exit;
            }

            $code = $input['code'] ?? null;
            if (!$code) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Código de autorización requerido']);
                exit;
            }

            try {
                require_once __DIR__ . '/../utils/OperatixBridge.php';

                $stmt = $db->prepare("SELECT id, nombre, slug, config_json FROM proyectos WHERE id = ? AND activo = 1");
                $stmt->execute([$proyectoId]);
                $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$proyecto) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'Proyecto no encontrado']);
                    exit;
                }

                $configJson = $proyecto['config_json'] ? json_decode($proyecto['config_json'], true) : [];
                $bridge = OperatixBridge::getInstance();

                // Buscar/crear proyecto en servicio de mensajería
                $operatixProjectId = $configJson['operatix_project_id'] ?? null;
                if (!$operatixProjectId) {
                    $opProject = $bridge->getOrCreateProject(
                        "Mentoria: {$proyecto['nombre']}",
                        "Proyecto vinculado desde Mentoria (ID: {$proyecto['id']}, slug: {$proyecto['slug']})"
                    );
                    if (!$opProject || !isset($opProject['id'])) {
                        http_response_code(500);
                        echo json_encode(['success' => false, 'error' => 'Error configurando servicio de mensajería']);
                        exit;
                    }
                    $operatixProjectId = (int)$opProject['id'];
                }

                // Procesar OAuth
                $result = $bridge->connectWhatsApp($code, $operatixProjectId);
                if (!$result || empty($result['success'])) {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'error' => $result['error'] ?? 'Error conectando WhatsApp Business'
                    ]);
                    exit;
                }

                // Guardar en config_json
                $configJson['operatix_project_id'] = $operatixProjectId;
                $configJson['whatsapp_connected'] = true;
                $configJson['whatsapp_number'] = $result['whatsapp']['phone'] ?? null;
                $configJson['whatsapp_display_name'] = $result['whatsapp']['display_name'] ?? null;
                $configJson['whatsapp_business_name'] = $result['business_name'] ?? null;
                $configJson['whatsapp_token_id'] = $result['token_id'] ?? null;
                $configJson['whatsapp_connected_at'] = date('Y-m-d H:i:s');

                $stmt = $db->prepare("UPDATE proyectos SET config_json = ? WHERE id = ?");
                $stmt->execute([json_encode($configJson, JSON_UNESCAPED_UNICODE), $proyectoId]);

                // Configurar webhook forward
                try {
                    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                    $host = $_SERVER['HTTP_HOST'] ?? 'mentoria.ateneo.co';
                    $forwardUrl = "{$protocol}://{$host}/backend/api/webhook/wa-respuesta.php";
                    $bridge->updateProjectSettings($operatixProjectId, [
                        'webhook_forward_url' => $forwardUrl
                    ]);
                } catch (Exception $whErr) {
                    error_log('wa-dashboard connect: Error configurando webhook: ' . $whErr->getMessage());
                }

                echo json_encode([
                    'success' => true,
                    'message' => 'WhatsApp Business conectado exitosamente',
                    'whatsapp' => [
                        'connected' => true,
                        'phone_number' => $configJson['whatsapp_number'],
                        'display_name' => $configJson['whatsapp_display_name'],
                        'business_name' => $configJson['whatsapp_business_name']
                    ]
                ]);
            } catch (Exception $e) {
                error_log('wa-dashboard connect Error: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error interno al conectar WhatsApp']);
            }
            break;

        case 'disconnect-whatsapp':
            // Solo coordinadores y admin pueden desconectar
            if (!$canManage) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Solo coordinadores pueden desconectar WhatsApp']);
                exit;
            }

            try {
                require_once __DIR__ . '/../utils/OperatixBridge.php';

                $stmt = $db->prepare("SELECT config_json FROM proyectos WHERE id = ? AND activo = 1");
                $stmt->execute([$proyectoId]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $configJson = $row && $row['config_json'] ? json_decode($row['config_json'], true) : [];

                // Desconectar en servicio de mensajería si hay proyecto vinculado
                if (!empty($configJson['operatix_project_id'])) {
                    try {
                        $bridge = OperatixBridge::getInstance();
                        $bridge->disconnectWhatsApp($configJson['operatix_project_id']);
                    } catch (Exception $bridgeErr) {
                        error_log('wa-dashboard disconnect bridge error: ' . $bridgeErr->getMessage());
                    }
                }

                // Limpiar config_json
                unset($configJson['whatsapp_connected']);
                unset($configJson['whatsapp_number']);
                unset($configJson['whatsapp_display_name']);
                unset($configJson['whatsapp_business_name']);
                unset($configJson['whatsapp_token_id']);
                unset($configJson['whatsapp_connected_at']);

                $stmt = $db->prepare("UPDATE proyectos SET config_json = ? WHERE id = ?");
                $stmt->execute([json_encode($configJson, JSON_UNESCAPED_UNICODE), $proyectoId]);

                echo json_encode(['success' => true, 'message' => 'WhatsApp Business desconectado']);
            } catch (Exception $e) {
                error_log('wa-dashboard disconnect Error: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error al desconectar WhatsApp']);
            }
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción POST no válida']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Método no permitido']);
