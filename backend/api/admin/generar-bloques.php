<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/config.php';
require_once '../../config/db.php';
require_once '../../middleware/AuthMiddleware.php';
require_once '../../models/DocumentoBloque.php';

$userData = AuthMiddleware::requireAdmin();

$database = new Database();
$db = $database->getConnection();
$bloqueModel = new DocumentoBloque($db);

$method = $_SERVER['REQUEST_METHOD'];

// GET: Obtener bloques existentes + resumen de un documento
if ($method === 'GET') {
    $documentoId = intval($_GET['documento_id'] ?? 0);
    if (!$documentoId) {
        http_response_code(400);
        echo json_encode(['error' => 'documento_id requerido']);
        exit;
    }

    $bloques = $bloqueModel->getByDocumento($documentoId);

    // Obtener resumen
    $stmt = $db->prepare("SELECT resumen FROM documentos WHERE id = ?");
    $stmt->execute([$documentoId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'documento_id' => $documentoId,
        'resumen' => $doc['resumen'] ?? null,
        'bloques' => $bloques
    ]);
    exit;
}

// DELETE: Eliminar todos los bloques de un documento
if ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $documentoId = intval($input['documento_id'] ?? 0);
    if (!$documentoId) {
        http_response_code(400);
        echo json_encode(['error' => 'documento_id requerido']);
        exit;
    }

    $bloqueModel->deleteByDocumento($documentoId);

    // Limpiar resumen
    $stmt = $db->prepare("UPDATE documentos SET resumen = NULL WHERE id = ?");
    $stmt->execute([$documentoId]);

    echo json_encode(['success' => true, 'message' => 'Bloques y resumen eliminados']);
    exit;
}

