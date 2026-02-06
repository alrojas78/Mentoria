<?php
/**
 * API Endpoint: /api/reto.php
 * Maneja todas las operaciones relacionadas con el modo Reto semanal
 *
 * Métodos:
 * GET  - Verificar reto pendiente / Obtener historial
 * POST - Enviar respuesta a reto
 *
 * Parámetros GET:
 * - action: 'verificar' | 'historial' | 'admin_stats' | 'reto_detalle'
 * - document_id: ID del documento
 * - user_id: ID del usuario
 * - reto_id: ID del reto (para reto_detalle)
 *
 * Parámetros POST:
 * - action: 'responder' | 'generar'
 * - reto_id: ID del reto (para responder)
 * - user_id: ID del usuario
 * - respuesta: Respuesta del usuario
 * - document_id: ID del documento (para generar)
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/RetoService.php';

try {
    $database = new Database();
    $db = $database->getConnection();
    $retoService = new RetoService($db);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'verificar';
        $documentId = isset($_GET['document_id']) ? intval($_GET['document_id']) : null;
        $userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
        $retoId = isset($_GET['reto_id']) ? intval($_GET['reto_id']) : null;

        switch ($action) {
            case 'verificar':
                if (!$documentId) {
                    throw new Exception('document_id es requerido');
                }
                if (!$userId) {
                    throw new Exception('user_id es requerido');
                }
                $resultado = $retoService->verificarRetoPendiente($documentId, $userId);
                break;

            case 'historial':
                if (!$documentId) {
                    throw new Exception('document_id es requerido');
                }
                if (!$userId) {
                    throw new Exception('user_id es requerido');
                }
                $limite = isset($_GET['limite']) ? intval($_GET['limite']) : 10;
                $resultado = $retoService->obtenerHistorialRetos($documentId, $userId, $limite);
                break;

            case 'admin_stats':
                if (!$documentId) {
                    throw new Exception('document_id es requerido');
                }
                $resultado = $retoService->obtenerEstadisticasAdmin($documentId);
                break;

            case 'reto_detalle':
                if (!$retoId) {
                    throw new Exception('reto_id es requerido');
                }
                $resultado = $retoService->obtenerRespuestasReto($retoId);
                break;

            default:
                throw new Exception('Acción no válida');
        }

        echo json_encode($resultado);

    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data) {
            throw new Exception('Datos JSON inválidos');
        }

        $action = $data['action'] ?? 'responder';

        switch ($action) {
            case 'responder':
                $retoId = isset($data['reto_id']) ? intval($data['reto_id']) : null;
                $userId = isset($data['user_id']) ? intval($data['user_id']) : null;
                $respuesta = $data['respuesta'] ?? null;

                if (!$retoId || !$userId || !$respuesta) {
                    throw new Exception('reto_id, user_id y respuesta son requeridos');
                }

                $resultado = $retoService->evaluarRespuesta($retoId, $userId, $respuesta);
                break;

            case 'generar':
                $documentId = isset($data['document_id']) ? intval($data['document_id']) : null;
                $diaReto = $data['dia_reto'] ?? null;

                if (!$documentId) {
                    throw new Exception('document_id es requerido');
                }

                $resultado = $retoService->generarReto($documentId, $diaReto);
                break;

            case 'generar_automatico':
                // Para el cron job - genera retos para todos los documentos
                $resultado = $retoService->generarRetosAutomaticos();
                break;

            default:
                throw new Exception('Acción no válida');
        }

        echo json_encode($resultado);

    } else {
        throw new Exception('Método no permitido');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
