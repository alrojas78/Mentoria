<?php
/**
 * Script de Cron para generar retos automáticamente
 * 
 * Configuración del cron (ejecutar a las 6:00 AM):
 * 0 6 * * * /usr/bin/php /var/www/vozama/backend/cron/generar_retos.php >> /var/www/vozama/backend/logs/cron_retos.log 2>&1
 */

date_default_timezone_set('America/Bogota');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/RetoService.php';

$timestamp = date('Y-m-d H:i:s');
echo "[$timestamp] === INICIO CRON GENERACIÓN DE RETOS ===\n";

try {
    $diaSemana = strtolower(date('l'));
    echo "[$timestamp] Día actual: $diaSemana\n";
    
    if (!in_array($diaSemana, ['monday', 'thursday'])) {
        echo "[$timestamp] No es lunes ni jueves. Saliendo.\n";
        exit(0);
    }
    
    $database = new Database();
    $db = $database->getConnection();
    
    $retoService = new RetoService($db);
    $resultado = $retoService->generarRetosAutomaticos();
    
    if ($resultado['success']) {
        echo "[$timestamp] Retos generados: {$resultado['retos_generados']}/{$resultado['total_documentos']}\n";
    } else {
        echo "[$timestamp] ERROR: {$resultado['error']}\n";
    }
    
} catch (Exception $e) {
    echo "[$timestamp] EXCEPCIÓN: " . $e->getMessage() . "\n";
    exit(1);
}

echo "[$timestamp] === FIN CRON ===\n";
?>
