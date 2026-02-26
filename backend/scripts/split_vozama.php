<?php
/**
 * Script para dividir el documento VOZAMA (ID 19) en bloques temáticos
 * y generar un resumen ejecutivo con GPT.
 *
 * Uso: php scripts/split_vozama.php
 *
 * Este script sirve como MODELO para la creación de bloques en otros documentos.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../models/DocumentoBloque.php';

$database = new Database();
$db = $database->getConnection();

$DOCUMENTO_ID = 19;

// 1. Leer contenido del documento
$stmt = $db->prepare("SELECT id, titulo, contenido FROM documentos WHERE id = ?");
$stmt->execute([$DOCUMENTO_ID]);
$doc = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$doc) {
    die("Documento ID {$DOCUMENTO_ID} no encontrado\n");
}

$contenido = $doc['contenido'];
$lines = explode("\n", $contenido);
$totalLines = count($lines);
echo "Documento: {$doc['titulo']}\n";
echo "Total caracteres: " . mb_strlen($contenido) . "\n";
echo "Total líneas: {$totalLines}\n\n";

// 2. Definir bloques temáticos por líneas
$bloquesDef = [
    [
        'titulo' => 'Introducción y Glosario Parcial',
        'resumen' => 'Información general del documento VOZAMA (Manual de Capacitación), instrucciones de uso y glosario parcial de términos médicos gastroenterológicos.',
        'start_line' => 1,
        'end_marker' => 'CAPITULO 1'
    ],
    [
        'titulo' => 'Capítulo 1: Fisiopatología de la Digestión',
        'resumen' => 'Anatomía y fisiología del sistema digestivo: boca, faringe, esófago, estómago (anatomía, histología, glándulas gástricas), intestino delgado y grueso. Tipos celulares, hormonas digestivas y procesos de digestión mecánica y química.',
        'start_marker' => 'CAPITULO 1',
        'end_marker' => 'CAPITULO 2'
    ],
    [
        'titulo' => 'Capítulo 2: Secreción del Ácido Gástrico',
        'resumen' => 'Estructura de la célula parietal, mecanismo de la bomba de protones (H+/K+ ATPasa), tres estímulos principales de secreción ácida (histamina, gastrina, acetilcolina), mecanismo intracelular de producción de HCl, fases cefálica, gástrica e intestinal.',
        'start_marker' => 'CAPITULO 2',
        'end_marker' => 'CAPITULO 3'
    ],
    [
        'titulo' => 'Capítulo 3: Enfermedad Ácido Péptica',
        'resumen' => 'Enfermedad ulcerosa (gástrica, duodenal, esofágica), epidemiología, etiología (H. pylori, AINEs), fisiopatología, diagnóstico, tratamiento (antiácidos, anti-H2, IBPs, sucralfato, bismuto). ERGE: síntomas, diagnóstico, tratamiento, esófago de Barrett. Gastritis aguda y crónica. Síndrome de Zollinger-Ellison.',
        'start_marker' => 'CAPITULO 3',
        'end_marker' => 'CAPITULO 4'
    ],
    [
        'titulo' => 'Capítulo 4: Producto VOZAMA - Monografía del Fármaco',
        'resumen' => 'Monografía completa de VOZAMA (Vonoprazan 10mg/20mg): formulaciones, principio activo (vonoprazan fumarato), clasificación ATC, indicaciones (úlcera gástrica/duodenal, esofagitis erosiva, prevención con AINEs, erradicación H. pylori), mecanismo P-CAB, farmacocinética (Tmax 1.5h, T½ ~7h), dosificación, contraindicaciones, interacciones.',
        'start_marker' => 'CAPITULO 4',
        'end_marker_pattern' => '/^CAPITULOS?\s*$/i'
    ],
    [
        'titulo' => 'Capítulo 5: Monografía para Médicos',
        'resumen' => 'Monografía orientada a médicos: mecanismo de vonoprazan, farmacocinética, estudios clínicos comparativos, datos de eficacia (esofagitis 92% vs 85% IBPs, úlcera péptica 89% vs 82%, ERGE 78% vs 64%, erradicación H. pylori 90% vs 85%), referencias bibliográficas.',
        'start_marker_pattern' => '/^CAPITULOS?\s*$/i',
        'end_marker' => 'PALABRAS QUE DEFINEN EL PRODUCTO'
    ],
    [
        'titulo' => 'Palabras Clave del Producto',
        'resumen' => 'Palabras de marketing que definen VOZAMA: Innovador, Único, Efectivo, Rápido, Potente, y sus definiciones para la fuerza de ventas.',
        'start_marker' => 'PALABRAS QUE DEFINEN EL PRODUCTO',
        'end_marker' => 'GLOSARIO'
    ],
    [
        'titulo' => 'Glosario Médico Completo',
        'resumen' => 'Glosario extenso de términos médicos gastroenterológicos: desde Acalasia hasta Zollinger-Ellison, con definiciones claras para cada término técnico utilizado en el manual.',
        'start_marker' => 'GLOSARIO',
        'end_marker' => 'BASE DE POSIBLES PREGUNTAS'
    ],
    [
        'titulo' => 'Base de Preguntas de Entrenamiento',
        'resumen' => 'Banco de ~120 preguntas para evaluación del estudiante, organizadas por capítulo: fisiopatología digestiva, secreción ácida, enfermedad ácido péptica, producto VOZAMA, y temas clínicos avanzados.',
        'start_marker' => 'BASE DE POSIBLES PREGUNTAS',
        'end_marker' => 'Potassium'
    ],
    [
        'titulo' => 'Artículo Científico: P-CABs - Uso Clínico y Desarrollos Futuros',
        'resumen' => 'Artículo de revisión científica (Scarpignato & Hunt, 2024): farmacología, estudios clínicos y perspectivas de los cuatro P-CABs disponibles (vonoprazan, tegoprazan, fexuprazan, keverprazan). Comparativas con IBPs en ERGE y erradicación de H. pylori.',
        'start_marker' => 'Potassium',
        'end_line' => $totalLines
    ]
];

// 3. Funciones auxiliares
function findLine($lines, $marker, $startFrom = 0) {
    for ($i = $startFrom; $i < count($lines); $i++) {
        if (stripos(trim($lines[$i]), $marker) !== false) {
            return $i;
        }
    }
    return -1;
}

function findLineByPattern($lines, $pattern, $startFrom = 0) {
    for ($i = $startFrom; $i < count($lines); $i++) {
        if (preg_match($pattern, trim($lines[$i]))) {
            return $i;
        }
    }
    return -1;
}

// 4. Procesar y extraer bloques
$bloqueModel = new DocumentoBloque($db);
$bloqueModel->deleteByDocumento($DOCUMENTO_ID);
echo "Bloques anteriores eliminados.\n\n";

$lastEndLine = 0;

foreach ($bloquesDef as $orden => $def) {
    if (isset($def['start_line'])) {
        $startLine = $def['start_line'] - 1;
    } elseif (isset($def['start_marker'])) {
        $startLine = findLine($lines, $def['start_marker'], $lastEndLine);
    } elseif (isset($def['start_marker_pattern'])) {
        $startLine = findLineByPattern($lines, $def['start_marker_pattern'], $lastEndLine);
    } else {
        $startLine = $lastEndLine;
    }

    if (isset($def['end_line'])) {
        $endLine = $def['end_line'] - 1;
    } elseif (isset($def['end_marker'])) {
        $endLine = findLine($lines, $def['end_marker'], $startLine + 1);
        if ($endLine === -1) $endLine = $totalLines - 1;
    } elseif (isset($def['end_marker_pattern'])) {
        $endLine = findLineByPattern($lines, $def['end_marker_pattern'], $startLine + 1);
        if ($endLine === -1) $endLine = $totalLines - 1;
    } else {
        $endLine = $totalLines - 1;
    }

    $blockLines = array_slice($lines, $startLine, $endLine - $startLine);
    $blockContent = implode("\n", $blockLines);
    $charCount = mb_strlen($blockContent);
    $tokenEstimate = intval($charCount / 3.5);

    echo "Bloque " . ($orden + 1) . ": {$def['titulo']}\n";
    echo "  Líneas: " . ($startLine + 1) . " - {$endLine}\n";
    echo "  Caracteres: {$charCount}\n";
    echo "  Tokens estimados: {$tokenEstimate}\n\n";

    $bloqueModel->documento_id = $DOCUMENTO_ID;
    $bloqueModel->orden = $orden + 1;
    $bloqueModel->titulo = $def['titulo'];
    $bloqueModel->resumen_bloque = $def['resumen'];
    $bloqueModel->contenido = $blockContent;
    $bloqueModel->tokens_estimados = $tokenEstimate;
    $bloqueModel->create();

    $lastEndLine = $endLine;
}

echo "=== Bloques creados exitosamente ===\n\n";

// 5. Verificar bloques
$bloques = $bloqueModel->getByDocumento($DOCUMENTO_ID);
echo "Bloques en DB:\n";
$totalTokens = 0;
foreach ($bloques as $b) {
    echo "  #{$b['orden']} [{$b['id']}] {$b['titulo']} (~{$b['tokens_estimados']} tokens)\n";
    $totalTokens += $b['tokens_estimados'];
}
echo "\nTotal tokens estimados: {$totalTokens}\n";

// 6. Generar resumen ejecutivo con GPT
echo "\n=== Generando resumen ejecutivo con GPT ===\n";

$resumenPrompt = "Eres un asistente educativo médico. Genera un RESUMEN EJECUTIVO conciso (máximo 2000 palabras) del siguiente manual de capacitación farmacéutica. El resumen debe cubrir:\n\n"
    . "1. De qué trata el manual (producto VOZAMA/Vonoprazan)\n"
    . "2. Resumen de cada capítulo (1-2 párrafos cada uno)\n"
    . "3. Puntos clave del producto (mecanismo, indicaciones, ventajas vs IBPs)\n"
    . "4. Información que un estudiante necesita saber para aprobar la evaluación\n\n"
    . "El resumen será usado como contexto general en una sesión de voz con IA. Escribe en español.\n\n"
    . "CONTENIDO DEL MANUAL:\n\n";

$resumenInput = "MANUAL DE CAPACITACIÓN VOZAMA\n\n";
foreach ($bloquesDef as $def) {
    $resumenInput .= "=== {$def['titulo']} ===\n{$def['resumen']}\n\n";
}

$cap4Start = findLine($lines, 'CAPITULO 4');
$cap5Start = findLineByPattern($lines, '/^CAPITULOS?\s*$/i', $cap4Start + 1);
if ($cap4Start !== -1 && $cap5Start !== -1) {
    $cap4Content = implode("\n", array_slice($lines, $cap4Start, min(200, $cap5Start - $cap4Start)));
    if (mb_strlen($cap4Content) > 15000) {
        $cap4Content = mb_substr($cap4Content, 0, 15000);
    }
    $resumenInput .= "=== DETALLE DEL PRODUCTO (Capítulo 4 - Fragmento) ===\n{$cap4Content}\n";
}

$gptPayload = json_encode([
    'model' => 'gpt-4o',
    'messages' => [
        ['role' => 'system', 'content' => $resumenPrompt],
        ['role' => 'user', 'content' => $resumenInput]
    ],
    'temperature' => 0.3,
    'max_tokens' => 3000
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
    CURLOPT_TIMEOUT => 60
]);

$gptResponse = curl_exec($ch);
$gptHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($gptHttpCode !== 200) {
    echo "Error GPT ({$gptHttpCode}): {$gptResponse}\n";
    echo "Creando resumen manual como fallback...\n";

    $resumen = "RESUMEN EJECUTIVO - VOZAMA (Vonoprazan)\n\n";
    $resumen .= "Este es el Manual de Capacitación de VOZAMA, el primer y único Bloqueador de Ácido Competitivo con Potasio (P-CAB) del mercado paraguayo, fabricado por Farmacéutica Paraguaya S.A.\n\n";
    foreach ($bloquesDef as $def) {
        $resumen .= "• {$def['titulo']}: {$def['resumen']}\n\n";
    }
} else {
    $gptData = json_decode($gptResponse, true);
    $resumen = $gptData['choices'][0]['message']['content'] ?? '';
    echo "Resumen generado exitosamente (" . mb_strlen($resumen) . " chars)\n";
}

// 7. Guardar resumen en documentos.resumen
$updateStmt = $db->prepare("UPDATE documentos SET resumen = ? WHERE id = ?");
$updateStmt->execute([$resumen, $DOCUMENTO_ID]);
echo "Resumen guardado en documentos.resumen\n";

// 8. Mostrar resumen
echo "\n=== RESUMEN EJECUTIVO ===\n";
echo mb_substr($resumen, 0, 2000) . "\n";
if (mb_strlen($resumen) > 2000) echo "... (truncado en pantalla)\n";

echo "\n=== PROCESO COMPLETADO ===\n";
echo "Documento VOZAMA (ID {$DOCUMENTO_ID}) reestructurado en " . count($bloquesDef) . " bloques temáticos.\n";
echo "Este formato sirve como MODELO para la creación de bloques en otros documentos.\n";
