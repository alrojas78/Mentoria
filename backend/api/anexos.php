<?php
// =====================================================
// API: Gestión de Anexos Multimedia
// =====================================================

// Headers CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Responder a preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos necesarios
include_once '../config/config.php';
include_once '../config/db.php';
include_once '../models/Anexo.php';
include_once '../utils/AttachmentService.php';
include_once '../utils/jwt.php';

// Crear conexiones
$database = new Database();
$db = $database->getConnection();
$anexo = new Anexo($db);
$attachmentService = new AttachmentService();
$jwt = new JWTUtil();

// Verificar autenticación (opcional para desarrollo)
$skipAuth = true; // Cambiar a true para omitir autenticación durante desarrollo

if (!$skipAuth) {
    $headers = getallheaders();
    $token = isset($headers['Authorization']) ? str_replace('Bearer ', '', $headers['Authorization']) : '';

    $userData = $jwt->validate($token);
    if (!$userData) {
        http_response_code(401);
        echo json_encode(["message" => "No autorizado"]);
        exit();
    }
}

// Determinar acción según método HTTP
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            handleGet();
            break;
        case 'POST':
            handlePost();
            break;
        case 'PUT':
            handlePut();
            break;
        case 'DELETE':
            handleDelete();
            break;
        default:
            http_response_code(405);
            echo json_encode(["message" => "Método no permitido"]);
    }
} catch (Exception $e) {
    error_log("Error en anexos.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "message" => "Error interno del servidor",
        "error" => $e->getMessage()
    ]);
}

// =====================================================
// FUNCIONES DE MANEJO DE PETICIONES
// =====================================================

function handleGet() {
    global $anexo, $attachmentService, $action;

    switch ($action) {
        case 'by_document':
            getAnexosByDocument();
            break;
        case 'by_id':
            getAnexoById();
            break;
        case 'search':
            searchAnexos();
            break;
        case 'stats':
            getStorageStats();
            break;
        case 'download':
            downloadFile();
            break;
        default:
            http_response_code(400);
            echo json_encode(["message" => "Acción no especificada"]);
    }
}

function handlePost() {
    global $attachmentService, $anexo, $action;

    switch ($action) {
        case 'upload':
            uploadFile();
            break;
        case 'cleanup':
            cleanupFiles();
            break;
        default:
            http_response_code(400);
            echo json_encode(["message" => "Acción no especificada para POST"]);
    }
}

function handlePut() {
    global $anexo;
    updateAnexo();
}

function handleDelete() {
    global $anexo, $attachmentService;
    deleteAnexo();
}

// =====================================================
// IMPLEMENTACIÓN DE FUNCIONES
// =====================================================

function getAnexosByDocument() {
    global $anexo;

    $documentId = $_GET['document_id'] ?? null;
    if (!$documentId) {
        http_response_code(400);
        echo json_encode(["message" => "Se requiere document_id"]);
        return;
    }

    $activeOnly = isset($_GET['active_only']) ? filter_var($_GET['active_only'], FILTER_VALIDATE_BOOLEAN) : true;
    
    $anexos = $anexo->getByDocument($documentId, $activeOnly);
    
    // Agregar URLs públicas
    foreach ($anexos as &$anexoItem) {
        $anexoItem['public_url'] = AttachmentConfig::getPublicUrl($anexoItem['filename']);
        if ($anexoItem['thumbnail_path']) {
            $anexoItem['thumbnail_url'] = AttachmentConfig::getPublicUrl($anexoItem['thumbnail_path'], true);
        }
        
        // Decodificar metadata si existe
        if ($anexoItem['metadata']) {
            $anexoItem['metadata'] = json_decode($anexoItem['metadata'], true);
        }
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $anexos,
        "total" => count($anexos)
    ]);
}

function getAnexoById() {
    global $anexo;

    $id = $_GET['id'] ?? null;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Se requiere ID"]);
        return;
    }

    $anexo->id = $id;
    if ($anexo->readOne()) {
        $anexoData = [
            'id' => $anexo->id,
            'document_id' => $anexo->document_id,
            'filename' => $anexo->filename,
            'original_name' => $anexo->original_name,
            'file_type' => $anexo->file_type,
            'mime_type' => $anexo->mime_type,
            'file_size_bytes' => $anexo->file_size_bytes,
            'titulo' => $anexo->titulo,
            'descripcion' => $anexo->descripcion,
            'keywords' => $anexo->keywords,
            'is_active' => $anexo->is_active,
            'orden' => $anexo->orden,
            'metadata' => json_decode($anexo->metadata, true),
            'created_at' => $anexo->created_at,
            'updated_at' => $anexo->updated_at,
            'public_url' => AttachmentConfig::getPublicUrl($anexo->filename)
        ];

        if ($anexo->thumbnail_path) {
            $anexoData['thumbnail_url'] = AttachmentConfig::getPublicUrl($anexo->thumbnail_path, true);
        }

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "data" => $anexoData
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Anexo no encontrado"]);
    }
}

