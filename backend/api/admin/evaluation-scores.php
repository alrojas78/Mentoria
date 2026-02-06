<?php
// backend/api/admin/evaluation-scores.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

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

try {
    // Obtener distribución de calificaciones
    $query = "
        SELECT 
            CASE 
                WHEN score BETWEEN 0 AND 20 THEN '0-20'
                WHEN score BETWEEN 21 AND 40 THEN '21-40'
                WHEN score BETWEEN 41 AND 60 THEN '41-60'
                WHEN score BETWEEN 61 AND 80 THEN '61-80'
                WHEN score BETWEEN 81 AND 100 THEN '81-100'
            END AS range,
            COUNT(*) as count
        FROM 
            evaluations
        GROUP BY 
            range
        ORDER BY 
            range
    ";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $scoreDistribution = [];
    
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $scoreDistribution[] = [
            'range' => $row['range'],
            'count' => (int)$row['count']
        ];
    }
    
    // Asegurarse de que todas las categorías estén presentes
    $expectedRanges = ['0-20', '21-40', '41-60', '61-80', '81-100'];
    $existingRanges = array_column($scoreDistribution, 'range');
    
    foreach ($expectedRanges as $range) {
        if (!in_array($range, $existingRanges)) {
            $scoreDistribution[] = [
                'range' => $range,
                'count' => 0
            ];
        }
    }
    
    // Ordenar por rango
    usort($scoreDistribution, function($a, $b) {
        return $a['range'] <=> $b['range'];
    });
    
    // Si se solicita un módulo específico
    if (isset($_GET['module_id'])) {
        $moduleId = (int)$_GET['module_id'];
        
        $moduleQuery = "
            SELECT 
                CASE 
                    WHEN score BETWEEN 0 AND 20 THEN '0-20'
                    WHEN score BETWEEN 21 AND 40 THEN '21-40'
                    WHEN score BETWEEN 41 AND 60 THEN '41-60'
                    WHEN score BETWEEN 61 AND 80 THEN '61-80'
                    WHEN score BETWEEN 81 AND 100 THEN '81-100'
                END AS range,
                COUNT(*) as count
            FROM 
                evaluations
            WHERE 
                module_id = ?
            GROUP BY 
                range
            ORDER BY 
                range
        ";
        
        $moduleStmt = $db->prepare($moduleQuery);
        $moduleStmt->execute([$moduleId]);
        
        $moduleScores = [];
        
        while ($row = $moduleStmt->fetch(PDO::FETCH_ASSOC)) {
            $moduleScores[] = [
                'range' => $row['range'],
                'count' => (int)$row['count']
            ];
        }
        
        // Asegurarse de que todas las categorías estén presentes
        foreach ($expectedRanges as $range) {
            if (!in_array($range, array_column($moduleScores, 'range'))) {
                $moduleScores[] = [
                    'range' => $range,
                    'count' => 0
                ];
            }
        }
        
        // Ordenar por rango
        usort($moduleScores, function($a, $b) {
            return $a['range'] <=> $b['range'];
        });
        
        // Responder con ambos conjuntos de datos
        http_response_code(200);
        echo json_encode([
            'global' => $scoreDistribution,
            'module' => $moduleScores
        ]);
    } else {
        // Responder con los datos generales
        http_response_code(200);
        echo json_encode($scoreDistribution);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error al obtener distribución de calificaciones", "error" => $e->getMessage()]);
}