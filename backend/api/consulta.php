<?php

require_once '../vendor/autoload.php';
$dotenv = Dotenv\Dotenv::createImmutable('../');
$dotenv->load();

// backend/api/consulta.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Documento.php';
include_once '../utils/jwt.php';
include_once '../utils/OpenAIService.php';
include_once '../utils/AttachmentContextService.php';
include_once '../utils/VideoMentorService.php';
include_once '../utils/ConversationalPromptBuilder.php';
include_once '../utils/ContextManager.php';
include_once '../utils/QuestionGenerator.php';
include_once '../utils/SemanticEvaluator.php';
include_once '../utils/MentorPromptBuilder.php';
include_once '../utils/VideoRetroalimentacionHelper.php';
include_once '../utils/intencionHelper.php';
require_once '../utils/EstadisticasFilter.php';

$database = new Database();
$db = $database->getConnection();

$documento = new Documento($db);
$jwt = new JWTUtil();
$openai = new OpenAIService();
$promptBuilder = new ConversationalPromptBuilder($db);
$contextManager = new ContextManager($db);
$semanticEvaluator = new SemanticEvaluator($db, $promptBuilder);
$mentorPromptBuilder = new MentorPromptBuilder($db, $promptBuilder);
$intencionHelper = new IntencionHelper($db);
$intencionHelper->setOpenAI($openai);


// Verificar autenticación
$headers = getallheaders();
$token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';


$userData = $jwt->validate($token);
if (!$userData) {
    http_response_code(401);
    echo json_encode(["message" => "No autorizado"]);
    exit();
}

// Solo permitir POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Método no permitido"]);
    exit();
}


// Obtener datos enviados
$data = json_decode(file_get_contents("php://input"));

// Verificar datos requeridos
if (!isset($data->documentId) || !isset($data->question)) {
    http_response_code(400);
    echo json_encode(["message" => "Se requieren documentId y question"]);
    exit();
}

$sessionToken = isset($data->sessionToken) ? $data->sessionToken : null;