// POST: Generar bloques automáticamente con GPT
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $documentoId = intval($input['documento_id'] ?? 0);

    if (!$documentoId) {
        http_response_code(400);
        echo json_encode(['error' => 'documento_id requerido']);
        exit;
    }

    // Obtener documento
    $stmt = $db->prepare("SELECT id, titulo, descripcion, contenido FROM documentos WHERE id = ?");
    $stmt->execute([$documentoId]);
    $doc = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$doc) {
        http_response_code(404);
        echo json_encode(['error' => 'Documento no encontrado']);
        exit;
    }

    $contenido = $doc['contenido'] ?? '';
    if (mb_strlen($contenido) < 500) {
        http_response_code(400);
        echo json_encode(['error' => 'El contenido es demasiado corto para dividir en bloques (mínimo 500 caracteres)']);
        exit;
    }

    // Eliminar bloques existentes
    $bloqueModel->deleteByDocumento($documentoId);

    // PASO 1: Pedir a GPT que identifique secciones del documento
    // Enviamos solo los primeros 30000 chars para análisis de estructura (+ primeras líneas de cada sección)
    $contenidoParaAnalisis = $contenido;
    if (mb_strlen($contenidoParaAnalisis) > 30000) {
        $contenidoParaAnalisis = mb_substr($contenidoParaAnalisis, 0, 30000) . "\n\n[... contenido continúa ...]";
    }

    $structurePrompt = "Analiza el siguiente documento educativo y divídelo en bloques temáticos lógicos. "
        . "Identifica las secciones principales basándote en capítulos, títulos, cambios de tema, etc.\n\n"
        . "Para cada bloque, proporciona:\n"
        . "- titulo: nombre descriptivo del bloque\n"
        . "- resumen: resumen de 1-2 oraciones del contenido del bloque\n"
        . "- texto_inicio: las primeras 5-10 palabras EXACTAS que inician esa sección en el documento original (para poder localizarla)\n"
        . "- texto_fin: las primeras 5-10 palabras EXACTAS que inician la SIGUIENTE sección (o 'FIN_DOCUMENTO' si es la última)\n\n"
        . "IMPORTANTE:\n"
        . "- Los textos de inicio/fin deben ser EXACTAMENTE como aparecen en el documento\n"
        . "- Intenta crear entre 3 y 15 bloques dependiendo del tamaño y estructura\n"
        . "- Cada bloque debe tener un tema coherente\n"
        . "- Responde SOLO con JSON válido, sin markdown ni explicaciones\n\n"
        . "Formato de respuesta:\n"
        . "{\"bloques\": [{\"titulo\": \"...\", \"resumen\": \"...\", \"texto_inicio\": \"...\", \"texto_fin\": \"...\"}]}";

    $gptPayload = json_encode([
        'model' => 'gpt-4o',
        'messages' => [
            ['role' => 'system', 'content' => $structurePrompt],
            ['role' => 'user', 'content' => "DOCUMENTO: {$doc['titulo']}\n\n{$contenidoParaAnalisis}"]
        ],
        'temperature' => 0.2,
        'max_tokens' => 4000,
        'response_format' => ['type' => 'json_object']
    ]);

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . OPENAI_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => $gptPayload,
        CURLOPT_TIMEOUT => 90
    ]);

    $gptResponse = curl_exec($ch);
    $gptHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($gptHttpCode !== 200) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error al analizar estructura con GPT',
            'details' => json_decode($gptResponse, true)
        ]);
        exit;
    }

    $gptData = json_decode($gptResponse, true);
    $structureJson = $gptData['choices'][0]['message']['content'] ?? '';
    $structure = json_decode($structureJson, true);

    if (!$structure || !isset($structure['bloques']) || count($structure['bloques']) === 0) {
        http_response_code(500);
        echo json_encode(['error' => 'GPT no pudo identificar bloques en el documento', 'raw' => $structureJson]);
        exit;
    }

    // PASO 2: Dividir contenido usando los marcadores de GPT
    $bloquesCreados = [];
    $bloquesDef = $structure['bloques'];

    for ($i = 0; $i < count($bloquesDef); $i++) {
        $def = $bloquesDef[$i];
        $textoInicio = $def['texto_inicio'] ?? '';
        $textoFin = ($i + 1 < count($bloquesDef)) ? ($bloquesDef[$i + 1]['texto_inicio'] ?? '') : '';

        // Encontrar posición de inicio
        $posInicio = 0;
        if ($textoInicio && $textoInicio !== 'FIN_DOCUMENTO') {
            $found = mb_strpos($contenido, $textoInicio);
            if ($found !== false) {
                $posInicio = $found;
            } else {
                // Intentar búsqueda parcial (primeras 3 palabras)
                $palabras = explode(' ', $textoInicio);
                $parcial = implode(' ', array_slice($palabras, 0, min(3, count($palabras))));
                $found = mb_strpos($contenido, $parcial);
                if ($found !== false) {
                    $posInicio = $found;
                }
            }
        }

        // Encontrar posición de fin
        $posFin = mb_strlen($contenido);
        if ($textoFin && $textoFin !== 'FIN_DOCUMENTO') {
            $found = mb_strpos($contenido, $textoFin, $posInicio + 1);
            if ($found !== false) {
                $posFin = $found;
            } else {
                $palabras = explode(' ', $textoFin);
                $parcial = implode(' ', array_slice($palabras, 0, min(3, count($palabras))));
                $found = mb_strpos($contenido, $parcial, $posInicio + 1);
                if ($found !== false) {
                    $posFin = $found;
                }
            }
        }

        $blockContent = mb_substr($contenido, $posInicio, $posFin - $posInicio);
        $blockContent = trim($blockContent);

        if (mb_strlen($blockContent) < 10) continue; // Skip empty blocks

        $charCount = mb_strlen($blockContent);
        $tokenEstimate = intval($charCount / 3.5);

        $bloqueModel->documento_id = $documentoId;
        $bloqueModel->orden = $i + 1;
        $bloqueModel->titulo = $def['titulo'] ?? "Bloque " . ($i + 1);
        $bloqueModel->resumen_bloque = $def['resumen'] ?? '';
        $bloqueModel->contenido = $blockContent;
        $bloqueModel->tokens_estimados = $tokenEstimate;
        $bloqueModel->create();

        $bloquesCreados[] = [
            'orden' => $i + 1,
            'titulo' => $def['titulo'],
            'resumen' => $def['resumen'] ?? '',
            'caracteres' => $charCount,
            'tokens_estimados' => $tokenEstimate
        ];
    }

    // PASO 3: Generar resumen ejecutivo
    $resumenInput = "DOCUMENTO: {$doc['titulo']}\n{$doc['descripcion']}\n\n";
    $resumenInput .= "BLOQUES IDENTIFICADOS:\n";
    foreach ($bloquesCreados as $b) {
        $resumenInput .= "- {$b['titulo']}: {$b['resumen']}\n";
    }
    // Agregar fragmento de contenido para contexto
    $resumenInput .= "\nCONTENIDO (fragmento):\n" . mb_substr($contenido, 0, 8000);

    $resumenPayload = json_encode([
        'model' => 'gpt-4o',
        'messages' => [
            ['role' => 'system', 'content' => "Genera un RESUMEN EJECUTIVO conciso (maximo 1500 palabras) de este documento educativo. El resumen sera usado como contexto en una sesion de voz con IA educativa. Incluye: de que trata, puntos clave de cada seccion, informacion critica para el estudiante. Escribe en espanol."],
            ['role' => 'user', 'content' => $resumenInput]
        ],
        'temperature' => 0.3,
        'max_tokens' => 2500
    ]);

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . OPENAI_API_KEY,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => $resumenPayload,
        CURLOPT_TIMEOUT => 60
    ]);

    $resumenResponse = curl_exec($ch);
    $resumenHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resumen = '';
    if ($resumenHttpCode === 200) {
        $resumenData = json_decode($resumenResponse, true);
        $resumen = $resumenData['choices'][0]['message']['content'] ?? '';
    }

    // Guardar resumen
    if ($resumen) {
        $stmt = $db->prepare("UPDATE documentos SET resumen = ? WHERE id = ?");
        $stmt->execute([$resumen, $documentoId]);
    }

    // Retornar resultado
    $totalTokens = array_sum(array_column($bloquesCreados, 'tokens_estimados'));

    echo json_encode([
        'success' => true,
        'documento_id' => $documentoId,
        'bloques_creados' => count($bloquesCreados),
        'total_tokens' => $totalTokens,
        'resumen_generado' => !empty($resumen),
        'resumen' => $resumen,
        'bloques' => $bloquesCreados
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
?>
