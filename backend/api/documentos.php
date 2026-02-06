<?php
// backend/api/documentos.php

// Headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Para preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Incluir archivos de configuración
include_once '../config/db.php';

// Log para depuración
$logFile = __DIR__ . '/docs_debug.log';
file_put_contents($logFile, date('Y-m-d H:i:s') . " - Método: " . $_SERVER['REQUEST_METHOD'] . "\n", FILE_APPEND);

// Crear conexión a base de datos
try {
    $database = new Database();
    $db = $database->getConnection();
    
    // Si es POST (crear documento)
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        file_put_contents($logFile, date('Y-m-d H:i:s') . " - POST: " . print_r($_POST, true) . "\n", FILE_APPEND);
        
        // Obtener datos
        $titulo = isset($_POST['titulo']) ? $_POST['titulo'] : null;
        $descripcion = isset($_POST['descripcion']) ? $_POST['descripcion'] : '';
        $contenido = isset($_POST['contenido']) ? $_POST['contenido'] : '';
        
        // Obtener datos de configuración de evaluación (opcionales)
        $preguntas_por_evaluacion = isset($_POST['preguntas_por_evaluacion']) ? (int)$_POST['preguntas_por_evaluacion'] : 10;
        $porcentaje_aprobacion = isset($_POST['porcentaje_aprobacion']) ? (float)$_POST['porcentaje_aprobacion'] : 60.00;
        $tiene_certificado = isset($_POST['tiene_certificado']) ? (int)$_POST['tiene_certificado'] : 0;
        $max_intentos = isset($_POST['max_intentos']) ? (int)$_POST['max_intentos'] : 3;

        // NUEVAS configuraciones de ponderación y tiempo
$puntuacion_respuesta_completa = isset($_POST['puntuacion_respuesta_completa']) ? (float)$_POST['puntuacion_respuesta_completa'] : 1.00;
$puntuacion_respuesta_parcial = isset($_POST['puntuacion_respuesta_parcial']) ? (float)$_POST['puntuacion_respuesta_parcial'] : 0.80;
$puntuacion_respuesta_minima = isset($_POST['puntuacion_respuesta_minima']) ? (float)$_POST['puntuacion_respuesta_minima'] : 0.40;
$umbral_respuesta_parcial = isset($_POST['umbral_respuesta_parcial']) ? (float)$_POST['umbral_respuesta_parcial'] : 0.30;
$tiempo_respuesta_segundos = isset($_POST['tiempo_respuesta_segundos']) ? (int)$_POST['tiempo_respuesta_segundos'] : 60;

// Validar rangos de las nuevas configuraciones
if ($puntuacion_respuesta_completa < 0.1 || $puntuacion_respuesta_completa > 1.0) {
    $puntuacion_respuesta_completa = 1.00;
}
if ($puntuacion_respuesta_parcial < 0.1 || $puntuacion_respuesta_parcial > 1.0) {
    $puntuacion_respuesta_parcial = 0.80;
}
if ($puntuacion_respuesta_minima < 0.1 || $puntuacion_respuesta_minima > 1.0) {
    $puntuacion_respuesta_minima = 0.40;
}
if ($umbral_respuesta_parcial < 0.1 || $umbral_respuesta_parcial > 1.0) {
    $umbral_respuesta_parcial = 0.30;
}
if ($tiempo_respuesta_segundos < 10 || $tiempo_respuesta_segundos > 300) {
    $tiempo_respuesta_segundos = 60;
}
        
        // Validar rangos
        if ($preguntas_por_evaluacion < 1 || $preguntas_por_evaluacion > 50) {
            $preguntas_por_evaluacion = 10;
        }
        if ($porcentaje_aprobacion < 1 || $porcentaje_aprobacion > 100) {
            $porcentaje_aprobacion = 60.00;
        }
        if ($max_intentos < 1 || $max_intentos > 10) {
            $max_intentos = 3;
        }
        
        // Validar datos mínimos
        if (empty($titulo)) {
            http_response_code(400);
            echo json_encode(["message" => "El título es obligatorio"]);
            exit();
        }
        
        // Insertar documento
// Insertar documento con configuración de evaluación
        try {
            // Iniciar transacción
            $db->beginTransaction();
            
            // Insertar documento
            $query = "INSERT INTO documentos (titulo, descripcion, contenido, created) 
                      VALUES (:titulo, :descripcion, :contenido, NOW())";
                      
            $stmt = $db->prepare($query);
            $stmt->bindParam(':titulo', $titulo);
            $stmt->bindParam(':descripcion', $descripcion);
            $stmt->bindParam(':contenido', $contenido);
            
            if (!$stmt->execute()) {
                throw new Exception("Error al insertar documento");
            }
            
            $document_id = $db->lastInsertId();
            
            // Insertar configuración de evaluación
$eval_query = "INSERT INTO doc_evaluacion_configuracion 
              (document_id, preguntas_por_evaluacion, porcentaje_aprobacion, tiene_certificado, max_intentos, 
               puntuacion_respuesta_completa, puntuacion_respuesta_parcial, puntuacion_respuesta_minima, 
               umbral_respuesta_parcial, tiempo_respuesta_segundos, fecha_creacion) 
              VALUES (:document_id, :preguntas, :porcentaje, :certificado, :intentos, 
                      :punt_completa, :punt_parcial, :punt_minima, :umbral_parcial, :tiempo, NOW())";
                          
            $eval_stmt = $db->prepare($eval_query);
            $eval_stmt->bindParam(':document_id', $document_id);
            $eval_stmt->bindParam(':preguntas', $preguntas_por_evaluacion);
            $eval_stmt->bindParam(':porcentaje', $porcentaje_aprobacion);
            $eval_stmt->bindParam(':certificado', $tiene_certificado);
            $eval_stmt->bindParam(':intentos', $max_intentos);
            $eval_stmt->bindParam(':punt_completa', $puntuacion_respuesta_completa);
$eval_stmt->bindParam(':punt_parcial', $puntuacion_respuesta_parcial);
$eval_stmt->bindParam(':punt_minima', $puntuacion_respuesta_minima);
$eval_stmt->bindParam(':umbral_parcial', $umbral_respuesta_parcial);
$eval_stmt->bindParam(':tiempo', $tiempo_respuesta_segundos);
            
            if (!$eval_stmt->execute()) {
                throw new Exception("Error al insertar configuración de evaluación");
            }
            
            // Confirmar transacción
            $db->commit();
            
            file_put_contents($logFile, date('Y-m-d H:i:s') . " - Documento creado con ID: $document_id\n", FILE_APPEND);
            
            http_response_code(201);
            echo json_encode([
                "message" => "Documento y configuración de evaluación creados correctamente",
                "id" => $document_id,
                "evaluation_config" => [
                    "preguntas_por_evaluacion" => $preguntas_por_evaluacion,
                    "porcentaje_aprobacion" => $porcentaje_aprobacion,
                    "tiene_certificado" => $tiene_certificado,
                    "max_intentos" => $max_intentos
                ]
            ]);
            
            } catch (Exception $e) {
            file_put_contents($logFile, date('Y-m-d H:i:s') . " - Exception: " . $e->getMessage() . "\n", FILE_APPEND);
            
            http_response_code(500);
            echo json_encode([
                "message" => "Error de servidor: " . $e->getMessage()
            ]);
        }
    }
    // Si es GET (listar documentos)
    else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Si se solicita un documento específico
       // Si se solicita un documento específico
