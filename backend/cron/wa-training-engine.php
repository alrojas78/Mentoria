<?php
/**
 * WA Training Engine — Cron Job para envío automático de entregas WhatsApp
 *
 * Ejecutar cada 15 minutos:
 * [star]/15 * * * * /usr/bin/php /var/www/voicemed/backend/cron/wa-training-engine.php >> /var/www/voicemed/backend/logs/wa-training.log 2>&1
 *
 * Flujo:
 * 1. Programar entregas para inscripciones nuevas sin programación
 * 2. Procesar envíos pendientes cuya fecha_programada <= NOW()
 * 3. Log de resultados
 *
 * @since Fase 11.5
 */

date_default_timezone_set('America/Bogota');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../utils/WaTrainingService.php';

$timestamp = date('Y-m-d H:i:s');
echo "[$timestamp] === WA TRAINING ENGINE START ===\n";

try {
    $database = new Database();
    $db = $database->getConnection();
    $service = new WaTrainingService($db);

    // =========================================================================
    // PASO 1: Auto-programar inscripciones sin entregas programadas
    // =========================================================================

    $stmt = $db->query("
        SELECT ins.id, ins.programa_id, wp.nombre AS programa_nombre
        FROM wa_inscripciones ins
        JOIN wa_programas wp ON ins.programa_id = wp.id
        WHERE ins.estado = 'activo'
          AND wp.estado = 'activo'
          AND NOT EXISTS (
              SELECT 1 FROM wa_interacciones wi
              WHERE wi.inscripcion_id = ins.id
              AND wi.tipo IN ('envio_contenido', 'envio_pregunta')
          )
    ");
    $sinProgramar = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($sinProgramar) > 0) {
        echo "[$timestamp] Inscripciones sin programar: " . count($sinProgramar) . "\n";
        foreach ($sinProgramar as $ins) {
            $programadas = $service->programarEntregas($ins['id']);
            echo "[$timestamp]   -> Inscripcion #{$ins['id']} (programa: {$ins['programa_nombre']}): $programadas entregas programadas\n";
        }
    }

    // =========================================================================
    // PASO 2: Resumen de pendientes
    // =========================================================================

    $resumen = $service->getResumenPendientes();
    echo "[$timestamp] Pendientes listos: {$resumen['total_pendientes']} (inscripciones: {$resumen['inscripciones_afectadas']})\n";

    if ((int)$resumen['total_pendientes'] === 0) {
        echo "[$timestamp] Sin envios pendientes. Fin.\n";
        exit(0);
    }

    // =========================================================================
    // PASO 3: Procesar envios
    // =========================================================================

    $resultado = $service->procesarEnviosPendientes();

    echo "[$timestamp] Enviados: {$resultado['enviados']} | Errores: {$resultado['errores']}\n";

    foreach ($resultado['detalles'] as $d) {
        $status = $d['success'] ? 'OK' : 'FAIL';
        $info = $d['success']
            ? "tel:{$d['telefono']} tipo:{$d['tipo']}"
            : "error:{$d['error']}";
        echo "[$timestamp]   [$status] inscripcion:{$d['inscripcion']} $info\n";
    }

    echo "[$timestamp] === WA TRAINING ENGINE END ===\n";

} catch (Exception $e) {
    echo "[$timestamp] EXCEPCION FATAL: " . $e->getMessage() . "\n";
    echo "[$timestamp] " . $e->getTraceAsString() . "\n";
    exit(1);
}