// ============= MANEJAR CONTEXTO DEL RETO SEMANAL =============
// Cuando se completa un reto, el frontend envía el contexto para memoria
if (isset($data->es_contexto_reto) && $data->es_contexto_reto === true) {
    try {
        // Obtener o crear sesión
        $sessionData = getOrCreateSession($db, $userId, $documentId, $sessionToken);
        $sessionId = $sessionData['session_id'];
        $currentSessionToken = $sessionData['session_token'];

        // Guardar el contexto del reto en el historial de mensajes
        $stmt = $db->prepare("
            INSERT INTO doc_conversacion_mensajes
            (session_id, tipo, contenido, modo_activo, timestamp)
            VALUES (?, 'contexto_reto', ?, 'consulta', NOW())
        ");
        $stmt->execute([$sessionId, $data->question]);

        error_log("✅ Contexto del reto guardado en sesión $sessionId");

        // Responder sin generar texto (solo confirmación)
        echo json_encode([
            'success' => true,
            'message' => 'Contexto del reto guardado',
            'sessionToken' => $currentSessionToken
        ]);
        exit();
    } catch (Exception $e) {
        error_log("❌ Error guardando contexto del reto: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
        exit();
    }
}

$userId = $userData->id;
$documentId = $data->documentId;

// ✅ MANEJAR RETROALIMENTACIÓN INTELIGENTE DE VIDEO
/*if (isset($data->videoContext) && isset($data->videoContext->needsIntelligentResponse)) {
    $videoContext = $data->videoContext;
    $action = $videoContext->action ?? 'unknown';
    
    // Crear prompt contextual específico
    $contextPrompt = "CONTEXTO ESPECÍFICO DEL VIDEO:\n";
    $contextPrompt .= "- Video: " . ($videoContext->videoTitle ?? 'Video educativo') . "\n";
    $contextPrompt .= "- Momento: " . gmdate("i:s", $videoContext->currentTime ?? 0) . " de " . gmdate("i:s", $videoContext->videoDuration ?? 0) . "\n";
    $contextPrompt .= "- Progreso: " . number_format($videoContext->percentage ?? 0, 1) . "%\n";
    $contextPrompt .= "- Acción: " . $action . "\n\n";
    
    // Obtener transcripción o contenido específico si está disponible
    $stmt = $db->prepare("
        SELECT transcripcion, titulo_completo 
        FROM doc_mentor_videos 
        WHERE document_id = ? AND modulo_numero = ? AND leccion_numero = ?
        LIMIT 1
    ");
    $stmt->execute([$documentId, $videoContext->module ?? 1, $videoContext->lesson ?? 1]);
    $videoInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($videoInfo && !empty($videoInfo['transcripcion'])) {
        // Extraer segmento relevante de transcripción
        $tiempoActual = $videoContext->currentTime ?? 0;
        $segmento = extraerSegmentoRelevante($videoInfo['transcripcion'], $tiempoActual);
        $contextPrompt .= "- Contenido en este momento: " . $segmento . "\n\n";
    }
    
    $fullPrompt = $contextPrompt . $data->question;
    
    // Usar IA con contexto específico
    $messages = [
        ['role' => 'system', 'content' => 'Eres un mentor educativo experto. Proporciona retroalimentación específica y contextual basada en el momento exacto del video. No uses frases genéricas. Haz preguntas específicas sobre el contenido que el estudiante acaba de ver.'],
        ['role' => 'user', 'content' => $fullPrompt]
    ];
    
    $aiResult = $openai->generateResponseWithAttachments($messages, $documentId, $fullPrompt, $db);
    
    if ($aiResult['success']) {
        echo json_encode([
            "answer" => $aiResult['response'],
            "images" => $aiResult['images'] ?? [],
            "has_images" => $aiResult['has_images'] ?? false,
            "sessionToken" => generateSessionToken(),
            "context" => "video_intelligent_feedback"
        ]);
        exit;
    }
} */

function extraerSegmentoRelevante($transcripcion, $tiempoActual) {
    if (empty($transcripcion)) return "Contenido no disponible";
    
    error_log("🔍 DEBUG extraerSegmento - Tiempo solicitado: {$tiempoActual}s");
    error_log("🔍 DEBUG extraerSegmento - Primeros 500 chars: " . substr($transcripcion, 0, 500));
    
    // ✅ REGEX MEJORADO - Soporta timestamps con número de línea pegado
    // Formato 1: "1.00:00:05,250 --> 00:00:09,330"
    // Formato 2: "00:00:05,250 --> 00:00:09,330"
    $pattern = '/(?:\d+\.)?(\d+):(\d+):(\d+)[,\.](\d+)\s*-->\s*(?:\d+\.)?(\d+):(\d+):(\d+)[,\.](\d+)\s*\n(.+?)(?=\n\n|\n(?:\d+\.)?\\d+:\\d+:\\d+|$)/s';
    
    if (preg_match_all($pattern, $transcripcion, $matches, PREG_SET_ORDER)) {
        error_log("🔍 DEBUG extraerSegmento - Total segmentos encontrados: " . count($matches));
        
        $ventana = 30; // Ventana de ±30 segundos
        $segmentos = [];
        $segmentosDebug = [];
        
        foreach ($matches as $i => $match) {
            // Extraer horas, minutos, segundos del timestamp de inicio
            $horas = (int)$match[1];
            $minutos = (int)$match[2];
            $segundos = (int)$match[3];
            $milisegundos = (int)$match[4];
            
            // Convertir a segundos totales
            $inicioSegundos = ($horas * 3600) + ($minutos * 60) + $segundos + ($milisegundos / 1000);
            
            // Extraer timestamp de fin
            $horasFin = (int)$match[5];
            $minutosFin = (int)$match[6];
            $segundosFin = (int)$match[7];
            
            $finSegundos = ($horasFin * 3600) + ($minutosFin * 60) + $segundosFin;
            
            $texto = trim($match[9]);
            
            // Debug de los primeros 5 segmentos
            if ($i < 5) {
                error_log("   Segmento {$i}: {$inicioSegundos}s - " . substr($texto, 0, 50));
            }
            
            // Tomar segmentos en la ventana de tiempo
            if ($inicioSegundos >= ($tiempoActual - $ventana) && $inicioSegundos <= ($tiempoActual + $ventana)) {
                $segmentos[] = $texto;
                $segmentosDebug[] = "{$inicioSegundos}s: " . substr($texto, 0, 30);
            }
        }
        
        if (!empty($segmentos)) {
            error_log("✅ DEBUG extraerSegmento - Segmentos en ventana: " . implode(' | ', $segmentosDebug));
            return implode(' ', $segmentos);
        } else {
            error_log("⚠️ DEBUG extraerSegmento - No se encontraron segmentos en ventana de {$tiempoActual}±{$ventana}s");
        }
    } else {
        error_log("⚠️ DEBUG extraerSegmento - Regex no encontró matches");
    }
    
    // Fallback: usar posición proporcional en el texto
    if ($tiempoActual > 0 && strlen($transcripcion) > 300) {
        error_log("ℹ️ DEBUG extraerSegmento - Usando fallback proporcional");
        $posicionEstimada = ($tiempoActual / 600) * strlen($transcripcion); // Asume 10 min máx
        $inicio = max(0, $posicionEstimada - 200);
        $segmento = substr($transcripcion, $inicio, 400);
        
        // Limpiar inicio y fin para que no corte palabras
        $segmento = preg_replace('/^[^\s]*\s/', '', $segmento);
        $segmento = preg_replace('/\s[^\s]*$/', '', $segmento);
        
        return $segmento . "...";
    }
    
    // Último fallback: primeros 300 caracteres
    error_log("ℹ️ DEBUG extraerSegmento - Usando fallback de primeros 300 chars");
    return substr($transcripcion, 0, 300) . "...";
}

// ✅ Función auxiliar NO necesita cambios (pero la incluyo por si no existe)
function convertirTimestampASegundos($timestamp) {
    $partes = explode(':', $timestamp);
    if (count($partes) === 3) {
        return ((int)$partes[0] * 3600) + ((int)$partes[1] * 60) + (int)$partes[2];
    }
    return 0;
}

function generateSessionToken() {
    return bin2hex(random_bytes(32));
}

// ============= AGREGAR DESPUÉS DE generateSessionToken() =============
// Función para detectar preguntas fuera del tema
function isOffTopicQuestion($question, $documentTitle) {
    // FUNCIÓN DEPRECADA - Mantenida solo por compatibilidad
    // Ahora retorna false siempre para permitir análisis inteligente
    return false;
}
// ============= FIN DE LA FUNCIÓN =============

// Función para crear o obtener sesión
function getOrCreateSession($db, $userId, $documentId, $sessionToken) {
    if ($sessionToken) {
        // Verificar si la sesión existe y está activa
        $stmt = $db->prepare("SELECT id FROM doc_conversacion_sesiones WHERE session_token = ? AND estado = 'activa'");
        $stmt->execute([$sessionToken]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($session) {
            return ['session_id' => $session['id'], 'session_token' => $sessionToken];
        }
    }
    
    // Crear nueva sesión
    $newSessionToken = generateSessionToken();
    $stmt = $db->prepare("
        INSERT INTO doc_conversacion_sesiones (user_id, document_id, session_token, started_at) 
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->execute([$userId, $documentId, $newSessionToken]);
    
    return ['session_id' => $db->lastInsertId(), 'session_token' => $newSessionToken];
}

// Función para registrar mensaje del usuario
function registrarMensajeUsuario($db, $sessionId, $question, $modo = 'consulta') {
    $stmt = $db->prepare("
        INSERT INTO doc_conversacion_mensajes (session_id, tipo, contenido, modo_activo, timestamp) 
        VALUES (?, 'pregunta_usuario', ?, ?, NOW())
    ");
    $stmt->execute([$sessionId, $question, $modo]);
    
    // Actualizar contador de mensajes en la sesión
    $stmt = $db->prepare("
        UPDATE doc_conversacion_sesiones 
        SET total_mensajes = total_mensajes + 1 
        WHERE id = ?
    ");
    $stmt->execute([$sessionId]);
}

// Función para detectar comandos (delegada a EstadisticasFilter compartido)
function detectarComandoMejorado($question) {
    return EstadisticasFilter::detectarComandoMejorado($question);
}

// Función de validación para estadísticas (delegada a EstadisticasFilter compartido)
function esPreguntaValidaParaEstadisticas($question) {
    return EstadisticasFilter::esPreguntaValidaParaEstadisticas($question);
}

function detectarComando($question) {
    return detectarComandoMejorado($question);
}

try {
    // Obtener o crear sesión
    $sessionData = getOrCreateSession($db, $userId, $documentId, $sessionToken);
    $sessionId = $sessionData['session_id'];
    $currentSessionToken = $sessionData['session_token'];
    
    // Detectar si es un comando
    $comando = detectarComando($data->question);
    
    // Registrar mensaje del usuario
// Detectar modo actual de la sesión
$modoActual = getModoActualSesion($db, $sessionId);

// Registrar mensaje del usuario
$tipoMensaje = $comando ? 'comando' : 'pregunta_usuario';

// 🔥 NUEVA VALIDACIÓN: Solo guardar preguntas válidas como 'pregunta_usuario'
if ($tipoMensaje === 'pregunta_usuario' && !esPreguntaValidaParaEstadisticas($data->question)) {
    // Si no es válida para estadísticas, cambiar tipo a 'comando'
    $tipoMensaje = 'comando';
}

/*tmt = $db->prepare("
    INSERT INTO doc_conversacion_mensajes (session_id, tipo, contenido, modo_activo, timestamp) 
    VALUES (?, ?, ?, ?, NOW())
");
$stmt->execute([$sessionId, $tipoMensaje, $data->question, $modoActual]);*/

// ❌ ELIMINADO: No guardar aquí porque ContextManager lo hace después
// El ContextManager guarda el mensaje con metadata apropiada más adelante (línea ~646)
error_log("📝 Mensaje del usuario será guardado por ContextManager");
    
    // Actualizar contador de mensajes
    $stmt = $db->prepare("
        UPDATE doc_conversacion_sesiones 
        SET total_mensajes = total_mensajes + 1 
        WHERE id = ?
    ");
    $stmt->execute([$sessionId]);
    
    // **NUEVA LÓGICA PARA MODO MENTOR**
    if ($comando) {
        $response = "";
switch ($comando) {
    case 'activar_mentor':
        // Actualizar modo de la sesión
        updateSessionMode($db, $sessionId, 'mentor');
        $response = handleMentorActivation($db, $userId, $documentId, $documento);
        break;
    case 'salir_mentor':
        // Volver a modo consulta
        updateSessionMode($db, $sessionId, 'consulta');
        $response = "Has salido del modo mentor. Ahora estamos de vuelta en el modo de consulta normal. ¿En qué más puedo ayudarte?";
        break;
    // 🆕 AGREGAR ESTE CASE COMPLETO
case 'iniciar_consulta':
    // Asegurar modo consulta con contexto limpio
    updateSessionMode($db, $sessionId, 'consulta');
    error_log("🔄 Modo consulta iniciado desde popup (contexto cerrado)");
    
    // Respuesta vacía (no se muestra al usuario)
    $response = "";
    break;

    case 'activar_evaluacion':
        // Actualizar modo de la sesión
        updateSessionMode($db, $sessionId, 'evaluacion');
        $response = handleEvaluationActivation($db, $userId, $documentId, $sessionId, $documento);
        break;
    case 'salir_evaluacion':
        // Finalizar evaluación activa si existe
        $activeEvaluation = getActiveEvaluation($db, $userId, $documentId, $sessionId);
        if ($activeEvaluation) {
            $stmt = $db->prepare("
                UPDATE doc_evaluacion_resultados 
                SET fecha_finalizacion = NOW(), 
                    observaciones_ia = 'Evaluación cancelada por el usuario',
                    duracion_minutos = TIMESTAMPDIFF(MINUTE, fecha_inicio, NOW())
                WHERE id = ?
            ");
            $stmt->execute([$activeEvaluation['id']]);
        }
        
        // Cambiar modo de sesión a consulta
        updateSessionMode($db, $sessionId, 'consulta');
        
        $response = "Has salido del modo evaluación. La evaluación ha sido cancelada. Volvemos al modo consulta normal. ¿Hay algo más en lo que pueda ayudarte?";
        break;
}
                
        // Respuesta exitosa para comandos
http_response_code(200);

// Si es un array (modo video), incluir toda la estructura
// ✅ CORRECCIÓN: Usar variables correctas y definir valores por defecto.
// Si la respuesta es un array (como en el caso de los videos), es un resultado complejo.
if (is_array($response) && isset($response['action'])) {
    echo json_encode([
        "answer" => $response['response'],
        "action" => $response['action'] ?? null,
        "video_data" => $response['video_data'] ?? null,
        "images" => $response['images'] ?? [],
        "has_images" => $response['has_images'] ?? false,
        "sessionToken" => $currentSessionToken
    ]);
} else {
    // Para todas las demás respuestas de texto de los comandos.
    echo json_encode([
        "answer" => is_array($response) ? ($response['response'] ?? 'Acción completada.') : $response,
        "images" => [], // Los comandos simples no suelen devolver imágenes.
        "has_images" => false,
        "sessionToken" => $currentSessionToken
    ]);
}
        exit();
    }
    

    // 🔥 LOGS DE DEBUG CRÍTICOS
error_log("═══════════════════════════════════════");
error_log("🔍 INICIO DE PROCESAMIENTO DE CONSULTA");
error_log("   Usuario: $userId");
error_log("   Documento: $documentId");
error_log("   Pregunta: " . $data->question);
error_log("   awaiting_confirmation isset: " . (isset($data->awaiting_confirmation) ? 'SÍ' : 'NO'));
error_log("   awaiting_confirmation value: " . (isset($data->awaiting_confirmation) ? ($data->awaiting_confirmation ? 'TRUE' : 'FALSE') : 'NULL'));
error_log("   awaiting_validation isset: " . (isset($data->awaiting_validation) ? 'SÍ' : 'NO'));
error_log("   awaiting_validation value: " . (isset($data->awaiting_validation) ? ($data->awaiting_validation ? 'TRUE' : 'FALSE') : 'NULL'));
error_log("═══════════════════════════════════════");

    // **VERIFICAR SI ESTAMOS EN MODO MENTOR ACTIVO**
$modoSesion = getModoActualSesion($db, $sessionId);
$mentorProgress = getMentorProgress($db, $userId, $documentId);

// Solo entrar en modo mentor si AMBOS: sesión está en 'mentor' Y progreso existe
if ($modoSesion === 'mentor' && $mentorProgress && $mentorProgress['estado'] !== 'completado') {
    error_log("✅ Entrando a handleMentorConversation");
    error_log("   - Modo sesión: $modoSesion");
    error_log("   - Estado progreso: " . $mentorProgress['estado']);
    error_log("   - Question: " . $data->question);
    error_log("   - awaiting_validation: " . (isset($data->awaiting_validation) ? 'true' : 'false'));
   $mentorResult = handleMentorConversation($db, $userId, $documentId, $data->question, $mentorProgress, $documento, $openai, $data);

// Verificar si el resultado incluye información de videos
if (is_array($mentorResult) && isset($mentorResult['action'])) {
    // Respuesta con acción de video
    http_response_code(200);
    echo json_encode([
        "answer" => $mentorResult['response'],
          "response" => $mentorResult['response'],
        "action" => $mentorResult['action'],
        "video_data" => $mentorResult['video_data'] ?? null,
        "images" => $mentorResult['images'] ?? [],
        "has_images" => $mentorResult['has_images'] ?? false,
        "sessionToken" => $currentSessionToken,
        "document" => [
            "id" => $documentId,
            "titulo" => $documento->titulo
        ]
    ]);
    exit();
// consulta.php (reemplazo desde la línea 437 hasta la 462)

} else if (is_array($mentorResult) && isset($mentorResult['response'])) {
    // Respuesta con multimedia normal
    $response = $mentorResult['response'];
    $images = $mentorResult['images'] ?? [];
    $hasImages = $mentorResult['has_images'] ?? false;
    
    // Flags existentes
    $awaitingValidation = $mentorResult['awaiting_validation'] ?? false;
    $awaitingConfirmation = $mentorResult['awaiting_confirmation'] ?? false;

    // 🆕 Flags para el sistema de 3 preguntas
    $retroalimentacionActiva = $mentorResult['retroalimentacion_activa'] ?? false;
    $numeroPregunta = $mentorResult['numero_pregunta'] ?? null;
    $videoIdRetro = $mentorResult['video_id'] ?? null;

} else {

    // Respuesta simple de texto
    $response = $mentorResult;
    $images = [];
    $hasImages = false;

    // ✅ INICIO DE LA CORRECCIÓN: Definir flags por defecto
    $awaitingValidation = false;
    $awaitingConfirmation = false;
    // ✅ FIN DE LA CORRECCIÓN
}

http_response_code(200);
http_response_code(200);
echo json_encode([
    "answer" => $response,
    "response" => $response,  // 🆕 Agregar AMBOS para compatibilidad
    "images" => $images,
    "has_images" => $hasImages,
    "sessionToken" => $currentSessionToken,
    "document" => [
        "id" => $documentId,
        "titulo" => $documento->titulo
    ],
    "awaiting_validation" => $awaitingValidation,
    "awaiting_confirmation" => $awaitingConfirmation,
    // 🆕 Campos del sistema de 3 preguntas
    "retroalimentacion_activa" => $retroalimentacionActiva ?? false,
    "numero_pregunta" => $numeroPregunta ?? null,
    "video_id" => $videoIdRetro ?? null
]);
exit();

}



// **VERIFICAR SI ESTAMOS EN MODO EVALUACIÓN ACTIVO**
if ($modoSesion === 'evaluacion') {
        $response = handleEvaluationConversation($db, $userId, $documentId, $sessionId, $data->question, $documento);
        
        http_response_code(200);
        echo json_encode([
            "answer" => $response,
            "sessionToken" => $currentSessionToken,
            "document" => [
                "id" => $documentId,
                "titulo" => $documento->titulo
            ]
        ]);
        exit();
    }

    
    // **LÓGICA ORIGINAL DE CONSULTA** (se mantiene igual)
// **LÓGICA MEJORADA DE CONSULTA CON IA CONVERSACIONAL**
$documento->id = $documentId;
if (!$documento->readOne()) {
    http_response_code(404);
    echo json_encode(["message" => "Documento no encontrado"]);
    exit();
}

// 1. OBTENER NOMBRE DEL USUARIO
$userName = $promptBuilder->getUserName($userId);
error_log("👤 Usuario identificado: " . $userName);

// 2. SIEMPRE OBTENER CONTEXTO RECIENTE (OpenAI decide si lo usa)
$recentContext = $contextManager->getRecentContext($sessionId, 6);
error_log("📋 Contexto disponible: " . count($recentContext) . " mensajes");

// 3. VALIDACIÓN INTELIGENTE DE RELEVANCIA
$intencionHelper->setDocumento($documento);
$analisisRelevancia = $intencionHelper->esConsultaRelevante(
    $data->question, 
    $documento, 
    $recentContext
);

error_log("📊 Análisis de relevancia: " . json_encode($analisisRelevancia));

// Solo rechazar si hay ALTA confianza de que está fuera de tema
if (!$analisisRelevancia['es_relevante'] && $analisisRelevancia['confianza'] > 0.8) {
    $response = "Lo siento {$userName}, " . ($analisisRelevancia['sugerencia'] ?? 
                "esa pregunta no parece estar relacionada con {$documento->titulo}. ¿Tienes alguna consulta sobre el contenido del documento?");
    
    // Guardar en contexto que fue rechazada
    $contextManager->saveMessage($sessionId, 'user', $data->question);
    $contextManager->saveMessage($sessionId, 'assistant', $response);
    
    echo json_encode([
        'answer' => $response,
        'sessionToken' => $currentSessionToken,
        'images' => [],
        'has_images' => false,
        'relevance_info' => $analisisRelevancia // Para debugging
    ]);
    exit();
}

// Si la relevancia es baja pero no está seguro, agregar contexto al prompt
if ($analisisRelevancia['confianza'] < 0.6) {
    error_log("⚠️ Relevancia baja detectada - agregando contexto adicional al prompt");
    // Esto se manejará en el prompt builder
}


// 5. CONSTRUIR SYSTEM PROMPT INTELIGENTE
$systemPrompt = $promptBuilder->buildConsultaPrompt($documento, $userName, $recentContext);
error_log("✅ System prompt construido con fuzzy matching y personalización");

// 6. PREPARAR MENSAJES PARA OPENAI
$messages = [
    ['role' => 'system', 'content' => $systemPrompt]
];

// 6.1 Agregar contexto reciente si existe
if (!empty($recentContext)) {
    foreach ($recentContext as $contextMsg) {
        $messages[] = $contextMsg;
    }
}

// 6.2 Agregar pregunta actual
$messages[] = ['role' => 'user', 'content' => $data->question];

// 7. VERIFICAR IMÁGENES DISPONIBLES (DEBUG)
error_log("DEBUG: DocumentId = " . $documentId);
$tempStmt = $db->prepare("SELECT id, titulo, filename, file_type FROM doc_anexos WHERE document_id = ? AND is_active = 1 AND (file_type = 'image' OR mime_type LIKE 'image/%')");
$tempStmt->execute([$documentId]);
$imagenesExistentes = $tempStmt->fetchAll(PDO::FETCH_ASSOC);
error_log("DEBUG: Imágenes encontradas: " . count($imagenesExistentes));

// 8. LLAMAR A OPENAI CON SISTEMA DE ANEXOS
error_log("🤖 Enviando a OpenAI con " . count($messages) . " mensajes");
$aiResult = $openai->generateResponseWithAttachments($messages, $documentId, $data->question, $db);

if ($aiResult['success']) {
    $answer = $aiResult['response'];
    error_log("✅ Respuesta generada exitosamente");
    
    // 9. GUARDAR MENSAJE DEL USUARIO EN CONTEXTO
    $contextManager->saveMessage($sessionId, 'user', $data->question);
    
    // 10. GUARDAR RESPUESTA DE LA IA EN CONTEXTO
    $contextManager->saveMessage($sessionId, 'assistant', $answer);
    
    // 11. LIMPIAR MENSAJES ANTIGUOS (MANTENIMIENTO)
    $stats = $contextManager->getSessionStats($sessionId);
    if ($stats['total_messages'] > 20) {
        $contextManager->cleanOldMessages($sessionId);
        error_log("🧹 Limpieza de mensajes antiguos ejecutada");
    }
    
    // 12. REGISTRAR USO DE ANEXOS SI HAY IMÁGENES
    if ($aiResult['has_images']) {
        $attachmentContext = new AttachmentContextService($db);
        foreach ($aiResult['images'] as $image) {
            $attachmentContext->logAttachmentUsage(
                $image['id'],
                $userData->id,
                $sessionId,
                'viewed',
                'consulta',
                'automatic'
            );
        }
        error_log("📸 Registrado uso de " . count($aiResult['images']) . " imágenes");
    }
    
    // 13. RESPUESTA FINAL
    http_response_code(200);
    error_log("DEBUG: JSON enviado al frontend: " . json_encode($aiResult['images'] ?? []));
    
    echo json_encode([
        "answer" => $answer,
        "images" => $aiResult['images'] ?? [],
        "has_images" => $aiResult['has_images'] ?? false,
        "sessionToken" => $currentSessionToken,
        "document" => [
            "id" => $documento->id,
            "titulo" => $documento->titulo
        ],
        "context_used" => !empty($recentContext),
        "user_name" => $userName,
        "attachment_analysis" => [
            "is_image_request" => $aiResult['analysis']['is_image_request'] ?? false,
            "total_relevant" => $aiResult['total_relevant_attachments'] ?? 0
        ]
    ]);
} else {
    error_log("❌ Error en OpenAI: " . ($aiResult['error'] ?? 'Desconocido'));
    http_response_code(500);
    echo json_encode([
        "message" => "Error al generar respuesta",
        "answer" => "Lo siento {$userName}, ha ocurrido un error técnico. ¿Podrías repetir tu pregunta?"
    ]);
}
} catch (Exception $e) {
    error_log("Excepción en consulta: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Error al procesar la consulta"]);
}

// **NUEVAS FUNCIONES PARA MODO MENTOR**

function getMentorProgress($db, $userId, $documentId) {
    $stmt = $db->prepare("
        SELECT * FROM doc_mentor_progreso 
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function handleMentorActivation($db, $userId, $documentId, $documento) {
    // Cargar contenido del documento PRIMERO
    $documento->id = $documentId;
    if (!$documento->readOne()) {
        return "Error: No se pudo cargar el contenido del documento.";
    }
    
    // NUEVO: Verificar si existen videos estructurados
    include_once '../utils/VideoMentorService.php';
    $videoService = new VideoMentorService($db);
    $videosPrograma = $videoService->detectarVideosProgramaMentor($documentId);
    
if (!empty($videosPrograma)) {
    // ✅ CORRECCIÓN: Verificar si ya hay progreso para reanudar.
    $existingProgress = getMentorProgress($db, $userId, $documentId);
    
    // ✅ PRIMERO: Verificar si está completado
    if ($existingProgress && $existingProgress['estado'] === 'completado') {
        // Obtener estructura y título
        $estructura = json_decode($existingProgress['estructura_contenido'], true);
        $tituloPrograma = $estructura['titulo_programa'] ?? 'el programa de estudio';
        
        error_log("🎓 Usuario ingresó con programa completado");
        
        return [
            'response' => "¡Hola de nuevo! 🎓\n\n" .
                         "Veo que ya has completado todo el programa de **{$tituloPrograma}**. ¡Felicitaciones por tu dedicación!\n\n" .
                         "¿Qué te gustaría hacer?\n\n" .
                         /*"📚 **Repasar una lección específica** - Dime qué módulo o tema quieres revisar\n" .*/
                         "💬 **Hacer consultas** - Pregúntame cualquier duda sobre el contenido\n" .
                         "📝 **Hacer la evaluación final** - Di 'activar modo evaluación' para certificar tus conocimientos\n\n" .
                         "¿En qué puedo ayudarte hoy?",
            'has_images' => false,
            'images' => [],
            'programa_completado' => true
        ];
    }
    
// DENTRO DE handleMentorActivation
if ($existingProgress && $existingProgress['estado'] === 'iniciado') {
    $leccionActual = $existingProgress['leccion_actual'];
    $moduloActual = $existingProgress['modulo_actual'];
    $estructura = json_decode($existingProgress['estructura_contenido'], true);
    $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
    
    // ✅ Calcular progreso
    $totalLecciones = 0;
    foreach ($estructura['modulos'] as $modulo) {
        $totalLecciones += count($modulo['lecciones']);
    }
    $porcentaje = round((($leccionActual / $totalLecciones) * 100), 0);
    
    // ✅ DEBUG
    error_log("🔍 Retomando mentor video:");
    error_log("  - Lección: {$leccionActual} de {$totalLecciones}");
    error_log("  - Progreso: {$porcentaje}%");
    error_log("  - Video: " . ($videoActual['titulo_completo'] ?? 'NULL'));
    
return [
    'response' => "¡Perfecto! Continuemos donde lo dejamos.\n\n" .
                 "📊 **Progreso:** {$leccionActual} de {$totalLecciones} lecciones ({$porcentaje}%)\n\n" .
                 "📹 **Siguiente lección:** {$videoActual['titulo_completo']}\n\n" .
                 "Di **'continuar'** o **'listo'** para abrir el video. ¿Estás listo?",
    'action' => 'awaiting_user_confirmation',  // 🆕 Acción especial
    'video_data' => $videoActual,  // Datos del video para cuando confirme
    'awaiting_confirmation' => true,
    'has_images' => false,
    'images' => []
];

}
    // Si no hay progreso, se crea la estructura.
    return crearEstructuraConVideos($db, $userId, $documentId, $videosPrograma, $documento);
    } else {
        // MODO IA: Verificar si ya existe progreso ANTES de crear nuevo
        $existingProgress = getMentorProgress($db, $userId, $documentId);
        
        if ($existingProgress) {
            if ($existingProgress['estado'] === 'completado') {
                return "Ya has completado este programa de estudio. ¿Te gustaría repasar algún tema específico o empezar de nuevo?";
} else {
    // Continuar desde donde quedó
    $estructura = json_decode($existingProgress['estructura_contenido'], true);
    $leccionActual = $existingProgress['leccion_actual'];
    $moduloActual = $existingProgress['modulo_actual'];
    
    $temaActual = $estructura['modulos'][$moduloActual - 1]['lecciones'][$leccionActual - 1]['titulo'] ?? 'tema actual';
    
    // ✅ CONSTRUIR PRESENTACIÓN COMPLETA ANTES DE RETORNAR
    $presentacion = "Perfecto, continuemos con tu programa de estudio. La última vez estabas en el **Módulo {$moduloActual}**: {$temaActual}.\n\n";
    
    $presentacion .= "**Estructura del programa:**\n\n";
    
    foreach ($estructura['modulos'] as $modulo) {
        $presentacion .= "• **Módulo {$modulo['numero']}**: {$modulo['titulo']}\n";
    }
    
    $presentacion .= "\n¿Te gustaría un breve repaso de lo que vimos anteriormente o prefieres continuar directamente con el siguiente tema?";
    
    return $presentacion;
}
        }
        
        // Primera vez - crear estructura nueva
        return createMentorStructure($db, $userId, $documentId, $documento);
    }
}

// NUEVA FUNCIÓN para estructuras con videos
function crearEstructuraConVideos($db, $userId, $documentId, $videosPrograma, $documento) {
    $estructura = [
        'titulo_programa' => "Programa de Video: " . $documento->titulo,
        'tipo_programa' => 'video_estructurado',
        'duracion_estimada' => 'Variable según videos',
        'modulos' => []
    ];
    
    // Organizar videos por módulos
    $modulosAgrupados = [];
    foreach ($videosPrograma as $video) {
        $modulosAgrupados[$video['modulo']][] = $video;
    }
    
    foreach ($modulosAgrupados as $numeroModulo => $videosModulo) {
        $modulo = [
            'numero' => $numeroModulo,
            'titulo' => "Módulo $numeroModulo",
            'tipo' => 'video',
            'lecciones' => []
        ];
        
        foreach ($videosModulo as $video) {
            $modulo['lecciones'][] = [
                'numero' => $video['leccion'],
                'titulo' => $video['titulo'],
                'tipo' => 'video',
                'vimeo_id' => $video['vimeo_id'],
                'anexo_id' => $video['anexo_id']
            ];
        }
        
        $estructura['modulos'][] = $modulo;
    }
    
    // Guardar estructura
    // FIX: Solo actualizar estructura_contenido, NUNCA resetear estado/posicion
    $stmt = $db->prepare("
        INSERT INTO doc_mentor_progreso (user_id, document_id, estructura_contenido, estado)
        VALUES (?, ?, ?, 'iniciado')
        ON DUPLICATE KEY UPDATE
        estructura_contenido = VALUES(estructura_contenido)
    ");
    $stmt->execute([$userId, $documentId, json_encode($estructura)]);
    
    $totalModulos = count($estructura['modulos']);
    $totalLecciones = array_sum(array_map(function($m) { return count($m['lecciones']); }, $estructura['modulos']));
    
// ✅ Obtener el primer video para abrirlo automáticamente
    $primerVideo = obtenerVideoActual($db, $userId, $documentId, 1, 1);
    
    return [
        'response' => "¡Perfecto! He detectado un programa estructurado con videos educativos:\n\n" .
                     "🎥 **{$estructura['titulo_programa']}**\n" .
                     "📚 Total: {$totalModulos} módulos, {$totalLecciones} video-lecciones\n\n" .
                     "¡Genial! Entonces, puedes continuar con el video. Estoy aquí para ayudarte con cualquier pregunta o resumen que necesites a medida que avanzas.",
        'action' => 'open_video',
        'video_data' => $primerVideo,
        'has_images' => false,
        'images' => []
    ];
}

function createMentorStructure($db, $userId, $documentId, $documento) {
    // Llamada a OpenAI para estructurar el contenido
$systemPrompt = "Eres un experto pedagogo que crea programas de estudio EXCLUSIVAMENTE basados en el contenido proporcionado.

INSTRUCCIONES CRÍTICAS:
1. Lee COMPLETAMENTE el documento proporcionado
2. Identifica EXACTAMENTE de qué trata el documento (tema principal)
3. Crea un programa de estudio SOLO con la información que está en el documento
4. NO busques información externa
5. NO inventes contenido que no esté en el documento
6. Si el documento habla de una plataforma, el curso debe ser sobre esa plataforma
7. Si el documento habla de un medicamento, el curso debe ser sobre ese medicamento específico
8. La duración debe ser realista según el contenido disponible (no inventar 50 horas)

DOCUMENTO A ANALIZAR:
{$documento->contenido}

TÍTULO DEL DOCUMENTO: {$documento->titulo}

FORMATO DE RESPUESTA (JSON):
{
    \"titulo_programa\": \"Nombre basado en el contenido real del documento\",
    \"descripcion\": \"Descripción basada en lo que realmente dice el documento\",
    \"duracion_estimada\": \"Duración realista según el contenido (máximo 5 horas)\",
    \"modulos\": [
        {
            \"numero\": 1,
            \"titulo\": \"Módulo basado en el contenido real\",
            \"descripcion\": \"Descripción del módulo con información del documento\",
            \"lecciones\": [
                {
                    \"numero\": 1,
                    \"titulo\": \"Lección con información específica del documento\",
                    \"objetivos\": [\"Objetivos extraídos del contenido real\"],
                    \"contenido_clave\": [\"Puntos que están en el documento\"],
                    \"duracion_minutos\": 20
                }
            ]
        }
    ]
}

EJEMPLO: Si el documento habla de 'Plataforma Ateneo.co', el programa debe llamarse 'Capacitación sobre Plataforma Ateneo.co' y los módulos deben cubrir: qué es Ateneo, cursos disponibles, suscripciones, certificaciones, etc.

IMPORTANTE: Crea un programa coherente con el contenido real, no inventes información externa.";

    $openaiData = [
        'model' => 'gpt-4o',
        'messages' => [
            [
                'role' => 'system',
                'content' => $systemPrompt
            ]
        ],
        'temperature' => 0.3,
        'max_tokens' => 1500
    ];

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($openaiData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $decoded = json_decode($response, true);
    
    if (isset($decoded['choices'][0]['message']['content'])) {
        $estructuraTexto = $decoded['choices'][0]['message']['content'];
        
        // Extraer JSON de la respuesta
        preg_match('/\{.*\}/s', $estructuraTexto, $matches);
        if (isset($matches[0])) {
            $estructura = json_decode($matches[0], true);
            
            if ($estructura) {
                // Guardar en base de datos
                // FIX: Solo actualizar estructura_contenido, NUNCA resetear estado/posicion
                $stmt = $db->prepare("
                    INSERT INTO doc_mentor_progreso (user_id, document_id, estructura_contenido, estado)
                    VALUES (?, ?, ?, 'iniciado')
                    ON DUPLICATE KEY UPDATE
                    estructura_contenido = VALUES(estructura_contenido)
                ");
                $stmt->execute([$userId, $documentId, json_encode($estructura)]);
                
                // Generar respuesta de presentación
                $totalModulos = count($estructura['modulos']);
                $totalLecciones = array_sum(array_map(function($modulo) {
                    return count($modulo['lecciones']);
                }, $estructura['modulos']));
                
                $presentacion = "¡Perfecto! He activado el modo mentor y he creado un programa de estudio personalizado para ti:\n\n";
                $presentacion .= " **{$estructura['titulo_programa']}**\n";
                $presentacion .= " Duración estimada: {$estructura['duracion_estimada']}\n";
                $presentacion .= " Total: {$totalModulos} módulos, {$totalLecciones} lecciones\n\n";
                
                $presentacion .= "**Estructura del programa:**\n";
                foreach ($estructura['modulos'] as $modulo) {
                    $presentacion .= "• **Módulo {$modulo['numero']}**: {$modulo['titulo']}\n";
                }
                
                $presentacion .= "\n¿Estás listo para comenzar con la primera lección del Módulo 1?";
                
                return $presentacion;
            }
        }
    }
    
    // Fallback si OpenAI falla
    return "He activado el modo mentor. Voy a analizar el contenido y crear un programa estructurado para ti. ¿Estás listo para comenzar con las lecciones?";
}

function handleMentorConversation($db, $userId, $documentId, $question, $mentorProgress, $documento, $openai, $data = null) {
    global $mentorPromptBuilder, $promptBuilder, $contextManager, $userData;
    
    $estructura = json_decode($mentorProgress['estructura_contenido'], true);

    // NUEVO: Verificar si es programa de videos
    if (isset($estructura['tipo_programa']) && $estructura['tipo_programa'] === 'video_estructurado') {
        return handleVideoMentorConversation($db, $userId, $documentId, $question, $mentorProgress, $estructura);
    }

    // ✅ NUEVO: CONFIRMAR EVALUACIÓN (MODO MENTOR IA)
    if (isset($data->awaiting_evaluation_confirmation) && $data->awaiting_evaluation_confirmation === true) {
        error_log("📝 Procesando confirmación de evaluación en modo mentor IA");
        
        $questionLower = strtolower(trim($question));
        
        // Detectar SI quiere hacer la evaluación
        if (stripos($questionLower, 'si') !== false ||
            stripos($questionLower, 'sí') !== false ||
            stripos($questionLower, 'listo') !== false ||
            stripos($questionLower, 'preparado') !== false ||
            stripos($questionLower, 'comenzar') !== false ||
            stripos($questionLower, 'empezar') !== false ||
            stripos($questionLower, 'adelante') !== false) {
            
            error_log("✅ Usuario aceptó - Activando modo evaluación");
            
            // Cambiar modo a evaluación
            $stmt = $db->prepare("
                SELECT cs.id as session_id 
                FROM doc_conversacion_sesiones cs
                WHERE cs.user_id = ? AND cs.document_id = ? 
                AND cs.estado = 'activa'
                ORDER BY cs.id DESC 
                LIMIT 1
            ");
            $stmt->execute([$userId, $documentId]);
            $sessionData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($sessionData) {
                $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = 'evaluacion' WHERE id = ?");
                $stmt->execute([$sessionData['session_id']]);
                error_log("🔄 Modo cambiado a: evaluacion");
            }
            
            // Obtener nombre del usuario
            $userName = 'estudiante';
            if (isset($userData) && isset($promptBuilder)) {
                $userName = $promptBuilder->getUserName($userData->id);
            }
            
            return [
                'response' => "¡Excelente decisión, {$userName}! 🎯\n\n" .
                             "He activado el **modo evaluación**. Voy a generar un examen sobre todo el contenido que estudiaste.\n\n" .
                             "📝 Prepárate para demostrar lo que aprendiste. ¡Mucha suerte!\n\n" .
                             "Di **'comenzar evaluación'** cuando estés listo.",
                'has_images' => false,
                'images' => []
            ];
        }
        
        // Detectar NO (quiere repasar)
        if (stripos($questionLower, 'no') !== false ||
            stripos($questionLower, 'repaso') !== false ||
            stripos($questionLower, 'repasar') !== false ||
            stripos($questionLower, 'consulta') !== false ||
            stripos($questionLower, 'revisar') !== false) {
            
            error_log("📚 Usuario prefiere repasar - Cambiando a modo consulta");
            
            $stmt = $db->prepare("
                SELECT cs.id as session_id 
                FROM doc_conversacion_sesiones cs
                WHERE cs.user_id = ? AND cs.document_id = ? 
                AND cs.estado = 'activa'
                ORDER BY cs.id DESC 
                LIMIT 1
            ");
            $stmt->execute([$userId, $documentId]);
            $sessionData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($sessionData) {
                $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = 'consulta' WHERE id = ?");
                $stmt->execute([$sessionData['session_id']]);
                error_log("🔄 Modo cambiado a: consulta");
            }
            
            $userName = 'estudiante';
            if (isset($userData) && isset($promptBuilder)) {
                $userName = $promptBuilder->getUserName($userData->id);
            }
            
            return [
                'response' => "¡Muy bien pensado, {$userName}! 📚\n\n" .
                             "He activado el **modo consulta** para que puedas repasar cualquier tema.\n\n" .
                             "Pregúntame lo que necesites. " .
                             "Cuando te sientas preparado, di **'activar modo evaluación'**.\n\n" .
                             "¿Sobre qué tema quieres que conversemos?",
                'has_images' => false,
                'images' => []
            ];
        }
    }

    $leccionActual = $mentorProgress['leccion_actual'];
    $moduloActual = $mentorProgress['modulo_actual'];
    $estado = $mentorProgress['estado'];
    $notasProgreso = $mentorProgress['notas_progreso'] ?? '';
    
    // Obtener nombre del usuario
    $userName = 'estudiante';
    if (isset($userData) && isset($promptBuilder)) {
        $userName = $promptBuilder->getUserName($userData->id);
    }
    
    // Obtener lección actual
    $leccion = $estructura['modulos'][$moduloActual - 1]['lecciones'][$leccionActual - 1] ?? null;
    
    if (!$leccion) {
        // Programa completado
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET estado = 'completado', ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$userId, $documentId]);
        return "¡Felicidades, {$userName}! Has completado todo el programa de estudio. ¿Te gustaría hacer una evaluación final para consolidar tus conocimientos?";
    }
    
    // ✅ NUEVO: Detectar si quiere salir del modo mentor
    if ($mentorPromptBuilder->detectarSalidaMentor($question)) {
        return "Has salido del modo mentor. Ahora estamos de vuelta en el modo de consulta normal. ¿En qué más puedo ayudarte?";
    }

    // ✅ NUEVO: DETECTAR SOLICITUD DE EVALUACIÓN FINAL (MODO MENTOR IA)
$questionLower = strtolower(trim($question));
if (stripos($questionLower, 'evaluación') !== false || 
    stripos($questionLower, 'evaluacion') !== false ||
    stripos($questionLower, 'examen') !== false ||
    stripos($questionLower, 'prueba final') !== false ||
    stripos($questionLower, 'test') !== false ||
    stripos($questionLower, 'certificar') !== false) {
    
    error_log("📝 Usuario solicitó evaluación final en modo mentor IA");
    
    return [
        'response' => "¡Perfecto, {$userName}! Veo que estás listo para poner a prueba tus conocimientos. 📝\n\n" .
                     "**Antes de comenzar la evaluación, ten en cuenta:**\n\n" .
                     "✅ Serás **calificado** sobre todo el contenido del programa\n" .
                     "✅ Recibirás una **puntuación final** y feedback detallado\n" .
                     "✅ Podrás **certificar** tus conocimientos si apruebas\n" .
                     "⏱️ La evaluación tiene un **tiempo límite** por pregunta\n\n" .
                     "¿Te sientes preparado para comenzar ahora, o prefieres hacer un **repaso rápido** en modo consulta primero?",
        'awaiting_evaluation_confirmation' => true,
        'has_images' => false,
        'images' => []
    ];
}
    
    // ✅ NUEVO: Detectar intención del estudiante
    $intencionData = $mentorPromptBuilder->detectarIntencion($question);
    $intencion = $intencionData['intencion'];
    
    error_log("🎯 Intención detectada: {$intencion} (confianza: {$intencionData['confianza']})");
    
    // ✅ NUEVO: Obtener contexto reciente para coherencia
    $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
    $contextReciente = $contextManager->getRecentContext($sessionId, 6);
    
    // **DETERMINAR EL ESTADO ACTUAL DE LA LECCIÓN**
    $estadoLeccion = determinarEstadoLeccionNuevo($notasProgreso, $leccionActual, $moduloActual);
    
    error_log("📍 Estado lección: {$estadoLeccion} | Módulo: {$moduloActual} | Lección: {$leccionActual}");
    
    // **LÓGICA DE FLUJO CONVERSACIONAL MEJORADA**
    // ✅ PRIORIDAD MÁXIMA: Detectar "siguiente lección" manualmente
if (stripos($question, 'siguiente') !== false && 
    (stripos($question, 'lección') !== false || stripos($question, 'leccion') !== false)) {
    
    error_log("⏭️ DETECTADO 'siguiente lección' manualmente - Forzando avance");
    
    // Marcar lección actual como completada
    $clave = "M{$moduloActual}L{$leccionActual}";
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET notas_progreso = CONCAT(IFNULL(notas_progreso, ''), '{$clave}_COMPLETADA\n'),
            ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    
    // Avanzar inmediatamente
    return avanzarSiguienteLeccionMejorada($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual, $userName);
}

    // CASO 1: Pregunta específica del estudiante (PRIORIDAD MÁXIMA)
    if ($intencion === 'pregunta_especifica' || $intencion === 'confusion' || $intencion === 'solicitud_ejemplo') {
        return manejarPreguntaEstudiante($db, $userId, $documentId, $question, $leccion, $estructura, $documento, $userName, $contextReciente);
    }
    
    // CASO 2: Inicio de nueva lección
    if ($estadoLeccion === 'inicio_leccion') {
        return iniciarNuevaLeccionMejorada($db, $userId, $documentId, $leccion, $estructura, $leccionActual, $moduloActual, $documento, $userName);
    }
    
    // CASO 3: Estudiante quiere avanzar
// CASO 3: Estudiante quiere avanzar
if ($intencion === 'avanzar' || $intencion === 'confirmacion_entendimiento') {
    error_log("⏭️ Detectado avance - Estado: {$estadoLeccion}");
    error_log("⏭️ Notas progreso actuales: " . $notasProgreso);
    
    // ✅ NUEVO: Si explícitamente pide avanzar, marcar lección como completada
    if (strpos(strtolower($question), 'siguiente') !== false || 
        strpos(strtolower($question), 'avanzar') !== false) {
        
        error_log("⏭️ Solicitud EXPLÍCITA de avance - Forzando completar lección");
        
        // Marcar como completada
        $clave = "M{$moduloActual}L{$leccionActual}";
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET notas_progreso = CONCAT(IFNULL(notas_progreso, ''), '{$clave}_COMPLETADA\n'),
                ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$userId, $documentId]);
        
        // Avanzar inmediatamente
        return avanzarSiguienteLeccionMejorada($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual, $userName);
    }
        
        // Si está en medio de la lección, continuar explicando
        if ($estadoLeccion === 'explicacion_parcial') {
            return continuarExplicacionLeccion($db, $userId, $documentId, $leccion, $estructura, $documento, $userName, $contextReciente);
        }
        
        // Si terminó de explicar todo, hacer pregunta de verificación
        if ($estadoLeccion === 'explicacion_completa') {
            return hacerPreguntaVerificacion($db, $userId, $documentId, $leccion, $userName);
        }
    }
    
    // CASO 4: Solicitud de profundizar
    if ($intencion === 'solicitud_profundizar') {
        return profundizarConcepto($db, $userId, $documentId, $question, $leccion, $documento, $userName, $contextReciente);
    }
    
    // CASO 5: Solicitud de pausa
    if ($intencion === 'solicitud_pausa') {
        return "Perfecto, {$userName}. Toma el tiempo que necesites. Cuando estés listo para continuar, solo avísame. ¿Hay algo que quieras revisar mientras tanto?";
    }
    
    // CASO 6: Respuesta a pregunta de comprensión
    if ($estadoLeccion === 'esperando_respuesta_comprension') {
        return evaluarRespuestaComprensionMejorada($db, $userId, $documentId, $question, $leccion, $estructura, $leccionActual, $moduloActual, $userName);
    }
    
    // CASO DEFAULT: Conversación natural
    return continuarConversacionNaturalMejorada($db, $userId, $documentId, $question, $leccion, $estructura, $documento, $userName, $contextReciente);
}

// ==========================================
// FUNCIONES AUXILIARES MEJORADAS PARA MENTOR
// ==========================================

/**
 * Determina el estado actual de la lección (versión mejorada)
 */
function determinarEstadoLeccionNuevo($notasProgreso, $leccionActual, $moduloActual) {
    $clave = "M{$moduloActual}L{$leccionActual}";
    
    // Si no hay notas, es inicio de lección
    if (empty($notasProgreso)) {
        return 'inicio_leccion';
    }
    
    // Buscar marcadores en las notas
    if (strpos($notasProgreso, "{$clave}_EXPLICACION_COMPLETA") !== false) {
        if (strpos($notasProgreso, "{$clave}_VERIFICACION_HECHA") !== false) {
            return 'leccion_completada';
        } else {
            return 'explicacion_completa';
        }
    }
    
    if (strpos($notasProgreso, "{$clave}_EXPLICACION_INICIADA") !== false) {
        return 'explicacion_parcial';
    }
    
    if (strpos($notasProgreso, "{$clave}_PREGUNTA_COMPRENSION") !== false) {
        return 'esperando_respuesta_comprension';
    }
    
    if (strpos($notasProgreso, "{$clave}_COMPLETADA") !== false) {
        return 'leccion_completada';
    }
    
    return 'inicio_leccion';
}

/**
 * Obtiene o crea una sesión para el contexto conversacional
 */
function obtenerOCrearSesion($db, $userId, $documentId) {
    $stmt = $db->prepare("
        SELECT id FROM doc_conversacion_sesiones 
        WHERE user_id = ? AND document_id = ? AND modo = 'mentor'
        ORDER BY started_at DESC LIMIT 1
    ");
    $stmt->execute([$userId, $documentId]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($session) {
        return $session['id'];
    }
    
    // Crear nueva sesión
    $sessionToken = bin2hex(random_bytes(32));
    $stmt = $db->prepare("
        INSERT INTO doc_conversacion_sesiones (user_id, document_id, modo, session_token, started_at)
        VALUES (?, ?, 'mentor', ?, NOW())
    ");
    $stmt->execute([$userId, $documentId, $sessionToken]);
    return $db->lastInsertId();
}

/**
 * Maneja preguntas específicas del estudiante durante el mentor
 */
function manejarPreguntaEstudiante($db, $userId, $documentId, $pregunta, $leccion, $estructura, $documento, $userName, $contextReciente) {
    global $mentorPromptBuilder, $contextManager;
    
    error_log("❓ Manejando pregunta específica del estudiante");
    
    // Verificar relevancia con la lección actual
    $relevancia = $mentorPromptBuilder->verificarRelevanciaConLeccion($pregunta, $leccion, $documento);
    
    error_log("📊 Relevancia con lección: {$relevancia['relevancia']} (relacionada: " . ($relevancia['relacionada'] ? 'SÍ' : 'NO') . ")");
    
    // Construir prompt para responder la pregunta
    $systemPrompt = $mentorPromptBuilder->buildRespuestaPreguntaPrompt(
        $pregunta,
        $leccion,
        $documento,
        $userName,
        $contextReciente
    );
    
    // Llamar a OpenAI
    $respuesta = llamarOpenAISimple($systemPrompt, $pregunta);
    
    // Guardar en contexto
    $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
    $contextManager->saveMessage($sessionId, 'user', $pregunta);
    $contextManager->saveMessage($sessionId, 'assistant', $respuesta);
    
    return $respuesta;
}

/**
 * Inicia una nueva lección de manera conversacional
 */
function iniciarNuevaLeccionMejorada($db, $userId, $documentId, $leccion, $estructura, $leccionActual, $moduloActual, $documento, $userName) {
    global $mentorPromptBuilder, $contextManager;
    
    error_log("🆕 Iniciando nueva lección: {$leccion['titulo']}");
    
    // Construir prompt para iniciar lección
    $systemPrompt = $mentorPromptBuilder->buildInicioLeccionPrompt(
        $leccion,
        $estructura,
        $documento,
        $userName
    );
    
    // Llamar a OpenAI
    $respuesta = llamarOpenAISimple($systemPrompt, "Inicia la lección: {$leccion['titulo']}");
    
    // Marcar lección como iniciada
    $clave = "M{$moduloActual}L{$leccionActual}";
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET notas_progreso = CONCAT(IFNULL(notas_progreso, ''), '{$clave}_EXPLICACION_INICIADA\n'),
            ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    
    // Guardar en contexto
    $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
    $contextManager->saveMessage($sessionId, 'assistant', $respuesta);
    
    return $respuesta;
}

/**
 * Continúa explicando la lección actual
 */
function continuarExplicacionLeccion($db, $userId, $documentId, $leccion, $estructura, $documento, $userName, $contextReciente) {
    global $mentorPromptBuilder;
    
    error_log("➡️ Continuando explicación de lección");
    
    // Construir contexto de lo que ya se explicó
    $contextoStr = '';
    if (!empty($contextReciente)) {
        $contextoStr = "\n\nLo que ya explicaste:\n";
        foreach (array_slice($contextReciente, -3) as $msg) {
            if ($msg['role'] === 'assistant') {
                $contextoStr .= "- " . substr($msg['content'], 0, 150) . "...\n";
            }
        }
    }
    
    $systemPrompt = "Eres un mentor educativo para {$userName}.

**CONTEXTO:**
Estás en medio de explicar: **{$leccion['titulo']}**
{$contextoStr}

**INSTRUCCIONES:**
1. Continúa con el SIGUIENTE concepto clave que NO has explicado aún
2. Mantén la explicación breve (máximo 150 palabras)
3. Usa ejemplos del documento si ayuda
4. Termina preguntando si tiene dudas o si puede continuar

**CONTENIDO DE LA LECCIÓN:**
" . implode("\n- ", $leccion['contenido_clave'] ?? ['Contenido no disponible']) . "

**DOCUMENTO COMPLETO:**
" . substr($documento->contenido, 0, 3000) . "

Continúa explicando el siguiente concepto de manera natural y conversacional.";
    
    $respuesta = llamarOpenAISimple($systemPrompt, "Continuar explicación");
    
    return $respuesta;
}

/**
 * Hace una pregunta de verificación de comprensión
 */
function hacerPreguntaVerificacion($db, $userId, $documentId, $leccion, $userName) {
    global $mentorPromptBuilder;
    
    error_log("❓ Generando pregunta de verificación");
    
    $conceptoExplicado = $leccion['titulo'];
    $systemPrompt = $mentorPromptBuilder->buildVerificacionComprensionPrompt(
        $leccion,
        $conceptoExplicado,
        $userName
    );
    
    $pregunta = llamarOpenAISimple($systemPrompt, "Generar pregunta de verificación");
    
    // Marcar que se hizo pregunta de comprensión
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'PREGUNTA_COMPRENSION\n'),
            ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    
    return $pregunta;
}

/**
 * Evalúa la respuesta del estudiante a una pregunta de comprensión
 */
function evaluarRespuestaComprensionMejorada($db, $userId, $documentId, $respuesta, $leccion, $estructura, $leccionActual, $moduloActual, $userName) {
    error_log("✅ Evaluando respuesta de comprensión");
    
    // Evaluación simple: si respondió algo coherente, asumimos que entendió
    $respuestaLower = strtolower(trim($respuesta));
    
    $respuestasPositivas = ['sí', 'si', 'claro', 'entiendo', 'sí entendí', 'tiene sentido', 'ok', 'correcto'];
    $respuestasNegativas = ['no', 'no entiendo', 'confundido', 'no me queda claro'];
    
    $esPositiva = false;
    foreach ($respuestasPositivas as $positiva) {
        if (strpos($respuestaLower, $positiva) !== false) {
            $esPositiva = true;
            break;
        }
    }
    
    $esNegativa = false;
    foreach ($respuestasNegativas as $negativa) {
        if (strpos($respuestaLower, $negativa) !== false) {
            $esNegativa = true;
            break;
        }
    }
    
    if ($esNegativa) {
        return "Entiendo, {$userName}. Déjame explicártelo de otra manera. ¿Qué parte específicamente no te quedó clara?";
    }
    
    // Marcar lección como completada
    $clave = "M{$moduloActual}L{$leccionActual}";
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET notas_progreso = CONCAT(IFNULL(notas_progreso, ''), '{$clave}_VERIFICACION_HECHA\n{$clave}_COMPLETADA\n'),
            ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    
    return "¡Perfecto, {$userName}! Veo que comprendiste bien el concepto. ¿Listo para avanzar a la siguiente lección?";
}

/**
 * Avanza a la siguiente lección
 */
function avanzarSiguienteLeccionMejorada($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual, $userName) {
    error_log("⏭️ Avanzando a siguiente lección");
    
    $moduloInfo = $estructura['modulos'][$moduloActual - 1] ?? null;
    
    if (!$moduloInfo) {
        return "Error al cargar el módulo. Por favor intenta de nuevo.";
    }
    
    $totalLeccionesModulo = count($moduloInfo['lecciones']);
    
    // Si hay más lecciones en este módulo
    if ($leccionActual < $totalLeccionesModulo) {
        $nuevaLeccion = $leccionActual + 1;
        
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET leccion_actual = ?, 
                notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'AVANZAR_LECCION\n'),
                ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$nuevaLeccion, $userId, $documentId]);
        
        $siguienteLeccion = $moduloInfo['lecciones'][$nuevaLeccion - 1];
        
        return "¡Excelente, {$userName}! Ahora pasemos a la **Lección {$nuevaLeccion}: {$siguienteLeccion['titulo']}**\n\n¿Listo para comenzar?";
    }
    
    // Si no hay más lecciones, avanzar al siguiente módulo
    $totalModulos = count($estructura['modulos']);
    
    if ($moduloActual < $totalModulos) {
        $nuevoModulo = $moduloActual + 1;
        
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET modulo_actual = ?, 
                leccion_actual = 1,
                notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'COMPLETADO_MODULO_{$moduloActual}\n'),
                ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$nuevoModulo, $userId, $documentId]);
        
        $siguienteModulo = $estructura['modulos'][$nuevoModulo - 1];
        $primeraLeccion = $siguienteModulo['lecciones'][0];
        
        return "🎉 ¡Felicidades, {$userName}! Has completado el **Módulo {$moduloActual}**.\n\n" .
               "Ahora comenzamos con el **Módulo {$nuevoModulo}: {$siguienteModulo['titulo']}**\n\n" .
               "Primera lección: **{$primeraLeccion['titulo']}**\n\n" .
               "¿Listo para continuar?";
    }
    
    // Programa completado
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET estado = 'completado', 
            notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'PROGRAMA_COMPLETADO\n'),
            ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    
    return "🎊 ¡Felicidades, {$userName}! Has completado todo el programa de estudio.\n\n" .
           "Has demostrado un excelente compromiso con tu aprendizaje. ¿Te gustaría hacer una evaluación final para poner a prueba tus conocimientos?";
}

/**
 * Profundiza en un concepto específico
 */
function profundizarConcepto($db, $userId, $documentId, $pregunta, $leccion, $documento, $userName, $contextReciente) {
    error_log("🔍 Profundizando en concepto");
    
    $systemPrompt = "Eres un mentor educativo para {$userName}.

**CONTEXTO:**
Estás explicando: **{$leccion['titulo']}**
{$userName} pidió profundizar en algo.

**SOLICITUD:**
\"{$pregunta}\"

**DOCUMENTO COMPLETO:**
" . substr($documento->contenido, 0, 3000) . "

**INSTRUCCIONES:**
1. Identifica QUÉ quiere profundizar
2. Da una explicación MÁS DETALLADA de ese concepto
3. Usa ejemplos prácticos del documento
4. Máximo 200 palabras
5. Termina preguntando si quedó más claro

Responde de manera profunda pero clara.";
    
    return llamarOpenAISimple($systemPrompt, $pregunta);
}

/**
 * Continúa conversación natural cuando no cae en otros casos
 */
function continuarConversacionNaturalMejorada($db, $userId, $documentId, $question, $leccion, $estructura, $documento, $userName, $contextReciente) {
    error_log("💬 Continuando conversación natural");
    
    $contextoStr = '';
    if (!empty($contextReciente)) {
        $contextoStr = "\n\nCONTEXTO RECIENTE:\n";
        foreach ($contextReciente as $msg) {
            $rol = $msg['role'] === 'user' ? $userName : 'Tú (Mentor)';
            $contextoStr .= "- {$rol}: " . substr($msg['content'], 0, 100) . "\n";
        }
    }
    
    $systemPrompt = "Eres un mentor educativo conversando con {$userName}.

**CONTEXTO:**
Están en la lección: **{$leccion['titulo']}**
{$contextoStr}

**MENSAJE DE {$userName}:**
\"{$question}\"

**INSTRUCCIONES:**
1. Responde de manera natural y conversacional
2. Si es un comentario, reconócelo y pregunta si quiere continuar
3. Si es una pregunta, respóndela brevemente
4. Mantén el enfoque en la lección actual
5. Máximo 120 palabras

**DOCUMENTO:**
" . substr($documento->contenido, 0, 2000) . "

Responde de manera natural y amigable.";
    
    return llamarOpenAISimple($systemPrompt, $question);
}

/**
 * Función auxiliar para llamar a OpenAI de manera simple
 */
/**
 * Función auxiliar para llamar a OpenAI de manera simple
 */
function llamarOpenAISimple($systemPrompt, $userMessage) {
    $apiKey = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '';
    
    if (empty($apiKey)) {
        error_log("⚠️ API Key de OpenAI no configurada");
        return "Lo siento, hay un problema de configuración. Por favor contacta al administrador.";
    }
    
    // ✅ LIMPIEZA DE CONTENIDO PARA EVITAR ERRORES JSON
    $systemPrompt = mb_convert_encoding($systemPrompt, 'UTF-8', 'UTF-8');
    $userMessage = mb_convert_encoding($userMessage, 'UTF-8', 'UTF-8');
    
    // Limitar longitud para evitar problemas
    if (strlen($systemPrompt) > 12000) {
        $systemPrompt = substr($systemPrompt, 0, 12000) . "\n\n[Contenido truncado por longitud]";
    }
    
    $data = [
        'model' => 'gpt-4o',
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage]
        ],
        'temperature' => 0.7,
        'max_tokens' => 500
    ];
    
    // ✅ USAR JSON_UNESCAPED_UNICODE para manejar caracteres especiales
    $jsonPayload = json_encode($data, JSON_UNESCAPED_UNICODE);
    
    // ✅ VERIFICAR QUE EL JSON SEA VÁLIDO
    if ($jsonPayload === false) {
        error_log("❌ Error al codificar JSON: " . json_last_error_msg());
        error_log("System Prompt length: " . strlen($systemPrompt));
        error_log("User Message length: " . strlen($userMessage));
        return "Lo siento, hubo un error al preparar tu consulta. Por favor intenta con una pregunta más corta.";
    }
    
    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json; charset=utf-8',
        'Authorization: Bearer ' . $apiKey
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        error_log("❌ Error OpenAI HTTP {$httpCode}: {$response}");
        
        // Si es error 400, probablemente es problema de encoding
        if ($httpCode === 400) {
            error_log("🔍 JSON enviado (primeros 500 chars): " . substr($jsonPayload, 0, 500));
        }
        
        return "Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo con otras palabras.";
    }
    
    $decoded = json_decode($response, true);
    
    if (!isset($decoded['choices'][0]['message']['content'])) {
        error_log("❌ Respuesta inválida de OpenAI");
        return "Lo siento, no pude procesar la respuesta. Por favor intenta de nuevo.";
    }
    
    return $decoded['choices'][0]['message']['content'];
}

