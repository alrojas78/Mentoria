<?php
// backend/utils/AudioCleanupService.php

class AudioCleanupService {
    private $audioDir;
    private $maxFilesPerSession = 50; // Máximo de archivos por sesión
    private $maxAgeHours = 1; // Antigüedad máxima de archivos en sesión activa
    private $maxSessionAgeHours = 24; // Antigüedad máxima de sesiones inactivas
    
    public function __construct() {
        $this->audioDir = __DIR__ . '/../audio';
        
        // Crear directorio principal si no existe
        if (!file_exists($this->audioDir)) {
            mkdir($this->audioDir, 0755, true);
        }
    }
    
    /**
     * 🆕 Obtiene la ruta de la carpeta de audio para una sesión específica
     * @param string|null $sessionToken Token de sesión
     * @return string Ruta de la carpeta de audio
     */
    public function getSessionAudioPath($sessionToken = null) {
        if ($sessionToken) {
            $sessionDir = $this->audioDir . '/session_' . $sessionToken;
            
            // Crear carpeta de sesión si no existe
            if (!file_exists($sessionDir)) {
                mkdir($sessionDir, 0755, true);
                error_log("📁 Carpeta de audio creada para sesión: {$sessionToken}");
            }
            
            return $sessionDir;
        }
        
        // Fallback a carpeta global (compatibilidad con código antiguo)
        return $this->audioDir;
    }
    
    /**
     * 🆕 Limpia archivos de una sesión específica o sesiones antiguas globalmente
     * @param string|null $sessionToken Token de sesión (null para limpieza global)
     * @return array Estadísticas de limpieza
     */
    public function cleanup($sessionToken = null) {
        $stats = [
            'files_deleted' => 0,
            'space_freed_mb' => 0,
            'sessions_deleted' => 0,
            'mode' => $sessionToken ? 'session' : 'global'
        ];
        
        try {
            if ($sessionToken) {
                // MODO 1: Limpiar archivos antiguos de UNA sesión específica
                $stats = $this->cleanupSession($sessionToken);
            } else {
                // MODO 2: Limpiar sesiones antiguas globalmente
                $stats = $this->cleanupOldSessions();
            }
            
        } catch (Exception $e) {
            error_log("❌ Error en limpieza de audio: " . $e->getMessage());
        }
        
        return $stats;
    }
    
    /**
     * 🆕 Limpia archivos antiguos de una sesión específica
     * @param string $sessionToken Token de sesión
     * @return array Estadísticas
     */
    private function cleanupSession($sessionToken) {
        $stats = [
            'files_deleted' => 0,
            'space_freed_mb' => 0,
            'mode' => 'session'
        ];
        
        $sessionDir = $this->audioDir . '/session_' . $sessionToken;
        
        if (!is_dir($sessionDir)) {
            return $stats;
        }
        
        // Obtener archivos de esta sesión
        $files = glob($sessionDir . '/*.mp3');
        
        if (!$files) {
            return $stats;
        }
        
        $now = time();
        $maxAge = $this->maxAgeHours * 3600;
        
        // Eliminar archivos antiguos (> 1 hora)
        foreach ($files as $file) {
            if (is_file($file)) {
                $fileAge = $now - filemtime($file);
                
                if ($fileAge > $maxAge) {
                    $fileSize = filesize($file);
                    
                    if (unlink($file)) {
                        $stats['files_deleted']++;
                        $stats['space_freed_mb'] += $fileSize;
                        error_log("🗑️ Audio antiguo eliminado: " . basename($file));
                    }
                }
            }
        }
        
        // Convertir bytes a MB
        $stats['space_freed_mb'] = round($stats['space_freed_mb'] / 1024 / 1024, 2);
        
        // Si la carpeta quedó vacía, eliminarla
        $remainingFiles = glob($sessionDir . '/*.mp3');
        if (empty($remainingFiles)) {
            rmdir($sessionDir);
            error_log("📁 Carpeta de sesión vacía eliminada: {$sessionToken}");
        }
        
        if ($stats['files_deleted'] > 0) {
            error_log("🧹 Limpieza de sesión completada: {$stats['files_deleted']} archivos eliminados, {$stats['space_freed_mb']} MB liberados");
        }
        
        return $stats;
    }
    
    /**
     * 🆕 Limpia sesiones completas que tienen más de 24 horas sin actividad
     * @return array Estadísticas
     */
    private function cleanupOldSessions() {
        $stats = [
            'files_deleted' => 0,
            'space_freed_mb' => 0,
            'sessions_deleted' => 0,
            'mode' => 'global'
        ];
        
        $sessionDirs = glob($this->audioDir . '/session_*');
        
        if (!$sessionDirs) {
            return $stats;
        }
        
        $now = time();
        $maxSessionAge = $this->maxSessionAgeHours * 3600;
        
        foreach ($sessionDirs as $sessionDir) {
            if (!is_dir($sessionDir)) {
                continue;
            }
            
            // Verificar antigüedad de la sesión (basado en último archivo modificado)
            $dirAge = $now - filemtime($sessionDir);
            
            // Si la sesión tiene más de 24 horas sin actividad, eliminarla
            if ($dirAge > $maxSessionAge) {
                $sessionStats = $this->deleteSessionFolder($sessionDir);
                
                $stats['files_deleted'] += $sessionStats['files_deleted'];
                $stats['space_freed_mb'] += $sessionStats['space_freed_mb'];
                $stats['sessions_deleted']++;
            }
        }
        
        if ($stats['sessions_deleted'] > 0) {
            error_log("🧹 Limpieza global completada: {$stats['sessions_deleted']} sesiones antiguas eliminadas, {$stats['files_deleted']} archivos, {$stats['space_freed_mb']} MB liberados");
        }
        
        return $stats;
    }
    
