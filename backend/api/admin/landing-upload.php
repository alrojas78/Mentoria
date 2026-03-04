<?php
// admin/landing-upload.php — Upload de imágenes para secciones de landing
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/config.php';
require_once '../../middleware/AuthMiddleware.php';

$userData = AuthMiddleware::requireAdmin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$proyectoId = intval($_POST['proyecto_id'] ?? 0);
$seccionId = trim($_POST['seccion_id'] ?? '');

if (!$proyectoId || !$seccionId) {
    http_response_code(400);
    echo json_encode(['error' => 'proyecto_id y seccion_id son requeridos']);
    exit;
}

if (empty($_FILES['imagen']) || $_FILES['imagen']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No se recibió imagen válida']);
    exit;
}

$uploadDir = __DIR__ . '/../../uploads/landing/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$ext = strtolower(pathinfo($_FILES['imagen']['name'], PATHINFO_EXTENSION));
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];

if (!in_array($ext, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo de archivo no permitido. Permitidos: ' . implode(', ', $allowed)]);
    exit;
}

// Limitar a 5MB
if ($_FILES['imagen']['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'Imagen demasiado grande. Máximo: 5MB']);
    exit;
}

$filename = "p{$proyectoId}_{$seccionId}_" . time() . '.' . $ext;

if (move_uploaded_file($_FILES['imagen']['tmp_name'], $uploadDir . $filename)) {
    $relativePath = 'uploads/landing/' . $filename;
    echo json_encode([
        'success' => true,
        'url' => $relativePath,
        'filename' => $filename
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Error guardando imagen']);
}
?>
