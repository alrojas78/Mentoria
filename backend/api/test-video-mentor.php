<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

include_once '../config/db.php';
include_once '../utils/VideoMentorService.php';

$database = new Database();
$db = $database->getConnection();

if ($_GET['action'] === 'detectar_videos') {
    $documentId = $_GET['document_id'] ?? null;
    
    if (!$documentId) {
        echo json_encode(["error" => "document_id requerido"]);
        exit();
    }
    
    $videoService = new VideoMentorService($db);
    $videos = $videoService->detectarVideosProgramaMentor($documentId);
    
    echo json_encode([
        "success" => true,
        "videos_detectados" => count($videos),
        "videos" => $videos
    ]);
    
} elseif ($_GET['action'] === 'simular_estructura') {
    $documentId = $_GET['document_id'] ?? null;
    
    if (!$documentId) {
        echo json_encode(["error" => "document_id requerido"]);
        exit();
    }
    
    // Simular creación de estructura
    $videoService = new VideoMentorService($db);
    $videos = $videoService->detectarVideosProgramaMentor($documentId);
    
    if (!empty($videos)) {
        $estructura = [
            'titulo_programa' => 'Programa de Testing',
            'tipo_programa' => 'video_estructurado',
            'total_videos' => count($videos),
            'modulos' => []
        ];
        
        $modulosAgrupados = [];
        foreach ($videos as $video) {
            $modulosAgrupados[$video['modulo']][] = $video;
        }
        
        foreach ($modulosAgrupados as $num => $vids) {
            $estructura['modulos'][] = [
                'numero' => $num,
                'titulo' => "Módulo $num",
                'videos' => count($vids)
            ];
        }
        
        echo json_encode([
            "success" => true,
            "estructura_generada" => $estructura
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "No se detectaron videos con estructura válida"
        ]);
    }
}
?>