function searchAnexos() {
    global $anexo;

    $documentId = $_GET['document_id'] ?? null;
    $keywords = $_GET['keywords'] ?? '';

    if (!$documentId || !$keywords) {
        http_response_code(400);
        echo json_encode(["message" => "Se requieren document_id y keywords"]);
        return;
    }

    $anexos = $anexo->searchByKeywords($documentId, $keywords);

    // Agregar URLs públicas
    foreach ($anexos as &$anexoItem) {
        $anexoItem['public_url'] = AttachmentConfig::getPublicUrl($anexoItem['filename']);
        if ($anexoItem['thumbnail_path']) {
            $anexoItem['thumbnail_url'] = AttachmentConfig::getPublicUrl($anexoItem['thumbnail_path'], true);
        }
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $anexos,
        "total" => count($anexos),
        "search_term" => $keywords
    ]);
}

function uploadFile() {
    global $attachmentService, $anexo, $db; // Añadido $db para acceder a la conexión

// Verificar si es un video de Vimeo (anexo virtual) o archivo real
$esVideoVimeo = false;
$descripcion = $_POST['descripcion'] ?? '';

if (strpos($descripcion, 'vimeo.com') !== false || strpos($descripcion, 'player.vimeo.com') !== false) {
    $esVideoVimeo = true;
}

if (!$esVideoVimeo && (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "No se subió ningún archivo o falta enlace de Vimeo"
    ]);
    return;
}

    // Obtener datos del formulario
    $documentId = $_POST['document_id'] ?? null;
    $titulo = $_POST['titulo'] ?? '';
    $descripcion = $_POST['descripcion'] ?? '';
    $keywords = $_POST['keywords'] ?? '';
    $transcripcion = $_POST['transcripcion'] ?? '';

    if (!$documentId || !$titulo) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Se requieren document_id y titulo"
        ]);
        return;
    }

    // Procesar subida
if ($esVideoVimeo) {
    // BYPASS COMPLETO PARA VIDEOS DE VIMEO
    // Crear datos directamente sin pasar por AttachmentService
    $anexoData = [
        'document_id' => $documentId,
        'filename' => 'vimeo_' . time() . '.mp4',
        'original_name' => $titulo . '.mp4',
        'file_type' => 'video',
        'mime_type' => 'video/mp4',
        'file_size_bytes' => 0,
        'thumbnail_path' => null,
        'is_active' => 1,
        'titulo' => $titulo,
        'descripcion' => $descripcion,
        'keywords' => $keywords,
        'orden' => 0 
    ];
    
    // Preparar metadata con transcripción
    $metadata = [];
    if (!empty($transcripcion)) {
        $metadata['transcripcion'] = $transcripcion;
    }
    $anexoData['metadata'] = json_encode($metadata);
    
    $result = ['success' => true, 'anexo_data' => $anexoData];
    
} else {
    // PROCESO NORMAL PARA ARCHIVOS REALES
    $result = $attachmentService->processUpload($_FILES['file'], $documentId, $titulo, $descripcion, $keywords);
    
    if (!$result['success']) {
        http_response_code(400);
        echo json_encode($result);
        return;
    }
    
    // Agregar transcripción a archivos normales si existe
    $anexoData = $result['anexo_data'];
    if (!empty($transcripcion)) {
        $metadata = [];
        $metadata['transcripcion'] = $transcripcion;
        $anexoData['metadata'] = json_encode($metadata);
    }
}

// Continuar con el guardado en BD (común para ambos casos)
foreach ($anexoData as $key => $value) {
    $anexo->$key = $value;
}

