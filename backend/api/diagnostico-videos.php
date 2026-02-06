<?php
// Script de Diagnóstico de Estructura de Videos
// Este script te ayudará a identificar el problema

require_once '../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable('../');
$dotenv->load();

header("Content-Type: application/json; charset=UTF-8");

include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Anexo.php';
include_once '../utils/VideoMentorService.php';

$database = new Database();
$db = $database->getConnection();

// CONFIGURA ESTOS VALORES según tu caso
$documentId = isset($_GET['document_id']) ? $_GET['document_id'] : null;

if (!$documentId) {
    echo json_encode(['error' => 'Se requiere document_id como parámetro. Ejemplo: ?document_id=2']);
    exit;
}

echo "=== DIAGNÓSTICO DE VIDEOS - DOCUMENTO {$documentId} ===\n\n";

// 1. VERIFICAR ANEXOS
echo "📁 PASO 1: Verificando anexos de tipo video...\n";
$anexo = new Anexo($db);
$anexos = $anexo->getByDocument($documentId, true);

$videosEncontrados = [];
foreach ($anexos as $anexoData) {
    if ($anexoData['file_type'] === 'video') {
        $videosEncontrados[] = $anexoData;
        echo "   ✅ Video encontrado: {$anexoData['titulo']}\n";
    }
}

echo "\nTotal videos encontrados: " . count($videosEncontrados) . "\n\n";

// 2. DETECTAR ESTRUCTURA CON PATRÓN
echo "🔍 PASO 2: Detectando estructura con patrón...\n";
$videoService = new VideoMentorService($db);
$videosPrograma = $videoService->detectarVideosProgramaMentor($documentId);

echo "Videos que cumplen el patrón: " . count($videosPrograma) . "\n\n";

// 3. MOSTRAR DETALLE DE CADA VIDEO
echo "📋 PASO 3: Detalle de estructura detectada:\n";
$modulosAgrupados = [];
foreach ($videosPrograma as $video) {
    $modulosAgrupados[$video['modulo']][] = $video;
}

foreach ($modulosAgrupados as $numeroModulo => $videosModulo) {
    echo "\n🎯 MÓDULO {$numeroModulo}:\n";
    foreach ($videosModulo as $video) {
        echo "   - Lección {$video['leccion']}: {$video['titulo']}\n";
        echo "     Anexo ID: {$video['anexo_id']}, Vimeo ID: {$video['vimeo_id']}\n";
    }
}

// 4. VERIFICAR TABLA doc_mentor_videos
echo "\n\n📊 PASO 4: Verificando tabla doc_mentor_videos...\n";
$stmt = $db->prepare("
    SELECT id, modulo_numero, leccion_numero, titulo_completo, vimeo_id
    FROM doc_mentor_videos
    WHERE document_id = ?
    ORDER BY modulo_numero, leccion_numero
");
$stmt->execute([$documentId]);
$videosDB = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Videos en BD: " . count($videosDB) . "\n";
foreach ($videosDB as $video) {
    echo "   - M{$video['modulo_numero']}L{$video['leccion_numero']}: {$video['titulo_completo']}\n";
}

// 5. RESUMEN
echo "\n\n📈 RESUMEN:\n";
echo "   - Anexos tipo video: " . count($videosEncontrados) . "\n";
echo "   - Videos detectados con patrón: " . count($videosPrograma) . "\n";
echo "   - Videos en tabla mentor: " . count($videosDB) . "\n";
echo "   - Total módulos: " . count($modulosAgrupados) . "\n";

foreach ($modulosAgrupados as $numMod => $vids) {
    echo "   - Módulo {$numMod}: " . count($vids) . " lecciones\n";
}

// 6. DIAGNÓSTICO
echo "\n\n🔧 DIAGNÓSTICO:\n";
if (count($videosEncontrados) != count($videosPrograma)) {
    echo "   ⚠️ ADVERTENCIA: Algunos videos no cumplen el patrón de nomenclatura\n";
    echo "   Los títulos deben seguir el formato: 'Módulo X - Lección Y - Título'\n";
}

if (count($videosPrograma) != count($videosDB)) {
    echo "   ⚠️ ADVERTENCIA: Desincronización entre anexos y tabla mentor\n";
    echo "   Recomendación: Sincronizar videos con el endpoint de sincronización\n";
}

if (count($modulosAgrupados) > 0) {
    echo "   ✅ Estructura detectada correctamente\n";
} else {
    echo "   ❌ No se detectó ninguna estructura válida\n";
}

echo "\n=== FIN DEL DIAGNÓSTICO ===\n";
?>