/**
 * Limpia la transcripción de timestamps y números de línea para enviar a OpenAI
 * Esto evita que los timestamps confundan al modelo
 */
function limpiarTranscripcionParaIA($transcripcion) {
    if (empty($transcripcion)) {
        return '';
    }
    
    // Eliminar números de línea (1, 2, 3, etc. al inicio de línea)
    $limpia = preg_replace('/^\d+\s*$/m', '', $transcripcion);
    
    // Eliminar timestamps (00:02:21,450 --> 00:02:26,000)
    $limpia = preg_replace('/\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{3}/m', '', $limpia);
    
    // Eliminar múltiples saltos de línea (dejar máximo 2)
    $limpia = preg_replace('/\n{3,}/', "\n\n", $limpia);
    
    // Eliminar espacios al inicio/final de cada línea
    $limpia = preg_replace('/^[ \t]+|[ \t]+$/m', '', $limpia);
    
    return trim($limpia);
}

/**
 * Detecta si el mentor hizo una pregunta en su última respuesta
 */
function mentorHizoPregunta($sessionId, $db) {
    try {
        // ✅ CORRECCIÓN 1: Columnas correctas (session_id, tipo, timestamp)
        $stmt = $db->prepare("
            SELECT contenido 
            FROM doc_conversacion_mensajes 
            WHERE session_id = ? 
            AND tipo IN ('comando', 'respuesta_evaluacion')
            ORDER BY timestamp DESC 
            LIMIT 1
        ");
        $stmt->execute([$sessionId]);
        $ultimaRespuesta = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ultimaRespuesta) {
            return false;
        }
        
        $contenido = $ultimaRespuesta['contenido'];
        
        // Detectar si termina con ? o contiene palabras interrogativas
        $patronesPreguntas = [
            '/\?$/u',  // Termina en ?
            '/¿.+\?/u',  // Contiene ¿...?
            '/\b(qué|cómo|cuál|dónde|cuándo|por qué|quién)\b/iu',  // Palabras interrogativas
            '/\b(puedes|podrías|te gustaría|quieres|necesitas)\b/iu'  // Verbos que sugieren pregunta
        ];
        
        foreach ($patronesPreguntas as $patron) {
            if (preg_match($patron, $contenido)) {
                error_log("✅ Mentor hizo pregunta detectada: " . substr($contenido, 0, 100));
                return true;
            }
        }
        
        return false;
    } catch (Exception $e) {
        error_log("⚠️ Error en mentorHizoPregunta: " . $e->getMessage());
        return false;
    }
}