if ($anexo->create()) {
    // --- INICIO: FASE 6.2 ---
    // NUEVO: Si es un video, verificar si es parte de un programa mentor
    if ($anexoData['file_type'] === 'video') {
        $deteccion = Anexo::isVideoPrograma($anexoData['titulo']);
        
        if ($deteccion['es_video_programa']) {
            // Registrar como video de programa mentor
            $videoMentorStmt = $db->prepare("
                INSERT INTO doc_mentor_videos 
                (document_id, anexo_id, modulo_numero, leccion_numero, titulo_completo, vimeo_id, hash_privacidad, transcripcion, orden_secuencial)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            // EXTRAER TANTO ID COMO HASH
            $vimeoId = extraerVimeoIdDeDescripcion($anexoData['descripcion']);
            $hashPrivacidad = extraerHashPrivacidadVimeo($anexoData['descripcion']);
            $transcripcionVideo = $transcripcion ?? null; // Usar la transcripción del formulario
            $ordenSecuencial = ($deteccion['modulo'] * 100) + $deteccion['leccion'];

            $videoMentorStmt->execute([
                $documentId,
                $anexo->id,
                $deteccion['modulo'],
                $deteccion['leccion'],
                $anexoData['titulo'],
                $vimeoId,
                $hashPrivacidad,
                $transcripcionVideo,
                $ordenSecuencial
            ]);
                
                // Invalidar caché de estructura mentor para forzar su regeneración
                $cacheStmt = $db->prepare("
                    UPDATE doc_mentor_progreso 
                    SET estructura_contenido = NULL 
                    WHERE document_id = ?
                ");
                $cacheStmt->execute([$documentId]);
            }
        }
        
        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Archivo subido exitosamente",
            "video_programa_detectado" => isset($deteccion) ? $deteccion['es_video_programa'] : false, // Informa al frontend si se detectó
            "data" => [
                "id" => $anexo->id,
                "filename" => $anexoData['filename'],
                "original_name" => $anexoData['original_name'],
                "file_type" => $anexoData['file_type'],
                "file_size" => $anexoData['file_size_bytes'],
                "public_url" => AttachmentConfig::getPublicUrl($anexoData['filename']),
                "thumbnail_url" => $anexoData['thumbnail_path'] ? 
                    AttachmentConfig::getPublicUrl($anexoData['thumbnail_path'], true) : null
            ]
        ]);
        // --- FIN: FASE 6.2 ---
    } else {
        // Si falló la BD, eliminar archivo físico
        $attachmentService->deleteFiles($anexoData['filename'], $anexoData['thumbnail_path']);
       
       http_response_code(500);
       echo json_encode([
           "success" => false,
           "message" => "Error al guardar en base de datos"
       ]);
   }
}

function extraerVimeoIdDeDescripcion($descripcion) {
    error_log("🎥 DEBUG: Descripción recibida: " . $descripcion);
    
    $patrones = [
        '/player\.vimeo\.com\/video\/(\d+)\?h=[\w\d]+/',
        '/player\.vimeo\.com\/video\/(\d+)/',
        '/vimeo\.com\/video\/(\d+)\?h=[\w\d]+/',
        '/vimeo\.com\/video\/(\d+)/',
        '/vimeo\.com\/(\d+)\?h=[\w\d]+/',
        '/vimeo\.com\/(\d+)/',
        '/(\d{8,12})/'
    ];
    
    foreach ($patrones as $patron) {
        if (preg_match($patron, $descripcion, $matches)) {
            error_log("🎯 DEBUG: ID extraído: " . $matches[1]);
            return $matches[1];
        }
    }
    
    error_log("❌ DEBUG: No se encontró ID en: " . $descripcion);
    return null;
}

// NUEVA FUNCIÓN para extraer hash de privacidad
function extraerHashPrivacidadVimeo($descripcion) {
    error_log("🔐 DEBUG: Buscando hash en: " . $descripcion);
    
    $patrones = [
        '/\?h=([\w\d]+)/',  // Busca ?h=HASH
        '/&h=([\w\d]+)/'    // Busca &h=HASH
    ];
    
    foreach ($patrones as $patron) {
        if (preg_match($patron, $descripcion, $matches)) {
            error_log("🔑 DEBUG: Hash encontrado: " . $matches[1]);
            return $matches[1];
        }
    }
    
    error_log("⚠️ DEBUG: No se encontró hash en: " . $descripcion);
    return null;
}



// --- FIN: FASE 6.2 ---

function updateAnexo() {
   global $anexo;

   $data = json_decode(file_get_contents("php://input"), true);

   if (!$data || !isset($data['id'])) {
       http_response_code(400);
       echo json_encode(["message" => "Se requiere ID para actualizar"]);
       return;
   }

   $anexo->id = $data['id'];
   
   // Verificar que el anexo existe
   if (!$anexo->readOne()) {
       http_response_code(404);
       echo json_encode(["message" => "Anexo no encontrado"]);
       return;
   }

   // Actualizar campos permitidos
   if (isset($data['titulo'])) $anexo->titulo = $data['titulo'];
   if (isset($data['descripcion'])) $anexo->descripcion = $data['descripcion'];
   if (isset($data['keywords'])) $anexo->keywords = $data['keywords'];
   if (isset($data['is_active'])) $anexo->is_active = $data['is_active'];
   if (isset($data['orden'])) $anexo->orden = $data['orden'];
   if (isset($data['metadata'])) $anexo->metadata = json_encode($data['metadata']);

   if ($anexo->update()) {
       http_response_code(200);
       echo json_encode([
           "success" => true,
           "message" => "Anexo actualizado exitosamente"
       ]);
   } else {
       http_response_code(500);
       echo json_encode([
           "success" => false,
           "message" => "Error al actualizar anexo"
       ]);
   }
}

