<?php
class VideoMentorService {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    // Detectar videos estructurados automáticamente
    public function detectarVideosProgramaMentor($documentId) {
        $anexo = new Anexo($this->db);
        $anexos = $anexo->getByDocument($documentId, true);
        
        $videosPrograma = [];
        
        foreach ($anexos as $anexoData) {
            if ($anexoData['file_type'] === 'video') {
                $deteccion = Anexo::isVideoPrograma($anexoData['titulo']);
                
                if ($deteccion['es_video_programa']) {
                    $videosPrograma[] = [
                        'anexo_id' => $anexoData['id'],
                        'modulo' => $deteccion['modulo'],
                        'leccion' => $deteccion['leccion'],
                        'titulo' => $anexoData['titulo'],
                        'vimeo_id' => $this->extraerVimeoId($anexoData['descripcion'])
                    ];
                }
            }
        }
        
        // Ordenar por módulo y lección
        usort($videosPrograma, function($a, $b) {
            if ($a['modulo'] === $b['modulo']) {
                return $a['leccion'] <=> $b['leccion'];
            }
            return $a['modulo'] <=> $b['modulo'];
        });
        
        return $videosPrograma;
    }
    
private function extraerVimeoId($texto) {
    // Patrones mejorados para URLs con hash de privacidad
    $patrones = [
        '/player\.vimeo\.com\/video\/(\d+)\?h=[\w\d]+/',  // https://player.vimeo.com/video/1085039218?h=72d886bab2
        '/player\.vimeo\.com\/video\/(\d+)/',             // https://player.vimeo.com/video/1085039218
        '/vimeo\.com\/video\/(\d+)\?h=[\w\d]+/',          // https://vimeo.com/video/1085039218?h=hash
        '/vimeo\.com\/video\/(\d+)/',                     // https://vimeo.com/video/1085039218
        '/vimeo\.com\/(\d+)\?h=[\w\d]+/',                 // https://vimeo.com/1085039218?h=hash
        '/vimeo\.com\/(\d+)/',                            // https://vimeo.com/1085039218
        '/(\d{8,12})/'                                    // ID numérico directo como fallback
    ];
    
    foreach ($patrones as $patron) {
        if (preg_match($patron, $texto, $matches)) {
            return $matches[1];
        }
    }
    
    return null;
}
}
?>