<?php
/**
 * RetoService.php
 * Servicio para gestionar el modo Reto semanal
 *
 * Este servicio maneja:
 * - Generación automática de preguntas de reto (lunes y jueves)
 * - Verificación de retos pendientes por usuario
 * - Evaluación de respuestas usando IA
 * - Historial de retos contestados
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';

class RetoService {
    private $db;
    private $apiKey;
    private $apiEndpoint = 'https://api.openai.com/v1/chat/completions';

    public function __construct($database = null) {
        if ($database) {
            $this->db = $database;
        } else {
            $db = new Database();
            $this->db = $db->getConnection();
        }

        if (defined('OPENAI_API_KEY')) {
            $this->apiKey = OPENAI_API_KEY;
        }
    }

    /**
     * Verifica si hay un reto pendiente para un usuario en un documento
     */
    public function verificarRetoPendiente($documentId, $userId) {
        try {
            $hoy = date('Y-m-d');
            $diaSemana = strtolower(date('l'));
            $esDiaDeReto = in_array($diaSemana, ['monday', 'thursday']);

            $query = "SELECT r.*,
                      (SELECT COUNT(*) FROM doc_reto_respuestas rr
                       WHERE rr.reto_id = r.id AND rr.user_id = :user_id) as ya_respondido
                      FROM doc_retos r
                      WHERE r.document_id = :document_id
                      AND r.activo = 1
                      AND r.fecha_disponible <= :hoy
                      ORDER BY r.fecha_disponible DESC
                      LIMIT 1";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->bindParam(':hoy', $hoy);
            $stmt->execute();

            $reto = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$reto) {
                $proximoReto = $this->calcularProximoDiaReto();
                return [
                    'tiene_reto_pendiente' => false,
                    'reto' => null,
                    'mensaje' => "No hay reto disponible actualmente",
                    'proximo_reto' => $proximoReto,
                    'es_dia_de_reto' => $esDiaDeReto
                ];
            }

            if ($reto['ya_respondido'] > 0) {
                $proximoReto = $this->calcularProximoDiaReto();
                return [
                    'tiene_reto_pendiente' => false,
                    'reto' => null,
                    'mensaje' => "Ya completaste el reto de esta semana",
                    'proximo_reto' => $proximoReto,
                    'reto_completado' => true
                ];
            }

            return [
                'tiene_reto_pendiente' => true,
                'reto' => [
                    'id' => $reto['id'],
                    'pregunta' => $reto['pregunta'],
                    'dia_semana' => $reto['dia_semana'],
                    'fecha_disponible' => $reto['fecha_disponible']
                ],
                'mensaje' => "Tienes un reto pendiente",
                'es_dia_de_reto' => $esDiaDeReto
            ];

        } catch (Exception $e) {
            error_log("Error en verificarRetoPendiente: " . $e->getMessage());
            return [
                'tiene_reto_pendiente' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    private function calcularProximoDiaReto() {
        $hoy = new DateTime();
        $diaSemana = (int)$hoy->format('N');

        if ($diaSemana < 4) {
            $diasHastaJueves = 4 - $diaSemana;
            $proximoReto = clone $hoy;
            $proximoReto->modify("+{$diasHastaJueves} days");
            return [
                'dia' => 'jueves',
                'fecha' => $proximoReto->format('Y-m-d'),
                'dias_restantes' => $diasHastaJueves
            ];
        } else {
            $diasHastaLunes = (8 - $diaSemana);
            $proximoReto = clone $hoy;
            $proximoReto->modify("+{$diasHastaLunes} days");
            return [
                'dia' => 'lunes',
                'fecha' => $proximoReto->format('Y-m-d'),
                'dias_restantes' => $diasHastaLunes
            ];
        }
    }

    public function generarReto($documentId, $diaReto = null) {
        try {
            if (!$diaReto) {
                $diaSemana = strtolower(date('l'));
                $diaReto = ($diaSemana === 'monday') ? 'lunes' : 'jueves';
            }

            $queryDoc = "SELECT id, titulo, contenido FROM documentos WHERE id = :id";
            $stmtDoc = $this->db->prepare($queryDoc);
            $stmtDoc->bindParam(':id', $documentId, PDO::PARAM_INT);
            $stmtDoc->execute();
            $documento = $stmtDoc->fetch(PDO::FETCH_ASSOC);

            if (!$documento) {
                throw new Exception("Documento no encontrado");
            }

            $semanaAnio = date('Y-W');
            $fechaDisponible = date('Y-m-d');

            $queryExiste = "SELECT id FROM doc_retos
                           WHERE document_id = :document_id
                           AND semana_anio = :semana_anio
                           AND dia_semana = :dia_semana";
            $stmtExiste = $this->db->prepare($queryExiste);
            $stmtExiste->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmtExiste->bindParam(':semana_anio', $semanaAnio);
            $stmtExiste->bindParam(':dia_semana', $diaReto);
            $stmtExiste->execute();

            if ($stmtExiste->fetch()) {
                return [
                    'success' => false,
                    'message' => "Ya existe un reto para este documento esta semana ($diaReto)"
                ];
            }

            $preguntaGenerada = $this->generarPreguntaConIA($documento);

            if (!$preguntaGenerada['success']) {
                throw new Exception("Error al generar pregunta: " . $preguntaGenerada['error']);
            }

            $queryInsert = "INSERT INTO doc_retos
                           (document_id, pregunta, contexto_pregunta, fecha_disponible, dia_semana, semana_anio, activo)
                           VALUES
                           (:document_id, :pregunta, :contexto, :fecha_disponible, :dia_semana, :semana_anio, 1)";

            $stmtInsert = $this->db->prepare($queryInsert);
            $stmtInsert->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmtInsert->bindParam(':pregunta', $preguntaGenerada['pregunta']);
            $stmtInsert->bindParam(':contexto', $preguntaGenerada['contexto']);
            $stmtInsert->bindParam(':fecha_disponible', $fechaDisponible);
            $stmtInsert->bindParam(':dia_semana', $diaReto);
            $stmtInsert->bindParam(':semana_anio', $semanaAnio);
            $stmtInsert->execute();

            $retoId = $this->db->lastInsertId();

            return [
                'success' => true,
                'reto_id' => $retoId,
                'pregunta' => $preguntaGenerada['pregunta'],
                'dia_semana' => $diaReto,
                'semana_anio' => $semanaAnio
            ];

        } catch (Exception $e) {
            error_log("Error en generarReto: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    private function generarPreguntaConIA($documento) {
        if (empty($this->apiKey)) {
            return [
                'success' => false,
                'error' => 'API Key de OpenAI no configurada'
            ];
        }

        $systemPrompt = <<<EOT
Eres un generador de preguntas de reto semanal para una plataforma de capacitación.
Tu tarea es crear UNA pregunta desafiante pero justa basada en el contenido del documento.

**REGLAS PARA LA PREGUNTA:**
1. La pregunta debe ser de reflexión o aplicación práctica, NO de memoria
2. Debe poder responderse en 2-3 oraciones
3. Debe estar directamente relacionada con el contenido del documento
4. Debe ser clara y sin ambigüedades
5. Debe promover el pensamiento crítico
6. NO debe ser una pregunta de opción múltiple

**FORMATO DE RESPUESTA:**
Responde ÚNICAMENTE con un JSON válido:
{
  "pregunta": "Tu pregunta aquí",
  "contexto": "Breve contexto del tema para evaluar la respuesta (2-3 oraciones)"
}
EOT;

        $userPrompt = "Genera una pregunta de reto semanal basada en este documento:\n\n";
        $userPrompt .= "TÍTULO: " . $documento['titulo'] . "\n\n";
        $userPrompt .= "CONTENIDO:\n" . substr($documento['contenido'], 0, 4000);

        $data = [
            'model' => 'gpt-4o',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt]
            ],
            'temperature' => 0.7,
            'max_tokens' => 500
        ];

        try {
            $ch = curl_init($this->apiEndpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey
            ]);

            $response = curl_exec($ch);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                throw new Exception("Error CURL: " . $error);
            }

            $decoded = json_decode($response, true);

            if (isset($decoded['choices'][0]['message']['content'])) {
                $content = $decoded['choices'][0]['message']['content'];
                $jsonStart = strpos($content, '{');
                $jsonEnd = strrpos($content, '}');

                if ($jsonStart !== false && $jsonEnd !== false) {
                    $jsonString = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
                    $resultado = json_decode($jsonString, true);

                    if ($resultado && isset($resultado['pregunta'])) {
                        return [
                            'success' => true,
                            'pregunta' => $resultado['pregunta'],
                            'contexto' => $resultado['contexto'] ?? ''
                        ];
                    }
                }
            }

            throw new Exception("Respuesta de IA inválida");

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function evaluarRespuesta($retoId, $userId, $respuestaUsuario) {
        try {
            $query = "SELECT r.*, d.titulo, d.contenido
                      FROM doc_retos r
                      JOIN documentos d ON r.document_id = d.id
                      WHERE r.id = :reto_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':reto_id', $retoId, PDO::PARAM_INT);
            $stmt->execute();
            $reto = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$reto) {
                throw new Exception("Reto no encontrado");
            }

            $queryCheck = "SELECT id FROM doc_reto_respuestas
                          WHERE reto_id = :reto_id AND user_id = :user_id";
            $stmtCheck = $this->db->prepare($queryCheck);
            $stmtCheck->bindParam(':reto_id', $retoId, PDO::PARAM_INT);
            $stmtCheck->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmtCheck->execute();

            if ($stmtCheck->fetch()) {
                throw new Exception("Ya has respondido este reto");
            }

            $evaluacion = $this->evaluarConIA($reto, $respuestaUsuario);

            $queryInsert = "INSERT INTO doc_reto_respuestas
                           (reto_id, user_id, respuesta_usuario, retroalimentacion, puntuacion, es_correcta)
                           VALUES
                           (:reto_id, :user_id, :respuesta, :retroalimentacion, :puntuacion, :es_correcta)";

            $stmtInsert = $this->db->prepare($queryInsert);
            $stmtInsert->bindParam(':reto_id', $retoId, PDO::PARAM_INT);
            $stmtInsert->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmtInsert->bindParam(':respuesta', $respuestaUsuario);
            $stmtInsert->bindParam(':retroalimentacion', $evaluacion['retroalimentacion']);
            $stmtInsert->bindParam(':puntuacion', $evaluacion['puntuacion']);
            $stmtInsert->bindParam(':es_correcta', $evaluacion['es_correcta'], PDO::PARAM_INT);
            $stmtInsert->execute();

            return [
                'success' => true,
                'retroalimentacion' => $evaluacion['retroalimentacion'],
                'puntuacion' => $evaluacion['puntuacion'],
                'es_correcta' => $evaluacion['es_correcta'],
                'mensaje_despedida' => $this->generarMensajeDespedida($evaluacion['es_correcta'])
            ];

        } catch (Exception $e) {
            error_log("Error en evaluarRespuesta: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    private function evaluarConIA($reto, $respuestaUsuario) {
        if (empty($this->apiKey)) {
            return [
                'retroalimentacion' => 'Gracias por tu respuesta. Tu participación ha sido registrada.',
                'puntuacion' => 0.5,
                'es_correcta' => true
            ];
        }

        $systemPrompt = <<<EOT
Eres un evaluador de respuestas para retos semanales de capacitación.
Tu tarea es evaluar la respuesta del usuario de forma constructiva y motivadora.

**CRITERIOS DE EVALUACIÓN:**
1. Relevancia: ¿La respuesta aborda la pregunta?
2. Comprensión: ¿Demuestra entendimiento del tema?
3. Reflexión: ¿Muestra pensamiento crítico?

**REGLAS:**
1. Sé constructivo y motivador, nunca crítico negativamente
2. Destaca los puntos positivos de la respuesta
3. Si hay áreas de mejora, sugiérelas amablemente
4. La retroalimentación debe ser personalizada y específica
5. Mantén un tono cercano y profesional

**FORMATO DE RESPUESTA:**
Responde ÚNICAMENTE con un JSON válido:
{
  "retroalimentacion": "Tu retroalimentación constructiva aquí (máximo 4 oraciones)",
  "puntuacion": 0.85,
  "es_correcta": true
}

La puntuación va de 0.0 a 1.0
es_correcta es true si la puntuación >= 0.6
EOT;

        $userPrompt = "PREGUNTA DEL RETO:\n" . $reto['pregunta'] . "\n\n";
        $userPrompt .= "CONTEXTO DEL TEMA:\n" . ($reto['contexto_pregunta'] ?? 'N/A') . "\n\n";
        $userPrompt .= "RESPUESTA DEL USUARIO:\n" . $respuestaUsuario;

        $data = [
            'model' => 'gpt-4o',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt]
            ],
            'temperature' => 0.5,
            'max_tokens' => 400
        ];

        try {
            $ch = curl_init($this->apiEndpoint);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey
            ]);

            $response = curl_exec($ch);
            curl_close($ch);

            $decoded = json_decode($response, true);

            if (isset($decoded['choices'][0]['message']['content'])) {
                $content = $decoded['choices'][0]['message']['content'];
                $jsonStart = strpos($content, '{');
                $jsonEnd = strrpos($content, '}');

                if ($jsonStart !== false && $jsonEnd !== false) {
                    $jsonString = substr($content, $jsonStart, $jsonEnd - $jsonStart + 1);
                    $resultado = json_decode($jsonString, true);

                    if ($resultado) {
                        return [
                            'retroalimentacion' => $resultado['retroalimentacion'] ?? 'Gracias por tu respuesta.',
                            'puntuacion' => floatval($resultado['puntuacion'] ?? 0.5),
                            'es_correcta' => $resultado['es_correcta'] ?? false
                        ];
                    }
                }
            }

        } catch (Exception $e) {
            error_log("Error en evaluarConIA: " . $e->getMessage());
        }

        return [
            'retroalimentacion' => 'Gracias por participar en el reto. Tu respuesta ha sido registrada.',
            'puntuacion' => 0.5,
            'es_correcta' => true
        ];
    }

    private function generarMensajeDespedida($esCorrecta) {
        if ($esCorrecta) {
            $mensajes = [
                "¡Excelente trabajo! Tu participación demuestra compromiso con tu aprendizaje.",
                "¡Muy bien hecho! Sigue así, vas por buen camino.",
                "¡Felicitaciones! Has completado el reto exitosamente."
            ];
        } else {
            $mensajes = [
                "Gracias por participar. Cada reto es una oportunidad de aprendizaje.",
                "Tu esfuerzo es valioso. Sigue practicando y mejorarás.",
                "Participar es lo importante. El próximo reto será otra oportunidad."
            ];
        }

        return $mensajes[array_rand($mensajes)] . " Ahora puedes continuar en modo consulta si tienes más dudas.";
    }

    public function obtenerHistorialRetos($documentId, $userId, $limite = 10) {
        try {
            $query = "SELECT r.id, r.pregunta, r.dia_semana, r.fecha_disponible,
                      rr.respuesta_usuario, rr.retroalimentacion, rr.puntuacion,
                      rr.es_correcta, rr.fecha_respuesta
                      FROM doc_retos r
                      LEFT JOIN doc_reto_respuestas rr ON r.id = rr.reto_id AND rr.user_id = :user_id
                      WHERE r.document_id = :document_id
                      ORDER BY r.fecha_disponible DESC
                      LIMIT :limite";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->bindParam(':limite', $limite, PDO::PARAM_INT);
            $stmt->execute();

            return [
                'success' => true,
                'historial' => $stmt->fetchAll(PDO::FETCH_ASSOC)
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function obtenerEstadisticasAdmin($documentId) {
        try {
            // Reto actual (más reciente activo)
            $queryActual = "SELECT r.*,
                           (SELECT COUNT(*) FROM doc_reto_respuestas WHERE reto_id = r.id) as total_respuestas,
                           (SELECT COUNT(*) FROM doc_reto_respuestas WHERE reto_id = r.id AND es_correcta = 1) as respuestas_correctas,
                           (SELECT AVG(puntuacion) FROM doc_reto_respuestas WHERE reto_id = r.id) as promedio_puntuacion
                           FROM doc_retos r
                           WHERE r.document_id = :document_id AND r.activo = 1
                           ORDER BY r.fecha_disponible DESC
                           LIMIT 1";

            $stmtActual = $this->db->prepare($queryActual);
            $stmtActual->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmtActual->execute();
            $retoActual = $stmtActual->fetch(PDO::FETCH_ASSOC);

            // Estadísticas generales
            $queryStats = "SELECT
                          COUNT(DISTINCT r.id) as total_retos,
                          COUNT(DISTINCT rr.id) as total_respuestas,
                          AVG(rr.puntuacion) as promedio_general,
                          (SELECT COUNT(*) FROM doc_reto_respuestas drr 
                           JOIN doc_retos dr ON drr.reto_id = dr.id 
                           WHERE dr.document_id = :document_id2 AND drr.es_correcta = 1) as total_correctas,
                          MAX(rr.puntuacion) as mejor_puntuacion
                          FROM doc_retos r
                          LEFT JOIN doc_reto_respuestas rr ON r.id = rr.reto_id
                          WHERE r.document_id = :document_id";

            $stmtStats = $this->db->prepare($queryStats);
            $stmtStats->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmtStats->bindParam(':document_id2', $documentId, PDO::PARAM_INT);
            $stmtStats->execute();
            $stats = $stmtStats->fetch(PDO::FETCH_ASSOC);

            // Respuestas del reto actual
            $respuestasActual = [];
            if ($retoActual) {
                $queryRespuestas = "SELECT rr.*, u.nombre, u.email
                                   FROM doc_reto_respuestas rr
                                   JOIN users u ON rr.user_id = u.id
                                   WHERE rr.reto_id = :reto_id
                                   ORDER BY rr.fecha_respuesta DESC";
                $stmtRespuestas = $this->db->prepare($queryRespuestas);
                $stmtRespuestas->bindParam(':reto_id', $retoActual['id'], PDO::PARAM_INT);
                $stmtRespuestas->execute();
                $respuestasActual = $stmtRespuestas->fetchAll(PDO::FETCH_ASSOC);
            }

            // NUEVO: Historial de todos los retos con estadísticas
            $queryHistorial = "SELECT r.id, r.pregunta, r.dia_semana, r.fecha_disponible, r.semana_anio, r.activo,
                              (SELECT COUNT(*) FROM doc_reto_respuestas WHERE reto_id = r.id) as total_respuestas,
                              (SELECT COUNT(*) FROM doc_reto_respuestas WHERE reto_id = r.id AND es_correcta = 1) as respuestas_correctas,
                              (SELECT AVG(puntuacion) FROM doc_reto_respuestas WHERE reto_id = r.id) as promedio_puntuacion,
                              (SELECT MAX(puntuacion) FROM doc_reto_respuestas WHERE reto_id = r.id) as mejor_puntuacion,
                              (SELECT MIN(puntuacion) FROM doc_reto_respuestas WHERE reto_id = r.id) as peor_puntuacion
                              FROM doc_retos r
                              WHERE r.document_id = :document_id
                              ORDER BY r.fecha_disponible DESC
                              LIMIT 50";

            $stmtHistorial = $this->db->prepare($queryHistorial);
            $stmtHistorial->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmtHistorial->execute();
            $historialRetos = $stmtHistorial->fetchAll(PDO::FETCH_ASSOC);

            // NUEVO: Ranking de usuarios por mejor puntuación promedio
            $queryRanking = "SELECT u.id, u.nombre, u.email,
                            COUNT(rr.id) as retos_completados,
                            AVG(rr.puntuacion) as promedio_puntuacion,
                            MAX(rr.puntuacion) as mejor_puntuacion,
                            SUM(CASE WHEN rr.es_correcta = 1 THEN 1 ELSE 0 END) as respuestas_correctas
                            FROM users u
                            JOIN doc_reto_respuestas rr ON u.id = rr.user_id
                            JOIN doc_retos r ON rr.reto_id = r.id
                            WHERE r.document_id = :document_id
                            GROUP BY u.id, u.nombre, u.email
                            ORDER BY promedio_puntuacion DESC, retos_completados DESC
                            LIMIT 20";

            $stmtRanking = $this->db->prepare($queryRanking);
            $stmtRanking->bindParam(':document_id', $documentId, PDO::PARAM_INT);
            $stmtRanking->execute();
            $rankingUsuarios = $stmtRanking->fetchAll(PDO::FETCH_ASSOC);

            return [
                'success' => true,
                'reto_actual' => $retoActual,
                'estadisticas' => $stats,
                'respuestas_reto_actual' => $respuestasActual,
                'historial_retos' => $historialRetos,
                'ranking_usuarios' => $rankingUsuarios
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Obtener respuestas de un reto específico (para ver detalles de retos anteriores)
     */
    public function obtenerRespuestasReto($retoId) {
        try {
            // Obtener info del reto
            $queryReto = "SELECT * FROM doc_retos WHERE id = :reto_id";
            $stmtReto = $this->db->prepare($queryReto);
            $stmtReto->bindParam(':reto_id', $retoId, PDO::PARAM_INT);
            $stmtReto->execute();
            $reto = $stmtReto->fetch(PDO::FETCH_ASSOC);

            if (!$reto) {
                throw new Exception("Reto no encontrado");
            }

            // Obtener respuestas con info de usuario
            $queryRespuestas = "SELECT rr.*, u.nombre, u.email
                               FROM doc_reto_respuestas rr
                               JOIN users u ON rr.user_id = u.id
                               WHERE rr.reto_id = :reto_id
                               ORDER BY rr.puntuacion DESC, rr.fecha_respuesta ASC";
            $stmtRespuestas = $this->db->prepare($queryRespuestas);
            $stmtRespuestas->bindParam(':reto_id', $retoId, PDO::PARAM_INT);
            $stmtRespuestas->execute();
            $respuestas = $stmtRespuestas->fetchAll(PDO::FETCH_ASSOC);

            // Calcular estadísticas del reto
            $totalRespuestas = count($respuestas);
            $puntuaciones = array_column($respuestas, 'puntuacion');
            $promedio = $totalRespuestas > 0 ? array_sum($puntuaciones) / $totalRespuestas : 0;
            $mejor = $totalRespuestas > 0 ? max($puntuaciones) : 0;
            $peor = $totalRespuestas > 0 ? min($puntuaciones) : 0;

            return [
                'success' => true,
                'reto' => $reto,
                'respuestas' => $respuestas,
                'estadisticas' => [
                    'total_respuestas' => $totalRespuestas,
                    'promedio_puntuacion' => round($promedio * 100),
                    'mejor_puntuacion' => round($mejor * 100),
                    'peor_puntuacion' => round($peor * 100),
                    'correctas' => count(array_filter($respuestas, fn($r) => $r['es_correcta']))
                ]
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function generarRetosAutomaticos() {
        try {
            $diaSemana = strtolower(date('l'));

            if (!in_array($diaSemana, ['monday', 'thursday'])) {
                return [
                    'success' => true,
                    'message' => 'Hoy no es día de generar retos',
                    'retos_generados' => 0
                ];
            }

            $diaReto = ($diaSemana === 'monday') ? 'lunes' : 'jueves';

            $queryDocs = "SELECT id FROM documentos WHERE 1=1";
            $stmtDocs = $this->db->prepare($queryDocs);
            $stmtDocs->execute();
            $documentos = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);

            $retosGenerados = 0;
            $errores = [];

            foreach ($documentos as $doc) {
                $resultado = $this->generarReto($doc['id'], $diaReto);
                if ($resultado['success']) {
                    $retosGenerados++;
                } else {
                    $errores[] = "Doc {$doc['id']}: " . ($resultado['error'] ?? $resultado['message']);
                }
            }

            return [
                'success' => true,
                'retos_generados' => $retosGenerados,
                'total_documentos' => count($documentos),
                'errores' => $errores
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}
?>
