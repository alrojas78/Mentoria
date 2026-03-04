<?php
/**
 * WaTrainingService — Lógica de negocio para Entrenamiento por WhatsApp
 *
 * Maneja la programación de entregas, envío de mensajes,
 * y gestión del ciclo de vida de inscripciones.
 *
 * @package Mentoria
 * @since Fase 11.5
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/OperatixBridge.php';

class WaTrainingService {

    private PDO $db;
    private OperatixBridge $bridge;

    public function __construct(PDO $db) {
        $this->db = $db;
        $this->bridge = OperatixBridge::getInstance();
    }

    // =========================================================================
    // PROGRAMACIÓN DE ENTREGAS
    // =========================================================================

    /**
     * Programar todas las entregas pendientes para una inscripción.
     * Crea registros en wa_interacciones con fecha_programada calculada.
     */
    public function programarEntregas(int $inscripcionId): int {
        $inscripcion = $this->getInscripcion($inscripcionId);
        if (!$inscripcion) return 0;

        $fechaInicio = $inscripcion['fecha_inicio'] ?: date('Y-m-d');

        $stmt = $this->db->prepare("
            SELECT * FROM wa_entregas
            WHERE programa_id = ? AND activo = 1
            ORDER BY orden ASC
        ");
        $stmt->execute([$inscripcion['programa_id']]);
        $entregas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $this->db->prepare("
            SELECT entrega_id FROM wa_interacciones
            WHERE inscripcion_id = ? AND entrega_id IS NOT NULL
            AND tipo IN ('envio_contenido', 'envio_pregunta')
        ");
        $stmt->execute([$inscripcionId]);
        $yaProgramadas = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'entrega_id');

        $count = 0;
        $diaAcumulado = 0;

        foreach ($entregas as $entrega) {
            if (in_array($entrega['id'], $yaProgramadas)) {
                $diaAcumulado += (int)$entrega['dias_despues'];
                continue;
            }

            $diaAcumulado += (int)$entrega['dias_despues'];
            $hora = $entrega['hora_envio'] ?: '09:00:00';
            $fechaProgramada = date('Y-m-d', strtotime("$fechaInicio + $diaAcumulado days")) . ' ' . $hora;

            $tipo = $entrega['tipo'] === 'pregunta' ? 'envio_pregunta' : 'envio_contenido';

            $stmt = $this->db->prepare("
                INSERT INTO wa_interacciones
                (inscripcion_id, entrega_id, tipo, contenido, fecha_programada, estado_envio)
                VALUES (?, ?, ?, ?, ?, 'pendiente')
            ");
            $contenido = $entrega['texto'] ?: $entrega['titulo'];
            $stmt->execute([$inscripcionId, $entrega['id'], $tipo, $contenido, $fechaProgramada]);
            $count++;
        }

        return $count;
    }

    /**
     * Programar entregas para TODAS las inscripciones activas de un programa
     */
    public function programarEntregasPrograma(int $programaId): int {
        $stmt = $this->db->prepare("
            SELECT id FROM wa_inscripciones
            WHERE programa_id = ? AND estado = 'activo'
        ");
        $stmt->execute([$programaId]);
        $inscripciones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $total = 0;
        foreach ($inscripciones as $ins) {
            $total += $this->programarEntregas($ins['id']);
        }
        return $total;
    }

    // =========================================================================
    // MOTOR DE ENVÍO
    // =========================================================================

    /**
     * Procesar todos los envíos pendientes cuya fecha_programada <= ahora.
     * Método principal llamado por el cron.
     */
    public function procesarEnviosPendientes(): array {
        $ahora = date('Y-m-d H:i:s');

        $stmt = $this->db->prepare("
            SELECT i.*,
                   ins.telefono, ins.nombre AS estudiante_nombre, ins.programa_id,
                   e.tipo AS entrega_tipo, e.titulo AS entrega_titulo, e.texto AS entrega_texto,
                   e.media_url, e.media_tipo, e.pregunta, e.template_name,
                   e.template_variables, e.orden AS entrega_orden
            FROM wa_interacciones i
            JOIN wa_inscripciones ins ON i.inscripcion_id = ins.id
            JOIN wa_entregas e ON i.entrega_id = e.id
            WHERE i.estado_envio = 'pendiente'
              AND i.fecha_programada <= ?
              AND i.tipo IN ('envio_contenido', 'envio_pregunta')
              AND ins.estado = 'activo'
            ORDER BY i.fecha_programada ASC
            LIMIT 50
        ");
        $stmt->execute([$ahora]);
        $pendientes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $resultado = ['enviados' => 0, 'errores' => 0, 'detalles' => []];

        foreach ($pendientes as $item) {
            $detalle = $this->enviarEntrega($item);
            $resultado['detalles'][] = $detalle;
            if ($detalle['success']) {
                $resultado['enviados']++;
            } else {
                $resultado['errores']++;
            }
        }

        return $resultado;
    }

    /**
     * Enviar una entrega individual via OperatixBridge
     */
    private function enviarEntrega(array $item): array {
        $telefono = $item['telefono'];
        $interaccionId = $item['id'];
        $inscripcionId = $item['inscripcion_id'];

        try {
            $proyectoConfig = $this->getProyectoConfig($item['programa_id']);
            if (!$proyectoConfig || empty($proyectoConfig['whatsapp_connected'])) {
                $this->marcarError($interaccionId, 'WhatsApp no conectado en el proyecto');
                return ['success' => false, 'error' => 'WA no conectado', 'inscripcion' => $inscripcionId];
            }

            $result = null;

            if (!empty($item['template_name'])) {
                $variables = $item['template_variables'] ? json_decode($item['template_variables'], true) : [];
                $result = $this->bridge->sendTemplateMessage($telefono, $item['template_name'], $variables ?: []);
            } elseif (!empty($item['media_url'])) {
                $mediaType = $this->mapMediaType($item['media_tipo']);
                $caption = $item['entrega_texto'] ?: $item['entrega_titulo'];
                $result = $this->bridge->sendMediaMessage($telefono, $item['media_url'], $mediaType, $caption);
            } else {
                $texto = $item['entrega_texto'] ?: $item['entrega_titulo'] ?: '';

                if ($item['entrega_tipo'] === 'pregunta' && $item['pregunta']) {
                    if (!empty($texto)) $texto .= "\n\n";
                    $texto .= $item['pregunta'];
                }

                if (empty(trim($texto))) {
                    $this->marcarError($interaccionId, 'Sin contenido para enviar');
                    return ['success' => false, 'error' => 'Sin contenido', 'inscripcion' => $inscripcionId];
                }

                $result = $this->bridge->sendTextMessage($telefono, $texto);
            }

            if ($result && !empty($result['success'])) {
                $msgId = $result['message_id'] ?? $result['id'] ?? null;
                $this->marcarEnviado($interaccionId, $msgId);
                $this->actualizarProgresoInscripcion($inscripcionId, (int)$item['entrega_orden']);

                return [
                    'success' => true,
                    'inscripcion' => $inscripcionId,
                    'telefono' => $telefono,
                    'tipo' => $item['entrega_tipo'],
                    'message_id' => $msgId
                ];
            } else {
                $error = $result['error'] ?? 'Respuesta sin success de Operatix';
                $this->marcarError($interaccionId, $error);
                return ['success' => false, 'error' => $error, 'inscripcion' => $inscripcionId];
            }

        } catch (\Exception $e) {
            $this->marcarError($interaccionId, $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage(), 'inscripcion' => $inscripcionId];
        }
    }

    private function marcarEnviado(int $interaccionId, ?string $messageId): void {
        $stmt = $this->db->prepare("
            UPDATE wa_interacciones
            SET estado_envio = 'enviado', fecha_enviado = NOW(), operatix_message_id = ?
            WHERE id = ?
        ");
        $stmt->execute([$messageId, $interaccionId]);
    }

    private function marcarError(int $interaccionId, string $error): void {
        $stmt = $this->db->prepare("
            UPDATE wa_interacciones
            SET estado_envio = 'fallido', evaluacion_detalle = ?
            WHERE id = ?
        ");
        $stmt->execute(["Error envío: $error", $interaccionId]);
    }

    private function actualizarProgresoInscripcion(int $inscripcionId, int $entregaOrden): void {
        $stmt = $this->db->prepare("
            UPDATE wa_inscripciones
            SET entrega_actual = GREATEST(entrega_actual, ?), fecha_ultima_interaccion = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$entregaOrden + 1, $inscripcionId]);

        // Verificar si completó todas las entregas
        $stmt = $this->db->prepare("
            SELECT ins.programa_id, ins.entrega_actual,
                   (SELECT COUNT(*) FROM wa_entregas WHERE programa_id = ins.programa_id AND activo = 1) as total_entregas
            FROM wa_inscripciones ins WHERE ins.id = ?
        ");
        $stmt->execute([$inscripcionId]);
        $info = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($info && $info['entrega_actual'] >= $info['total_entregas']) {
            $stmt = $this->db->prepare("UPDATE wa_inscripciones SET estado = 'completado' WHERE id = ?");
            $stmt->execute([$inscripcionId]);
        }
    }

    // =========================================================================
    // AUTO-PROGRAMACIÓN
    // =========================================================================

    public function onProgramaActivado(int $programaId): int {
        return $this->programarEntregasPrograma($programaId);
    }

    public function onNuevaInscripcion(int $inscripcionId): int {
        $inscripcion = $this->getInscripcion($inscripcionId);
        if (!$inscripcion) return 0;

        $stmt = $this->db->prepare("SELECT estado FROM wa_programas WHERE id = ?");
        $stmt->execute([$inscripcion['programa_id']]);
        $programa = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($programa && $programa['estado'] === 'activo') {
            return $this->programarEntregas($inscripcionId);
        }
        return 0;
    }

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    private function getInscripcion(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM wa_inscripciones WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    private function getProyectoConfig(int $programaId): ?array {
        $stmt = $this->db->prepare("
            SELECT p.config_json
            FROM wa_programas wp
            JOIN proyectos p ON wp.proyecto_id = p.id
            WHERE wp.id = ?
        ");
        $stmt->execute([$programaId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || !$row['config_json']) return null;
        return json_decode($row['config_json'], true);
    }

    private function mapMediaType(?string $tipo): string {
        switch ($tipo) {
            case 'pdf':
            case 'documento': return 'document';
            case 'imagen': return 'image';
            case 'audio': return 'audio';
            case 'video': return 'video';
            default: return 'document';
        }
    }

    public function getResumenPendientes(): array {
        $stmt = $this->db->query("
            SELECT
                COUNT(*) as total_pendientes,
                COUNT(DISTINCT inscripcion_id) as inscripciones_afectadas,
                MIN(fecha_programada) as proxima_entrega
            FROM wa_interacciones
            WHERE estado_envio = 'pendiente'
              AND tipo IN ('envio_contenido', 'envio_pregunta')
              AND fecha_programada <= NOW()
        ");
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}
