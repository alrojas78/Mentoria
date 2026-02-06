<?php
require_once __DIR__ . '/../vendor/autoload.php';
use \Firebase\JWT\JWT;
use \Firebase\JWT\Key;

class JWTUtil {
    private $secretKey;
    private $algorithm;
    
    public function __construct() {
        $this->secretKey = JWT_SECRET;
        $this->algorithm = 'HS256';
    }
    
    public function generate($userId, $name, $email, $role) {
        $issuedAt = time();
        $expirationTime = $issuedAt + 86400; // Válido por 24 horas
        
        $payload = [
            'iat' => $issuedAt,
            'exp' => $expirationTime,
            'data' => [
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'role' => $role
            ]
        ];
        
        return JWT::encode($payload, $this->secretKey, $this->algorithm);
    }
    
    public function validate($token) {
        try {
            $decoded = JWT::decode($token, new Key($this->secretKey, $this->algorithm));
            return $decoded->data;
        } catch (Exception $e) {
            return false;
        }
    }
}
?>