if (isset($_GET['id'])) {
    $id = $_GET['id'];
    
    $query = "SELECT d.*, 
                     ec.preguntas_por_evaluacion,
                     ec.porcentaje_aprobacion,
                     ec.tiene_certificado,
                     ec.max_intentos,
                     ec.puntuacion_respuesta_completa,
                     ec.puntuacion_respuesta_parcial,
                     ec.puntuacion_respuesta_minima,
                     ec.umbral_respuesta_parcial,
                     ec.tiempo_respuesta_segundos
              FROM documentos d
              LEFT JOIN doc_evaluacion_configuracion ec ON d.id = ec.document_id
              WHERE d.id = ?";  // ✅ CORRECTO - consulta individual
    $stmt = $db->prepare($query);
    $stmt->execute([$id]);
    
    $documento = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($documento) {
        // Incluir anexos automáticamente
        require_once '../models/Anexo.php';
        require_once '../config/attachments.php';
        $documento = includeAnexosInDocument($documento);
        
        http_response_code(200);
        echo json_encode($documento);
    } else {
        http_response_code(404);
        echo json_encode(["message" => "Documento no encontrado"]);
    }
} 
        // Listar todos los documentos
// Listar todos los documentos
else {
    $query = "SELECT d.*,
                     ec.preguntas_por_evaluacion,
                     ec.porcentaje_aprobacion,
                     ec.tiene_certificado,
                     ec.max_intentos,
                     ec.puntuacion_respuesta_completa,
                     ec.puntuacion_respuesta_parcial,
                     ec.puntuacion_respuesta_minima,
                     ec.umbral_respuesta_parcial,
                     ec.tiempo_respuesta_segundos
              FROM documentos d
              LEFT JOIN doc_evaluacion_configuracion ec ON d.id = ec.document_id
              ORDER BY d.created DESC";
            $stmt = $db->prepare($query);
            $stmt->execute();
            
            $documentos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            http_response_code(200);
            echo json_encode($documentos);
        }
    }
