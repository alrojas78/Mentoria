<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config/config.php';
require_once '../config/db.php';
require_once '../middleware/AuthMiddleware.php';
require_once '../utils/PollyService.php';
require_once '../models/SystemConfig.php';
require_once '../models/DocumentoBloque.php';

// Validate authentication
$userData = AuthMiddleware::requireAuth();

$input = json_decode(file_get_contents('php://input'), true);
$documentId = $input['document_id'] ?? null;
$mode = $input['mode'] ?? 'consulta'; // consulta, mentor, evaluacion
$videoId = $input['video_id'] ?? null;
$videoTitle = $input['video_title'] ?? null;
$lessonContext = $input['lesson_context'] ?? null;
$currentTime = $input['current_time'] ?? 0;

// Get database connection
$database = new Database();
$db = $database->getConnection();

// Read voice config from system_config
$systemConfig = new SystemConfig($db);
$voiceMode = 'realtime'; // default
$realtimeVoice = 'sage'; // default
$realtimeModel = 'gpt-4o-realtime-preview';

if ($systemConfig->getByKey('voice_service')) {
    $voiceConfig = json_decode($systemConfig->config_value, true);
    $voiceMode = $voiceConfig['voice_mode'] ?? 'realtime';
    $realtimeVoice = $voiceConfig['realtime_voice'] ?? 'sage';
    $realtimeModel = $voiceConfig['realtime_model'] ?? 'gpt-4o-realtime-preview';
}

// If voice_mode is not realtime, return config so frontend knows to use text mode
if ($voiceMode !== 'realtime') {
    echo json_encode([
        'success' => true,
        'voice_mode' => $voiceMode,
        'realtime_available' => false,
        'message' => 'Modo de voz configurado: ' . $voiceMode
    ]);
    exit;
}

// === ESTRATEGIA HÍBRIDA: Resumen + Bloques + Function Calling ===
// Si el documento tiene bloques temáticos, usar resumen + tool definition
// Si no tiene bloques, usar contenido truncado (fallback)

$documentContext = '';
$toolDefinition = null;
$bloquesList = [];

if ($documentId) {
    $bloqueModel = new DocumentoBloque($db);
    $tieneBloques = $bloqueModel->documentoTieneBloques($documentId);

    if ($tieneBloques) {
        // MODO HÍBRIDO: resumen + lista de bloques + tool
        $stmt = $db->prepare("SELECT titulo, descripcion, resumen FROM documentos WHERE id = ?");
        $stmt->execute([$documentId]);
        $doc = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($doc) {
            $resumen = $doc['resumen'] ?? '';
            $bloques = $bloqueModel->getByDocumento($documentId);

            // Construir lista de bloques disponibles
            $bloquesTexto = "BLOQUES TEMATICOS DISPONIBLES (usa la funcion obtener_bloque para consultar el contenido completo de cualquier bloque):\n";
            foreach ($bloques as $b) {
                $bloquesTexto .= "- Bloque {$b['orden']}: {$b['titulo']}";
                if ($b['resumen_bloque']) {
                    $bloquesTexto .= " — {$b['resumen_bloque']}";
                }
                $bloquesTexto .= "\n";
                $bloquesList[] = [
                    'id' => $b['id'],
                    'orden' => $b['orden'],
                    'titulo' => $b['titulo'],
                    'resumen' => $b['resumen_bloque']
                ];
            }

            $documentContext = "Documento: {$doc['titulo']}\n{$doc['descripcion']}\n\n"
                . "RESUMEN EJECUTIVO:\n{$resumen}\n\n"
                . $bloquesTexto;

            // Definir herramienta para obtener bloques
            $toolDefinition = [
                [
                    'type' => 'function',
                    'name' => 'obtener_bloque',
                    'description' => 'Busca informacion detallada en el documento. OBLIGATORIO usarla ANTES de decir que no tienes informacion. Busca por cualquier termino: nombres de estudios, farmacos, temas, palabras clave.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'bloque_titulo' => [
                                'type' => 'string',
                                'description' => 'Termino de busqueda: nombre de estudio, farmaco, tema o palabra clave. Ejemplos: "VISION", "Vonoprazan", "Fisiopatologia", "Monografia", "P-CABs", "Acido Gastrico"'
                            ]
                        ],
                        'required' => ['bloque_titulo']
                    ]
                ]
            ];
        }
    } else {
        // FALLBACK: documento sin bloques, usar contenido truncado
        $stmt = $db->prepare("SELECT titulo, descripcion, contenido FROM documentos WHERE id = ?");
        $stmt->execute([$documentId]);
        $doc = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($doc) {
            $contenido = $doc['contenido'] ?? '';
            $maxContentChars = 49000;
            if (mb_strlen($contenido) > $maxContentChars) {
                $contenido = mb_substr($contenido, 0, $maxContentChars) . "\n\n[Contenido truncado por limite de la sesion de voz]";
            }
            $documentContext = "Documento: {$doc['titulo']}\n{$doc['descripcion']}\n\nContenido: {$contenido}";
        }
    }
}

