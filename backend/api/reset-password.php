<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';

$email = 'admin@voicemed.com';
$plainPassword = 'admin123';
$hashedPassword = password_hash($plainPassword, PASSWORD_BCRYPT);

$db = new Database();
$conn = $db->getConnection();

$stmt = $conn->prepare("UPDATE users SET password = :password WHERE email = :email");
$stmt->bindParam(':password', $hashedPassword);
$stmt->bindParam(':email', $email);

if ($stmt->execute()) {
    echo "✅ Contraseña actualizada a admin123 para $email";
} else {
    echo "❌ Error: " . $stmt->errorInfo()[2];
}
?>
