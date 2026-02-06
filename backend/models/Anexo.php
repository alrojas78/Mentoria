<?php
// =====================================================
// MODELO: Gestión de Anexos Multimedia
// =====================================================

require_once __DIR__ . '/../config/attachments.php';

class Anexo {
    private $conn;
    private $table_name = "doc_anexos";

    // Propiedades del anexo
    public $id;
    public $document_id;
    public $filename;
    public $original_name;
    public $file_type;
    public $mime_type;
    public $file_size_bytes;
    public $file_path;
    public $thumbnail_path;
    public $titulo;
    public $descripcion;
    public $keywords;
    public $is_active;
    public $orden;
    public $metadata;
    public $created_at;
    public $updated_at;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Crear un nuevo anexo
    public function create() {
        $query = "INSERT INTO " . $this->table_name . " 
                  SET document_id = :document_id,
                      filename = :filename,
                      original_name = :original_name,
                      file_type = :file_type,
                      mime_type = :mime_type,
                      file_size_bytes = :file_size_bytes,
                      file_path = :file_path,
                      thumbnail_path = :thumbnail_path,
                      titulo = :titulo,
                      descripcion = :descripcion,
                      keywords = :keywords,
                      is_active = :is_active,
                      orden = :orden,
                      metadata = :metadata";

        $stmt = $this->conn->prepare($query);

        // Sanitizar datos
        $this->document_id = htmlspecialchars(strip_tags($this->document_id));
        $this->filename = htmlspecialchars(strip_tags($this->filename));
        $this->original_name = htmlspecialchars(strip_tags($this->original_name));
        $this->file_type = htmlspecialchars(strip_tags($this->file_type));
        $this->mime_type = htmlspecialchars(strip_tags($this->mime_type));
        $this->titulo = htmlspecialchars(strip_tags($this->titulo));
        $this->descripcion = htmlspecialchars(strip_tags($this->descripcion));
        $this->keywords = htmlspecialchars(strip_tags($this->keywords));

        // Vincular parámetros
        $stmt->bindParam(':document_id', $this->document_id);
        $stmt->bindParam(':filename', $this->filename);
        $stmt->bindParam(':original_name', $this->original_name);
        $stmt->bindParam(':file_type', $this->file_type);
        $stmt->bindParam(':mime_type', $this->mime_type);
        $stmt->bindParam(':file_size_bytes', $this->file_size_bytes);
        $stmt->bindParam(':file_path', $this->file_path);
        $stmt->bindParam(':thumbnail_path', $this->thumbnail_path);
        $stmt->bindParam(':titulo', $this->titulo);
        $stmt->bindParam(':descripcion', $this->descripcion);
        $stmt->bindParam(':keywords', $this->keywords);
        $stmt->bindParam(':is_active', $this->is_active);
        $stmt->bindParam(':orden', $this->orden);
        $stmt->bindParam(':metadata', $this->metadata);

        if ($stmt->execute()) {
            $this->id = $this->conn->lastInsertId();
            return true;
        }

        return false;
    }

// ✅ FUNCIÓN CORREGIDA - Detectar videos de programa mentor con patrones mejorados
public static function isVideoPrograma($titulo, $descripcion = '') {
    // Normalizar el título: eliminar espacios extras y convertir a minúsculas
    $tituloNormalizado = preg_replace('/\s+/', ' ', trim($titulo));
    
    // ✅ PATRONES MEJORADOS - Soportan múltiples variaciones
    $patterns = [
        // Patrón 1: "Módulo 1 - Lección 2 - Título" (con acentos y espacios flexibles)
        '/^M[óo]dulo\s+(\d+)\s*-\s*Lecci[óo]n\s+(\d+)/iu',
        
        // Patrón 2: "Módulo 1 Lección 2" (sin guión intermedio)
        '/^M[óo]dulo\s+(\d+)\s+Lecci[óo]n\s+(\d+)/iu',
        
        // Patrón 3: "Modulo 1 - Leccion 2" (sin acentos)
        '/^Modulo\s+(\d+)\s*-\s*Leccion\s+(\d+)/i',
        
        // Patrón 4: "Modulo 1 Leccion 2" (sin acentos ni guión)
        '/^Modulo\s+(\d+)\s+Leccion\s+(\d+)/i',
        
        // Patrón 5: "M1 - L2" o "M1L2" (formato abreviado)
        '/^M(\d+)\s*[-\s]*L(\d+)/i',
        
        // Patrón 6: Con espacios extra "Módulo  1  -  Lección  2"
        '/^M[óo]dulo\s+(\d+)\s+-\s+Lecci[óo]n\s+(\d+)/iu'
    ];
    
    foreach ($patterns as $index => $pattern) {
        if (preg_match($pattern, $tituloNormalizado, $matches)) {
            // Log para debugging
            error_log("✅ Video detectado con patrón #{$index}: {$titulo}");
            error_log("   Módulo: {$matches[1]}, Lección: {$matches[2]}");
            
            return [
                'es_video_programa' => true,
                'modulo' => (int)$matches[1],
                'leccion' => (int)$matches[2]
            ];
        }
    }
    
    // Si no coincide con ningún patrón
    error_log("❌ Video NO detectado: {$titulo}");
    return ['es_video_programa' => false];
}  

