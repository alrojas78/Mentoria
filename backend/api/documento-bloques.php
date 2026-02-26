<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config/config.php';
require_once '../config/db.php';
require_once '../middleware/AuthMiddleware.php';
require_once '../models/DocumentoBloque.php';

// Validate authentication
$userData = AuthMiddleware::requireAuth();

$database = new Database();
$db = $database->getConnection();
$bloqueModel = new DocumentoBloque($db);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $documentoId = isset($_GET['documento_id']) ? intval($_GET['documento_id']) : null;
    $bloqueId = isset($_GET['bloque_id']) ? intval($_GET['bloque_id']) : null;
    $titulo = isset($_GET['titulo']) ? $_GET['titulo'] : null;

    if (!$documentoId) {
        http_response_code(400);
        echo json_encode(['error' => 'documento_id es requerido']);
        exit;
    }

    // Si se pide un bloque específico por ID
    if ($bloqueId) {
        $bloque = $bloqueModel->getById($bloqueId);
        if ($bloque && $bloque['documento_id'] == $documentoId) {
            echo json_encode(['success' => true, 'bloque' => $bloque]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Bloque no encontrado']);
        }
        exit;
    }

    // Si se pide por título (para function calling del Realtime API)
    if ($titulo) {
        $bloque = $bloqueModel->getByDocumentoAndTitulo($documentoId, $titulo);
        if ($bloque) {
            echo json_encode(['success' => true, 'bloque' => $bloque]);
        } else {
            // No encontrado: retornar lista de bloques disponibles para que el AI reintente
            $disponibles = $bloqueModel->getByDocumento($documentoId);
            $titulos = array_map(function($b) { return $b['titulo']; }, $disponibles);
            echo json_encode([
                'success' => false,
                'error' => 'No se encontró bloque con: ' . $titulo,
                'bloques_disponibles' => $titulos
            ]);
        }
        exit;
    }

    // Sin filtro: retornar lista de bloques (metadata, sin contenido)
    $bloques = $bloqueModel->getByDocumento($documentoId);
    echo json_encode([
        'success' => true,
        'documento_id' => $documentoId,
        'total_bloques' => count($bloques),
        'bloques' => $bloques
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
?>