// ✅ FUNCIÓN CORREGIDA: Conversacional como modo mentor normal
function handleVideoMentorConversation($db, $userId, $documentId, $question, $mentorProgress, $estructura) {
    global $data;
    global $sessionToken;
    
    // ✅ LOGS DE DEBUG CRÍTICOS
    error_log("═══════════════════════════════════════════");
    error_log("🔍 handleVideoMentorConversation EJECUTADO");
    error_log("   Question: " . $question);
    error_log("   awaiting_validation en \$data: " . (isset($data->awaiting_validation) ? ($data->awaiting_validation ? 'TRUE' : 'FALSE') : 'NO EXISTE'));
    error_log("   Tipo de \$data->awaiting_validation: " . (isset($data->awaiting_validation) ? gettype($data->awaiting_validation) : 'N/A'));
    error_log("   Lección actual: " . $mentorProgress['leccion_actual']);
    error_log("   Módulo actual: " . $mentorProgress['modulo_actual']);
    error_log("═══════════════════════════════════════════");

    // ✅ VERIFICAR SI EL PROGRAMA YA ESTÁ COMPLETADO
    if ($mentorProgress['estado'] === 'completado') {
        // Obtener nombre del usuario
        global $userData, $promptBuilder;
        $userName = 'estudiante';
        if (isset($userData) && isset($promptBuilder)) {
            $userName = $promptBuilder->getUserName($userData->id);
        }
        
        // Obtener título del programa
        $tituloPrograma = $estructura['titulo_programa'] ?? 'el programa de estudio';
        
        error_log("🎓 Usuario $userName ingresó con programa completado");
        
        return [
            'response' => "¡Hola de nuevo, {$userName}! 🎓\n\n" .
                         "Veo que ya has completado todo el programa de **{$tituloPrograma}**. ¡Felicitaciones por tu dedicación!\n\n" .
                         "¿Qué te gustaría hacer?\n\n" .
                         "📚 **Repasar una lección específica** - Dime qué módulo o tema quieres revisar\n" .
                         "💬 **Hacer consultas** - Pregúntame cualquier duda sobre el contenido\n" .
                         "📝 **Hacer la evaluación final** - Di 'activar modo evaluación' para certificar tus conocimientos\n\n" .
                         "¿En qué puedo ayudarte hoy?",
            'has_images' => false,
            'images' => [],
            'programa_completado' => true
        ];
    }
    
   $leccionActual = $mentorProgress['leccion_actual'];
    $moduloActual = $mentorProgress['modulo_actual'];
    $questionLower = strtolower(trim($question));
    
    // ✅ 1. OBTENER ESTADO ACTUAL DEL VIDEO
    $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
    
    if (!$videoActual) {
        return [
            'response' => "Error: No se encontró el video actual. Por favor, contacta al administrador.",
            'has_images' => false,
            'images' => []
        ];
    }
    
    $videoCompletado = ($videoActual['completado'] == 1);

    // 🔍 DEBUG: Ver valores antes de la condición
error_log("🔍 DETECCIÓN TEMPRANA - Valores:");
error_log("   awaiting_confirmation isset: " . (isset($data->awaiting_confirmation) ? 'SÍ' : 'NO'));
error_log("   awaiting_confirmation value: " . (isset($data->awaiting_confirmation) ? ($data->awaiting_confirmation ? 'TRUE' : 'FALSE') : 'NULL'));
error_log("   awaiting_validation isset: " . (isset($data->awaiting_validation) ? 'SÍ' : 'NO'));
error_log("   awaiting_validation value: " . (isset($data->awaiting_validation) ? ($data->awaiting_validation ? 'TRUE' : 'FALSE') : 'NULL'));
error_log("   Question: $questionLower");


// 🔥 PRIORIDAD: Si viene con awaiting_confirmation o awaiting_validation, NO interceptar
if (isset($data->awaiting_confirmation) && $data->awaiting_confirmation === true) {
    error_log("⏭️ Saltando detección temprana - awaiting_confirmation está activo");
    // Dejar que el flujo continue al bloque correcto más abajo
} 
else if (isset($data->awaiting_validation) && $data->awaiting_validation === true) {
    error_log("⏭️ Saltando detección temprana - awaiting_validation está activo");
    // Dejar que el flujo continue al bloque correcto
}
// 🆕 DETECCIÓN TEMPRANA solo si NO hay flags activos
else if (!isset($data->awaiting_confirmation) || $data->awaiting_confirmation !== true) {
    if (!isset($data->awaiting_validation) || $data->awaiting_validation !== true) {
        
        // ✅ VERIFICAR SI EL MENTOR HIZO UNA PREGUNTA
        $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
        $mentorHizoPreguntaPrevia = mentorHizoPregunta($sessionId, $db);
        
           
        // ✅ Si el mentor hizo pregunta y el usuario dice "sí", es respuesta conversacional
        if ($mentorHizoPreguntaPrevia) {
            $respuestasAfirmativas = ['si', 'sí', 'si.', 'sí.', 'claro', 'entendido', 'ok'];
            $esRespuestaCorta = strlen(trim($question)) < 20; // Respuestas cortas tipo "sí"
            
            foreach ($respuestasAfirmativas as $respuesta) {
                if ($questionLower === $respuesta || ($esRespuestaCorta && strpos($questionLower, $respuesta) !== false)) {
                    error_log("💬 Detectado 'sí' como RESPUESTA a pregunta del mentor, no como comando");
                    
                    // Respuesta conversacional natural
                    return [
                        'response' => "Perfecto. Si tienes alguna otra duda sobre lo que vimos, pregúntame. O si quieres continuar, dime 'continuar con el video'.",
                        'has_images' => false,
                        'images' => []
                    ];
                }
            }
        }
        
        // ✅ Si NO es respuesta a pregunta, entonces SÍ es comando
        $palabrasIniciar = ['continuar', 'continuemos', 'listo', 'adelante', 'estoy listo'];
        
        // ⚠️ IMPORTANTE: "sí" y "si" SOLO son comandos si:
        // 1. NO hubo pregunta previa del mentor
        // 2. Van acompañados de contexto: "sí, continuar", "sí, listo", etc.
        $siConContexto = (strpos($questionLower, 'si') !== false || strpos($questionLower, 'sí') !== false) && 
                         (strpos($questionLower, 'continuar') !== false || 
                          strpos($questionLower, 'video') !== false ||
                          strpos($questionLower, 'siguiente') !== false ||
                          strpos($questionLower, 'adelante') !== false);
        
        foreach ($palabrasIniciar as $palabra) {
            if (stripos($questionLower, $palabra) !== false || $siConContexto) {
                error_log("✅ Usuario quiere iniciar/continuar video (comando explícito): $palabra");
                
                // Si el video no está completado, abrirlo
                if (!$videoCompletado) {
                    return [
                        'response' => "¡Perfecto! Te abro el video.",
                        'action' => 'open_video',
                        'video_data' => $videoActual,
                        'sessionToken' => $sessionToken
                    ];
                }
                
                break;
            }
        }
    }
}

// ✅ 2. COMANDO ESPECIAL: VIDEO TERMINADO
if (strpos($questionLower, 'accion_video_completado') !== false) {
    error_log("🎬 Video completado - Iniciando retroalimentación con 3 preguntas");
    
    // Obtener video actual
    $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
    
    if (!$videoActual) {
        return [
            'response' => "Error al obtener información del video.",
            'has_images' => false,
            'images' => []
        ];
    }
    
    // ✅ IMPORTANTE: Declarar las variables globales ANTES de usarlas
    global $mentorPromptBuilder, $openai, $contextManager, $promptBuilder, $userData;
    
    // Obtener sessionId
    $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
    
    // Obtener nombre real del usuario
    $userName = 'estudiante';
    if (isset($userData) && isset($promptBuilder)) {
        $userName = $promptBuilder->getUserName($userData->id);
        error_log("👤 Usuario identificado: {$userName}");
    }
    
    // ✅ LLAMADA CORRECTA con todas las variables
    return VideoRetroalimentacionHelper::iniciarRetroalimentacion(
        $videoActual,
        $userName,
        $sessionId,
        $db,
        $mentorPromptBuilder,
        $openai,
        $contextManager
    );
}

    


// ✅ 2B. DETECTAR SI ESTÁ RESPONDIENDO LA PREGUNTA DE RETROALIMENTACIÓN
// El frontend envía awaiting_validation=true cuando el usuario responde la retroalimentación
error_log("🔍 Verificando awaiting_validation:");
error_log("   isset(\$data->awaiting_validation): " . (isset($data->awaiting_validation) ? 'SÍ' : 'NO'));
if (isset($data->awaiting_validation)) {
    error_log("   Valor de \$data->awaiting_validation: " . ($data->awaiting_validation ? 'TRUE' : 'FALSE'));
    error_log("   Comparación === true: " . ($data->awaiting_validation === true ? 'SÍ' : 'NO'));
}

// ✅ 2B. DETECTAR SI ESTÁ RESPONDIENDO PREGUNTA DE RETROALIMENTACIÓN
// El frontend envía awaiting_validation=true cuando el usuario responde la retroalimentación
error_log("🔍 Verificando awaiting_validation:");
error_log("   isset(\$data->awaiting_validation): " . (isset($data->awaiting_validation) ? 'SÍ' : 'NO'));
if (isset($data->awaiting_validation)) {
    error_log("   Valor de \$data->awaiting_validation: " . ($data->awaiting_validation ? 'TRUE' : 'FALSE'));
    error_log("   Comparación === true: " . ($data->awaiting_validation === true ? 'SÍ' : 'NO'));
}

// ✅ DETECTAR SI ESTAMOS EN MODO RETROALIMENTACIÓN (respondiendo preguntas)
if (isset($data->retroalimentacion_activa) && $data->retroalimentacion_activa === true) {
    error_log("💬 Usuario respondiendo pregunta de retroalimentación");
    
    // Variables necesarias
    $numeroPregunta = $data->numero_pregunta ?? 1;
    $videoId = $data->video_id ?? null;
    $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
    
    // ✅ IMPORTANTE: Declarar variables globales
    global $mentorPromptBuilder, $openai, $contextManager, $promptBuilder, $userData;
    
    // Obtener nombre real del usuario
    $userName = 'estudiante';
    if (isset($userData) && isset($promptBuilder)) {
        $userName = $promptBuilder->getUserName($userData->id);
    }
    
    if (!$videoId) {
        error_log("❌ Error: No se encontró video_id en retroalimentación");
        return [
            'response' => "Hubo un error. ¿Quieres continuar con la siguiente lección?",
            'has_images' => false,
            'images' => [],
            'awaiting_confirmation' => true
        ];
    }
    
    // ✅ LLAMADA CORRECTA a procesarRespuesta
    $result = VideoRetroalimentacionHelper::procesarRespuesta(
        $question,
        $numeroPregunta,
        $sessionId,
        $videoId,
        $userName,
        $db,
        $mentorPromptBuilder,
        $openai,
        $contextManager
    );
    
// ✅ Retornar para que el código principal procese la respuesta
    return $result;
} 

// ✅ 2C. DETECTAR CONFIRMACIÓN PARA AVANZAR O REPASAR
if (isset($data->awaiting_confirmation) && $data->awaiting_confirmation === true) {
    error_log("✅ Usuario decidió: $question");
    
    $questionLower = strtolower(trim($question));

    // ✅ NUEVO: Si está esperando confirmación de EVALUACIÓN (no de retroalimentación)
    if (isset($data->awaiting_evaluation_confirmation) && $data->awaiting_evaluation_confirmation === true) {
        error_log("📝 Procesando confirmación de evaluación");
        
        // Detectar SI quiere hacer la evaluación
        if (stripos($questionLower, 'si') !== false ||
            stripos($questionLower, 'sí') !== false ||
            stripos($questionLower, 'listo') !== false ||
            stripos($questionLower, 'preparado') !== false ||
            stripos($questionLower, 'comenzar') !== false ||
            stripos($questionLower, 'empezar') !== false ||
            stripos($questionLower, 'adelante') !== false) {
            
            error_log("✅ Usuario aceptó - Activando modo evaluación");
            
            // Cambiar modo a evaluación
            $stmt = $db->prepare("
                SELECT cs.id as session_id 
                FROM doc_conversacion_sesiones cs
                WHERE cs.user_id = ? AND cs.document_id = ? 
                AND cs.estado = 'activa'
                ORDER BY cs.id DESC 
                LIMIT 1
            ");
            $stmt->execute([$userId, $documentId]);
            $sessionData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($sessionData) {
                $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = 'evaluacion' WHERE id = ?");
                $stmt->execute([$sessionData['session_id']]);
                error_log("🔄 Modo cambiado a: evaluacion");
            }
            
            // Obtener nombre del usuario
            global $userData, $promptBuilder;
            $userName = 'estudiante';
            if (isset($userData) && isset($promptBuilder)) {
                $userName = $promptBuilder->getUserName($userData->id);
            }
            
            return [
                'response' => "¡Excelente decisión, {$userName}! 🎯\n\n" .
                             "He activado el **modo evaluación**. Voy a generar un examen sobre todo el contenido que viste.\n\n" .
                             "📝 Prepárate para demostrar lo que aprendiste. ¡Mucha suerte!\n\n" .
                             "Di **'comenzar evaluación'** cuando estés listo.",
                'has_images' => false,
                'images' => []
            ];
        }
        
        // Detectar NO (quiere repasar)
        if (stripos($questionLower, 'no') !== false ||
            stripos($questionLower, 'repaso') !== false ||
            stripos($questionLower, 'repasar') !== false ||
            stripos($questionLower, 'consulta') !== false ||
            stripos($questionLower, 'revisar') !== false) {
            
            error_log("📚 Usuario prefiere repasar - Cambiando a modo consulta");
            
            // Cambiar a modo consulta
            $stmt = $db->prepare("
                SELECT cs.id as session_id 
                FROM doc_conversacion_sesiones cs
                WHERE cs.user_id = ? AND cs.document_id = ? 
                AND cs.estado = 'activa'
                ORDER BY cs.id DESC 
                LIMIT 1
            ");
            $stmt->execute([$userId, $documentId]);
            $sessionData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($sessionData) {
                $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = 'consulta' WHERE id = ?");
                $stmt->execute([$sessionData['session_id']]);
                error_log("🔄 Modo cambiado a: consulta");
            }
            
            global $userData, $promptBuilder;
            $userName = 'estudiante';
            if (isset($userData) && isset($promptBuilder)) {
                $userName = $promptBuilder->getUserName($userData->id);
            }
            
            return [
                'response' => "¡Muy bien pensado, {$userName}! 📚\n\n" .
                             "He activado el **modo consulta** para que puedas repasar cualquier tema.\n\n" .
                             "Pregúntame lo que necesites sobre el contenido que viste. " .
                             "Cuando te sientas preparado, di **'activar modo evaluación'** y haremos el examen.\n\n" .
                             "¿Sobre qué tema quieres que conversemos?",
                'has_images' => false,
                'images' => []
            ];
        }
    }

     // ✅ NUEVO: Detectar si pide profundizar/explicar
    $pideProfundizar = (
        stripos($questionLower, 'explica') !== false ||
        stripos($questionLower, 'explícame') !== false ||
        stripos($questionLower, 'profundiza') !== false ||
        stripos($questionLower, 'más sobre') !== false ||
        stripos($questionLower, 'mas sobre') !== false ||
        stripos($questionLower, 'detalla') !== false ||
        stripos($questionLower, 'esos puntos') !== false ||
        stripos($questionLower, 'estos puntos') !== false ||
        stripos($questionLower, 'eso') !== false && strlen($question) < 30
    );
    
    if ($pideProfundizar) {
        error_log("📚 Usuario pidió profundizar en el contenido");
        
        // Obtener el video actual
        $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
        
        // Obtener nombre del usuario
        global $userData, $promptBuilder;
        $userName = 'estudiante';
        if (isset($userData) && isset($promptBuilder)) {
            $userName = $promptBuilder->getUserName($userData->id);
        }
        
        // Construir prompt para profundizar
        $promptProfundizar = "Eres un mentor educativo explicando en detalle a {$userName}.

**CONTEXTO:**
{$userName} acaba de ver el video: **{$videoActual['titulo_completo']}**

**TRANSCRIPCIÓN DEL VIDEO:**
" . substr($videoActual['transcripcion'], 0, 3000) . "

**SOLICITUD DE {$userName}:**
\"{$question}\"

**TU TAREA:**
1. Identifica QUÉ conceptos específicos quiere que profundices
2. Explica esos conceptos de manera más detallada
3. Usa ejemplos prácticos del video
4. Máximo 150 palabras
5. Termina preguntando: \"¿Quedó más claro? ¿Listo para continuar con la siguiente lección?\"

Explica de manera clara y profunda.";

        $respuestaProfunda = llamarOpenAISimple($promptProfundizar, $question);
        
        return [
            'response' => $respuestaProfunda,
            'has_images' => false,
            'images' => [],
            'awaiting_confirmation' => true, // ✅ Mantener en espera de confirmación
            'sessionToken' => $sessionToken
        ];
    }
    
    // Detectar si quiere continuar (código existente continúa aquí)
    $quiereContinuar = false;


    
// ✅ DETECCIÓN MEJORADA - Priorizar intención clara
$quiereContinuar = false;
$quiereRepasar = false;

// 1. Primero detectar COMANDOS EXPLÍCITOS de avanzar (alta prioridad)
$comandosExplicitosAvanzar = [
    'avanzar',
    'siguiente lección',
    'siguiente leccion',
    'avanzar a la siguiente',
    'continuar con la siguiente',
    'siguiente video',
    'próxima lección',
    'proxima leccion'
];

foreach ($comandosExplicitosAvanzar as $comando) {
    if (stripos($questionLower, $comando) !== false) {
        $quiereContinuar = true;
        error_log("✅ Comando explícito de avanzar detectado: $comando");
        break;
    }
}

// 2. Si NO hay comando explícito, detectar palabras simples de continuar
if (!$quiereContinuar) {
    $palabrasContinuar = ['si', 'sí', 'continuar', 'continuemos', 'listo', 'adelante'];
    
    foreach ($palabrasContinuar as $palabra) {
        if (strpos($questionLower, $palabra) !== false) {
            $quiereContinuar = true;
            break;
        }
    }
}

// 3. Detectar si quiere repasar SOLO si NO dijo explícitamente "avanzar"
if (!$quiereContinuar) {
    $palabrasRepasar = ['repasar', 'repetir', 'ver de nuevo', 'no entendí', 'no entendi', 'dudas', 'confundido'];
    
    foreach ($palabrasRepasar as $palabra) {
        if (strpos($questionLower, $palabra) !== false) {
            $quiereRepasar = true;
            break;
        }
    }
}

// 🔍 DEBUG: Mostrar lo que se detectó
error_log("🎯 Análisis de intención:");
error_log("   Input usuario: {$question}");
error_log("   ¿Quiere continuar?: " . ($quiereContinuar ? 'SÍ' : 'NO'));
error_log("   ¿Quiere repasar?: " . ($quiereRepasar ? 'SÍ' : 'NO'));

// ✅ AHORA SÍ: EJECUTAR LA ACCIÓN CORRESPONDIENTE
if ($quiereContinuar) {
    error_log("✅ Usuario quiere continuar - Analizando contexto...");
    
    // 🆕 PASO 1: Obtener video actual y verificar si está completado
    $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
    
    if (!$videoActual) {
        error_log("❌ No se encontró video actual");
        return [
            'response' => "Lo siento, no pude encontrar el video actual. ¿Podrías activar el modo mentor de nuevo?",
            'action' => 'info',
            'sessionToken' => $sessionToken
        ];
    }
    
    // 🆕 PASO 2: Calcular porcentaje de progreso del video actual
    $duracionTotal = $videoActual['duracion_segundos'] ?? 0;
    $tiempoActual = $videoActual['timestamp_actual'] ?? 0;
    $porcentajeVisto = $duracionTotal > 0 ? ($tiempoActual / $duracionTotal) * 100 : 0;
    $estaCompletado = $videoActual['completado'] == 1 || $porcentajeVisto >= 85;
    
    error_log("📊 Estado del video actual:");
    error_log("   - ID: {$videoActual['id']}");
    error_log("   - Título: {$videoActual['titulo_completo']}");
    error_log("   - Progreso: " . round($porcentajeVisto, 1) . "%");
    error_log("   - Completado BD: " . ($videoActual['completado'] ?? 0));
    error_log("   - ¿Está completado?: " . ($estaCompletado ? 'SÍ' : 'NO'));
    
    // 🆕 PASO 3: Decidir acción según estado del video
    
    // CASO A: Video actual NO completado → Continuar video actual
    if (!$estaCompletado) {
        error_log("▶️ Video NO completado - Continuando video actual");
        
        return [
            'response' => "¡Perfecto! Continuemos con: **{$videoActual['titulo_completo']}**\n\n" .
                         "Retomamos donde lo dejaste (en el " . round($porcentajeVisto, 0) . "%).",
            'action' => 'video_ready',
            'video_data' => $videoActual,
            'sessionToken' => $sessionToken
        ];
    }
    
    // CASO B: Video actual SÍ completado → Avanzar a siguiente lección
    error_log("✅ Video completado - Avanzando a siguiente lección");
    
    // 1. Marcar video actual como completado (por si no estaba marcado)
    
    if ($videoActual) {
        $stmt = $db->prepare("
            UPDATE doc_mentor_video_progreso 
            SET completado = 1, 
                timestamp_maximo = COALESCE((SELECT duracion_segundos FROM doc_mentor_videos WHERE id = ?), timestamp_maximo),
                timestamp_actual = COALESCE((SELECT duracion_segundos FROM doc_mentor_videos WHERE id = ?), timestamp_actual)
            WHERE user_id = ? AND video_id = ?
        ");
        $stmt->execute([$videoActual['id'], $videoActual['id'], $userId, $videoActual['id']]);
        
        error_log("✅ Video {$videoActual['id']} marcado como completado");
    }
    
    // 2. Avanzar a la siguiente lección
    $moduloInfo = $estructura['modulos'][$moduloActual - 1] ?? null;
    
    if ($moduloInfo) {
        $totalLeccionesModulo = count($moduloInfo['lecciones']);
        error_log("📊 Módulo {$moduloActual}: lección {$leccionActual} de {$totalLeccionesModulo}");
        
        // CASO A: Hay más lecciones en este módulo
        if ($leccionActual < $totalLeccionesModulo) {
            $nuevaLeccion = $leccionActual + 1;
            
            // Actualizar progreso en BD
            $stmt = $db->prepare("
                UPDATE doc_mentor_progreso 
                SET leccion_actual = ?, ultima_actualizacion = NOW()
                WHERE user_id = ? AND document_id = ?
            ");
            $stmt->execute([$nuevaLeccion, $userId, $documentId]);
            
            error_log("✅ Progreso actualizado: Módulo {$moduloActual}, Lección {$nuevaLeccion}");
            
            // Obtener siguiente video
            $siguienteVideo = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $nuevaLeccion);
            
            if ($siguienteVideo) {
                // Calcular progreso total
                $totalLecciones = 0;
                foreach ($estructura['modulos'] as $mod) {
                    $totalLecciones += count($mod['lecciones']);
                }
                $leccionesCompletadas = 0;
                for ($m = 1; $m < $moduloActual; $m++) {
                    $leccionesCompletadas += count($estructura['modulos'][$m - 1]['lecciones']);
                }
                $leccionesCompletadas += ($nuevaLeccion - 1);
                
                $porcentaje = round(($leccionesCompletadas / $totalLecciones) * 100, 0);
                
                return [
                    'response' => "¡Excelente! Avanzamos a la siguiente lección.\n\n" .
                                 "📹 **{$siguienteVideo['titulo_completo']}**\n\n" .
                                 "📊 **Progreso:** {$leccionesCompletadas} de {$totalLecciones} lecciones ({$porcentaje}%)\n\n" .
                                 "¿Listo para continuar?",
                    'action' => 'video_ready',
                    'video_data' => $siguienteVideo,
                    'sessionToken' => $sessionToken
                ];
            }
        }
        
        // CASO B: Terminó el módulo - avanzar al siguiente
        $totalModulos = count($estructura['modulos']);
        
        if ($moduloActual < $totalModulos) {
            $nuevoModulo = $moduloActual + 1;
            
            $stmt = $db->prepare("
                UPDATE doc_mentor_progreso 
                SET modulo_actual = ?, leccion_actual = 1, ultima_actualizacion = NOW()
                WHERE user_id = ? AND document_id = ?
            ");
            $stmt->execute([$nuevoModulo, $userId, $documentId]);
            
            error_log("✅ Avanzado a Módulo {$nuevoModulo}, Lección 1");
            
            $siguienteModulo = $estructura['modulos'][$nuevoModulo - 1];
            $primerVideoNuevoModulo = obtenerVideoActual($db, $userId, $documentId, $nuevoModulo, 1);
            
            if ($primerVideoNuevoModulo) {
                return [
                    'response' => "🎉 ¡Felicidades! Has completado el **Módulo {$moduloActual}**.\n\n" .
                                 "Ahora comenzamos con el **Módulo {$nuevoModulo}: {$siguienteModulo['titulo']}**\n\n" .
                                 "📹 Primera lección: **{$primerVideoNuevoModulo['titulo_completo']}**\n\n" .
                                 "¿Listo para continuar?",
                    'action' => 'video_ready',
                    'video_data' => $primerVideoNuevoModulo,
                    'sessionToken' => $sessionToken
                ];
            }
        }
        
        // CASO C: Terminó TODO el programa
        // ✅ ACTUALIZAR EL ESTADO A 'completado'
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET estado = 'completado', 
                ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$userId, $documentId]);
        
        error_log("✅ Programa completado - Estado actualizado a 'completado'");
        
        return [
            'response' => "🎉 ¡Increíble! Has completado **todo el programa de estudio**.\n\n" .
                         "Has demostrado dedicación y esfuerzo. ¿Te gustaría hacer una evaluación final para certificar tus conocimientos?",
            'awaiting_evaluation_confirmation' => true,
            'sessionToken' => $sessionToken
        ];
    }
    
} else if ($quiereRepasar) {
    // ✅ Usuario explícitamente quiere repasar
    error_log("🔄 Usuario solicitó repasar el video actual");
    
    $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
    
    return [
        'response' => "Entendido, es importante sentirse seguro del contenido antes de avanzar.\n\n" .
                     "📹 Volveremos a ver: **{$videoActual['titulo_completo']}**\n\n" .
                     "Tómate el tiempo que necesites.",
        'action' => 'video_ready',
        'video_data' => $videoActual,
        'sessionToken' => $sessionToken
    ];
    
} else {
    // ✅ No está claro - pedir aclaración
    error_log("❓ Respuesta ambigua del usuario");
    
    return [
        'response' => "No estoy seguro de entender. ¿Quieres:\n\n" .
                     "🔸 **'Avanzar'** a la siguiente lección, o\n" .
                     "🔸 **'Repasar'** este video nuevamente?",
        'awaiting_confirmation' => true,
        'sessionToken' => $sessionToken
    ];
}

} // ✅ ESTE ES EL CIERRE CORRECTO del bloque awaiting_confirmation
      
  
// ✅ 3. DETECTAR SI ES UNA PREGUNTA ESPECÍFICA (alta prioridad)
// ✅ INCLUYE RESPUESTAS AFIRMATIVAS para mantener contexto conversacional
$esRespuestaAfirmativaSimple = preg_match('/^(si|sí|claro|dale|ok|okay|está bien|perfecto|adelante|me gustaría|quiero que|quisiera que|explícame|cuéntame)/i', trim($question));

$esPreguntaEspecifica = 
    $esRespuestaAfirmativaSimple ||  // ✅ NUEVO: Respuestas afirmativas también son "específicas"
    strpos($questionLower, 'qué') !== false ||
    strpos($questionLower, 'que') !== false ||
    strpos($questionLower, 'cómo') !== false ||
    strpos($questionLower, 'como') !== false ||
    strpos($questionLower, 'cuál') !== false ||
    strpos($questionLower, 'cual') !== false ||
    strpos($questionLower, 'por qué') !== false ||
    strpos($questionLower, 'explica') !== false ||
    strpos($questionLower, 'dije') !== false ||
    strpos($questionLower, 'dijiste') !== false ||
    strpos($questionLower, 'dijeron') !== false ||
    strpos($questionLower, 'hablaron') !== false ||
    strpos($questionLower, 'mencionaron') !== false ||
    strpos($questionLower, 'último') !== false ||
    strpos($questionLower, 'ultimos') !== false ||
    strpos($questionLower, 'primeros') !== false ||
    strpos($questionLower, 'segundo') !== false ||
    strlen($question) > 30; // Preguntas largas = conversación

error_log("🔍 ¿Es pregunta específica o respuesta afirmativa? " . ($esPreguntaEspecifica ? 'SÍ' : 'NO'));

    /**
 * Detecta el tema principal de la última respuesta del mentor
 */
function detectarTemaConversacion($sessionId, $db) {
    try {
        $stmt = $db->prepare("
            SELECT contenido 
            FROM doc_conversacion_mensajes 
            WHERE session_id = ? AND rol = 'assistant'
            ORDER BY created_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$sessionId]);
        $ultimaRespuesta = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($ultimaRespuesta) {
            $contenido = $ultimaRespuesta['contenido'];
            
            // Detectar temas médicos específicos
            $temas = [
                'IBP' => ['IBP', 'inhibidor de la bomba', 'omeprazol', 'pantoprazol', 'VOZAMA', 'vonoprazan'],
                'ERGE' => ['reflujo', 'ERGE', 'acidez', 'esófago'],
                'AINEs' => ['AINEs', 'antiinflamatorio', 'ibuprofeno', 'naproxeno'],
                'úlcera' => ['úlcera', 'H pylori', 'helicobacter'],
                'digestión' => ['digestión', 'estómago', 'ácido gástrico', 'ácido clorhídrico'],
                'amilasa' => ['amilasa', 'enzima digestiva', 'saliva'],
                'anatomía digestiva' => ['lengua', 'papilas', 'glándulas salivales', 'boca'],
            ];
            
            foreach ($temas as $nombreTema => $palabrasClave) {
                foreach ($palabrasClave as $palabra) {
                    if (stripos($contenido, $palabra) !== false) {
                        error_log("🔍 Tema detectado en conversación: $nombreTema");
                        return [
                            'tema' => $nombreTema,
                            'contexto' => substr($contenido, 0, 200)
                        ];
                    }
                }
            }
        }
        
        return null;
    } catch (Exception $e) {
        error_log("⚠️ Error detectando tema: " . $e->getMessage());
        return null;
    }
}
    
if ($esPreguntaEspecifica) {
    // ✅ USAR MentorPromptBuilder PARA RESPONDER
    global $mentorPromptBuilder, $contextManager;
    
    error_log("❓ Pregunta específica sobre video detectada");
    
    // Obtener contexto reciente
    $sessionId = obtenerOCrearSesion($db, $userId, $documentId);
    $contextReciente = $contextManager->getRecentContext($sessionId, 4);
    
    // ✅ NUEVO: Detectar tema de conversación actual
    $temaActual = detectarTemaConversacion($sessionId, $db);
    
    // ✅ NUEVO: Si usuario responde afirmativamente y hay tema activo, continuar ese tema
    $esRespuestaAfirmativa = preg_match('/^(si|sí|claro|dale|ok|okay|está bien|perfecto|adelante|me gustaría|quiero que|quisiera que)/i', trim($question));
    $esPreguntaCorta = strlen(trim($question)) < 60; // Respuestas cortas tipo "sí, explícame"
    
    if ($esRespuestaAfirmativa && $temaActual && $esPreguntaCorta) {
        error_log("💬 Respuesta afirmativa detectada con tema activo: {$temaActual['tema']}");
        error_log("   Pregunta original: $question");
        
        // Reformular la pregunta para incluir el tema
        $questionOriginal = $question;
        $question = "Explícame más a fondo sobre " . $temaActual['tema'] . ". " . $questionOriginal;
        error_log("🔄 Pregunta reformulada: $question");
    }
    
    // Detectar si hace referencia a timestamp
    $timestampInfo = $mentorPromptBuilder->detectarTimestamp($question);
    
    if ($timestampInfo['tiene_timestamp']) {
        error_log("⏱️ Pregunta con timestamp detectado: {$timestampInfo['descripcion']}");
    }
    
    // Construir prompt para responder pregunta sobre video
// Obtener nombre real del usuario
// Obtener nombre real del usuario
global $userData, $promptBuilder;
$userName = 'estudiante';
if (isset($userData) && isset($promptBuilder)) {
    $userName = $promptBuilder->getUserName($userData->id);
}

// ✅ OBTENER TIEMPO ACTUAL DEL VIDEO
global $data;
$tiempoActualVideo = 0;
if (isset($data->videoContext) && is_object($data->videoContext)) {
    $tiempoActualVideo = $data->videoContext->currentTime ?? 0;
    error_log("🎥 Tiempo actual del video para pregunta: {$tiempoActualVideo}s");
}

// Construir prompt para responder pregunta sobre video
$systemPrompt = $mentorPromptBuilder->buildVideoQuestionPrompt(
    $question,
    $videoActual,
    $userName,
    $contextReciente,
    $tiempoActualVideo  // ✅ NUEVO PARÁMETRO
);
    
    // Llamar a OpenAI con el prompt mejorado
    $respuesta = llamarOpenAISimple($systemPrompt, $question);
    
    // Guardar en contexto
    $contextManager->saveMessage($sessionId, 'user', $question);
    $contextManager->saveMessage($sessionId, 'assistant', $respuesta);
    
    return [
        'response' => $respuesta,
        'has_images' => false,
        'images' => []
    ];
} else {
    // ✅ 4. COMANDOS EXPLÍCITOS DE NAVEGACIÓN
    // (código existente continúa aquí...)
        // ✅ 4. COMANDOS EXPLÍCITOS DE NAVEGACIÓN
        $comandosSiguiente = [
            'siguiente', 'próximo', 'proximo',
            'avanzar al siguiente', 'pasar al siguiente',
            'continuar con el siguiente',
            'nueva lección', 'otro video'
        ];
        
        $esSiguiente = false;
        foreach ($comandosSiguiente as $comando) {
            if (strpos($questionLower, $comando) !== false) {
                $esSiguiente = true;
                break;
            }
        }
        
        if ($esSiguiente) {
            if ($videoCompletado) {
                return avanzarSiguienteVideo($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual);
            } else {
                return [
                    'response' => "Debes completar la lección actual antes de avanzar. " .
                                 "El video debe llegar hasta el final. ¿Tienes alguna pregunta sobre lo que hemos visto?",
                    'has_images' => false,
                    'images' => []
                ];
            }
        }
        
        // ✅ 5. COMANDOS EXPLÍCITOS DE CONTINUAR/REPRODUCIR
// ✅ 5. COMANDOS EXPLÍCITOS DE CONTINUAR/REPRODUCIR O RESPUESTAS CORTAS AFIRMATIVAS
$comandosExplicitosContinuar = [
    'continuar', 'continuemos', 'continua', 'continuá',
    'seguir', 'sigamos', 'sigue',
    'reproducir', 'reproduce', 'play',
    'ver el video', 'ver video',
    'abrir el video', 'abrir video',
    'vamos', 'dale', 'ok', 'listo',
    'si', 'sí', 'claro', 'perfecto'
];

$esContinuar = false;

// Detectar palabras clave de continuar
foreach ($comandosExplicitosContinuar as $comando) {
    if (stripos($questionLower, $comando) !== false) {
        $esContinuar = true;
        error_log("▶️ Comando de continuar detectado: {$comando}");
        break;
    }
}

// También detectar respuestas muy cortas como "continuar"
if (strlen(trim($question)) < 20 && 
    (stripos($questionLower, 'continuar') !== false || 
     stripos($questionLower, 'seguir') !== false ||
     stripos($questionLower, 'listo') !== false ||
     $questionLower === 'si' || $questionLower === 'sí' ||
     $questionLower === 'ok' || $questionLower === 'dale')) {
    $esContinuar = true;
    error_log("▶️ Respuesta corta afirmativa detectada");
}

if ($esContinuar) {
    error_log("▶️ Abriendo video actual para continuar");
    
    // Obtener video actual
    $videoActual = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual);
    
    if ($videoActual) {
        return [
            'response' => "¡Perfecto! Continuemos con el video: **{$videoActual['titulo_completo']}**",
            'action' => 'open_video',
            'video_data' => $videoActual,
            'has_images' => false,
            'images' => []
        ];
    } else {
        return [
            'response' => "Hubo un error al cargar el video. Por favor intenta de nuevo.",
            'has_images' => false,
            'images' => []
        ];
    }
}

// ✅ NUEVO: DETECTAR COMANDO DE PAUSA
if (stripos($questionLower, 'pausa') !== false || 
    stripos($questionLower, 'espera') !== false ||
    stripos($questionLower, 'espérame') !== false ||
    stripos($questionLower, 'momento') !== false ||
    stripos($questionLower, 'detente') !== false) {
    
    error_log("⏸️ Comando de pausa detectado");
    
    global $userData, $promptBuilder;
    $userName = 'estudiante';
    if (isset($userData) && isset($promptBuilder)) {
        $userName = $promptBuilder->getUserName($userData->id);
    }
    
    return [
        'response' => "Perfecto, {$userName}. Toma todo el tiempo que necesites. " .
                     "Cuando estés listo para continuar, solo di **'continuar'** o **'listo'**. " .
                     "¿Hay algo que quieras revisar mientras tanto?",
        'has_images' => false,
        'images' => []
    ];
}


// ✅ NUEVO: DETECTAR SOLICITUD DE EVALUACIÓN FINAL
if (stripos($questionLower, 'evaluación') !== false || 
    stripos($questionLower, 'evaluacion') !== false ||
    stripos($questionLower, 'examen') !== false ||
    stripos($questionLower, 'prueba final') !== false ||
    stripos($questionLower, 'test') !== false ||
    stripos($questionLower, 'certificar') !== false) {
    
    error_log("📝 Usuario solicitó evaluación final en modo video");
    
    // Obtener nombre del usuario
    global $userData, $promptBuilder;
    $userName = 'estudiante';
    if (isset($userData) && isset($promptBuilder)) {
        $userName = $promptBuilder->getUserName($userData->id);
    }
    
    return [
        'response' => "¡Perfecto, {$userName}! Veo que estás listo para poner a prueba tus conocimientos. 📝\n\n" .
                     "**Antes de comenzar la evaluación, ten en cuenta:**\n\n" .
                     "✅ Serás **calificado** sobre todo el contenido del programa\n" .
                     "✅ Recibirás una **puntuación final** y feedback detallado\n" .
                     "✅ Podrás **certificar** tus conocimientos si apruebas\n" .
                     "⏱️ La evaluación tiene un **tiempo límite** por pregunta\n\n" .
                     "¿Te sientes preparado para comenzar ahora, o prefieres hacer un **repaso rápido** en modo consulta primero?",
        'awaiting_evaluation_confirmation' => true,
        'has_images' => false,
        'images' => []
    ];
}
        
        // ✅ 6. RESPUESTAS AFIRMATIVAS CORTAS (baja prioridad, solo si no es pregunta)
        $respuestasAfirmativas = [
            'sí', 'si', 'ok', 'okay', 'vale', 'dale', 'listo',
            'entiendo', 'entendido', 'claro', 'perfecto', 'bien'
        ];
        
        $esAfirmacionCorta = false;
        foreach ($respuestasAfirmativas as $afirmacion) {
            if ($questionLower === $afirmacion || 
                (strlen($questionLower) < 15 && strpos($questionLower, $afirmacion) !== false)) {
                $esAfirmacionCorta = true;
                break;
            }
        }
        
        if ($esAfirmacionCorta) {
            // ✅ Respuesta genérica suave (el frontend decide si reproduce)
            return [
                'response' => "Entendido. Si tienes alguna pregunta sobre el contenido, estaré aquí para ayudarte.",
                'has_images' => false,
                'images' => []
            ];
        }
    }

  // ✅ 7. RESPONDER CON CONTEXTO TEMPORAL INTELIGENTE
    if (!empty($videoActual['transcripcion'])) {
        // ✅ OBTENER TIEMPO ACTUAL DEL VIDEO desde $data (global)
        global $data;
        
        // ✅ LEER videoContext solo si existe
        $tiempoActualVideo = 0;
        $duracionVideo = $videoActual['duracion_segundos'] ?? 600; // ✅ DEFAULT 10 min
        
        if (isset($data->videoContext) && is_object($data->videoContext)) {
            $tiempoActualVideo = $data->videoContext->currentTime ?? 0;
            $duracionVideo = $data->videoContext->videoDuration ?? ($videoActual['duracion_segundos'] ?? 600);
            error_log("✅ Contexto recibido: tiempo={$tiempoActualVideo}s, duración={$duracionVideo}s");
        } else {
            error_log("ℹ️ No hay videoContext (normal si no hay video activo)");
        }
        
        // ✅ VALIDAR ANTES DE USAR EN CÁLCULOS
        if ($duracionVideo <= 0) {
            error_log("⚠️ Duración es 0, usando valor por defecto");
            $duracionVideo = 600; // 10 minutos por defecto
        }
        
        $progresoCalculado = round(($tiempoActualVideo / $duracionVideo) * 100, 1);
        $questionText = $question;
        
        // ✅ LIMPIAR TRANSCRIPCIÓN (quitar timestamps)
        $transcripcionLimpia = limpiarTranscripcionParaIA($videoActual['transcripcion']);
        
        // 🔍 DEBUG - Verificar contenido
        error_log("🔍 DEBUG - Longitud transcripción original: " . strlen($videoActual['transcripcion']));
        error_log("🔍 DEBUG - Longitud transcripción limpia: " . strlen($transcripcionLimpia));
        error_log("🔍 DEBUG - ¿Contiene 'amilasa'? " . (stripos($transcripcionLimpia, 'amilasa') !== false ? 'SÍ' : 'NO'));
        error_log("🔍 DEBUG - Primeros 300 chars limpios: " . substr($transcripcionLimpia, 0, 300));
        
        // ✅ EXTRAER SEGMENTO RELEVANTE SEGÚN TIEMPO ACTUAL
        $segmentoActual = extraerSegmentoRelevante($videoActual['transcripcion'], $tiempoActualVideo);
        
        // ✅ FORMATEAR TIEMPO
        $minutosActuales = floor($tiempoActualVideo / 60);
        $segundosActuales = floor($tiempoActualVideo % 60);
        $tiempoFormateado = sprintf("%d:%02d", $minutosActuales, $segundosActuales);
        
        // ✅ VALIDAR DURACIÓN
        if ($duracionVideo <= 0) {
            error_log("⚠️ ADVERTENCIA: Duración del video es 0 o negativa");
            $duracionVideo = 600;
        }
        
        $progresoCalculado = round(($tiempoActualVideo / $duracionVideo) * 100, 1);
        
        // ✅ PROMPT MEJORADO CON BÚSQUEDA EXPLÍCITA
        $prompt = "Eres un tutor experto viendo JUNTO con el estudiante el video: '{$videoActual['titulo_completo']}'.

⏸️ SITUACIÓN ACTUAL:
- El estudiante pausó el video en {$tiempoFormateado} (ha visto desde 0:00 hasta {$tiempoFormateado})
- Progreso: {$progresoCalculado}%

📋 CONTENIDO COMPLETO DE LA LECCIÓN:

A continuación está TODO lo que se ha explicado en esta lección. Lee CUIDADOSAMENTE porque contiene la información que necesitas para responder:

\"\"\"
{$transcripcionLimpia}
\"\"\"

⚠️ INSTRUCCIONES CRÍTICAS:

1. **BÚSQUEDA OBLIGATORIA**: Antes de responder, DEBES buscar en el contenido de arriba usando estos métodos:
   - Búsqueda literal: ¿Aparece la palabra exacta?
   - Búsqueda flexible: ¿Aparece con variaciones? (ej: \"amilasa\" / \"la amilasa\" / \"una amilasa\")
   - Búsqueda de sinónimos: ¿Se menciona el concepto con otras palabras?

2. **NUNCA digas \"no se menciona\" sin haber buscado exhaustivamente**

3. **Si encuentras la información**: Explícala con tus propias palabras de forma natural

4. **Lenguaje natural**: 
   - Di \"en la lección\" o \"en este video\" (NO \"en la transcripción\")
   - Di \"se explicó que...\" (NO \"dice textualmente...\")
   - Habla como si ESTUVIERAS VIENDO el video con el estudiante

5. **Referencias temporales**:
   - \"Los últimos X segundos\" = Los X segundos ANTES de pausar (no al final del video)
   - \"¿Qué sigue?\" = NO puedes responder (solo lo visto hasta {$tiempoFormateado})



❓ PREGUNTA DEL ESTUDIANTE:
{$questionText}

🔍 PROCESO ANTES DE RESPONDER:
1. Leer TODO el contenido de la lección mostrado arriba
2. Buscar la información usando búsqueda literal y flexible
3. Si la encuentras: Explicar con tus propias palabras
4. Si NO la encuentras después de buscar bien: Decir \"En lo que llevamos de la lección, aún no se ha mencionado ese tema específicamente\"

💬 EJEMPLOS:

❌ MAL: \"No se menciona la amilasa en el video\"
✅ BIEN: \"Sí, la amilasa se menciona en la lección. Es una enzima que...\" (si está en el contenido)

❌ MAL: \"La transcripción dice...\"
✅ BIEN: \"En esta parte de la lección se explica que...\"

AHORA RESPONDE LA PREGUNTA:";
        
        $respuestaIA = llamarOpenAI($prompt, $questionText);
        
        return [
            'response' => $respuestaIA,
            'has_images' => false,
            'images' => []
        ];
    }

    // ✅ 8. FALLBACK (si no hay transcripción)
    return [
        'response' => "Entendido. Puedes continuar viendo el video. Cuando termines, avanzaremos automáticamente al siguiente. " .
                     "Si tienes alguna pregunta específica sobre el contenido, estaré aquí para ayudarte.",
        'has_images' => false,
        'images' => []
    ];
}

// FUNCIÓN para obtener video actual
// REEMPLAZAR la función obtenerVideoActual existente por esta versión mejorada:

function obtenerVideoActual($db, $userId, $documentId, $moduloActual, $leccionActual) {
    // ✅ CORRECCIÓN: Se usa el $userId que viene como parámetro, no una variable de sesión.
    $stmt = $db->prepare("
        SELECT 
            mv.id, mv.document_id, mv.anexo_id, mv.modulo_numero, mv.leccion_numero,
            mv.titulo_completo, mv.vimeo_id, mv.hash_privacidad, mv.transcripcion,
            mv.duracion_segundos, mv.orden_secuencial,
            mvp.timestamp_actual, mvp.timestamp_maximo, mvp.completado
        FROM doc_mentor_videos mv
        LEFT JOIN doc_mentor_video_progreso mvp ON mv.id = mvp.video_id AND mvp.user_id = :user_id
        WHERE mv.document_id = :document_id 
          AND mv.modulo_numero = :modulo_actual 
          AND mv.leccion_numero = :leccion_actual
        ORDER BY mv.orden_secuencial ASC
        LIMIT 1
    ");
    
    $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
    $stmt->bindParam(':document_id', $documentId, PDO::PARAM_INT);
    $stmt->bindParam(':modulo_actual', $moduloActual, PDO::PARAM_INT);
    $stmt->bindParam(':leccion_actual', $leccionActual, PDO::PARAM_INT);
    $stmt->execute();
    
    $video = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($video) {
        // Asegurar valores por defecto para que el frontend no reciba nulos.
        $video['timestamp_actual'] = $video['timestamp_actual'] ?? 0;
        $video['timestamp_maximo'] = $video['timestamp_maximo'] ?? 0;
        $video['completado'] = $video['completado'] ?? 0;
    }
    
    return $video;
}

// FUNCIÓN para avanzar al siguiente video
function avanzarSiguienteVideo($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual) {
    error_log("⏭️ Intentando avanzar al siguiente video");
    error_log("  Módulo actual: {$moduloActual}, Lección actual: {$leccionActual}");
    
    $moduloInfo = $estructura['modulos'][$moduloActual - 1] ?? null;
    
    if (!$moduloInfo) {
        error_log("❌ No se encontró info del módulo {$moduloActual}");
        return [
            'response' => "Error al cargar información del módulo.",
            'has_images' => false,
            'images' => []
        ];
    }
    
    $totalLeccionesModulo = count($moduloInfo['lecciones']);
    error_log("  Total lecciones en módulo {$moduloActual}: {$totalLeccionesModulo}");
    
    // ✅ CASO 1: Hay más lecciones en este módulo
    if ($leccionActual < $totalLeccionesModulo) {
        $nuevaLeccion = $leccionActual + 1;
        
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET leccion_actual = ?, ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$nuevaLeccion, $userId, $documentId]);
        
        error_log("✅ Avanzado a lección {$nuevaLeccion} del módulo {$moduloActual}");
        
        $siguienteVideo = obtenerVideoActual($db, $userId, $documentId, $moduloActual, $nuevaLeccion);
        
        // Calcular progreso
        $totalLecciones = 0;
        foreach ($estructura['modulos'] as $mod) {
            $totalLecciones += count($mod['lecciones']);
        }
        $leccionesCompletadas = 0;
        for ($m = 1; $m < $moduloActual; $m++) {
            $leccionesCompletadas += count($estructura['modulos'][$m - 1]['lecciones']);
        }
        $leccionesCompletadas += $nuevaLeccion - 1; // -1 porque aún no completa la nueva
        
        $porcentaje = round(($leccionesCompletadas / $totalLecciones) * 100, 0);
        $barraProgreso = str_repeat('█', floor($porcentaje/10)) . str_repeat('░', 10 - floor($porcentaje/10));
        
        return [
            'response' => "¡Excelente progreso! Avanzamos a: **{$siguienteVideo['titulo_completo']}**\n\n" .
                         "📊 **Progreso:** {$leccionesCompletadas} de {$totalLecciones} lecciones ({$porcentaje}%)\n" .
                         "[{$barraProgreso}]\n\n" .
                         "¿Estás listo para continuar?",
            'action' => 'video_ready',
            'video_data' => $siguienteVideo,
            'has_images' => false,
            'images' => []
        ];
    }
    
    // ✅ CASO 2: Terminó el módulo, verificar si hay más módulos
    $totalModulos = count($estructura['modulos']);
    error_log("  Total módulos: {$totalModulos}");
    
    if ($moduloActual < $totalModulos) {
        // Avanzar al siguiente módulo
        $nuevoModulo = $moduloActual + 1;
        
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET modulo_actual = ?, leccion_actual = 1, ultima_actualizacion = NOW()
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$nuevoModulo, $userId, $documentId]);
        
        error_log("✅ Avanzado a módulo {$nuevoModulo}, lección 1");
        
        $siguienteModulo = $estructura['modulos'][$nuevoModulo - 1];
        $primerVideoNuevoModulo = obtenerVideoActual($db, $userId, $documentId, $nuevoModulo, 1);
        
        // Calcular progreso
        $totalLecciones = 0;
        foreach ($estructura['modulos'] as $mod) {
            $totalLecciones += count($mod['lecciones']);
        }
        $leccionesCompletadas = 0;
        for ($m = 1; $m < $nuevoModulo; $m++) {
            $leccionesCompletadas += count($estructura['modulos'][$m - 1]['lecciones']);
        }
        
        $porcentaje = round(($leccionesCompletadas / $totalLecciones) * 100, 0);
        $barraProgreso = str_repeat('█', floor($porcentaje/10)) . str_repeat('░', 10 - floor($porcentaje/10));
        
        return [
            'response' => "🎉 ¡Felicidades! Has completado el **Módulo {$moduloActual}**.\n\n" .
                         "📊 **Progreso:** {$leccionesCompletadas} de {$totalLecciones} lecciones ({$porcentaje}%)\n" .
                         "[{$barraProgreso}]\n\n" .
                         "Ahora comenzamos con el **Módulo {$nuevoModulo}: {$siguienteModulo['titulo']}**\n\n" .
                         "Primera lección: **{$primerVideoNuevoModulo['titulo_completo']}**\n\n" .
                         "¿Listo para continuar?",
            'action' => 'video_ready',
            'video_data' => $primerVideoNuevoModulo,
            'has_images' => false,
            'images' => []
        ];
    }
    
    // ✅ CASO 3: COMPLETÓ TODO EL PROGRAMA
    error_log("🎊 PROGRAMA COMPLETADO - No hay más módulos ni lecciones");
    
    // Marcar como completado
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET estado = 'completado', ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$userId, $documentId]);
    
    error_log("✅ Estado actualizado a 'completado' en base de datos");
    
    // Calcular estadísticas finales
    $totalLecciones = 0;
    $totalModulos = count($estructura['modulos']);
    foreach ($estructura['modulos'] as $modulo) {
        $totalLecciones += count($modulo['lecciones']);
    }
    
    // Obtener nombre del usuario
    global $userData, $promptBuilder;
    $userName = 'estudiante';
    if (isset($userData) && isset($promptBuilder)) {
        $userName = $promptBuilder->getUserName($userData->id);
    }
    
    return [
        'response' => "🎊🎉 **¡FELICIDADES, {$userName}!** 🎉🎊\n\n" .
                     "Has completado exitosamente todo el programa:\n\n" .
                     "📚 **{$estructura['titulo_programa']}**\n\n" .
                     "**Logros:**\n" .
                     "✅ {$totalModulos} módulos completados\n" .
                     "✅ {$totalLecciones} video-lecciones vistas\n" .
                     "✅ Duración: {$estructura['duracion_estimada']}\n\n" .
                     "**[████████████] 100%**\n\n" .
                     "Has demostrado un excelente compromiso con tu aprendizaje. " .
                     "¿Te gustaría hacer una **evaluación final** para certificar tus conocimientos, " .
                     "o prefieres **repasar** algún tema específico?",
        'has_images' => false,
        'images' => []
    ];
}


