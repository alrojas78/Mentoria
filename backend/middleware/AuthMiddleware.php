<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../utils/jwt.php';

class AuthMiddleware {
    private static $jwt;

    private static function getJWT() {
        if (!self::$jwt) {
            self::$jwt = new JWTUtil();
        }
        return self::$jwt;
    }

    /**
     * Validates JWT token from Authorization header
     * Returns user data if valid, null if invalid
     */
    public static function validateToken() {
        $headers = getallheaders();
        
        // Handle case-insensitive header names
        $authHeader = null;
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
        
        if (!$authHeader) {
            return null;
        }
        
        $token = str_replace('Bearer ', '', $authHeader);
        
        if (empty($token)) {
            return null;
        }
        
        return self::getJWT()->validate($token);
    }

    /**
     * Requires valid authentication
     * Returns user data or exits with 401 error
     */
    public static function requireAuth() {
        $userData = self::validateToken();

        if (!$userData) {
            http_response_code(401);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(['error' => 'No autorizado', 'message' => 'Token invalido o expirado']);
            exit;
        }

        return $userData;
    }

    /**
     * Requires admin role
     * Returns user data or exits with 403 error
     */
    public static function requireAdmin() {
        $userData = self::requireAuth();

        if ($userData->role !== 'admin') {
            http_response_code(403);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(['error' => 'Acceso denegado', 'message' => 'Se requiere rol de administrador']);
            exit;
        }

        return $userData;
    }

    /**
     * Optional authentication - returns user data if token present and valid, null otherwise
     */
    public static function optionalAuth() {
        return self::validateToken();
    }

    /**
     * Get user ID from valid token or return null
     */
    public static function getUserId() {
        $userData = self::validateToken();
        return $userData ? $userData->id : null;
    }
}
?>
