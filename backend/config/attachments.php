<?php
// =====================================================
// CONFIGURACIÓN DE ANEXOS MULTIMEDIA
// =====================================================

class AttachmentConfig {
    
    // Obtener configuración desde base de datos
    public static function getConfig($key, $default = null) {
        try {
            global $db; // Asumiendo conexión global
            
            $stmt = $db->prepare("SELECT config_value, data_type FROM doc_system_config WHERE config_key = ?");
            $stmt->execute([$key]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result) {
                return $default;
            }
            
            // Convertir según tipo de dato
            switch ($result['data_type']) {
                case 'number':
                    return is_numeric($result['config_value']) ? 
                           (float)$result['config_value'] : $default;
                case 'boolean':
                    return filter_var($result['config_value'], FILTER_VALIDATE_BOOLEAN);
                case 'json':
                    return json_decode($result['config_value'], true);
                default:
                    return $result['config_value'];
            }
        } catch (Exception $e) {
            error_log("Error obteniendo configuración {$key}: " . $e->getMessage());
            return $default;
        }
    }
    
    // Configuraciones por defecto (fallback)
    const DEFAULT_CONFIG = [
        'max_attachment_size_mb' => 5,
        'max_attachments_per_document' => 50,
        'allowed_image_types' => 'jpg,jpeg,png,webp,gif',
        'upload_path' => '/uploads/anexos/',
        'thumbnail_path' => '/uploads/thumbnails/',
        'generate_thumbnails' => true,
        'thumbnail_max_width' => 300,
        'thumbnail_max_height' => 300
    ];
    
    // Obtener tipos de archivo permitidos
    public static function getAllowedTypes($category = 'image') {
        $key = "allowed_{$category}_types";
        $types = self::getConfig($key, self::DEFAULT_CONFIG[$key] ?? '');
        return explode(',', $types);
    }
    
    // Validar tipo de archivo
    public static function isValidFileType($filename, $category = 'image') {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $allowedTypes = self::getAllowedTypes($category);
        return in_array($extension, $allowedTypes);
    }
    
    // Obtener tamaño máximo en bytes
    public static function getMaxSizeBytes() {
        $sizeMB = self::getConfig('max_attachment_size_mb', 5);
        return $sizeMB * 1024 * 1024;
    }
    
    // Generar nombre único para archivo
    public static function generateUniqueFilename($originalName, $documentId) {
        $extension = pathinfo($originalName, PATHINFO_EXTENSION);
        $baseName = pathinfo($originalName, PATHINFO_FILENAME);
        $cleanName = preg_replace('/[^a-zA-Z0-9\-_]/', '_', $baseName);
        $timestamp = time();
        $random = substr(md5(uniqid()), 0, 8);
        
        return "{$documentId}_{$timestamp}_{$random}_{$cleanName}.{$extension}";
    }
    
    // Obtener ruta completa de archivo
    public static function getFullPath($filename, $isThumb = false) {
        $basePath = __DIR__ . '/../';
        $uploadPath = $isThumb ? 
                     self::getConfig('thumbnail_path', '/uploads/thumbnails/') :
                     self::getConfig('upload_path', '/uploads/anexos/');
        
        return $basePath . trim($uploadPath, '/') . '/' . $filename;
    }
    
    // Obtener URL pública
public static function getPublicUrl($filename, $isThumb = false) {
    $uploadPath = $isThumb ? 
                 self::getConfig('thumbnail_path', '/uploads/thumbnails/') :
                 self::getConfig('upload_path', '/uploads/anexos/');
    
    // AGREGAR /backend/ a la ruta
    return '/backend' . rtrim($uploadPath, '/') . '/' . $filename;
}
}
?>