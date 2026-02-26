<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(200); exit; }

require_once "../../config/config.php";
require_once "../../config/db.php";
require_once "../../middleware/AuthMiddleware.php";

$userData = AuthMiddleware::requireAdmin();
$database = new Database();
$db = $database->getConnection();

$stmt = $db->query("SELECT COUNT(*) as total FROM users");
$totalUsers = $stmt->fetch(PDO::FETCH_ASSOC)["total"];

$activeUsers = 0;
try {
    $tableCheck = $db->query("SHOW TABLES LIKE 'realtime_sessions'");
    if ($tableCheck->rowCount() > 0) {
        $stmt = $db->query("SELECT COUNT(DISTINCT user_id) as active FROM realtime_sessions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
        $activeUsers = $stmt->fetch(PDO::FETCH_ASSOC)["active"];
    }
} catch (Exception $e) {}

$activeRate = $totalUsers > 0 ? round(($activeUsers / $totalUsers) * 100, 1) : 0;

$stmt = $db->query("SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC");
$roleDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

$registrationTrend = [];
try {
    $stmt = $db->query("SELECT DATE(created) as date, COUNT(*) as count FROM users WHERE created >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(created) ORDER BY date ASC");
    $registrationTrend = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {}

$totalDocuments = 0;
try {
    $stmt = $db->query("SELECT COUNT(*) as total FROM documentos");
    $totalDocuments = $stmt->fetch(PDO::FETCH_ASSOC)["total"];
} catch (Exception $e) {}

echo json_encode([
    "success" => true,
    "total_users" => (int)$totalUsers,
    "active_users" => (int)$activeUsers,
    "active_rate" => $activeRate,
    "total_documents" => (int)$totalDocuments,
    "role_distribution" => $roleDistribution,
    "registration_trend" => $registrationTrend
]);
?>
