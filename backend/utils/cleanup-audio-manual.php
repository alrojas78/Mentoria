<?php
// backend/utils/cleanup-audio-manual.php
// Script para ejecutar limpieza manual

require_once __DIR__ . '/AudioCleanupService.php';

echo "🧹 Iniciando limpieza manual de archivos de audio...\n\n";

$cleanup = new AudioCleanupService();

// Obtener estadísticas antes
$statsBefore = $cleanup->getStats();
echo "📊 Estado ANTES de la limpieza:\n";
echo "   - Archivos totales: {$statsBefore['total_files']}\n";
echo "   - Espacio usado: {$statsBefore['total_size_mb']} MB\n";
echo "   - Directorio: {$statsBefore['directory']}\n\n";

// Ejecutar limpieza
$results = $cleanup->cleanup();

// Mostrar resultados
echo "✅ Limpieza completada:\n";
echo "   - Archivos eliminados: {$results['files_deleted']}\n";
echo "   - Espacio liberado: {$results['space_freed_mb']} MB\n";
echo "   - Archivos restantes: {$results['files_after']}\n\n";

echo "✅ Limpieza manual finalizada\n";
?>