    // Obtener anexos por documento
    public function getByDocument($document_id, $activeOnly = true) {
        $query = "SELECT * FROM " . $this->table_name . " 
                  WHERE document_id = :document_id";
        
        if ($activeOnly) {
            $query .= " AND is_active = 1";
        }
        
        $query .= " ORDER BY orden ASC, created_at ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }


    
    // Obtener un anexo por ID
    public function readOne() {
        $query = "SELECT * FROM " . $this->table_name . " WHERE id = :id LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $this->document_id = $row['document_id'];
            $this->filename = $row['filename'];
            $this->original_name = $row['original_name'];
            $this->file_type = $row['file_type'];
            $this->mime_type = $row['mime_type'];
            $this->file_size_bytes = $row['file_size_bytes'];
            $this->file_path = $row['file_path'];
            $this->thumbnail_path = $row['thumbnail_path'];
            $this->titulo = $row['titulo'];
            $this->descripcion = $row['descripcion'];
            $this->keywords = $row['keywords'];
            $this->is_active = $row['is_active'];
            $this->orden = $row['orden'];
            $this->metadata = $row['metadata'];
            $this->created_at = $row['created_at'];
            $this->updated_at = $row['updated_at'];

            return true;
        }

        return false;
    }

    // Actualizar anexo
    public function update() {
        $query = "UPDATE " . $this->table_name . " 
                  SET titulo = :titulo,
                      descripcion = :descripcion,
                      keywords = :keywords,
                      is_active = :is_active,
                      orden = :orden,
                      metadata = :metadata
                  WHERE id = :id";

        $stmt = $this->conn->prepare($query);

        // Sanitizar datos
        $this->titulo = htmlspecialchars(strip_tags($this->titulo));
        $this->descripcion = htmlspecialchars(strip_tags($this->descripcion));
        $this->keywords = htmlspecialchars(strip_tags($this->keywords));

        // Vincular parámetros
        $stmt->bindParam(':titulo', $this->titulo);
        $stmt->bindParam(':descripcion', $this->descripcion);
        $stmt->bindParam(':keywords', $this->keywords);
        $stmt->bindParam(':is_active', $this->is_active);
        $stmt->bindParam(':orden', $this->orden);
        $stmt->bindParam(':metadata', $this->metadata);
        $stmt->bindParam(':id', $this->id);

        return $stmt->execute();
    }

    // Eliminar anexo (soft delete)
    public function delete() {
        $query = "UPDATE " . $this->table_name . " 
                  SET is_active = 0 
                  WHERE id = :id";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);

        return $stmt->execute();
    }

    // Eliminar anexo permanentemente
    public function deleteHard() {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = :id";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $this->id);

        return $stmt->execute();
    }

    // Buscar anexos por palabras clave
    public function searchByKeywords($document_id, $keywords) {
        if (empty($keywords)) {
            // Si no hay keywords, devolver todas las imágenes del documento
            return $this->getByDocument($document_id, true);
        }

        $query = "SELECT * FROM " . $this->table_name . " 
                  WHERE document_id = :document_id 
                  AND is_active = 1 
                  AND (file_type = 'image' OR mime_type LIKE 'image/%')
                  AND (
                      titulo LIKE :search_term OR 
                      descripcion LIKE :search_term OR 
                      keywords LIKE :search_term OR
                      original_name LIKE :search_term
                  )
                  ORDER BY created_at DESC";

        $stmt = $this->conn->prepare($query);
        
        $searchTerm = '%' . $keywords . '%';
        $stmt->bindParam(':document_id', $document_id);
        $stmt->bindParam(':search_term', $searchTerm);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Obtener estadísticas de anexos por documento
    public function getStatsForDocument($document_id) {
        $query = "SELECT 
                    file_type,
                    COUNT(*) as total,
                    SUM(file_size_bytes) as total_size,
                    AVG(file_size_bytes) as avg_size
                  FROM " . $this->table_name . " 
                  WHERE document_id = :document_id AND is_active = 1
                  GROUP BY file_type";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':document_id', $document_id);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Validar archivo antes de subir
    public static function validateFile($file, $fileType = 'image') {
        $errors = [];

        // Verificar que el archivo se subió correctamente
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errors[] = 'Error al subir el archivo: ' . $file['error'];
            return $errors;
        }

        // Verificar tamaño
        $maxSize = AttachmentConfig::getMaxSizeBytes();
        if ($file['size'] > $maxSize) {
            $maxSizeMB = $maxSize / (1024 * 1024);
            $errors[] = "El archivo es demasiado grande. Máximo permitido: {$maxSizeMB}MB";
        }

        // Verificar tipo de archivo
        if (!AttachmentConfig::isValidFileType($file['name'], $fileType)) {
            $allowedTypes = implode(', ', AttachmentConfig::getAllowedTypes($fileType));
            $errors[] = "Tipo de archivo no permitido. Tipos permitidos: {$allowedTypes}";
        }

        // Verificar MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $allowedMimes = [
            'image' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            'document' => ['application/pdf'],
            'video' => ['video/mp4', 'video/webm'],
            'audio' => ['audio/mpeg', 'audio/wav', 'audio/ogg']
        ];

        if (!in_array($mimeType, $allowedMimes[$fileType] ?? [])) {
            $errors[] = "Tipo MIME no válido: {$mimeType}";
        }

        return $errors;
    }

    // Determinar tipo de archivo automáticamente
    public static function determineFileType($filename, $mimeType) {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        // Imágenes
        if (in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp']) || 
            strpos($mimeType, 'image/') === 0) {
            return 'image';
        }

        // Documentos
        if (in_array($extension, ['pdf']) || 
            strpos($mimeType, 'application/pdf') === 0) {
            return 'document';
        }

        // Videos
        if (in_array($extension, ['mp4', 'webm']) || 
            strpos($mimeType, 'video/') === 0) {
            return 'video';
        }

        // Audio
        if (in_array($extension, ['mp3', 'wav', 'ogg']) || 
            strpos($mimeType, 'audio/') === 0) {
            return 'audio';
        }

        return 'other';
    }
}


?>
