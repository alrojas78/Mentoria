<?php
// /api/analytics/export-consultas.php
// Exporta todas las consultas de usuarios en formato CSV

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../../config/config.php';
include_once '../../config/db.php';
include_once '../../utils/jwt.php';

$database = new Database();
$db = $database->getConnection();
$jwt = new JWTUtil();

// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Solo permitir GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}

// Obtener parámetros
$document_id = isset($_GET['document_id']) ? (int)$_GET['document_id'] : 0;
$format = isset($_GET['format']) ? $_GET['format'] : 'json'; // json o csv
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;

if ($document_id <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "document_id es requerido"]);
    exit();
}

try {
    $query = "
        SELECT 
            u.nombre as usuario,
            u.email,
            dcm.contenido as consulta,
            dcm.timestamp as fecha
        FROM doc_conversacion_mensajes dcm
        INNER JOIN doc_conversacion_sesiones dcs ON dcm.session_id = dcs.id
        INNER JOIN users u ON dcs.user_id = u.id
        WHERE dcs.document_id = :document_id
        AND dcm.tipo = 'pregunta_usuario'
        AND CHAR_LENGTH(dcm.contenido) >= 5
        ORDER BY dcm.timestamp DESC
        LIMIT :limit
    ";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':document_id', $document_id, PDO::PARAM_INT);
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($format === 'csv') {
        // Generar CSV
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="consultas_usuarios_' . date('Y-m-d') . '.csv"');
        
        $output = fopen('php://output', 'w');
        
        // BOM para Excel
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        
        // Encabezados
        fputcsv($output, ['Usuario', 'Email', 'Consulta', 'Fecha']);
        
        // Datos
        foreach ($results as $row) {
            fputcsv($output, [
                $row['usuario'],
                $row['email'],
                $row['consulta'],
                $row['fecha']
            ]);
        }
        
        fclose($output);
        exit();
    } else {
        // Retornar JSON
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode([
            'success' => true,
            'total' => count($results),
            'data' => $results
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "error" => true,
        "message" => "Error del servidor: " . $e->getMessage()
    ]);
}
?>
