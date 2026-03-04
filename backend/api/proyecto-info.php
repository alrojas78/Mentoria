<?php
// proyecto-info.php — Endpoint público (sin auth)
// Detecta el proyecto por dominio/subdominio y devuelve info + documentos
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once '../config/config.php';
require_once '../config/db.php';

$database = new Database();
$db = $database->getConnection();

$host = strtolower($_SERVER['HTTP_HOST'] ?? '');
// Eliminar puerto si existe
$host = preg_replace('/:\d+$/', '', $host);

$proyecto = null;

// Match 1: dominio_personalizado exacto
if ($host) {
    $stmt = $db->prepare("SELECT * FROM proyectos WHERE dominio_personalizado = ? AND activo = 1 LIMIT 1");
    $stmt->execute([$host]);
    $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
}

// Match 2: subdominio de *.ateneomentoria.com
if (!$proyecto && preg_match('/^([a-z0-9\-]+)\.ateneomentoria\.com$/', $host, $matches)) {
    $slug = $matches[1];
    // Excluir subdominios reservados
    if (!in_array($slug, ['www', 'api', 'admin', 'mail', 'smtp'])) {
        $stmt = $db->prepare("SELECT * FROM proyectos WHERE slug = ? AND activo = 1 LIMIT 1");
        $stmt->execute([$slug]);
        $proyecto = $stmt->fetch(PDO::FETCH_ASSOC);
    }
}

if (!$proyecto) {
    echo json_encode(['success' => true, 'proyecto' => null]);
    exit;
}

// Obtener documentos asignados al proyecto
$stmt = $db->prepare("
    SELECT d.id, d.titulo, d.descripcion, d.imagen, d.logo,
           pd.orden
    FROM proyecto_documentos pd
    JOIN documentos d ON d.id = pd.documento_id
    WHERE pd.proyecto_id = ?
    ORDER BY pd.orden ASC, d.titulo ASC
");
$stmt->execute([$proyecto['id']]);
$documentos = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Limpiar config_json
if ($proyecto['config_json']) {
    $proyecto['config_json'] = json_decode($proyecto['config_json'], true);
}

$proyecto['documentos'] = $documentos;

echo json_encode(['success' => true, 'proyecto' => $proyecto]);
?>
