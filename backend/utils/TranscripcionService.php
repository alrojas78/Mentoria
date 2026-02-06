<?php
class TranscripcionService {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    // Procesar transcripción con timestamps
    public function procesarTranscripcion($videoId, $transcripcionTexto) {
        // Dividir transcripción en segmentos con timestamps
        $segmentos = $this->extraerSegmentosConTimestamp($transcripcionTexto);
        
        // Generar timestamps clave para búsqueda
        $timestampsClave = $this->generarTimestampsClave($segmentos);
        
        // Actualizar video con transcripción procesada
        $stmt = $this->db->prepare("
            UPDATE doc_mentor_videos 
            SET transcripcion = ?, timestamps_clave = ?
            WHERE id = ?
        ");
        
        return $stmt->execute([
            $transcripcionTexto,
            json_encode($timestampsClave),
            $videoId
        ]);
    }
    
    private function extraerSegmentosConTimestamp($texto) {
        $segmentos = [];
        
        // Buscar patrones de timestamp (00:30, 1:45, etc.)
        $pattern = '/(\d{1,2}:\d{2})\s*[-:]?\s*(.+?)(?=\d{1,2}:\d{2}|$)/s';
        
        if (preg_match_all($pattern, $texto, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $timestamp = $this->convertirTimestampASegundos($match[1]);
                $contenido = trim($match[2]);
                
                if (!empty($contenido)) {
                    $segmentos[] = [
                        'timestamp' => $timestamp,
                        'contenido' => $contenido,
                        'keywords' => $this->extraerKeywords($contenido)
                    ];
                }
            }
        }
        
        return $segmentos;
    }
    
    private function convertirTimestampASegundos($timestamp) {
        $partes = explode(':', $timestamp);
        if (count($partes) === 2) {
            return ((int)$partes[0] * 60) + (int)$partes[1];
        }
        return 0;
    }
    
    private function extraerKeywords($texto) {
        // Extraer palabras clave importantes
        $stopWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo'];
        $palabras = str_word_count(strtolower($texto), 1, 'áéíóúñü');
        
        $keywords = array_filter($palabras, function($palabra) use ($stopWords) {
            return strlen($palabra) > 3 && !in_array($palabra, $stopWords);
        });
        
        return array_unique(array_slice($keywords, 0, 10));
    }
    
    private function generarTimestampsClave($segmentos) {
        $clave = [];
        
        foreach ($segmentos as $segmento) {
            foreach ($segmento['keywords'] as $keyword) {
                if (!isset($clave[$keyword])) {
                    $clave[$keyword] = [];
                }
                $clave[$keyword][] = $segmento['timestamp'];
            }
        }
        
        return $clave;
    }
    
    // Buscar contenido relevante por timestamp
    public function buscarContenidoPorTiempo($videoId, $timestamp, $rango = 30) {
        $stmt = $this->db->prepare("
            SELECT transcripcion, timestamps_clave 
            FROM doc_mentor_videos 
            WHERE id = ?
        ");
        
        $stmt->execute([$videoId]);
        $video = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$video || !$video['transcripcion']) {
            return null;
        }
        
        $segmentos = $this->extraerSegmentosConTimestamp($video['transcripcion']);
        
        // Buscar segmento más cercano al timestamp
        $segmentoRelevante = null;
        $menorDiferencia = PHP_INT_MAX;
        
        foreach ($segmentos as $segmento) {
            $diferencia = abs($segmento['timestamp'] - $timestamp);
            if ($diferencia <= $rango && $diferencia < $menorDiferencia) {
                $menorDiferencia = $diferencia;
                $segmentoRelevante = $segmento;
            }
        }
        
        return $segmentoRelevante;
    }
}
?>