    /**
     * 🆕 Elimina una carpeta de sesión completa
     * @param string $sessionDir Ruta de la carpeta de sesión
     * @return array Estadísticas
     */
    private function deleteSessionFolder($sessionDir) {
        $stats = [
            'files_deleted' => 0,
            'space_freed_mb' => 0
        ];
        
        $files = glob($sessionDir . '/*.mp3');
        
        foreach ($files as $file) {
            if (is_file($file)) {
                $fileSize = filesize($file);
                
                if (unlink($file)) {
                    $stats['files_deleted']++;
                    $stats['space_freed_mb'] += $fileSize;
                }
            }
        }
        
        // Eliminar la carpeta
        if (is_dir($sessionDir)) {
            rmdir($sessionDir);
        }
        
        // Convertir bytes a MB
        $stats['space_freed_mb'] = round($stats['space_freed_mb'] / 1024 / 1024, 2);
        
        error_log("🗑️ Sesión eliminada: " . basename($sessionDir) . " ({$stats['files_deleted']} archivos, {$stats['space_freed_mb']} MB)");
        
        return $stats;
    }
    
    /**
     * 🆕 Verifica si un audio ya existe en caché (ahora busca por sesión)
     * @param string $text Texto a sintetizar
     * @param string|null $sessionToken Token de sesión
     * @return string|null Ruta del archivo si existe
     */
    public function getCachedAudio($text, $sessionToken = null) {
        $textHash = substr(md5($text), 0, 8);
        
        // Buscar en carpeta de sesión si existe sessionToken
        if ($sessionToken) {
            $sessionDir = $this->audioDir . '/session_' . $sessionToken;
            
            if (is_dir($sessionDir)) {
                $pattern = $sessionDir . '/speech_*' . $textHash . '*.mp3';
                $matches = glob($pattern);
                
                if (!empty($matches)) {
                    $file = $matches[0];
                    
                    // Verificar que no sea muy antiguo (más de 24 horas)
                    if (file_exists($file) && (time() - filemtime($file)) < 86400) {
                        error_log("✅ Audio en caché reutilizado (sesión): " . basename($file));
                        return $file;
                    }
                }
            }
        }
        
        // Fallback: buscar en carpeta global (compatibilidad)
        $pattern = $this->audioDir . '/speech_*' . $textHash . '*.mp3';
        $matches = glob($pattern);
        
        if (!empty($matches)) {
            $file = $matches[0];
            
            if (file_exists($file) && (time() - filemtime($file)) < 86400) {
                error_log("✅ Audio en caché reutilizado (global): " . basename($file));
                return $file;
            }
        }
        
        return null;
    }
    
    /**
     * 🆕 Obtiene estadísticas de audio (ahora incluye info por sesión)
     * @param string|null $sessionToken Token de sesión
     * @return array
     */
    public function getStats($sessionToken = null) {
        if ($sessionToken) {
            // Estadísticas de una sesión específica
            return $this->getSessionStats($sessionToken);
        }
        
        // Estadísticas globales
        return $this->getGlobalStats();
    }
    
    /**
     * 🆕 Estadísticas de una sesión específica
     */
    private function getSessionStats($sessionToken) {
        $sessionDir = $this->audioDir . '/session_' . $sessionToken;
        
        if (!is_dir($sessionDir)) {
            return [
                'session' => $sessionToken,
                'total_files' => 0,
                'total_size_mb' => 0,
                'directory' => $sessionDir,
                'exists' => false
            ];
        }
        
        $files = glob($sessionDir . '/*.mp3');
        $totalSize = 0;
        
        if ($files) {
            foreach ($files as $file) {
                if (file_exists($file)) {
                    $totalSize += filesize($file);
                }
            }
        }
        
        return [
            'session' => $sessionToken,
            'total_files' => count($files),
            'total_size_mb' => round($totalSize / 1024 / 1024, 2),
            'directory' => $sessionDir,
            'exists' => true
        ];
    }
    
    /**
     * 🆕 Estadísticas globales (todas las sesiones)
     */
    private function getGlobalStats() {
        $sessionDirs = glob($this->audioDir . '/session_*');
        $totalSessions = count($sessionDirs);
        $totalFiles = 0;
        $totalSize = 0;
        
        // Archivos en carpeta global (legacy)
        $globalFiles = glob($this->audioDir . '/*.mp3');
        if ($globalFiles) {
            $totalFiles += count($globalFiles);
            foreach ($globalFiles as $file) {
                if (file_exists($file)) {
                    $totalSize += filesize($file);
                }
            }
        }
        
        // Archivos en carpetas de sesión
        foreach ($sessionDirs as $sessionDir) {
            if (is_dir($sessionDir)) {
                $files = glob($sessionDir . '/*.mp3');
                if ($files) {
                    $totalFiles += count($files);
                    foreach ($files as $file) {
                        if (file_exists($file)) {
                            $totalSize += filesize($file);
                        }
                    }
                }
            }
        }
        
        return [
            'total_sessions' => $totalSessions,
            'total_files' => $totalFiles,
            'total_size_mb' => round($totalSize / 1024 / 1024, 2),
            'directory' => $this->audioDir
        ];
    }
}
?>
