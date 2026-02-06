<?php
// =====================================================
// SERVICIO: Gestión Avanzada de Anexos Multimedia
// =====================================================

require_once __DIR__ . '/../config/attachments.php';
require_once __DIR__ . '/../models/Anexo.php';

class AttachmentService {
    private $uploadPath;
    private $thumbnailPath;
    private $basePath;

    public function __construct() {
        $this->basePath = __DIR__ . '/../';
        $this->uploadPath = $this->basePath . trim(AttachmentConfig::getConfig('upload_path', 'uploads/anexos/'), '/') . '/';
        $this->thumbnailPath = $this->basePath . trim(AttachmentConfig::getConfig('thumbnail_path', 'uploads/thumbnails/'), '/') . '/';
        
        // Crear directorios si no existen
        $this->ensureDirectoriesExist();
    }

    // Asegurar que los directorios existen
    private function ensureDirectoriesExist() {
        if (!file_exists($this->uploadPath)) {
            mkdir($this->uploadPath, 0755, true);
        }
        if (!file_exists($this->thumbnailPath)) {
            mkdir($this->thumbnailPath, 0755, true);
        }
    }

    // Procesar y guardar archivo subido
    public function processUpload($file, $documentId, $titulo, $descripcion = '', $keywords = '') {
        try {
            // 1. Determinar tipo de archivo
// Para videos de Vimeo, el tmp_name estará vacío
if (empty($file['tmp_name'])) {
    // Es un video de Vimeo, usar tipo predefinido
    $mimeType = $file['type']; // Ya viene como 'video/mp4'
} else {
    // Archivo real, detectar tipo
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
}
            
            $fileType = Anexo::determineFileType($file['name'], $mimeType);
            
            // 2. Validar archivo
            $validationErrors = Anexo::validateFile($file, $fileType);
            if (!empty($validationErrors)) {
                return [
                    'success' => false,
                    'errors' => $validationErrors
                ];
            }

            // 3. Generar nombre único
            $filename = AttachmentConfig::generateUniqueFilename($file['name'], $documentId);
            $filePath = $this->uploadPath . $filename;

            // 4. Mover archivo
// Solo mover archivo si no es un video de Vimeo
if (!empty($file['tmp_name'])) {
    if (!move_uploaded_file($file['tmp_name'], $filePath)) {
        return [
            'success' => false,
            'errors' => ['Error al guardar el archivo']
        ];
    }
} else {
    // Para videos de Vimeo, no hay archivo físico que mover
    // El "archivo" es virtual, solo existe la referencia en BD
}

            // 5. Generar thumbnail si es imagen
            $thumbnailPath = null;
            if ($fileType === 'image' && AttachmentConfig::getConfig('generate_thumbnails', true)) {
                $thumbnailResult = $this->generateThumbnail($filePath, $filename);
                if ($thumbnailResult['success']) {
                    $thumbnailPath = $thumbnailResult['path'];
                }
            }

            // 6. Obtener metadatos
            $metadata = $this->extractMetadata($filePath, $fileType);

            // 7. Crear registro en base de datos
            $anexoData = [
                'document_id' => $documentId,
                'filename' => $filename,
                'original_name' => $file['name'],
                'file_type' => $fileType,
                'mime_type' => $mimeType,
                'file_size_bytes' => $file['size'],
                'file_path' => $filename, // Solo el nombre, no la ruta completa
                'thumbnail_path' => $thumbnailPath,
                'titulo' => $titulo,
                'descripcion' => $descripcion,
                'keywords' => $keywords,
                'is_active' => true,
                'orden' => $this->getNextOrder($documentId),
                'metadata' => json_encode($metadata)
            ];

            return [
                'success' => true,
                'anexo_data' => $anexoData,
                'file_info' => [
                    'filename' => $filename,
                    'original_name' => $file['name'],
                    'file_type' => $fileType,
                    'file_size' => $file['size'],
                    'thumbnail_path' => $thumbnailPath,
                    'metadata' => $metadata
                ]
            ];

        } catch (Exception $e) {
            error_log("Error en processUpload: " . $e->getMessage());
            return [
                'success' => false,
                'errors' => ['Error interno del servidor: ' . $e->getMessage()]
            ];
        }
    }