function determinarEstadoLeccion($notasProgreso, $leccionActual, $moduloActual) {
    $marcadorLeccion = "M{$moduloActual}L{$leccionActual}";
    
    if (empty($notasProgreso)) {
        return 'inicio_leccion';
    }
    
    if (strpos($notasProgreso, "{$marcadorLeccion}_EXPLICACION_DADA") !== false) {
        if (strpos($notasProgreso, "{$marcadorLeccion}_PREGUNTA_HECHA") !== false) {
            if (strpos($notasProgreso, "{$marcadorLeccion}_COMPRENSION_VALIDADA") !== false) {
                return 'leccion_completada';
            }
            return 'pregunta_comprension';
        }
        return 'explicacion_dada';
    }
    
    return 'inicio_leccion';
}

function analizarIntencionUsuario($question) {
    $questionLower = strtolower(trim($question));
    
    // Indicadores de comprensión positiva
    $indicadoresPositivos = [
        'sí', 'si', 'entiendo', 'claro', 'perfecto', 'está bien', 'todo bien', 
        'me queda claro', 'comprendo', 'entendido', 'continúa', 'siguiente', 
        'avancemos', 'sí, estoy listo', 'por favor avancemos'
    ];
    
    // Indicadores de necesidad de repaso
    $indicadoresNegativos = [
        'no', 'no entiendo', 'no me queda claro', 'confuso', 'dudas', 
        'no comprendo', 'explica otra vez', 'repite', 'no está claro'
    ];
    
    // Indicadores de comprensión parcial
    $indicadoresParciales = [
        'más o menos', 'en parte', 'parcialmente', 'algo', 'un poco', 
        'casi', 'no del todo', 'tengo algunas dudas'
    ];
    
    foreach ($indicadoresPositivos as $indicador) {
        if (strpos($questionLower, $indicador) !== false) {
            return 'comprension_positiva';
        }
    }
    
    foreach ($indicadoresNegativos as $indicador) {
        if (strpos($questionLower, $indicador) !== false) {
            return 'necesita_repaso';
        }
    }
    
    foreach ($indicadoresParciales as $indicador) {
        if (strpos($questionLower, $indicador) !== false) {
            return 'comprension_parcial';
        }
    }
    
    return 'respuesta_elaborada';
}