// Build medical glossary (truncated for realtime)
$medicalGlossary = PollyService::getMedicalGlossaryForInstructions();
if (mb_strlen($medicalGlossary) > 2000) {
    $medicalGlossary = mb_substr($medicalGlossary, 0, 2000);
}

// Build system instructions based on mode
$videoContext = null;
if ($mode === 'mentor' && ($videoId || $videoTitle)) {
    $videoContext = [
        'video_id' => $videoId,
        'video_title' => $videoTitle,
        'lesson_context' => $lessonContext,
        'current_time' => $currentTime
    ];
}
$systemInstructions = buildSystemInstructions($mode, $documentContext, $medicalGlossary, $toolDefinition !== null, $videoContext);

// Final safety check: hard cap at ~57000 chars (~16300 tokens)
if (mb_strlen($systemInstructions) > 57000) {
    $systemInstructions = mb_substr($systemInstructions, 0, 57000);
}

// Create client secret with OpenAI GA endpoint
$clientSecretBody = json_encode([
    'session' => [
        'type' => 'realtime',
        'model' => $realtimeModel,
        'audio' => [
            'output' => [
                'voice' => $realtimeVoice
            ]
        ]
    ]
]);

$ch = curl_init('https://api.openai.com/v1/realtime/client_secrets');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . OPENAI_API_KEY,
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => $clientSecretBody
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    error_log("Realtime client_secrets failed: HTTP {$httpCode}, model: {$realtimeModel}, response: {$response}");
    http_response_code(500);
    echo json_encode([
        'error' => 'Error creando client secret Realtime',
        'http_code' => $httpCode,
        'model' => $realtimeModel,
        'details' => json_decode($response, true)
    ]);
    exit;
}

$secretData = json_decode($response, true);

// Log session for monitoring
logRealtimeSession($db, $userData->id, $documentId, $mode, null);

$responseData = [
    'success' => true,
    'voice_mode' => 'realtime',
    'realtime_available' => true,
    'client_secret' => $secretData['value'],
    'expires_at' => $secretData['expires_at'] ?? null,
    'instructions' => $systemInstructions,
    'voice' => $realtimeVoice,
    'model' => $realtimeModel
];

// Incluir tools y bloques si están disponibles
if ($toolDefinition) {
    $responseData['tools'] = $toolDefinition;
    $responseData['bloques'] = $bloquesList;
    $responseData['document_id'] = $documentId;
}

echo json_encode($responseData);

// === HELPER FUNCTIONS ===