    // Generar thumbnail para imágenes
    private function generateThumbnail($originalPath, $filename) {
        try {
            $maxWidth = AttachmentConfig::getConfig('thumbnail_max_width', 300);
            $maxHeight = AttachmentConfig::getConfig('thumbnail_max_height', 300);
            $quality = AttachmentConfig::getConfig('thumbnail_quality', 85);

            // Nombre del thumbnail
            $thumbnailFilename = 'thumb_' . $filename;
            $thumbnailPath = $this->thumbnailPath . $thumbnailFilename;

            // Obtener información de la imagen original
            $imageInfo = getimagesize($originalPath);
            if (!$imageInfo) {
                return ['success' => false, 'error' => 'No se pudo leer la imagen'];
            }

            list($origWidth, $origHeight, $imageType) = $imageInfo;

            // Calcular nuevas dimensiones manteniendo proporción
            $ratio = min($maxWidth / $origWidth, $maxHeight / $origHeight);
            $newWidth = intval($origWidth * $ratio);
            $newHeight = intval($origHeight * $ratio);

            // Crear imagen desde el archivo original
            switch ($imageType) {
                case IMAGETYPE_JPEG:
                    $originalImage = imagecreatefromjpeg($originalPath);
                    break;
                case IMAGETYPE_PNG:
                    $originalImage = imagecreatefrompng($originalPath);
                    break;
                case IMAGETYPE_GIF:
                    $originalImage = imagecreatefromgif($originalPath);
                    break;
                case IMAGETYPE_WEBP:
                    $originalImage = imagecreatefromwebp($originalPath);
                    break;
                default:
                    return ['success' => false, 'error' => 'Tipo de imagen no soportado'];
            }

            if (!$originalImage) {
                return ['success' => false, 'error' => 'No se pudo crear la imagen'];
            }

            // Crear nueva imagen con las dimensiones del thumbnail
            $thumbnailImage = imagecreatetruecolor($newWidth, $newHeight);

            // Mantener transparencia para PNG y GIF
            if ($imageType == IMAGETYPE_PNG || $imageType == IMAGETYPE_GIF) {
                imagealphablending($thumbnailImage, false);
                imagesavealpha($thumbnailImage, true);
                $transparent = imagecolorallocatealpha($thumbnailImage, 255, 255, 255, 127);
                imagefilledrectangle($thumbnailImage, 0, 0, $newWidth, $newHeight, $transparent);
            }

            // Redimensionar imagen
            imagecopyresampled(
                $thumbnailImage, $originalImage,
                0, 0, 0, 0,
                $newWidth, $newHeight, $origWidth, $origHeight
            );

            // Guardar thumbnail
            $success = false;
            switch ($imageType) {
                case IMAGETYPE_JPEG:
                    $success = imagejpeg($thumbnailImage, $thumbnailPath, $quality);
                    break;
                case IMAGETYPE_PNG:
                    $success = imagepng($thumbnailImage, $thumbnailPath, 9);
                    break;
                case IMAGETYPE_GIF:
                    $success = imagegif($thumbnailImage, $thumbnailPath);
                    break;
                case IMAGETYPE_WEBP:
                    $success = imagewebp($thumbnailImage, $thumbnailPath, $quality);
                    break;
            }

            // Limpiar memoria
            imagedestroy($originalImage);
            imagedestroy($thumbnailImage);

            if ($success) {
                return [
                    'success' => true,
                    'path' => $thumbnailFilename, // Solo el nombre del archivo
                    'full_path' => $thumbnailPath
                ];
            } else {
                return ['success' => false, 'error' => 'Error al guardar thumbnail'];
            }

        } catch (Exception $e) {
            error_log("Error generando thumbnail: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // Extraer metadatos del archivo
    private function extractMetadata($filePath, $fileType) {
        $metadata = [
            'file_size_readable' => $this->formatFileSize(filesize($filePath))
        ];

        switch ($fileType) {
            case 'image':
                $imageInfo = getimagesize($filePath);
                if ($imageInfo) {
                    $metadata['width'] = $imageInfo[0];
                    $metadata['height'] = $imageInfo[1];
                    $metadata['resolution'] = $imageInfo[0] . 'x' . $imageInfo[1];
                    
                    // Extraer EXIF si está disponible y es JPEG
                    if ($imageInfo[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
                        $exif = @exif_read_data($filePath);
                        if ($exif) {
                            if (isset($exif['DateTime'])) {
                                $metadata['date_taken'] = $exif['DateTime'];
                            }
                            if (isset($exif['Make'])) {
                                $metadata['camera_make'] = $exif['Make'];
                            }
                            if (isset($exif['Model'])) {
                                $metadata['camera_model'] = $exif['Model'];
                            }
                        }
                    }
                }
                break;

            case 'video':
                // Para video, se podría usar FFmpeg en el futuro
                $metadata['type'] = 'video';
                break;

            case 'audio':
                // Para audio, se podría usar getID3 en el futuro
                $metadata['type'] = 'audio';
                break;

            case 'document':
                $metadata['type'] = 'document';
                break;
        }

        return $metadata;
    }

    // Obtener siguiente orden para anexos de un documento
    private function getNextOrder($documentId) {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $stmt = $db->prepare("SELECT COALESCE(MAX(orden), 0) + 1 as next_order FROM doc_anexos WHERE document_id = ?");
            $stmt->execute([$documentId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return $result['next_order'] ?? 1;
        } catch (Exception $e) {
            error_log("Error obteniendo siguiente orden: " . $e->getMessage());
            return 1;
        }
    }

    // Formatear tamaño de archivo legible
    private function formatFileSize($bytes) {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        
        $bytes /= (1 << (10 * $pow));
        
        return round($bytes, 2) . ' ' . $units[$pow];
    }

    // Eliminar archivo físico y thumbnail
    public function deleteFiles($filename, $thumbnailFilename = null) {
        $deleted = [];
        $errors = [];

        // Eliminar archivo principal
        $mainFilePath = $this->uploadPath . $filename;
        if (file_exists($mainFilePath)) {
            if (unlink($mainFilePath)) {
                $deleted[] = 'main_file';
            } else {
                $errors[] = 'No se pudo eliminar el archivo principal';
            }
        }

        // Eliminar thumbnail si existe
        if ($thumbnailFilename) {
            $thumbnailPath = $this->thumbnailPath . $thumbnailFilename;
            if (file_exists($thumbnailPath)) {
                if (unlink($thumbnailPath)) {
                    $deleted[] = 'thumbnail';
                } else {
                    $errors[] = 'No se pudo eliminar el thumbnail';
                }
            }
        }

        return [
            'deleted' => $deleted,
            'errors' => $errors,
            'success' => empty($errors)
        ];
    }

    // Obtener URL pública del archivo
    public function getPublicUrl($filename, $isThumb = false) {
        return AttachmentConfig::getPublicUrl($filename, $isThumb);
    }

    // Validar que un archivo existe físicamente
    public function fileExists($filename, $isThumb = false) {
        $path = $isThumb ? $this->thumbnailPath : $this->uploadPath;
        return file_exists($path . $filename);
    }

    // Limpiar archivos huérfanos (archivos sin registro en BD)
    public function cleanOrphanFiles() {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            $cleaned = [];
            $errors = [];

            // Obtener todos los archivos registrados en BD
            $stmt = $db->prepare("SELECT filename, thumbnail_path FROM doc_anexos WHERE is_active = 1");
            $stmt->execute();
            $dbFiles = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $registeredFiles = [];
            $registeredThumbs = [];
            
            foreach ($dbFiles as $file) {
                $registeredFiles[] = $file['filename'];
                if ($file['thumbnail_path']) {
                    $registeredThumbs[] = $file['thumbnail_path'];
                }
            }

            // Limpiar archivos principales huérfanos
            $uploadFiles = scandir($this->uploadPath);
            foreach ($uploadFiles as $file) {
                if ($file != '.' && $file != '..' && !in_array($file, $registeredFiles)) {
                    $filePath = $this->uploadPath . $file;
                    if (is_file($filePath) && unlink($filePath)) {
                        $cleaned[] = 'uploads/' . $file;
                    } else {
                        $errors[] = 'No se pudo eliminar: uploads/' . $file;
                    }
                }
            }

            // Limpiar thumbnails huérfanos
            $thumbFiles = scandir($this->thumbnailPath);
            foreach ($thumbFiles as $file) {
                if ($file != '.' && $file != '..' && !in_array($file, $registeredThumbs)) {
                    $filePath = $this->thumbnailPath . $file;
                    if (is_file($filePath) && unlink($filePath)) {
                        $cleaned[] = 'thumbnails/' . $file;
                    } else {
                        $errors[] = 'No se pudo eliminar: thumbnails/' . $file;
                    }
                }
            }

            return [
                'success' => true,
                'cleaned_files' => $cleaned,
                'errors' => $errors,
                'total_cleaned' => count($cleaned)
            ];

        } catch (Exception $e) {
            error_log("Error en cleanOrphanFiles: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    // Obtener estadísticas de almacenamiento
    public function getStorageStats() {
        try {
            $database = new Database();
            $db = $database->getConnection();
            
            // Estadísticas de base de datos
            $stmt = $db->prepare("
                SELECT 
                    file_type,
                    COUNT(*) as count,
                    SUM(file_size_bytes) as total_size,
                    AVG(file_size_bytes) as avg_size,
                    MIN(file_size_bytes) as min_size,
                    MAX(file_size_bytes) as max_size
                FROM doc_anexos 
                WHERE is_active = 1 
                GROUP BY file_type
            ");
            $stmt->execute();
            $dbStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Estadísticas del sistema de archivos
            $uploadDirSize = $this->getDirectorySize($this->uploadPath);
            $thumbDirSize = $this->getDirectorySize($this->thumbnailPath);

            return [
                'success' => true,
                'database_stats' => $dbStats,
                'filesystem_stats' => [
                    'uploads_size_bytes' => $uploadDirSize,
                    'thumbnails_size_bytes' => $thumbDirSize,
                    'total_size_bytes' => $uploadDirSize + $thumbDirSize,
                    'uploads_size_readable' => $this->formatFileSize($uploadDirSize),
                    'thumbnails_size_readable' => $this->formatFileSize($thumbDirSize),
                    'total_size_readable' => $this->formatFileSize($uploadDirSize + $thumbDirSize)
                ]
            ];

        } catch (Exception $e) {
            error_log("Error obteniendo estadísticas: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    // Obtener tamaño de directorio
    private function getDirectorySize($directory) {
        $size = 0;
        if (is_dir($directory)) {
            $files = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($directory, RecursiveDirectoryIterator::SKIP_DOTS)
            );
            
            foreach ($files as $file) {
                if ($file->isFile()) {
                    $size += $file->getSize();
                }
            }
        }
        return $size;
    }

    // Comprimir imagen si está habilitado
    public function compressImage($filePath, $quality = null) {
        if (!AttachmentConfig::getConfig('enable_file_compression', true)) {
            return ['success' => false, 'message' => 'Compresión deshabilitada'];
        }

        $quality = $quality ?? AttachmentConfig::getConfig('compression_quality', 85);
        
        $imageInfo = getimagesize($filePath);
        if (!$imageInfo) {
            return ['success' => false, 'message' => 'No es una imagen válida'];
        }

        $originalSize = filesize($filePath);
        
        try {
            switch ($imageInfo[2]) {
                case IMAGETYPE_JPEG:
                    $image = imagecreatefromjpeg($filePath);
                    $success = imagejpeg($image, $filePath, $quality);
                    imagedestroy($image);
                    break;
                    
                case IMAGETYPE_PNG:
                    // PNG usa compresión sin pérdida, solo optimizamos
                    $image = imagecreatefrompng($filePath);
                    $success = imagepng($image, $filePath, 9);
                    imagedestroy($image);
                    break;
                    
                case IMAGETYPE_WEBP:
                    $image = imagecreatefromwebp($filePath);
                    $success = imagewebp($image, $filePath, $quality);
                    imagedestroy($image);
                    break;
                    
                default:
                    return ['success' => false, 'message' => 'Tipo de imagen no soportado para compresión'];
            }

            if ($success) {
                $newSize = filesize($filePath);
                $reduction = (($originalSize - $newSize) / $originalSize) * 100;
                
                return [
                    'success' => true,
                    'original_size' => $originalSize,
                    'new_size' => $newSize,
                    'reduction_percent' => round($reduction, 2),
                    'saved_bytes' => $originalSize - $newSize
                ];
            } else {
                return ['success' => false, 'message' => 'Error al comprimir imagen'];
            }

        } catch (Exception $e) {
            error_log("Error comprimiendo imagen: " . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
?>