<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/AudioCleanupService.php';

class ElevenLabsService {
    private $apiKey;
    private $apiUrl = 'https://api.elevenlabs.io/v1';
    private $cleanupService;
    
    public function __construct() {
        // Obtener API key desde la configuración
        if (defined('ELEVENLABS_API_KEY')) {
            $this->apiKey = ELEVENLABS_API_KEY;
        } else {
            error_log("ElevenLabs API Key no configurada");
        }
        
        // Inicializar servicio de limpieza
        $this->cleanupService = new AudioCleanupService();
    }
    
    /**
     * 🆕 VERSIÓN ACTUALIZADA - Soporta cache por sesión
     * @param string $text Texto a sintetizar
     * @param string $voiceId ID de la voz de ElevenLabs
     * @param string|null $sessionToken Token de sesión del usuario
     * @return array Resultado de la síntesis
     */
    public function synthesizeSpeech($text, $voiceId = 'EXAVITQu4vr4xnSDxMaL', $sessionToken = null) {
        try {
            error_log("🎙️ ElevenLabs - Procesando texto: " . substr($text, 0, 50) . "...");
            error_log("🔑 SessionToken: " . ($sessionToken ? substr($sessionToken, 0, 8) . '...' : 'No proporcionado'));
            
            // ✅ NUEVO: Verificar si ya existe en caché (por sesión)
            $cachedFile = $this->cleanupService->getCachedAudio($text, $sessionToken);
            if ($cachedFile) {
                $fileName = basename($cachedFile);
                
                // Construir URL correcta según si está en carpeta de sesión o global
                if ($sessionToken && strpos($cachedFile, 'session_') !== false) {
                    $sessionFolder = 'session_' . $sessionToken;
                    $url = '/backend/audio/' . $sessionFolder . '/' . $fileName;
                } else {
                    $url = '/backend/audio/' . $fileName;
                }
                
                error_log("📦 Audio en caché reutilizado: $fileName");
                
                return [
                    'success' => true,
                    'file' => $fileName,
                    'url' => $url,
                    'service' => 'elevenlabs',
                    'cached' => true
                ];
            }
            
            // Verificar que la API key existe
            if (empty($this->apiKey)) {
                throw new Exception("ElevenLabs API Key no configurada");
            }
            
            // ✅ NUEVO: Obtener carpeta de audio por sesión
            $audioDir = $this->cleanupService->getSessionAudioPath($sessionToken);
            error_log("📁 Guardando en: $audioDir");
            
            // Preparar la URL para la API de ElevenLabs
            $url = "{$this->apiUrl}/text-to-speech/{$voiceId}";
            
            // Preparar los datos a enviar - OPTIMIZADO PARA VELOCIDAD
            $data = [
                'text' => $text,
                'model_id' => 'eleven_turbo_v2_5',
                'voice_settings' => [
                    'stability' => 0.9,
                    'similarity_boost' => 0.95,
                    'style' => 0.0,
                    'use_speaker_boost' => true
                ],
                'optimize_streaming_latency' => 4,
                'output_format' => 'mp3_22050_32',
                'language_code' => 'es' 
            ];
            
            // Inicializar cURL
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'xi-api-key: ' . $this->apiKey,
                'Accept: audio/mpeg'
            ]);
            
            // Ejecutar la solicitud
            $audioStream = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            
            // Verificar errores
            if ($error) {
                throw new Exception("Error en cURL: " . $error);
            }
            
            if ($httpCode !== 200) {
                $errorInfo = json_decode($audioStream, true);
                $errorMsg = isset($errorInfo['detail']) ? $errorInfo['detail'] : "Error HTTP {$httpCode}";
                throw new Exception("Error en ElevenLabs API: " . (is_array($errorMsg) ? json_encode($errorMsg) : $errorMsg));
            }
            
            // ✅ Guardar archivo con hash del texto para caché
            $textHash = substr(md5($text), 0, 8);
            $fileName = 'speech_eleven_' . $textHash . '_' . time() . '.mp3';
            $filePath = $audioDir . '/' . $fileName;
            
            file_put_contents($filePath, $audioStream);
            
            // Verificar que el archivo se haya escrito correctamente
            if (!file_exists($filePath)) {
                throw new Exception("No se pudo escribir el archivo de audio");
            }
            
            error_log("✅ Audio generado exitosamente: $fileName");
            
            // ✅ NUEVO: Limpieza automática periódica (por sesión o global)
            if (rand(1, 5) === 1) {
                // 1 de cada 5 peticiones: limpiar archivos antiguos de la sesión actual
                if ($sessionToken) {
                    $this->cleanupService->cleanup($sessionToken);
                }
                
                // 1 de cada 20 peticiones: limpiar sesiones antiguas globalmente
                if (rand(1, 4) === 1) {
                    $this->cleanupService->cleanup(); // Sin sessionToken = limpieza global
                }
            }
            
            // ✅ NUEVO: Construir URL correcta según carpeta
            if ($sessionToken) {
                $sessionFolder = 'session_' . $sessionToken;
                $url = '/backend/audio/' . $sessionFolder . '/' . $fileName;
            } else {
                $url = '/backend/audio/' . $fileName;
            }
            
            return [
                'success' => true,
                'file' => $fileName,
                'url' => $url,
                'service' => 'elevenlabs',
                'cached' => false
            ];
        } catch (Exception $e) {
            error_log("❌ Error en ElevenLabs: " . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'service' => 'elevenlabs'
            ];
        }
    }
}
?>