else if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'] ?? null;
        $titulo = $data['titulo'] ?? null;
        $descripcion = $data['descripcion'] ?? '';
        $contenido = $data['contenido'] ?? '';
        
        // Datos de configuración de evaluación
        $preguntas_por_evaluacion = isset($data['preguntas_por_evaluacion']) ? (int)$data['preguntas_por_evaluacion'] : 10;
        $porcentaje_aprobacion = isset($data['porcentaje_aprobacion']) ? (float)$data['porcentaje_aprobacion'] : 60.00;
        $tiene_certificado = isset($data['tiene_certificado']) ? (int)$data['tiene_certificado'] : 0;
        $max_intentos = isset($data['max_intentos']) ? (int)$data['max_intentos'] : 3;

        // NUEVAS configuraciones de ponderación y tiempo para PUT
$puntuacion_respuesta_completa = isset($data['puntuacion_respuesta_completa']) ? (float)$data['puntuacion_respuesta_completa'] : 1.00;
$puntuacion_respuesta_parcial = isset($data['puntuacion_respuesta_parcial']) ? (float)$data['puntuacion_respuesta_parcial'] : 0.80;
$puntuacion_respuesta_minima = isset($data['puntuacion_respuesta_minima']) ? (float)$data['puntuacion_respuesta_minima'] : 0.40;
$umbral_respuesta_parcial = isset($data['umbral_respuesta_parcial']) ? (float)$data['umbral_respuesta_parcial'] : 0.30;
$tiempo_respuesta_segundos = isset($data['tiempo_respuesta_segundos']) ? (int)$data['tiempo_respuesta_segundos'] : 60;