function deleteAnexo() {
   global $anexo, $attachmentService;

   $id = $_GET['id'] ?? null;
   $hardDelete = isset($_GET['hard']) ? filter_var($_GET['hard'], FILTER_VALIDATE_BOOLEAN) : false;

   if (!$id) {
       http_response_code(400);
       echo json_encode(["message" => "Se requiere ID para eliminar"]);
       return;
   }

   $anexo->id = $id;
   
   // Verificar que el anexo existe y obtener datos
   if (!$anexo->readOne()) {
       http_response_code(404);
       echo json_encode(["message" => "Anexo no encontrado"]);
       return;
   }

   $filename = $anexo->filename;
   $thumbnailPath = $anexo->thumbnail_path;

   if ($hardDelete) {
       // Eliminación permanente
       if ($anexo->deleteHard()) {
           // Eliminar archivos físicos
           $deleteResult = $attachmentService->deleteFiles($filename, $thumbnailPath);
           
           http_response_code(200);
           echo json_encode([
               "success" => true,
               "message" => "Anexo eliminado permanentemente",
               "files_deleted" => $deleteResult['deleted'],
               "file_errors" => $deleteResult['errors']
           ]);
       } else {
           http_response_code(500);
           echo json_encode([
               "success" => false,
               "message" => "Error al eliminar anexo de la base de datos"
           ]);
       }
   } else {
       // Eliminación suave (soft delete)
       if ($anexo->delete()) {
           http_response_code(200);
           echo json_encode([
               "success" => true,
               "message" => "Anexo desactivado (eliminación suave)"
           ]);
       } else {
           http_response_code(500);
           echo json_encode([
               "success" => false,
               "message" => "Error al desactivar anexo"
           ]);
       }
   }
}

function getStorageStats() {
   global $attachmentService;

   $stats = $attachmentService->getStorageStats();
   
   if ($stats['success']) {
       http_response_code(200);
       echo json_encode([
           "success" => true,
           "data" => $stats
       ]);
   } else {
       http_response_code(500);
       echo json_encode([
           "success" => false,
           "message" => "Error obteniendo estadísticas",
           "error" => $stats['error']
       ]);
   }
}

function cleanupFiles() {
   global $attachmentService;

   $result = $attachmentService->cleanOrphanFiles();
   
   if ($result['success']) {
       http_response_code(200);
       echo json_encode([
           "success" => true,
           "message" => "Limpieza completada",
           "cleaned_files" => $result['cleaned_files'],
           "total_cleaned" => $result['total_cleaned'],
           "errors" => $result['errors']
       ]);
   } else {
       http_response_code(500);
       echo json_encode([
           "success" => false,
           "message" => "Error durante la limpieza",
           "error" => $result['error']
       ]);
   }
}

function downloadFile() {
   global $anexo;

   $id = $_GET['id'] ?? null;
   $isThumb = isset($_GET['thumb']) ? filter_var($_GET['thumb'], FILTER_VALIDATE_BOOLEAN) : false;

   if (!$id) {
       http_response_code(400);
       echo json_encode(["message" => "Se requiere ID del archivo"]);
       return;
   }

   $anexo->id = $id;
   
   if (!$anexo->readOne()) {
       http_response_code(404);
       echo json_encode(["message" => "Archivo no encontrado"]);
       return;
   }

   $filename = $isThumb ? $anexo->thumbnail_path : $anexo->filename;
   $filepath = AttachmentConfig::getFullPath($filename, $isThumb);

   if (!file_exists($filepath)) {
       http_response_code(404);
       echo json_encode(["message" => "Archivo físico no encontrado"]);
       return;
   }

   // Función auxiliar para extraer Vimeo ID
function extraerVimeoIdDeDescripcion($descripcion) {
    if (preg_match('/vimeo\.com\/video\/(\d+)/', $descripcion, $matches)) {
        return $matches[1];
    }
    if (preg_match('/player\.vimeo\.com\/video\/(\d+)/', $descripcion, $matches)) {
        return $matches[1];
    }
    if (preg_match('/vimeo\.com\/(\d+)/', $descripcion, $matches)) {
        return $matches[1];
    }
    return null;
}

   // Configurar headers para descarga
   header('Content-Type: ' . $anexo->mime_type);
   header('Content-Disposition: attachment; filename="' . $anexo->original_name . '"');
   header('Content-Length: ' . filesize($filepath));
   header('Cache-Control: must-revalidate');
   header('Pragma: public');

   // Enviar archivo
   readfile($filepath);
   exit();
}
?>