function iniciarNuevaLeccion($db, $userId, $documentId, $leccion, $estructura, $leccionActual, $moduloActual, $documento, $openai) {
    // Generar explicación de la lección usando OpenAI
    $sistemPrompt = "Eres un tutor médico experto. Tu tarea es explicar completamente el tema '{$leccion['titulo']}' basándote en el contenido del documento.

INSTRUCCIONES:
1. Da una explicación completa y fluida del tema
2. Cubre todos los puntos importantes: " . implode(', ', $leccion['contenido_clave']) . "
3. Mantén un tono conversacional y didáctico
4. Al final, pregunta de manera natural si todo está claro
5. NO menciones que es una 'lección' o 'módulo', habla como un tutor real

CONTENIDO DEL DOCUMENTO:
{$documento->contenido}

CONTEXTO:
- Tema actual: {$leccion['titulo']}
- Objetivos: " . implode(', ', $leccion['objetivos']);

   // NUEVO: Usar sistema de anexos inteligente igual que en modo consulta
$messages = [
    ['role' => 'system', 'content' => $sistemPrompt],
    ['role' => 'user', 'content' => "Por favor, explica el tema {$leccion['titulo']} de manera completa."]
];

// Usar el servicio OpenAI con multimedia (mismo que funciona en consulta)
$aiResult = $openai->generateResponseWithAttachments($messages, $documentId, "explicar {$leccion['titulo']}", $db);

if ($aiResult['success']) {
    $respuestaIA = $aiResult['response'];
    
    // Registrar uso de anexos si hay imágenes
    if ($aiResult['has_images']) {
        $attachmentContext = new AttachmentContextService($db);
        foreach ($aiResult['images'] as $image) {
            $attachmentContext->logAttachmentUsage(
                $image['id'],
                $userId,
                NULL,
                'viewed',
                'mentor',
                'automatic'
            );
        }
    }
    
    // Marcar que la explicación fue dada
    actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_EXPLICACION_DADA");
    
    // Devolver resultado completo con imágenes
    return [
        'response' => $respuestaIA,
        'images' => $aiResult['images'] ?? [],
        'has_images' => $aiResult['has_images'] ?? false
    ];
} else {
    // Marcar que la explicación fue dada
    actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_EXPLICACION_DADA");
    
    return [
        'response' => "Lo siento, ha ocurrido un error técnico. ¿Podrías repetir tu pregunta?",
        'images' => [],
        'has_images' => false
    ];
}
}

function manejarPostExplicacion($db, $userId, $documentId, $question, $intencionUsuario, $leccion, $estructura, $leccionActual, $moduloActual, $openai) {
    
    // **DETECTAR INTENCIÓN DE REPETIR O ACLARAR**
    $quiereRepetir = detectarIntencionRepetir($question);
    
    if ($quiereRepetir) {
        // El estudiante quiere que repita o aclare algo específico
        return manejarSolicitudAclaracion($question, $leccion, $estructura, $leccionActual, $moduloActual);
    }
    
    // **DETECTAR INTENCIÓN DE AVANZAR**
    $quiereAvanzar = detectarIntencionAvanzar($question);
    
    if ($quiereAvanzar) {
        // El estudiante quiere avanzar directamente
        actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_COMPRENSION_VALIDADA");
        return avanzarSiguienteLeccion($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual);
    }
    
    switch ($intencionUsuario) {
        case 'comprension_positiva':
            // Hacer pregunta simple de validación (no restrictiva)
            $pregunta = generarPreguntaValidacion($leccion);
            actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_PREGUNTA_HECHA");
            return "¡Perfecto! Solo para asegurarme, {$pregunta}";
            
        case 'necesita_repaso':
            return "Por supuesto, ¿qué parte específica te gustaría que explique nuevamente?";
            
        case 'comprension_parcial':
            return "Entiendo, ¿cuál es la parte que no te queda completamente clara?";
            
        default:
            // **CAMBIO: Si no es claro, hacer pregunta simple pero permitir avance**
            $pregunta = generarPreguntaValidacion($leccion);
            actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_PREGUNTA_HECHA");
            return "Muy bien. {$pregunta}";
    }
}

function detectarIntencionAvanzar($question) {
    $questionLower = strtolower(trim($question));
    
    $indicadoresAvance = [
        'continuemos', 'avancemos', 'siguiente', 'continua', 'avanza',
        'no quiero repasar', 'quiero continuar', 'sigamos', 'vamos al siguiente',
        'no necesito repaso', 'ya entendí', 'quiero avanzar', 'next',
        'adelante', 'prosigamos', 'vamos adelante'
    ];
    
    foreach ($indicadoresAvance as $indicador) {
        if (strpos($questionLower, $indicador) !== false) {
            return true;
        }
    }
    
    return false;
}

function detectarIntencionRepetir($question) {
    $questionLower = strtolower(trim($question));
    
    $indicadoresRepetir = [
        'repite', 'repetir', 'explica otra vez', 'explícame otra vez',
        'no entiendo', 'no me queda claro', 'puedes explicar',
        'me explicas', 'aclara', 'aclarar', 'duda', 'dudas',
        'no comprendo', 'confuso', 'confundido', 'nuevamente',
        'otra vez', 'de nuevo', 'podemos repasar', 'repasemos',
        'me puedes decir', 'quiero que me expliques', 'explícame',
        'tengo una pregunta', 'una pregunta', 'qué significa',
        'qué es', 'cómo funciona', 'puedes repetir'
    ];
    
    foreach ($indicadoresRepetir as $indicador) {
        if (strpos($questionLower, $indicador) !== false) {
            return true;
        }
    }
    
    return false;
}

function manejarSolicitudAclaracion($question, $leccion, $estructura, $leccionActual, $moduloActual) {
    // Analizar qué aspecto específico quiere que se aclare
    $sistemPrompt = "Eres un tutor médico paciente y comprensivo. Un estudiante te está pidiendo que aclares o repitas algo sobre el tema '{$leccion['titulo']}'. 

INSTRUCCIONES:
1. Identifica qué aspecto específico quiere que aclares basándote en su pregunta
2. Da una explicación clara y específica de ese punto
3. Usa ejemplos si es necesario para que sea más comprensible
4. Mantén un tono alentador y paciente
5. Al final pregunta si esa parte ya está más clara o si necesita más aclaración
6. NO avances al siguiente tema hasta que confirme que entendió

PREGUNTA/SOLICITUD DEL ESTUDIANTE: '{$question}'
CONTENIDO DEL TEMA: " . implode(', ', $leccion['contenido_clave']) . "
OBJETIVOS DEL TEMA: " . implode(', ', $leccion['objetivos']);

    // Usar sistema multimedia en lugar de llamarOpenAI básico
$messages = [
    ['role' => 'system', 'content' => $sistemPrompt],
    ['role' => 'user', 'content' => "Aclara específicamente lo que el estudiante está preguntando: " . $question]
];



$aiResult = $openai->generateResponseWithAttachments($messages, $documentId, $question, $db);

if ($aiResult['success']) {
    $aclaracion = $aiResult['response'];
    
    // Registrar uso de anexos si hay imágenes
    if ($aiResult['has_images']) {
        $attachmentContext = new AttachmentContextService($db);
        foreach ($aiResult['images'] as $image) {
            $attachmentContext->logAttachmentUsage(
                $image['id'],
                $userId,
                NULL,
                'viewed',
                'mentor',
                'clarification'
            );
        }
    }
    
    // Devolver resultado completo con imágenes
    return [
        'response' => $aclaracion,
        'images' => $aiResult['images'] ?? [],
        'has_images' => $aiResult['has_images'] ?? false
    ];
} else {
    return [
        'response' => "Lo siento, ha ocurrido un error técnico. ¿Podrías repetir tu pregunta?",
        'images' => [],
        'has_images' => false
    ];
}
}


function evaluarRespuestaComprension($db, $userId, $documentId, $question, $intencionUsuario, $leccion, $estructura, $leccionActual, $moduloActual, $openai) {
    
    // **CAMBIO CRÍTICO: Evaluar la respuesta como TUTOR, no como evaluador**
    $sistemPrompt = "Eres un tutor médico comprensivo y alentador. Un estudiante te respondió sobre el tema '{$leccion['titulo']}'. 

INSTRUCCIONES COMO TUTOR:
1. Lee su respuesta y da retroalimentación DIRECTA al estudiante
2. Si la respuesta es correcta: Felicita brevemente (ej: '¡Excelente!', '¡Muy bien!', '¡Perfecto!')
3. Si es parcialmente correcta: Reconoce lo bueno y complementa lo que falta (ej: 'Muy bien, y además de eso...')
4. Si es incorrecta: Corrige amablemente y explica brevemente (ej: 'En realidad, lo importante es que...')
5. SIEMPRE termina preguntando si puede avanzar al siguiente tema
6. Mantén un tono alentador y de apoyo
7. NO seas restrictivo, este es aprendizaje, no evaluación

RESPUESTA DEL ESTUDIANTE: '{$question}'
PUNTOS CLAVE DEL TEMA: " . implode(', ', $leccion['contenido_clave']);

   // Usar sistema multimedia en lugar de llamarOpenAI básico
$messages = [
    ['role' => 'system', 'content' => $sistemPrompt],
    ['role' => 'user', 'content' => "Da retroalimentación como tutor sobre esta respuesta: " . $question]
];



$aiResult = $openai->generateResponseWithAttachments($messages, $documentId, $question, $db);

if ($aiResult['success']) {
    $retroalimentacion = $aiResult['response'];
    
    // Registrar uso de anexos si hay imágenes
    if ($aiResult['has_images']) {
        $attachmentContext = new AttachmentContextService($db);
        foreach ($aiResult['images'] as $image) {
            $attachmentContext->logAttachmentUsage(
                $image['id'],
                $userId,
                NULL,
                'viewed',
                'mentor',
                'feedback'
            );
        }
    }
    
    // **CAMBIO CRÍTICO: SIEMPRE marcar como validada para permitir avance**
    actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_COMPRENSION_VALIDADA");
    
    // Devolver resultado completo con imágenes
    return [
        'response' => $retroalimentacion . " ¿Avanzamos al siguiente tema?",
        'images' => $aiResult['images'] ?? [],
        'has_images' => $aiResult['has_images'] ?? false
    ];
} else {
    // **CAMBIO CRÍTICO: SIEMPRE marcar como validada para permitir avance**
    actualizarNotasProgreso($db, $userId, $documentId, "M{$moduloActual}L{$leccionActual}_COMPRENSION_VALIDADA");
    
    return [
        'response' => "Lo siento, ha ocurrido un error técnico. ¿Podrías repetir tu pregunta? ¿Avanzamos al siguiente tema?",
        'images' => [],
        'has_images' => false
    ];
}
}

function avanzarSiguienteLeccion($db, $userId, $documentId, $estructura, $leccionActual, $moduloActual) {
    $totalLeccionesModulo = count($estructura['modulos'][$moduloActual - 1]['lecciones']);
    
    if ($leccionActual < $totalLeccionesModulo) {
        // Avanzar a la siguiente lección en el mismo módulo
        $nuevaLeccion = $leccionActual + 1;
        $stmt = $db->prepare("
            UPDATE doc_mentor_progreso 
            SET leccion_actual = ?, ultima_actualizacion = NOW(),
                notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'COMPLETADA_M{$moduloActual}L{$leccionActual}\n')
            WHERE user_id = ? AND document_id = ?
        ");
        $stmt->execute([$nuevaLeccion, $userId, $documentId]);
        
        $siguienteLeccion = $estructura['modulos'][$moduloActual - 1]['lecciones'][$nuevaLeccion - 1];
        
        // **CAMBIO: Iniciar directamente la nueva lección con explicación completa**
        $variacionesCierre = [
            "¿Te parece bien?",
            "¿Tienes alguna duda?",
            "¿Qué opinas?", 
            "¿Te hace sentido?",
            "¿Alguna pregunta?",
            "¿Necesitas que aclare algo?"
        ];
        
        $cierreRandom = $variacionesCierre[array_rand($variacionesCierre)];
        
        return "¡Excelente! Ahora vamos con: **{$siguienteLeccion['titulo']}**. 

" . generarExplicacionCompleta($siguienteLeccion, $estructura, $nuevaLeccion, $moduloActual) . "

{$cierreRandom}";
        
    } else {
        // Avanzar al siguiente módulo
        $totalModulos = count($estructura['modulos']);
        
        if ($moduloActual < $totalModulos) {
            $nuevoModulo = $moduloActual + 1;
            $stmt = $db->prepare("
                UPDATE doc_mentor_progreso 
                SET modulo_actual = ?, leccion_actual = 1, ultima_actualizacion = NOW(),
                    notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'COMPLETADO_MODULO_{$moduloActual}\n')
                WHERE user_id = ? AND document_id = ?
            ");
            $stmt->execute([$nuevoModulo, $userId, $documentId]);
            
            $siguienteModulo = $estructura['modulos'][$nuevoModulo - 1];
            $primeraLeccion = $siguienteModulo['lecciones'][0];
            
            $variacionesCierreModulo = [
                "¿Te parece bien continuar?",
                "¿Alguna pregunta antes de seguir?",
                "¿Qué te parece este nuevo módulo?",
                "¿Tienes dudas sobre esto?",
                "¿Todo bien hasta aquí?",
                "¿Necesitas que repase algo?"
            ];
            
            $cierreRandomModulo = $variacionesCierreModulo[array_rand($variacionesCierreModulo)];
            
            return "¡Perfecto! Has completado el Módulo {$moduloActual}. 

Ahora comenzamos con el **Módulo {$nuevoModulo}: {$siguienteModulo['titulo']}**

Primera lección: **{$primeraLeccion['titulo']}**

" . generarExplicacionCompleta($primeraLeccion, $estructura, 1, $nuevoModulo) . "

{$cierreRandomModulo}";
            
        } else {
            // Programa completado
            $stmt = $db->prepare("
                UPDATE doc_mentor_progreso 
                SET estado = 'completado', ultima_actualizacion = NOW(),
                    notas_progreso = CONCAT(IFNULL(notas_progreso, ''), 'PROGRAMA_COMPLETADO\n')
                WHERE user_id = ? AND document_id = ?
            ");
            $stmt->execute([$userId, $documentId]);
            
            return "¡Felicidades! Has completado todo el programa de estudio sobre {$estructura['titulo_programa']}. 

Has demostrado una excelente dedicación y comprensión de todos los temas. ¿Te gustaría hacer una evaluación final para consolidar tus conocimientos o tienes alguna pregunta específica?";
        }
    }
}

function generarExplicacionCompleta($leccion, $estructura, $leccionNum, $moduloNum) {
    // Generar explicación directa basada en los contenidos clave
    $explicacion = "";
    
    if (!empty($leccion['contenido_clave'])) {
        foreach ($leccion['contenido_clave'] as $index => $punto) {
            $explicacion .= ($index + 1) . ". " . $punto . "\n";
        }
    }
    
    if (!empty($leccion['objetivos'])) {
        $explicacion .= "\n**Puntos importantes a recordar:**\n";
        foreach ($leccion['objetivos'] as $index => $objetivo) {
            $explicacion .= "• " . $objetivo . "\n";
        }
    }
    
    return $explicacion;
}


function continuarConversacionNatural($db, $userId, $documentId, $question, $leccion, $estructura, $leccionActual, $moduloActual, $openai) {
    // Para casos no cubiertos, mantener conversación natural
    $sistemPrompt = "Continúa la conversación como un tutor médico sobre el tema '{$leccion['titulo']}'. 
    El estudiante dijo: '{$question}'. 
    Responde de manera natural y educativa basándote en los puntos clave: " . implode(', ', $leccion['contenido_clave']);
    
    // Usar sistema multimedia en lugar de llamarOpenAI básico
$messages = [
    ['role' => 'system', 'content' => $sistemPrompt],
    ['role' => 'user', 'content' => $question]
];



$aiResult = $openai->generateResponseWithAttachments($messages, $documentId, $question, $db);

if ($aiResult['success']) {
    $respuesta = $aiResult['response'];
    
    // Registrar uso de anexos si hay imágenes
    if ($aiResult['has_images']) {
        $attachmentContext = new AttachmentContextService($db);
        foreach ($aiResult['images'] as $image) {
            $attachmentContext->logAttachmentUsage(
                $image['id'],
                $userId,
                NULL,
                'viewed',
                'mentor',
                'conversation'
            );
        }
    }
    
    // Devolver resultado completo con imágenes
    return [
        'response' => $respuesta,
        'images' => $aiResult['images'] ?? [],
        'has_images' => $aiResult['has_images'] ?? false
    ];
} else {
    return [
        'response' => "Lo siento, ha ocurrido un error técnico. ¿Podrías repetir tu pregunta?",
        'images' => [],
        'has_images' => false
    ];
}
}

function actualizarNotasProgreso($db, $userId, $documentId, $marcador) {
    $stmt = $db->prepare("
        UPDATE doc_mentor_progreso 
        SET notas_progreso = CONCAT(IFNULL(notas_progreso, ''), ?, '\n'),
            ultima_actualizacion = NOW()
        WHERE user_id = ? AND document_id = ?
    ");
    $stmt->execute([$marcador, $userId, $documentId]);
}

function generarPreguntaValidacion($leccion) {
    $preguntas = [
        "¿podrías explicarme con tus propias palabras qué es " . $leccion['contenido_clave'][0] . "?",
        "¿cuál dirías que es el punto más importante de " . $leccion['titulo'] . "?",
        "¿cómo aplicarías " . $leccion['contenido_clave'][0] . " en la práctica?",
        "¿qué relación ves entre " . $leccion['titulo'] . " y lo que habíamos visto antes?"
    ];
    
    return $preguntas[array_rand($preguntas)];
}



function llamarOpenAI($systemPrompt, $userMessage) {
    $openaiApiKey = $_ENV['OPENAI_API_KEY'];
    
    $data = [
        'model' => 'gpt-4o-mini',
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage]
        ],
        'max_tokens' => 800,
        'temperature' => 0.7
    ];
    
    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $openaiApiKey
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    $decoded = json_decode($response, true);
    
    if (isset($decoded['choices'][0]['message']['content'])) {
        return $decoded['choices'][0]['message']['content'];
    }
    
    return "Lo siento, ha ocurrido un error técnico. ¿Podrías repetir tu pregunta?";
}