// Validar rangos de las nuevas configuraciones (PUT)
if ($puntuacion_respuesta_completa < 0.1 || $puntuacion_respuesta_completa > 1.0) {
    $puntuacion_respuesta_completa = 1.00;
}
if ($puntuacion_respuesta_parcial < 0.1 || $puntuacion_respuesta_parcial > 1.0) {
    $puntuacion_respuesta_parcial = 0.80;
}
if ($puntuacion_respuesta_minima < 0.1 || $puntuacion_respuesta_minima > 1.0) {
    $puntuacion_respuesta_minima = 0.40;
}
if ($umbral_respuesta_parcial < 0.1 || $umbral_respuesta_parcial > 1.0) {
    $umbral_respuesta_parcial = 0.30;
}
if ($tiempo_respuesta_segundos < 10 || $tiempo_respuesta_segundos > 300) {
    $tiempo_respuesta_segundos = 60;
}
    
        if (!$id || !$titulo) {
            http_response_code(400);
            echo json_encode(["message" => "ID y título son obligatorios"]);
            exit();
        }
        
        // Validar rangos
        if ($preguntas_por_evaluacion < 1 || $preguntas_por_evaluacion > 50) {
            $preguntas_por_evaluacion = 10;
        }
        if ($porcentaje_aprobacion < 1 || $porcentaje_aprobacion > 100) {
            $porcentaje_aprobacion = 60.00;
        }
        if ($max_intentos < 1 || $max_intentos > 10) {
            $max_intentos = 3;
        }
        
        try {
            // Iniciar transacción
            $db->beginTransaction();
            
            // Actualizar documento
            $query = "UPDATE documentos SET titulo = :titulo, descripcion = :descripcion, contenido = :contenido WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':titulo', $titulo);
            $stmt->bindParam(':descripcion', $descripcion);
            $stmt->bindParam(':contenido', $contenido);
            
            if (!$stmt->execute()) {
                throw new Exception("Error al actualizar documento");
            }
            
            // Actualizar o insertar configuración de evaluación
            $eval_check = $db->prepare("SELECT id FROM doc_evaluacion_configuracion WHERE document_id = ?");
            $eval_check->execute([$id]);
            
            if ($eval_check->fetch()) {
                // Actualizar configuración existente
$eval_query = "UPDATE doc_evaluacion_configuracion SET 
               preguntas_por_evaluacion = :preguntas, 
               porcentaje_aprobacion = :porcentaje, 
               tiene_certificado = :certificado, 
               max_intentos = :intentos,
               puntuacion_respuesta_completa = :punt_completa,
               puntuacion_respuesta_parcial = :punt_parcial,
               puntuacion_respuesta_minima = :punt_minima,
               umbral_respuesta_parcial = :umbral_parcial,
               tiempo_respuesta_segundos = :tiempo,
               fecha_actualizacion = NOW() 
               WHERE document_id = :document_id";
               
$eval_stmt = $db->prepare($eval_query);
} else {
    // Insertar nueva configuración
    $eval_query = "INSERT INTO doc_evaluacion_configuracion 
                   (document_id, preguntas_por_evaluacion, porcentaje_aprobacion, tiene_certificado, max_intentos,
                    puntuacion_respuesta_completa, puntuacion_respuesta_parcial, puntuacion_respuesta_minima,
                    umbral_respuesta_parcial, tiempo_respuesta_segundos, fecha_creacion) 
                   VALUES (:document_id, :preguntas, :porcentaje, :certificado, :intentos,
                           :punt_completa, :punt_parcial, :punt_minima, :umbral_parcial, :tiempo, NOW())";
                   
    $eval_stmt = $db->prepare($eval_query);
}
            
            $eval_stmt->bindParam(':document_id', $id);
            $eval_stmt->bindParam(':preguntas', $preguntas_por_evaluacion);
            $eval_stmt->bindParam(':porcentaje', $porcentaje_aprobacion);
            $eval_stmt->bindParam(':certificado', $tiene_certificado);
            $eval_stmt->bindParam(':intentos', $max_intentos);
            $eval_stmt->bindParam(':punt_completa', $puntuacion_respuesta_completa);
$eval_stmt->bindParam(':punt_parcial', $puntuacion_respuesta_parcial);
$eval_stmt->bindParam(':punt_minima', $puntuacion_respuesta_minima);
$eval_stmt->bindParam(':umbral_parcial', $umbral_respuesta_parcial);
$eval_stmt->bindParam(':tiempo', $tiempo_respuesta_segundos);
            
            if (!$eval_stmt->execute()) {
                throw new Exception("Error al actualizar configuración de evaluación");
            }
            
            // Confirmar transacción
            $db->commit();
            
            http_response_code(200);
            echo json_encode([
                "message" => "Documento y configuración actualizados correctamente",
                "evaluation_config" => [
                    "preguntas_por_evaluacion" => $preguntas_por_evaluacion,
                    "porcentaje_aprobacion" => $porcentaje_aprobacion,
                    "tiene_certificado" => $tiene_certificado,
                    "max_intentos" => $max_intentos
                ]
            ]);
            
        } catch (Exception $e) {
            $db->rollback();
            http_response_code(500);
            echo json_encode(["message" => "Error al actualizar: " . $e->getMessage()]);
        }
    }
    else if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "ID es obligatorio para eliminar"]);
            exit();
        }
    
        $query = "DELETE FROM documentos WHERE id = ?";
        $stmt = $db->prepare($query);
        if ($stmt->execute([$id])) {
            echo json_encode(["message" => "Documento eliminado"]);
        } else {
            echo json_encode(["message" => "Error al eliminar"]);
        }
    }
    
} catch (Exception $e) {
    // Rollback si hay una transacción activa
    if ($db->inTransaction()) {
        $db->rollback();
    }
    
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - Error principal: " . $e->getMessage() . "\n", FILE_APPEND);
    
    http_response_code(500);
    echo json_encode([
        "message" => "Error del servidor: " . $e->getMessage()
    ]);
}

// =====================================================
// FUNCIONES AUXILIARES PARA ANEXOS
// =====================================================

function includeAnexosInDocument($documento) {
    try {
        $database = new Database();
        $db = $database->getConnection();
        $anexo = new Anexo($db);
        
        $anexos = $anexo->getByDocument($documento['id'], true);
        
        // Agregar URLs públicas a los anexos
        foreach ($anexos as &$anexoItem) {
            $anexoItem['public_url'] = AttachmentConfig::getPublicUrl($anexoItem['filename']);
            if ($anexoItem['thumbnail_path']) {
                $anexoItem['thumbnail_url'] = AttachmentConfig::getPublicUrl($anexoItem['thumbnail_path'], true);
            }
            
            // Decodificar metadata
            if ($anexoItem['metadata']) {
                $anexoItem['metadata'] = json_decode($anexoItem['metadata'], true);
            }
        }
        
        $documento['anexos'] = $anexos;
        $documento['total_anexos'] = count($anexos);
        
        return $documento;
        
    } catch (Exception $e) {
        error_log("Error incluyendo anexos: " . $e->getMessage());
        $documento['anexos'] = [];
        $documento['total_anexos'] = 0;
        return $documento;
    }
}

?>