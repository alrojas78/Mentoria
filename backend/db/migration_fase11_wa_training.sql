-- =====================================================
-- FASE 11: Sistema de Entrenamiento por WhatsApp
-- Migración: Tablas para programas, entregas,
-- inscripciones e interacciones de WhatsApp Training
-- =====================================================

-- 1. WA_PROGRAMAS: Programa de entrenamiento (contenedor principal)
CREATE TABLE IF NOT EXISTS wa_programas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    documento_id INT DEFAULT NULL COMMENT 'Documento base opcional para contexto IA',
    estado ENUM('borrador','activo','pausado','finalizado') DEFAULT 'borrador',
    config_json JSON COMMENT 'Configuración adicional del programa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE SET NULL,
    INDEX idx_proyecto (proyecto_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. WA_ENTREGAS: Cada envío programado del programa (contenido, pregunta, retroalimentación)
CREATE TABLE IF NOT EXISTS wa_entregas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    programa_id INT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    tipo ENUM('contenido','pregunta','retroalimentacion') NOT NULL,
    titulo VARCHAR(200),
    -- Contenido del envío
    texto TEXT COMMENT 'Texto del mensaje a enviar',
    media_url VARCHAR(500) COMMENT 'URL de PDF/imagen/audio/video',
    media_tipo ENUM('pdf','imagen','audio','video','documento') DEFAULT NULL,
    -- Si tipo=pregunta
    pregunta TEXT COMMENT 'Texto de la pregunta (puede diferir del texto del mensaje)',
    respuesta_esperada TEXT COMMENT 'Respuesta correcta o criterios para evaluación IA',
    evaluacion_modo ENUM('ia_semantica','exacta','libre') DEFAULT 'ia_semantica',
    -- Programación
    dias_despues INT DEFAULT 0 COMMENT 'Días después del inicio o entrega anterior',
    hora_envio TIME DEFAULT '09:00:00',
    -- Meta template (para primer contacto o fuera de ventana 24h)
    template_name VARCHAR(100) COMMENT 'Nombre del template aprobado en Meta',
    template_variables JSON COMMENT 'Variables del template',
    -- Estado
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (programa_id) REFERENCES wa_programas(id) ON DELETE CASCADE,
    INDEX idx_programa_orden (programa_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. WA_INSCRIPCIONES: Estudiantes inscritos a un programa
CREATE TABLE IF NOT EXISTS wa_inscripciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    programa_id INT NOT NULL,
    contacto_id INT DEFAULT NULL COMMENT 'Referencia a tabla contactos del sistema de seguimiento',
    telefono VARCHAR(20) NOT NULL COMMENT 'Número WhatsApp del estudiante (con código país)',
    nombre VARCHAR(200),
    email VARCHAR(200) DEFAULT NULL,
    estado ENUM('activo','pausado','completado','abandonado') DEFAULT 'activo',
    entrega_actual INT DEFAULT 0 COMMENT 'Índice de última entrega enviada',
    fecha_inicio DATE COMMENT 'Fecha de inicio personalizada para este estudiante',
    fecha_ultima_interaccion DATETIME DEFAULT NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (programa_id) REFERENCES wa_programas(id) ON DELETE CASCADE,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE SET NULL,
    UNIQUE KEY uk_programa_telefono (programa_id, telefono),
    INDEX idx_programa_estado (programa_id, estado),
    INDEX idx_telefono (telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. WA_INTERACCIONES: Log completo de envíos, respuestas y evaluaciones
CREATE TABLE IF NOT EXISTS wa_interacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscripcion_id INT NOT NULL,
    entrega_id INT DEFAULT NULL COMMENT 'NULL si es respuesta libre del estudiante',
    tipo ENUM(
        'envio_contenido',
        'envio_pregunta',
        'respuesta_estudiante',
        'retroalimentacion_texto',
        'retroalimentacion_audio',
        'error_envio',
        'recordatorio'
    ) NOT NULL,
    contenido TEXT COMMENT 'Texto enviado o recibido',
    media_url VARCHAR(500) COMMENT 'URL de media enviada o recibida',
    -- Evaluación IA
    evaluacion_score DECIMAL(3,2) DEFAULT NULL COMMENT '0.00-1.00 (NULL si no aplica)',
    evaluacion_detalle TEXT COMMENT 'Retroalimentación generada por la IA',
    -- Operatix tracking
    operatix_message_id VARCHAR(100) COMMENT 'ID del mensaje en Operatix para tracking',
    estado_envio ENUM('pendiente','enviado','entregado','leido','fallido') DEFAULT 'pendiente',
    -- Timestamps de ciclo de vida
    fecha_programada DATETIME COMMENT 'Cuándo debe enviarse',
    fecha_enviado DATETIME COMMENT 'Cuándo se envió realmente',
    fecha_respuesta DATETIME COMMENT 'Cuándo respondió el estudiante',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inscripcion_id) REFERENCES wa_inscripciones(id) ON DELETE CASCADE,
    FOREIGN KEY (entrega_id) REFERENCES wa_entregas(id) ON DELETE SET NULL,
    INDEX idx_inscripcion (inscripcion_id),
    INDEX idx_entrega (entrega_id),
    INDEX idx_fecha_programada (fecha_programada, estado_envio),
    INDEX idx_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