function buildSystemInstructions($mode, $documentContext, $glossary, $hasBloques = false, $videoContext = null) {
    $baseInstructions = "Eres MentorIA, un asistente de mentoria educativa medica.
Hablas espanol latinoamericano de forma clara y profesional.
Tus respuestas son concisas y directas, ideales para conversacion por voz.

REGLAS:
1. Si la pregunta es CLARAMENTE ajena al documento (clima, deportes, cocina, chistes, temas personales), redirige amablemente: 'Mi especialidad es el contenido de este documento. Preguntame sobre [tema del documento].'
2. Para CUALQUIER otra pregunta, BUSCA en el documento PRIMERO usando obtener_bloque. NUNCA asumas que algo no esta sin haberlo buscado. Solo despues de 2-3 busquedas fallidas con distintos terminos puedes decir que no encontraste esa informacion.
3. En caso de duda entre regla 1 y 2, SIEMPRE aplica regla 2 (busca primero).

PRONUNCIACION DE TERMINOS MEDICOS:
{$glossary}

CONTEXTO DEL DOCUMENTO:
{$documentContext}";

    if ($hasBloques) {
        $baseInstructions .= "\n\nFUNCION obtener_bloque — OBLIGATORIA:
Cuando el estudiante pregunte CUALQUIER cosa sobre el documento, LLAMA obtener_bloque ANTES de hablar.
El resumen de arriba es solo un indice. NO tiene datos, cifras ni detalles para responder. SIEMPRE busca.

Flujo:
1. Pregunta del estudiante → llama obtener_bloque(termino_relevante). NO hables antes de buscar.
2. Usa el resultado para responder. No menciones como obtuviste la info.
3. Si no encontro nada, intenta con otro termino (sinonimo, nombre parcial).
4. Solo despues de 2-3 intentos fallidos di que no encontraste esa info en el documento.

Solo NO uses obtener_bloque al saludar o en conversacion general (que puedes hacer, como te llamas).

Nunca digas: 'resumen', 'bloques', 'secciones', 'funcion', 'herramienta'. El estudiante no conoce el sistema.
Busca por cualquier termino: estudios, farmacos, temas, palabras clave. No necesitas titulo exacto.";
    }

    switch ($mode) {
        case 'mentor':
            $mentorPrompt = "\n\nMODO MENTOR - LECCION EN VIDEO:";
            if ($videoContext) {
                if ($videoContext['video_title']) {
                    $mentorPrompt .= "\nVideo actual: \"{$videoContext['video_title']}\"";
                }
                if ($videoContext['lesson_context']) {
                    $mentorPrompt .= "\nLeccion: {$videoContext['lesson_context']}";
                }
                if ($videoContext['current_time'] > 0) {
                    $mins = floor($videoContext['current_time'] / 60);
                    $secs = $videoContext['current_time'] % 60;
                    $mentorPrompt .= "\nEl estudiante va en el minuto {$mins}:{$secs} del video";
                }
            }
            $mentorPrompt .= "
- El estudiante esta viendo un video de este programa educativo y tiene preguntas
- Responde basandote en el contenido del documento Y el contexto del video actual
- Si el estudiante pregunta algo del video, responde con informacion relevante de ese tema especifico
- Se conciso y directo, ideal para conversacion por voz mientras ve el video
- No repitas el contenido del video, complementa con informacion adicional o aclaraciones
- Si preguntan algo no relacionado al video actual, puedes responder pero redirige al tema de la leccion
- Usa un tono amigable y profesional";
            return $baseInstructions . $mentorPrompt;

        case 'evaluacion':
            return $baseInstructions . "\n\nMODO EVALUACION ACTIVO:
- Genera preguntas basadas en el contenido del documento
- Evalua las respuestas del estudiante de forma justa
- Proporciona retroalimentacion constructiva
- Manten un registro del progreso
- No des las respuestas directamente, guia al estudiante
- Comienza saludando y explicando que vas a hacer preguntas sobre el material";

        case 'consulta_grupo':
            return $baseInstructions . "\n\nMODO CONSULTA GRUPAL (ESPECTADOR):
- Estas en una reunion grupal. Escuchas la conversacion pero NO participas activamente.
- SOLO respondes cuando alguien te invoque directamente diciendo 'MentorIA' o 'Mentoria'.
- Cuando te invoquen, responde de forma concisa y relevante al contexto de la conversacion.
- Despues de responder, vuelve a modo silencioso automaticamente.
- Tienes acceso a toda la conversacion que has escuchado como contexto.
- Si te piden opinion sobre algo discutido, puedes referirte a lo que se dijo anteriormente.
- Responde siempre en tono profesional y colaborativo, como un colega experto.
- Si preguntan sobre el contenido del documento, SIEMPRE usa obtener_bloque ANTES de responder. No respondas de memoria.
- NO respondas a comentarios generales del grupo a menos que te invoquen por nombre.";

        default: // consulta
            return $baseInstructions . "\n\nMODO CONSULTA LIBRE:
- Responde preguntas sobre el contenido del documento
- Ofrece explicaciones claras y ejemplos
- SIEMPRE usa obtener_bloque ANTES de responder cualquier pregunta sobre el contenido. No respondas de memoria.
- Sigue el hilo de la conversacion de forma natural
- Saluda al estudiante y ofrece ayuda con el contenido del documento";
    }
}

function logRealtimeSession($db, $userId, $documentId, $mode, $sessionId) {
    try {
        $tableCheck = $db->query("SHOW TABLES LIKE 'realtime_sessions'");
        if ($tableCheck->rowCount() === 0) {
            error_log("realtime_sessions table does not exist, skipping log");
            return;
        }

        $stmt = $db->prepare("
            INSERT INTO realtime_sessions (user_id, document_id, mode, openai_session_id, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$userId, $documentId, $mode, $sessionId]);
    } catch (Exception $e) {
        error_log("Error logging realtime session: " . $e->getMessage());
    }
}
?>
