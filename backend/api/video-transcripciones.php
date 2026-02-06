<?php
// video-transcripciones.php - Manejo de transcripciones de videos
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../utils/auth.php';

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'POST':
            if ($action === 'save') {
                saveTranscripcion($db);
            } else {
                processVimeoTranscript($db);
            }
            break;
        case 'GET':
            getTranscripcion($db);
            break;
        case 'PUT':
            updateTranscripcion($db);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (Exception $e) {
    error_log("Error en video-transcripciones: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error interno del servidor']);
}

function saveTranscripcion($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $videoId = $input['video_id'] ?? null;
    $transcripcion = $input['transcripcion'] ?? '';
    $timestamps = $input['timestamps'] ?? null;
    $formato = $input['formato'] ?? 'vimeo';
    
    if (!$videoId) {
        http_response_code(400);
        echo json_encode(['error' => 'video_id es requerido']);
        return;
    }
    
    // ✅ Procesar transcripción según formato
    $transcripcionProcesada = procesarTranscripcionSegunFormato($transcripcion, $formato);
    $timestampsProcesados = procesarTimestamps($timestamps, $formato);
    
    $stmt = $db->prepare("
        UPDATE doc_mentor_videos 
        SET transcripcion = ?, 
            timestamps_clave = ?, 
            formato_transcripcion = ?
        WHERE id = ?
    ");
    
    $timestampsJson = $timestampsProcesados ? json_encode($timestampsProcesados) : null;
    
    if ($stmt->execute([$transcripcionProcesada, $timestampsJson, $formato, $videoId])) {
        echo json_encode([
            'success' => true,
            'message' => 'Transcripción guardada correctamente',
            'caracteres_procesados' => strlen($transcripcionProcesada),
            'timestamps_encontrados' => count($timestampsProcesados ?? [])
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar transcripción']);
    }
}

function procesarTranscripcionSegunFormato($transcripcion, $formato) {
    switch ($formato) {
        case 'vimeo':
            return procesarTranscripcionVimeo($transcripcion);
        case 'srt':
            return procesarTranscripcionSRT($transcripcion);
        case 'vtt':
            return procesarTranscripcionVTT($transcripcion);
        default:
            return limpiarTextoTranscripcion($transcripcion);
    }
}

function procesarTranscripcionVimeo($transcripcion) {
    // Si viene como array de objetos de Vimeo
    if (is_array($transcripcion)) {
        $textoCompleto = '';
        foreach ($transcripcion as $segmento) {
            if (isset($segmento['text'])) {
                $textoCompleto .= $segmento['text'] . ' ';
            }
        }
        return trim($textoCompleto);
    }
    
    // Si viene como texto con timestamps (formato: 00:00:02.520,0:00:08.400 texto)
    if (is_string($transcripcion)) {
        $lineas = explode("\n", $transcripcion);
        $textoLimpio = '';
        
        foreach ($lineas as $linea) {
            // Buscar patrón de timestamp y extraer solo el texto
            if (preg_match('/^\d+:\d+:\d+\.\d+,\d+:\d+:\d+\.\d+(.+)$/', trim($linea), $matches)) {
                $textoLimpio .= trim($matches[1]) . ' ';
            } else {
                // Si no tiene timestamp, agregar toda la línea
                $texto = trim($linea);
                if (!empty($texto) && !preg_match('/^\d+:\d+/', $texto)) {
                    $textoLimpio .= $texto . ' ';
                }
            }
        }
        
        return limpiarTextoTranscripcion($textoLimpio);
    }
    
    return limpiarTextoTranscripcion($transcripcion);
}

function procesarTimestamps($timestamps, $formato) {
    if (!$timestamps) return [];
    
    $timestampsProcesados = [];
    
    switch ($formato) {
        case 'vimeo':
            if (is_array($timestamps)) {
                foreach ($timestamps as $ts) {
                    if (isset($ts['startTime'], $ts['text'])) {
                        $timestampsProcesados[] = [
                            'tiempo' => $ts['startTime'],
                            'texto' => trim($ts['text']),
                            'duracion' => $ts['duration'] ?? null
                        ];
                    }
                }
            }
            break;
            
        case 'texto_con_tiempos':
            // Procesar texto que viene con timestamps como el ejemplo que compartiste
            if (is_string($timestamps)) {
                $lineas = explode("\n", $timestamps);
                foreach ($lineas as $linea) {
                    if (preg_match('/^(\d+:\d+:\d+\.\d+),(\d+:\d+:\d+\.\d+)(.+)$/', trim($linea), $matches)) {
                        $tiempoInicio = convertirTimestampASegundos($matches[1]);
                        $tiempoFin = convertirTimestampASegundos($matches[2]);
                        $texto = trim($matches[3]);
                        
                        $timestampsProcesados[] = [
                            'tiempo' => $tiempoInicio,
                            'tiempo_fin' => $tiempoFin,
                            'texto' => $texto,
                            'duracion' => $tiempoFin - $tiempoInicio
                        ];
                    }
                }
            }
            break;
    }
    
    return $timestampsProcesados;
}

function convertirTimestampASegundos($timestamp) {
    // Convertir formato 0:00:02.520 a segundos
    if (preg_match('/^(\d+):(\d+):(\d+)\.(\d+)$/', $timestamp, $matches)) {
        $horas = intval($matches[1]);
        $minutos = intval($matches[2]);
        $segundos = intval($matches[3]);
        $milisegundos = intval($matches[4]);
        
        return $horas * 3600 + $minutos * 60 + $segundos + ($milisegundos / 1000);
    }
    
    return 0;
}

function limpiarTextoTranscripcion($texto) {
    // Remover caracteres especiales y normalizar espacios
    $texto = preg_replace('/\s+/', ' ', $texto);
    $texto = trim($texto);
    return $texto;
}

function getTranscripcion($db) {
    $videoId = $_GET['video_id'] ?? null;
    
    if (!$videoId) {
        http_response_code(400);
        echo json_encode(['error' => 'video_id es requerido']);
        return;
    }
    
    $stmt = $db->prepare("
        SELECT transcripcion, timestamps_clave, formato_transcripcion 
        FROM doc_mentor_videos 
        WHERE id = ?
    ");
    $stmt->execute([$videoId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result) {
        echo json_encode([
            'success' => true,
            'transcripcion' => $result['transcripcion'],
            'timestamps' => $result['timestamps_clave'] ? json_decode($result['timestamps_clave'], true) : [],
            'formato' => $result['formato_transcripcion']
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Transcripción no encontrada']);
    }
}
?>