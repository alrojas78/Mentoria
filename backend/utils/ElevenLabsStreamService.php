<?php
require_once __DIR__ . '/../config/config.php';

class ElevenLabsStreamService {
    private $apiKey;
    private $apiUrl = 'https://api.elevenlabs.io/v1';
    
    public function __construct() {
        if (defined('ELEVENLABS_API_KEY')) {
            $this->apiKey = ELEVENLABS_API_KEY;
        } else {
            error_log("ElevenLabs API Key no configurada");
        }
    }
    
    public function streamAudio($text, $voiceId = 'HiFRzF6BxSCjTfbRNfJa') {
        try {
            if (empty($this->apiKey)) {
                throw new Exception("ElevenLabs API Key no configurada");
            }
            
            // ✅ URL DE STREAMING (diferente a la normal)
            $url = "{$this->apiUrl}/text-to-speech/{$voiceId}/stream";
            
            // ✅ CONFIGURACIÓN OPTIMIZADA PARA STREAMING
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
            
            error_log("🚀 Iniciando streaming para texto: " . substr($text, 0, 50) . "...");
            
            // ✅ CONFIGURAR cURL PARA STREAMING
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'xi-api-key: ' . $this->apiKey,
                'Accept: audio/mpeg'
            ]);
            
            // ✅ FUNCIÓN DE STREAMING - Envía data en tiempo real
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $chunk) {
                echo $chunk;
                flush();
                return strlen($chunk);
            });
            
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode !== 200) {
                throw new Exception("Error HTTP {$httpCode} en streaming");
            }
            
            error_log("✅ Streaming completado exitosamente");
            
        } catch (Exception $e) {
            error_log("❌ Error en streaming: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
?>