// **1. AGREGAR AL FINAL DEL ARCHIVO - NUEVAS FUNCIONES PARA MODO EVALUACIÓN**

function getEvaluationConfig($db, $documentId) {
    $stmt = $db->prepare("
        SELECT * FROM doc_evaluacion_configuracion 
        WHERE document_id = ?
    ");
    $stmt->execute([$documentId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function getActiveEvaluation($db, $userId, $documentId, $sessionId) {
    $stmt = $db->prepare("
        SELECT * FROM doc_evaluacion_resultados 
        WHERE user_id = ? AND document_id = ? AND session_id = ? 
        AND fecha_finalizacion IS NULL
        ORDER BY id DESC LIMIT 1
    ");
    $stmt->execute([$userId, $documentId, $sessionId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function getEvaluationAttempts($db, $userId, $documentId) {
    $stmt = $db->prepare("
        SELECT COUNT(*) as total_attempts, 
               COUNT(CASE WHEN aprobado = 1 THEN 1 END) as approved_attempts
        FROM doc_evaluacion_resultados 
        WHERE user_id = ? AND document_id = ? AND fecha_finalizacion IS NOT NULL
    ");
    $stmt->execute([$userId, $documentId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function handleEvaluationActivation($db, $userId, $documentId, $sessionId, $documento) {
    // Verificar configuración de evaluación
    $config = getEvaluationConfig($db, $documentId);
    if (!$config) {
        return "Lo siento, no hay una evaluación configurada para este contenido. Por favor contacta al administrador.";
    }
    
    // Verificar intentos previos
    $attempts = getEvaluationAttempts($db, $userId, $documentId);
    if ($attempts['total_attempts'] >= $config['max_intentos']) {
        return "Has alcanzado el máximo de intentos permitidos ({$config['max_intentos']}) para esta evaluación. " .
               ($attempts['approved_attempts'] > 0 ? "Ya has aprobado anteriormente." : "Contacta al instructor para más opciones.");
    }
    
    // Verificar si ya hay una evaluación activa
    $activeEvaluation = getActiveEvaluation($db, $userId, $documentId, $sessionId);
    if ($activeEvaluation) {
        return continuarEvaluacionActiva($db, $activeEvaluation, $config);
    }
    
    // Crear nueva evaluación
    return iniciarNuevaEvaluacion($db, $userId, $documentId, $sessionId, $config, $documento);
}

function iniciarNuevaEvaluacion($db, $userId, $documentId, $sessionId, $config, $documento) {
    // Cargar contenido del documento
    $documento->id = $documentId;
    if (!$documento->readOne()) {
        return "Error: No se pudo cargar el contenido del documento para la evaluación.";
    }
    
    // Calcular número de intento
    $attempts = getEvaluationAttempts($db, $userId, $documentId);
    $numeroIntento = $attempts['total_attempts'] + 1;
    
    // **GENERAR POOL DE PREGUNTAS ALEATORIAS CON AJUSTE DINÁMICO**
    $poolPreguntas = generarPoolPreguntasAleatorias($documento, $config['preguntas_por_evaluacion'], $numeroIntento);
    
    if (!$poolPreguntas || count($poolPreguntas) < 2) {
        return "Lo siento, el contenido del documento es muy limitado para generar una evaluación completa. Se necesita más contenido para crear preguntas variadas. Por favor contacta al administrador para revisar este material.";
    }
    
    $preguntasGeneradas = count($poolPreguntas);
    
    // Crear registro de evaluación con el pool de preguntas REAL
    $stmt = $db->prepare("
        INSERT INTO doc_evaluacion_resultados 
        (user_id, document_id, session_id, total_preguntas, porcentaje_aprobacion, numero_intento, fecha_inicio, detalle_respuestas)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)
    ");
    
    $initialData = [
        'pool_preguntas' => $poolPreguntas,
        'pregunta_actual' => 0,
        'respuestas' => []
    ];
    
    $stmt->execute([
        $userId, 
        $documentId, 
        $sessionId, 
        $preguntasGeneradas, // Usar cantidad real generada
        $config['porcentaje_aprobacion'],
        $numeroIntento,
        json_encode($initialData)
    ]);
    
    // Actualizar modo de sesión
    $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = 'evaluacion' WHERE id = ?");
    $stmt->execute([$sessionId]);
    
    $intentosRestantes = $config['max_intentos'] - $numeroIntento;
    
    $mensajeAjuste = "";
    if ($preguntasGeneradas < $config['preguntas_por_evaluacion']) {
        $mensajeAjuste = "\n📋 *Nota: La cantidad de preguntas se ajustó a {$preguntasGeneradas} según el contenido disponible.*";
    }
    
    return "¡Perfecto! He activado el modo evaluación. Esta será tu evaluación número {$numeroIntento}.

**Detalles de la evaluación:**
- Preguntas: {$preguntasGeneradas} (generadas aleatoriamente para ti).
- Porcentaje para aprobar: {$config['porcentaje_aprobacion']}% .
- Intentos restantes después de este: {$intentosRestantes}.
{$mensajeAjuste}

He preparado un conjunto único de preguntas basadas en el contenido de \"{$documento->titulo}\". Cada evaluación tiene preguntas diferentes para asegurar una evaluación justa.

¿Estás preparado para comenzar?";
}

function continuarEvaluacionActiva($db, $evaluation, $config) {
    $evaluationData = json_decode($evaluation['detalle_respuestas'] ?? '{}', true);
    $preguntasHechas = isset($evaluationData['respuestas']) ? count($evaluationData['respuestas']) : 0;
    $preguntasRestantes = $evaluation['total_preguntas'] - $preguntasHechas;
    
    if ($preguntasRestantes <= 0) {
        return finalizarEvaluacionAleatoria($db, $evaluation['id'], $evaluation, $evaluationData['respuestas'] ?? []);
    }
    
    return "Continuemos con tu evaluación. Llevas {$preguntasHechas} de {$evaluation['total_preguntas']} preguntas respondidas. 
           Te quedan {$preguntasRestantes} preguntas. ¿Listo para continuar?";
}

function generarPoolPreguntasAleatorias($documento, $cantidadPreguntas, $numeroIntento) {
    // Analizar extensión del contenido para ajustar cantidad de preguntas
    $longitudContenido = strlen($documento->contenido);
    $palabrasContenido = str_word_count($documento->contenido);
    
    // Ajustar cantidad según contenido disponible
    $preguntasOptimas = $cantidadPreguntas;
    if ($palabrasContenido < 200) {
        $preguntasOptimas = min(3, $cantidadPreguntas);
    } elseif ($palabrasContenido < 500) {
        $preguntasOptimas = min(5, $cantidadPreguntas);
    } elseif ($palabrasContenido < 1000) {
        $preguntasOptimas = min(7, $cantidadPreguntas);
    }
    
    // Crear seed único
    $seed = md5($documento->id . time() . $numeroIntento . rand(1000, 9999));
    
    $systemPrompt = "Eres un experto evaluador médico. El documento tiene aproximadamente {$palabrasContenido} palabras.

**CANTIDAD AJUSTADA**: Genera EXACTAMENTE {$preguntasOptimas} preguntas (ajustado según contenido disponible).

**INSTRUCCIONES CRÍTICAS:**
1. Cada pregunta debe ser ÚNICA y DIFERENTE
2. Usa SOLO información del documento proporcionado
3. Si el contenido es limitado, enfócate en los conceptos MÁS IMPORTANTES
4. Varía los tipos de preguntas según el contenido disponible
5. Asegúrate de que cada pregunta tenga una respuesta clara en el documento
6. SEED de aleatoriedad: {$seed}

**ESTRATEGIA SEGÚN CONTENIDO:**
- Contenido corto (< 200 palabras): Preguntas sobre conceptos clave principales
- Contenido medio (200-1000 palabras): Mix de conceptos principales y detalles importantes
- Contenido extenso (> 1000 palabras): Cobertura amplia de diferentes secciones

**FORMATO DE RESPUESTA (JSON):**
```json
{
  \"preguntas\": [
    {
      \"id\": 1,
      \"tipo\": \"verdadero_falso\",
      \"pregunta\": \"¿Es verdadero que...?\",
      \"respuesta_correcta\": \"verdadero\",
      \"justificacion\": \"Según el documento...\"
    }
  ]
}
```

**TIPOS DE PREGUNTA DISPONIBLES:**
- verdadero_falso: \"¿Estoy en lo correcto si digo que...?\"
- seleccion_multiple: \"¿Cuál de estas opciones...?\" 
- pregunta_abierta: \"¿Para qué sirve...?\" o \"¿Qué es...?\"
- completar: \"¿Cuál es el componente que...?\"

**CONTENIDO DEL DOCUMENTO:**
Título: {$documento->titulo}
Contenido: " . $documento->contenido . "

Genera exactamente {$preguntasOptimas} preguntas variadas y aleatorias en formato JSON válido.";

    $response = llamarOpenAI($systemPrompt, "Genera {$preguntasOptimas} preguntas aleatorias");
    
    // Parsear respuesta JSON
    $preguntasData = json_decode($response, true);
    
    if (!$preguntasData || !isset($preguntasData['preguntas']) || count($preguntasData['preguntas']) < 2) {
        // Fallback más flexible
       return generarPreguntasIndividuales($documento, $preguntasOptimas, $seed);
    }
    
    // Mezclar aleatoriamente las preguntas generadas
    $preguntas = $preguntasData['preguntas'];
    shuffle($preguntas);
    
    // Retornar las preguntas disponibles (puede ser menos que lo solicitado)
    return array_slice($preguntas, 0, $preguntasOptimas);
}
function generarPreguntasIndividuales($documento, $cantidadPreguntas, $seed) {
    global $db;
    
    // Usar el nuevo generador de preguntas
    $questionGenerator = new QuestionGenerator($db);
    $preguntas = $questionGenerator->generateQuestionPool(
        $documento, 
        $cantidadPreguntas, 
        $seed
    );
    
    // Log para debugging
    error_log("✅ Generadas {$cantidadPreguntas} preguntas variadas");
    error_log("   Tipos: V/F, Múltiple, Completar, Abierta, Lista");
    
    return $preguntas;
}



function handleEvaluationConversation($db, $userId, $documentId, $sessionId, $question, $documento) {
    $activeEvaluation = getActiveEvaluation($db, $userId, $documentId, $sessionId);
    if (!$activeEvaluation) {
        return "No hay una evaluación activa. Usa 'Activar modo evaluación' para comenzar.";
    }
    
    $evaluationData = json_decode($activeEvaluation['detalle_respuestas'] ?? '{}', true);
    
    if (!isset($evaluationData['pool_preguntas']) || empty($evaluationData['pool_preguntas'])) {
        return "Error: No se encontraron preguntas para esta evaluación. Por favor reinicia la evaluación.";
    }
    
    $poolPreguntas = $evaluationData['pool_preguntas'];
    $preguntaActual = $evaluationData['pregunta_actual'] ?? 0;
    $respuestas = $evaluationData['respuestas'] ?? [];
    
    // Verificar si la evaluación está completa
    if ($preguntaActual >= count($poolPreguntas)) {
        return finalizarEvaluacionAleatoria($db, $activeEvaluation['id'], $activeEvaluation, $respuestas);
    }
    
    // Si es la primera interacción después de activar, mostrar primera pregunta
    if ($preguntaActual == 0 && (strpos(strtolower($question), 'preparado') !== false || 
                                  strpos(strtolower($question), 'listo') !== false || 
                                  strpos(strtolower($question), 'sí') !== false ||
                                  strpos(strtolower($question), 'comenzar') !== false)) {
        $config = getEvaluationConfig($db, $documentId);
return mostrarPreguntaActual($poolPreguntas, 0, count($poolPreguntas), $config);
    }
    
    // Si ya hay una pregunta activa, procesar respuesta
    if ($preguntaActual < count($poolPreguntas) && count($respuestas) == $preguntaActual) {
        return procesarRespuestaAleatoria($db, $activeEvaluation['id'], $question, $poolPreguntas[$preguntaActual], $preguntaActual, $evaluationData);
    }
    
    // Mostrar siguiente pregunta si ya respondió la actual
    if ($preguntaActual < count($poolPreguntas)) {
        return mostrarPreguntaActual($poolPreguntas, $preguntaActual, count($poolPreguntas));
    }
    
    return "Error en el flujo de evaluación.";
}

/*function mostrarPreguntaActual($poolPreguntas, $indice, $total) {
    $pregunta = $poolPreguntas[$indice];
    $numeroPregunta = $indice + 1;
    
    $texto = "**Pregunta {$numeroPregunta} de {$total}**\n\n";
    $texto .= $pregunta['pregunta'];
    
    // Agregar opciones si es selección múltiple
    if ($pregunta['tipo'] === 'seleccion_multiple' && isset($pregunta['opciones'])) {
        $texto .= "\n\n**Opciones:**\n";
        foreach ($pregunta['opciones'] as $index => $opcion) {
            $letra = chr(65 + $index); // A, B, C, D...
            $texto .= "{$letra}) {$opcion}\n";
        }
    }
    
    return $texto;
}*/

function mostrarPreguntaActual($poolPreguntas, $indice, $total, $config = null) {
    $pregunta = $poolPreguntas[$indice];
    $numeroPregunta = $indice + 1;
    
    // Obtener tiempo límite de la configuración
    $tiempoLimite = $config['tiempo_respuesta_segundos'] ?? 60;
    
    $texto = "**Pregunta {$numeroPregunta} de {$total}**\n\n";
    
    // ✅ NUEVO: Indicar tipo de pregunta
    $tiposPregunta = [
        'verdadero_falso' => '🔵 **VERDADERO o FALSO.**',
        'seleccion_multiple' => '🔷 **SELECCIÓN MÚLTIPLE.**',
        'completar' => '✏️ **COMPLETAR**.',
        'pregunta_abierta' => '📝 **PREGUNTA ABIERTA**.',
        'lista_enumerada' => '📋 **LISTA ENUMERADA**.'
    ];
    
    $tipoTexto = $tiposPregunta[$pregunta['tipo']] ?? '❓ **PREGUNTA**';
    $texto .= "{$tipoTexto}\n\n";
    
    $texto .= $pregunta['pregunta'];
    
    // ✅ CORREGIDO: Agregar opciones si es selección múltiple
    if ($pregunta['tipo'] === 'seleccion_multiple' && isset($pregunta['opciones'])) {
        $texto .= "\n\n**Opciones:**.\n";
        foreach ($pregunta['opciones'] as $index => $opcion) {
            // Manejar tanto formato array como string
            if (is_array($opcion)) {
                $letra = $opcion['letra'] ?? chr(65 + $index);
                $textoOpcion = $opcion['texto'] ?? '';
            } else {
                $letra = chr(65 + $index);
                $textoOpcion = $opcion;
            }
            $texto .= "{$letra}) {$textoOpcion}\n";
        }
    }
    
    // Agregar información del tiempo límite
    if ($tiempoLimite > 0) {
        $texto .= "\n\n⏰ **Tiempo para responder: {$tiempoLimite} segundos**";
        $texto .= "\nTómate tu tiempo para pensar bien la respuesta.";
    }
    
    return $texto;
}

function procesarRespuestaAleatoria($db, $evaluationId, $respuestaUsuario, $preguntaData, $indicePregunta, $evaluationData) {
     global $semanticEvaluator, $userData, $promptBuilder;

// Obtener configuración de evaluación para ponderaciones personalizadas
$config = getEvaluationConfig($db, $evaluationData['document_id'] ?? null);

// Evaluar la respuesta con puntuación parcial (puede ser decimal)
// Obtener nombre de usuario para evaluación personalizada
global $userData, $promptBuilder, $semanticEvaluator;
$userName = 'estudiante';
if (isset($userData) && isset($promptBuilder)) {
    $userName = $promptBuilder->getUserName($userData->id);
}

$puntuacionObtenida = evaluarRespuestaSegunTipo($preguntaData, $respuestaUsuario, $config, $semanticEvaluator, $userName);
    
    // Determinar si se considera "correcto" para efectos de conteo (>= 0.5)
    $esCorrecto = $puntuacionObtenida >= 0.5 ? 1 : 0;
    
    // Guardar respuesta con puntuación decimal
    $nuevaRespuesta = [
        'pregunta_id' => $preguntaData['id'],
        'pregunta' => $preguntaData['pregunta'],
        'respuesta_usuario' => $respuestaUsuario,
        'respuesta_correcta' => $preguntaData['respuesta_correcta'],
        'correcto' => $esCorrecto,
        'puntuacion_obtenida' => $puntuacionObtenida, // NUEVO CAMPO
        'justificacion' => $preguntaData['justificacion'] ?? '',
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    $evaluationData['respuestas'][] = $nuevaRespuesta;
    $evaluationData['pregunta_actual'] = $indicePregunta + 1;
    
    // Calcular puntuación total con decimales
    $puntuacionTotal = array_sum(array_column($evaluationData['respuestas'], 'puntuacion_obtenida'));
    $totalRespondidas = count($evaluationData['respuestas']);
    $porcentaje = ($puntuacionTotal / $totalRespondidas) * 100;
    
    // Contar correctas para compatibilidad (>= 0.5)
    $correctas = array_sum(array_column($evaluationData['respuestas'], 'correcto'));
    
    $stmt = $db->prepare("
        UPDATE doc_evaluacion_resultados 
        SET detalle_respuestas = ?, preguntas_correctas = ?, porcentaje_obtenido = ?
        WHERE id = ?
    ");
    $stmt->execute([
        json_encode($evaluationData),
        $correctas,
        round($porcentaje, 2), // Redondear a 2 decimales
        $evaluationId
    ]);
    
    // Verificar si es la última pregunta
    if ($evaluationData['pregunta_actual'] >= count($evaluationData['pool_preguntas'])) {
        return finalizarEvaluacionAleatoria($db, $evaluationId, [], $evaluationData['respuestas']);
    }
    
    // Mostrar siguiente pregunta
   $config = getEvaluationConfig($db, $evaluationData['document_id'] ?? null);
return mostrarPreguntaActual($evaluationData['pool_preguntas'], $evaluationData['pregunta_actual'], count($evaluationData['pool_preguntas']), $config);
}

function evaluarRespuestaSegunTipo($preguntaData, $respuestaUsuario, $config = null, $semanticEvaluator = null, $userName = 'estudiante') {
    // Si tenemos SemanticEvaluator, usarlo para evaluación conceptual
    if ($semanticEvaluator !== null) {
        $ponderacion = [
            'puntuacion_completa' => $config['puntuacion_respuesta_completa'] ?? 1.0,
            'puntuacion_parcial' => $config['puntuacion_respuesta_parcial'] ?? 0.8,
            'puntuacion_minima' => $config['puntuacion_respuesta_minima'] ?? 0.4,
            'umbral_parcial' => $config['umbral_respuesta_parcial'] ?? 0.3
        ];
        
        $resultado = $semanticEvaluator->evaluateAnswer(
            $preguntaData,
            $respuestaUsuario,
            $ponderacion,
            $userName
        );
        
        // Log para debugging
        error_log("📊 Evaluación Semántica - " . ($preguntaData['tipo'] ?? 'unknown'));
        error_log("  Nivel: " . $resultado['nivel'] . " | Puntaje: " . $resultado['puntaje']);
        
        return $resultado['puntaje'];
    }
    
    // FALLBACK: Evaluación simple original (si no hay SemanticEvaluator)
    $tipo = $preguntaData['tipo'];
    $respuestaCorrecta = strtolower(trim($preguntaData['respuesta_correcta']));
    $respuestaUsuarioLower = strtolower(trim($respuestaUsuario));
    
    switch ($tipo) {
        case 'verdadero_falso':
            return evaluarVerdaderoFalso($respuestaUsuarioLower, $respuestaCorrecta);
        
        case 'seleccion_multiple':
            return evaluarSeleccionMultiple($respuestaUsuarioLower, $respuestaCorrecta);
        
        case 'lista_enumerada':
            return evaluarListaEnumerada($respuestaUsuarioLower, $respuestaCorrecta);
        
        case 'pregunta_abierta':
        case 'completar':
        default:
            return evaluarRespuestaAbiertaSimple($respuestaUsuarioLower, $respuestaCorrecta, $config);
    }
}

function evaluarVerdaderoFalso($respuestaUsuario, $respuestaCorrecta) {
    // Palabras que indican "verdadero"
    $palabrasVerdadero = ['verdadero', 'cierto', 'correcto', 'sí', 'si', 'exacto', 'afirmativo', 'eso es correcto', 'es correcto'];
    
    // Palabras que indican "falso"  
    $palabrasFalso = ['falso', 'incorrecto', 'no', 'erróneo', 'equivocado', 'inexacto'];
    
    $esVerdadero = false;
    foreach ($palabrasVerdadero as $palabra) {
        if (strpos($respuestaUsuario, $palabra) !== false) {
            $esVerdadero = true;
            break;
        }
    }
    
    $esFalso = false;
    foreach ($palabrasFalso as $palabra) {
        if (strpos($respuestaUsuario, $palabra) !== false) {
            $esFalso = true;
            break;
        }
    }
    
    // Determinar puntuación
    if ($respuestaCorrecta === 'verdadero' && $esVerdadero && !$esFalso) {
        return 1.0; // Correcto completo
    } elseif ($respuestaCorrecta === 'falso' && $esFalso && !$esVerdadero) {
        return 1.0; // Correcto completo
    } else {
        return 0.0; // Incorrecto (en verdadero/falso no hay parciales)
    }
}


function evaluarSeleccionMultiple($respuestaUsuario, $respuestaCorrecta) {
    // Buscar letra o contenido de la opción correcta
    if (strpos($respuestaUsuario, $respuestaCorrecta) !== false) {
        return 1.0; // Correcto completo
    }
    
    // Si mencionó conceptos relacionados pero no la respuesta exacta
    $similitud = calcularSimilitudSimple($respuestaCorrecta, $respuestaUsuario);
    if ($similitud > 0.3) {
        return 0.8; // Respuesta parcial
    }
    
    return 0.0; // Incorrecto
}

function evaluarListaEnumerada($respuestaUsuario, $respuestaCorrecta) {
    // Extraer números mencionados en la respuesta del usuario
    preg_match_all('/\d+/', $respuestaUsuario, $numerosUsuario);
    preg_match_all('/\d+/', $respuestaCorrecta, $numerosCorrectos);
    
    if (empty($numerosCorrectos[0])) {
        // Si no hay números específicos, evaluar como respuesta abierta
        return evaluarRespuestaAbiertaSimple($respuestaUsuario, $respuestaCorrecta);
    }
    
    $numerosUsuarioArray = $numerosUsuario[0];
    $numerosCorrectosArray = $numerosCorrectos[0];
    
    $coincidencias = count(array_intersect($numerosUsuarioArray, $numerosCorrectosArray));
    $totalCorrectos = count($numerosCorrectosArray);
    
    if ($coincidencias == $totalCorrectos && count($numerosUsuarioArray) == $totalCorrectos) {
        return 1.0; // Correcto completo
    } elseif ($coincidencias > 0) {
        return 0.8; // Respuesta parcial
    }
    
    return 0.0; // Incorrecto
}

function evaluarRespuestaAbiertaSimple($respuestaUsuario, $respuestaCorrecta, $config = null) {
    // **USAR CONFIGURACIÓN PERSONALIZADA O VALORES POR DEFECTO**
    $puntuacionCompleta = $config['puntuacion_respuesta_completa'] ?? 1.00;
    $puntuacionParcial = $config['puntuacion_respuesta_parcial'] ?? 0.80;
    $puntuacionMinima = $config['puntuacion_respuesta_minima'] ?? 0.40;
    $umbralParcial = $config['umbral_respuesta_parcial'] ?? 0.30;
    
    // 1. Coincidencia perfecta
    if ($respuestaUsuario === $respuestaCorrecta) {
        return $puntuacionCompleta;
    }
    
    // 2. Calcular similitud
    $similitud = calcularSimilitudSimple($respuestaCorrecta, $respuestaUsuario);
    
    // 3. Clasificación con ponderaciones configurables
    if ($similitud >= 0.7) {
        return $puntuacionCompleta; // Muy buena respuesta
    } elseif ($similitud >= $umbralParcial) {
        return $puntuacionParcial; // Respuesta parcial (CONFIGURABLE)
    } elseif ($similitud >= 0.15) {
        return $puntuacionMinima; // Algo de conocimiento (CONFIGURABLE)
    }
    
    return 0.0; // Sin conocimiento relevante
}


function calcularSimilitudSimple($correcta, $usuario) {
    // Extraer palabras importantes (excluyendo conectores)
    $stopWords = [
        'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 
        'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'una', 'sus', 'más', 'muy', 'este', 
        'esta', 'estos', 'estas', 'como', 'pero', 'todo', 'bien', 'cada', 'hasta', 'donde', 'mientras'
    ];
    
    // Limpiar y dividir en palabras
    $palabrasCorrecta = array_filter(explode(' ', strtolower($correcta)), function($palabra) use ($stopWords) {
        $palabra = trim($palabra, '.,;:!?()[]');
        return strlen($palabra) > 2 && !in_array($palabra, $stopWords);
    });
    
    $palabrasUsuario = array_filter(explode(' ', strtolower($usuario)), function($palabra) use ($stopWords) {
        $palabra = trim($palabra, '.,;:!?()[]');
        return strlen($palabra) > 2 && !in_array($palabra, $stopWords);
    });
    
    if (empty($palabrasCorrecta)) return 0;
    
    // Contar coincidencias
    $coincidencias = 0;
    foreach ($palabrasCorrecta as $palabraCorrecta) {
        foreach ($palabrasUsuario as $palabraUsuario) {
            // Coincidencia exacta
            if ($palabraCorrecta === $palabraUsuario) {
                $coincidencias++;
                break;
            }
            // Coincidencia parcial (una palabra contiene a la otra)
            if (strpos($palabraUsuario, $palabraCorrecta) !== false || 
                strpos($palabraCorrecta, $palabraUsuario) !== false) {
                $coincidencias += 0.7; // Puntuación parcial por coincidencia parcial
                break;
            }
        }
    }
    
    // Calcular porcentaje de similitud
    return min(1.0, $coincidencias / count($palabrasCorrecta));
}


function finalizarEvaluacionAleatoria($db, $evaluationId, $evaluation, $respuestas) {

        // ✅ AGREGAR ESTAS LÍNEAS
    global $openai, $documentId;
    // Obtener datos actualizados
    $stmt = $db->prepare("SELECT * FROM doc_evaluacion_resultados WHERE id = ?");
    $stmt->execute([$evaluationId]);
    $evaluationData = $stmt->fetch(PDO::FETCH_ASSOC);

     // ✅ AGREGAR ESTA LÍNEA (para tener documentId disponible)
    $documentId = $evaluationData['document_id'];
    
    $porcentajeObtenido = $evaluationData['porcentaje_obtenido'];
    $porcentajeAprobacion = $evaluationData['porcentaje_aprobacion'];
    $aprobado = $porcentajeObtenido >= $porcentajeAprobacion;
    
    // Generar observaciones específicas basadas en las respuestas
    $observaciones = generarObservacionesDetalladas($respuestas, $porcentajeObtenido, $porcentajeAprobacion, $aprobado);
    
    // Actualizar registro final
    $stmt = $db->prepare("
        UPDATE doc_evaluacion_resultados 
        SET aprobado = ?, observaciones_ia = ?, fecha_finalizacion = NOW(),
            duracion_minutos = TIMESTAMPDIFF(MINUTE, fecha_inicio, NOW())
        WHERE id = ?
    ");
    $stmt->execute([$aprobado ? 1 : 0, $observaciones, $evaluationId]);
    
    // Cambiar modo de sesión de vuelta a consulta
    $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = 'consulta' WHERE id = ?");
    $stmt->execute([$evaluationData['session_id']]);
    
    return construirMensajeFinal($evaluationData, $observaciones, $aprobado, $db);
}



function analizarDetalleRespuestas($respuestas) {
    $totalPreguntas = count($respuestas);
    $respuestasCompletas = 0;
    $respuestasParciales = 0;
    $respuestasIncorrectas = 0;
    
    foreach ($respuestas as $respuesta) {
        $puntuacion = $respuesta['puntuacion_obtenida'] ?? ($respuesta['correcto'] ?? 0);
        
        if ($puntuacion >= 0.9) {
            $respuestasCompletas++;
        } elseif ($puntuacion >= 0.5) {
            $respuestasParciales++;
        } else {
            $respuestasIncorrectas++;
        }
    }
    
    return [
        'completas' => $respuestasCompletas,
        'parciales' => $respuestasParciales,
        'incorrectas' => $respuestasIncorrectas,
        'total' => $totalPreguntas
    ];
}

/**
 * Genera observaciones detalladas usando OpenAI para análisis profundo
 * Esta función actúa como un verdadero profesor evaluando el desempeño
 * 
 * @param array $respuestas Array con todas las respuestas del estudiante
 * @param float $porcentaje Porcentaje obtenido en la evaluación
 * @param float $porcentajeAprobacion Porcentaje mínimo para aprobar
 * @param bool $aprobado Si aprobó o no la evaluación
 * @param OpenAIService $openai Instancia del servicio OpenAI
 * @param int $documentId ID del documento para contexto adicional
 * @return string Observaciones detalladas generadas por IA
 */
function generarObservacionesDetalladasConIA($respuestas, $porcentaje, $porcentajeAprobacion, $aprobado, $openai, $documentId = null) {
    $analisis = analizarDetalleRespuestas($respuestas);
    
    // 1. CONSTRUIR PROMPT ESTRUCTURADO PARA LA IA
    $promptSistema = construirPromptSistemaEvaluacion();
    $promptUsuario = construirPromptUsuarioEvaluacion($respuestas, $porcentaje, $porcentajeAprobacion, $aprobado, $analisis);
    
    // 2. LLAMAR A OPENAI PARA GENERAR OBSERVACIONES DETALLADAS
    try {
        $messages = [
            ['role' => 'system', 'content' => $promptSistema],
            ['role' => 'user', 'content' => $promptUsuario]
        ];
        
        $response = $openai->chat($messages, [
            'model' => 'gpt-4o-mini',
            'temperature' => 0.7,
            'max_tokens' => 1500
        ]);
        
        if ($response && isset($response['choices'][0]['message']['content'])) {
            $observacionesIA = $response['choices'][0]['message']['content'];
            
            // Agregar estadísticas finales
            $observacionesIA .= "\n\n📊 **Detalle:** {$analisis['completas']} completas, {$analisis['parciales']} parciales, {$analisis['incorrectas']} incorrectas.";
            
            return $observacionesIA;
        }
        
    } catch (Exception $e) {
        error_log("❌ Error generando observaciones con IA: " . $e->getMessage());
        // Fallback a observaciones básicas
    }
    
    // 3. FALLBACK: Si falla OpenAI, usar observaciones mejoradas pero sin IA
    return generarObservacionesMejoradasSinIA($respuestas, $porcentaje, $porcentajeAprobacion, $aprobado, $analisis);
}

/**
 * Construye el prompt del sistema que define el rol de la IA
 */
function construirPromptSistemaEvaluacion() {
    return "Eres un profesor experto y empático evaluando el desempeño de un estudiante en una evaluación académica. 

Tu tarea es:
1. Analizar el desempeño general del estudiante
2. Identificar fortalezas específicas (preguntas que respondió bien)
3. Identificar debilidades específicas (preguntas que falló o respondió parcialmente)
4. Dar retroalimentación constructiva pregunta por pregunta
5. Sugerir áreas específicas de estudio para mejorar

FORMATO DE RESPUESTA:
- Usa emojis para hacer la retroalimentación más amigable (🎯, ✅, ⚠️, ❌, 📚, 💡)
- Sé específico: menciona qué conceptos faltan, qué se respondió bien, qué se puede mejorar
- Sé constructivo: siempre termina con recomendaciones prácticas
- Sé conciso pero completo: máximo 1200 caracteres

NO uses XML, HTML o markdown excesivo. Usa formato simple con saltos de línea y emojis.";
}

/**
 * Construye el prompt del usuario con toda la información de la evaluación
 */
function construirPromptUsuarioEvaluacion($respuestas, $porcentaje, $porcentajeAprobacion, $aprobado, $analisis) {
    $estadoTexto = $aprobado ? "APROBÓ" : "NO APROBÓ";
    
    $prompt = "INFORMACIÓN DE LA EVALUACIÓN:\n";
    $prompt .= "- Estado: {$estadoTexto}\n";
    $prompt .= "- Puntuación obtenida: " . number_format($porcentaje, 2) . "%\n";
    $prompt .= "- Puntuación requerida: " . number_format($porcentajeAprobacion, 2) . "%\n";
    $prompt .= "- Total preguntas: {$analisis['total']}\n";
    $prompt .= "- Respuestas completas: {$analisis['completas']}\n";
    $prompt .= "- Respuestas parciales: {$analisis['parciales']}\n";
    $prompt .= "- Respuestas incorrectas: {$analisis['incorrectas']}\n\n";
    
    $prompt .= "DETALLE DE CADA PREGUNTA:\n\n";
    
    $numeroPregunta = 1;
    foreach ($respuestas as $respuesta) {
        $puntuacion = $respuesta['puntuacion_obtenida'] ?? ($respuesta['correcto'] ?? 0);
        $nivelRespuesta = determinarNivelRespuesta($puntuacion);
        
        $prompt .= "Pregunta {$numeroPregunta}:\n";
        $prompt .= "Pregunta: \"{$respuesta['pregunta']}\"\n";
        $prompt .= "Respuesta del estudiante: \"{$respuesta['respuesta_usuario']}\"\n";
        $prompt .= "Respuesta correcta esperada: \"{$respuesta['respuesta_correcta']}\"\n";
        $prompt .= "Nivel: {$nivelRespuesta} (puntuación: " . number_format($puntuacion * 100, 1) . "%)\n";
        
        if (!empty($respuesta['justificacion'])) {
            $prompt .= "Explicación adicional: {$respuesta['justificacion']}\n";
        }
        
        $prompt .= "\n";
        $numeroPregunta++;
    }
    
    $prompt .= "\nGenera una retroalimentación detallada y constructiva que ayude al estudiante a mejorar.";
    
    return $prompt;
}

/**
 * Determina el nivel de la respuesta basado en la puntuación
 */
function determinarNivelRespuesta($puntuacion) {
    if ($puntuacion >= 0.9) {
        return "CORRECTA";
    } elseif ($puntuacion >= 0.7) {
        return "CASI CORRECTA";
    } elseif ($puntuacion >= 0.5) {
        return "PARCIALMENTE CORRECTA";
    } elseif ($puntuacion >= 0.3) {
        return "INCOMPLETA";
    } else {
        return "INCORRECTA";
    }
}

/**
 * Genera observaciones mejoradas sin IA (fallback)
 */
function generarObservacionesMejoradasSinIA($respuestas, $porcentaje, $porcentajeAprobacion, $aprobado, $analisis) {
    $observacion = "";
    
    // ANÁLISIS GENERAL
    $observacion .= "🎯 **ANÁLISIS DE TU DESEMPEÑO:**\n";
    
    if ($aprobado) {
        if ($porcentaje >= 90) {
            $observacion .= "¡Excelente! Has obtenido {$porcentaje}%. Demuestras dominio completo del contenido.\n\n";
        } elseif ($porcentaje >= 80) {
            $observacion .= "¡Muy bien! Has obtenido {$porcentaje}%. Comprendes claramente los conceptos principales.\n\n";
        } elseif ($porcentaje >= 70) {
            $observacion .= "¡Buen trabajo! Has obtenido {$porcentaje}%. Aprobaste satisfactoriamente.\n\n";
        } else {
            $observacion .= "Has aprobado con {$porcentaje}%, alcanzando el mínimo requerido ({$porcentajeAprobacion}%). Tu comprensión es básica pero hay conceptos importantes que necesitan fortalecimiento.\n\n";
        }
    } else {
        $diferencia = $porcentajeAprobacion - $porcentaje;
        if ($diferencia <= 10) {
            $observacion .= "Estuviste muy cerca de aprobar ({$porcentaje}% vs {$porcentajeAprobacion}% requerido). Tienes una buena base que necesita consolidarse.\n\n";
        } elseif ($porcentaje >= 30) {
            $observacion .= "Has obtenido {$porcentaje}%. Tienes conocimiento básico presente, pero se recomienda un repaso completo del contenido.\n\n";
        } else {
            $observacion .= "Has obtenido {$porcentaje}%. Necesitas estudio más profundo del material. Te recomendamos usar el modo mentor para preparación estructurada.\n\n";
        }
    }
    
    // FORTALEZAS Y DEBILIDADES
    $observacion .= identificarFortalezasYDebilidades($respuestas);
    
    // RECOMENDACIONES
    $observacion .= "\n💡 **RECOMENDACIONES:**\n";
    if (!$aprobado) {
        $observacion .= "• Repasa especialmente las preguntas que fallaste\n";
        $observacion .= "• Usa el modo mentor para reforzar conceptos\n";
        $observacion .= "• Tómate tu tiempo para comprender cada tema antes del próximo intento\n";
    } else if ($porcentaje < 80) {
        $observacion .= "• Considera repasar las áreas donde mostraste conocimiento parcial\n";
        $observacion .= "• Profundiza en los detalles de los conceptos principales\n";
    }
    
    return $observacion;
}

/**
 * Identifica fortalezas y debilidades específicas
 */
function identificarFortalezasYDebilidades($respuestas) {
    $texto = "";
    $fortalezas = [];
    $debilidades = [];
    $parciales = [];
    
    $numeroPregunta = 1;
    foreach ($respuestas as $respuesta) {
        $puntuacion = $respuesta['puntuacion_obtenida'] ?? ($respuesta['correcto'] ?? 0);
        
        if ($puntuacion >= 0.9) {
            $fortalezas[] = "Pregunta {$numeroPregunta}";
        } elseif ($puntuacion >= 0.5) {
            $parciales[] = [
                'numero' => $numeroPregunta,
                'pregunta' => $respuesta['pregunta'],
                'respuesta_usuario' => $respuesta['respuesta_usuario'],
                'respuesta_correcta' => $respuesta['respuesta_correcta']
            ];
        } else {
            $debilidades[] = [
                'numero' => $numeroPregunta,
                'pregunta' => $respuesta['pregunta'],
                'respuesta_usuario' => $respuesta['respuesta_usuario'],
                'respuesta_correcta' => $respuesta['respuesta_correcta']
            ];
        }
        
        $numeroPregunta++;
    }
    
    // FORTALEZAS
    if (count($fortalezas) > 0) {
        $texto .= "✅ **ÁREAS DONDE DESTACASTE:**\n";
        $texto .= "Respondiste correctamente: " . implode(", ", $fortalezas) . "\n\n";
    }
    
    // RESPUESTAS PARCIALES
    if (count($parciales) > 0) {
        $texto .= "⚠️ **RESPUESTAS PARCIALES:**\n";
        foreach ($parciales as $parcial) {
            $texto .= "• Pregunta {$parcial['numero']}: Tu respuesta estuvo cerca pero incompleta. ";
            $texto .= "Revisa el concepto para incluir todos los aspectos importantes.\n";
        }
        $texto .= "\n";
    }
    
    // DEBILIDADES
    if (count($debilidades) > 0) {
        $texto .= "❌ **PREGUNTAS QUE NECESITAS REPASAR:**\n";
        foreach ($debilidades as $debilidad) {
            $texto .= "• Pregunta {$debilidad['numero']}: \"{$debilidad['pregunta']}\"\n";
            $texto .= "  Tu respuesta: \"{$debilidad['respuesta_usuario']}\"\n";
            $texto .= "  📚 Repasa este concepto en el contenido del curso.\n\n";
        }
    }
    
    return $texto;
}

/**
 * Wrapper para mantener compatibilidad - ESTA FUNCIÓN REEMPLAZA LA ORIGINAL
 * Intenta usar IA, si falla usa el método mejorado sin IA
 */
function generarObservacionesDetalladas($respuestas, $porcentaje, $porcentajeAprobacion, $aprobado) {
    global $openai, $documentId;
    
    // Intentar usar IA si está disponible
    if (isset($openai) && $openai !== null) {
        return generarObservacionesDetalladasConIA(
            $respuestas, 
            $porcentaje, 
            $porcentajeAprobacion, 
            $aprobado, 
            $openai,
            $documentId ?? null
        );
    }
    
    // Fallback: observaciones mejoradas sin IA
    $analisis = analizarDetalleRespuestas($respuestas);
    return generarObservacionesMejoradasSinIA(
        $respuestas, 
        $porcentaje, 
        $porcentajeAprobacion, 
        $aprobado, 
        $analisis
    );
}

function generarObservacionesFinales($porcentaje, $porcentajeAprobacion, $aprobado) {
    if ($aprobado) {
        if ($porcentaje >= 90) {
            return "Excelente desempeño. El estudiante demuestra un dominio sólido del contenido con muy pocos errores. Conocimiento bien consolidado.";
        } elseif ($porcentaje >= 80) {
            return "Buen desempeño general. El estudiante comprende bien los conceptos principales, con algunos detalles menores a ajustar.";
        } elseif ($porcentaje >= 70) {
            return "Desempeño satisfactorio. Aprobó la evaluación, aunque sería beneficioso repasar algunos conceptos para fortalecer el conocimiento.";
        } else {
            return "Aprobó por el margen mínimo. Se recomienda enfáticamente repasar el contenido para consolidar mejor los conocimientos.";
        }
    } else {
        if ($porcentaje >= 50) {
            return "Estuvo cerca de aprobar. Tiene una base de conocimiento decente pero necesita repasar los conceptos clave antes del próximo intento.";
        } elseif ($porcentaje >= 30) {
            return "Conocimiento básico presente pero insuficiente. Se recomienda un repaso completo del contenido utilizando el modo mentor.";
        } else {
            return "Necesita un estudio más profundo del material. Se sugiere usar el modo mentor para un aprendizaje estructurado antes del próximo intento.";
        }
    }
}



function construirMensajeFinal($evaluationData, $observaciones, $aprobado, $db) {
    $estadoTexto = $aprobado ? " ¡APROBADO!" : " No aprobado";
    
    $mensaje = "**EVALUACIÓN COMPLETADA**\n\n";
    $mensaje .= "**Estado:** {$estadoTexto}\n";
    $mensaje .= "**Puntuación:** {$evaluationData['porcentaje_obtenido']}% (necesario: {$evaluationData['porcentaje_aprobacion']}%)\n";
    $mensaje .= "**Respuestas correctas:** {$evaluationData['preguntas_correctas']} de {$evaluationData['total_preguntas']}\n";
    $mensaje .= "**Intento número:** {$evaluationData['numero_intento']}\n\n.";
    $mensaje .= "**Observaciones del evaluador:**\n{$observaciones}\n\n";
    
    // Información sobre intentos restantes
    $config = getEvaluationConfig($db, $evaluationData['document_id']);
    $attempts = getEvaluationAttempts($db, $evaluationData['user_id'], $evaluationData['document_id']);
    $intentosRestantes = $config['max_intentos'] - $attempts['total_attempts'];
    
    // **DESPEDIDA Y OPCIONES MÁS NATURALES**
    $mensaje .= "---\n\n";
    
    if (!$aprobado && $intentosRestantes > 0) {
        $mensaje .= "** Próximos pasos:**\n";
        $mensaje .= "• Puedes **repetir esta evaluación** cuando te sientas preparado (te quedan {$intentosRestantes} intentos)\n";
        $mensaje .= "• Te recomiendo usar el **modo mentor** para repasar los temas antes del próximo intento\n";
        $mensaje .= "• Cada nuevo intento tendrá **preguntas aleatorias diferentes**\n\n";
    } elseif (!$aprobado) {
        $mensaje .= "** Contacto requerido:**\n";
        $mensaje .= "Has agotado todos los intentos permitidos. Te recomiendo contactar al instructor para opciones adicionales.\n\n.";
    } else {
        $mensaje .= "** ¡Felicidades por tu logro!**\n.";
        $mensaje .= "Has demostrado un buen dominio del material. Si deseas, puedes explorar más contenido o hacer consultas específicas.\n\n.";
    }
    
    $mensaje .= "** Cambio de modo**\n.";
    $mensaje .= "En unos momentos regresaremos automáticamente al **modo consulta** para que puedas hacer preguntas específicas sobre el contenido o explorar otros temas.\n\n";
    $mensaje .= "---\n\n";
    $mensaje .= "*Preparando modo consulta...*\n\n";
    $mensaje .= " **Modo consulta activado**\n\n";
    $mensaje .= "¿Hay algún tema específico que te gustaría profundizar o tienes alguna pregunta sobre el contenido?";
    
    return $mensaje;
}

function contarPreguntasHechas($detalleRespuestas) {
    if (!$detalleRespuestas) return 0;
    $detalle = json_decode($detalleRespuestas, true);
    return is_array($detalle) ? count($detalle) : 0;
}

// FUNCIÓN AUXILIAR PARA LLAMADAS A OPENAI (solo si no existe ya)
if (!function_exists('llamarOpenAI')) {
    function llamarOpenAI($systemPrompt, $userMessage) {
        $api_key = "sk-proj-tu-clave-aqui"; // USAR LA MISMA CLAVE QUE TIENES CONFIGURADA
        
        $data = [
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userMessage]
            ],
            'max_tokens' => 1000,
            'temperature' => 0.7
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://api.openai.com/v1/chat/completions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $api_key
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $decoded = json_decode($response, true);
        return $decoded['choices'][0]['message']['content'] ?? 'Error en la respuesta de IA';
    }
}


// Función para actualizar el modo de la sesión
function updateSessionMode($db, $sessionId, $modo) {
    error_log("🔄 Cambiando modo de sesión $sessionId a: $modo");
    
    // Actualizar modo de la sesión
    $stmt = $db->prepare("UPDATE doc_conversacion_sesiones SET modo = ? WHERE id = ?");
    $stmt->execute([$modo, $sessionId]);
    
    // 🆕 LIMPIAR CONTEXTO ANTERIOR al cambiar de modo
    // Marcar mensajes anteriores como "históricos" para que no se incluyan en nuevo contexto
    $stmt = $db->prepare("
        UPDATE doc_conversacion_mensajes 
        SET metadata = JSON_SET(
            COALESCE(metadata, '{}'), 
            '$.modo_previo', modo_activo,
            '$.contexto_cerrado', TRUE
        )
        WHERE session_id = ? 
        AND (metadata IS NULL OR JSON_EXTRACT(metadata, '$.contexto_cerrado') IS NULL)
    ");
    $stmt->execute([$sessionId]);
    
    error_log("🧹 Contexto anterior marcado como cerrado para nuevo modo: $modo");
}

// Función para obtener el modo actual de la sesión
function getModoActualSesion($db, $sessionId) {
    $stmt = $db->prepare("SELECT modo FROM doc_conversacion_sesiones WHERE id = ?");
    $stmt->execute([$sessionId]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return $session ? $session['modo'] : 'consulta';
}


// ✅ NUEVA FUNCIÓN: Obtener video por anexo_id
if (isset($_GET['action']) && $_GET['action'] === 'get_video_by_anexo' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $anexoId = $_GET['anexo_id'] ?? null;
    
    if ($anexoId) {
        $stmt = $db->prepare("SELECT id as video_id FROM doc_mentor_videos WHERE anexo_id = ?");
        $stmt->execute([$anexoId]);
        $video = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($video) {
            echo json_encode(['success' => true, 'video_id' => $video['video_id']]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Video no encontrado']);
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'anexo_id requerido']);
    }
    exit;
}



?>