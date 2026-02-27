-- =====================================================
-- FASE N: Sistema de Seguimiento y Notificaciones
-- Migración: Crear tablas para gestión de cohortes,
-- contactos, matrículas, reglas y plantillas
-- =====================================================

-- 1. COHORTES: Grupos de estudio vinculados a documentos
CREATE TABLE IF NOT EXISTS cohortes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    documento_id INT NOT NULL,
    rol_asignar VARCHAR(100) DEFAULT NULL COMMENT 'Rol/content_group a asignar al registrarse',
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado ENUM('planificada','activa','finalizada','cancelada') DEFAULT 'planificada',
    config_json JSON COMMENT 'Configuración específica de la cohorte',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    INDEX idx_documento (documento_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CONTACTOS: Base pre-cargada de personas a invitar
CREATE TABLE IF NOT EXISTS contactos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    telefono VARCHAR(50),
    whatsapp VARCHAR(50),
    institucion VARCHAR(200),
    convenio VARCHAR(200),
    cargo VARCHAR(200),
    notas TEXT,
    token_registro VARCHAR(64) UNIQUE COMMENT 'Token único para link de registro personalizado',
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_telefono (telefono),
    INDEX idx_token (token_registro)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. MATRICULAS: Vincula contacto + cohorte + usuario (cuando se registra)
CREATE TABLE IF NOT EXISTS matriculas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contacto_id INT NOT NULL,
    cohorte_id INT NOT NULL,
    user_id INT DEFAULT NULL COMMENT 'Se llena cuando el contacto se registra como usuario',
    estado ENUM('invitado','registrado','activo','pausado','suspendido','completado','excluido') DEFAULT 'invitado',
    fecha_invitacion DATETIME DEFAULT NULL,
    fecha_registro DATETIME DEFAULT NULL,
    fecha_inicio_programa DATETIME DEFAULT NULL,
    fecha_ultima_actividad DATETIME DEFAULT NULL,
    fecha_suspension DATETIME DEFAULT NULL,
    fecha_completado DATETIME DEFAULT NULL,
    recordatorios_enviados INT DEFAULT 0,
    etapa_actual ENUM('pre_registro','registrado_sin_iniciar','en_progreso','inactivo','completado','suspendido','excluido') DEFAULT 'pre_registro',
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE CASCADE,
    FOREIGN KEY (cohorte_id) REFERENCES cohortes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_contacto_cohorte (contacto_id, cohorte_id),
    INDEX idx_estado (estado),
    INDEX idx_etapa (etapa_actual),
    INDEX idx_cohorte (cohorte_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. REGLAS_RECORDATORIO: Cadencias configurables por cohorte y etapa
CREATE TABLE IF NOT EXISTS reglas_recordatorio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cohorte_id INT NOT NULL,
    etapa ENUM('no_registro','no_inicia','no_avanza') NOT NULL,
    numero_recordatorio INT NOT NULL COMMENT '1,2,3,4...',
    dias_trigger INT NOT NULL COMMENT 'Días desde que entró a la etapa',
    canal ENUM('email','whatsapp','llamada','in_app') NOT NULL DEFAULT 'email',
    plantilla_id INT DEFAULT NULL,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cohorte_id) REFERENCES cohortes(id) ON DELETE CASCADE,
    INDEX idx_cohorte_etapa (cohorte_id, etapa),
    UNIQUE KEY uk_cohorte_etapa_num (cohorte_id, etapa, numero_recordatorio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. PLANTILLAS_MENSAJE: Templates para cada canal
CREATE TABLE IF NOT EXISTS plantillas_mensaje (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo ENUM('invitacion','confirmacion','bienvenida','recordatorio','felicitacion','suspension','certificacion','custom') NOT NULL,
    canal ENUM('email','whatsapp','llamada','in_app') NOT NULL DEFAULT 'email',
    asunto VARCHAR(300) COMMENT 'Solo para email',
    cuerpo TEXT NOT NULL COMMENT 'Soporta variables: {{nombre}}, {{programa}}, {{enlace}}, {{modulo}}, {{progreso}}',
    variables_disponibles JSON COMMENT 'Lista de variables soportadas',
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. SEGUIMIENTO_LOG: Historial completo de todas las interacciones
CREATE TABLE IF NOT EXISTS seguimiento_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricula_id INT NOT NULL,
    tipo_evento ENUM('invitacion_enviada','recordatorio_enviado','registro_detectado','inicio_programa','avance_modulo','completado_programa','suspension','exclusion','reactivacion','respuesta_contacto','error_envio') NOT NULL,
    canal ENUM('email','whatsapp','llamada','in_app','sistema') DEFAULT 'sistema',
    detalle TEXT COMMENT 'Descripción o contenido del evento',
    metadata_json JSON COMMENT 'Datos adicionales del evento',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (matricula_id) REFERENCES matriculas(id) ON DELETE CASCADE,
    INDEX idx_matricula (matricula_id),
    INDEX idx_tipo (tipo_evento),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. CAMPANAS_OPERATIX: Preparada para integración futura con Operatix
CREATE TABLE IF NOT EXISTS campanas_operatix (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cohorte_id INT NOT NULL,
    tipo ENUM('whatsapp','llamada') NOT NULL,
    nombre VARCHAR(200),
    operatix_list_id VARCHAR(100) COMMENT 'ID de lista en Operatix',
    operatix_campaign_id VARCHAR(100) COMMENT 'ID de campaña en Operatix',
    estado ENUM('borrador','sincronizada','activa','pausada','finalizada') DEFAULT 'borrador',
    config_json JSON,
    ultima_sincronizacion DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cohorte_id) REFERENCES cohortes(id) ON DELETE CASCADE,
    INDEX idx_cohorte (cohorte_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SEED DATA: Plantillas base
-- =====================================================

INSERT INTO plantillas_mensaje (nombre, tipo, canal, asunto, cuerpo, variables_disponibles) VALUES
('Invitación por Email', 'invitacion', 'email',
 'Te invitamos al programa {{programa}}',
 'Hola {{nombre}},\n\nTe invitamos a participar en el programa \"{{programa}}\".\n\nPara registrarte, haz clic en el siguiente enlace:\n{{enlace_registro}}\n\nSi tienes preguntas, no dudes en contactarnos.\n\nSaludos cordiales.',
 '["nombre","programa","enlace_registro"]'),

('Confirmación de Registro', 'confirmacion', 'email',
 'Bienvenido al programa {{programa}}',
 'Hola {{nombre}},\n\nTu registro en el programa \"{{programa}}\" ha sido confirmado.\n\nFechas: {{fecha_inicio}} - {{fecha_fin}}\nCriterios de certificación: Completar todos los módulos y aprobar las evaluaciones.\n\nAccede a tu programa aquí: {{enlace_programa}}\n\nExitos!',
 '["nombre","programa","fecha_inicio","fecha_fin","enlace_programa"]'),

('Bienvenida al Programa', 'bienvenida', 'email',
 'Comienza tu aprendizaje en {{programa}}',
 'Hola {{nombre}},\n\nEs hora de comenzar tu programa \"{{programa}}\".\n\nTu primer módulo te espera. Ingresa aquí para iniciar:\n{{enlace_programa}}\n\nRecuerda: avanza a tu ritmo pero mantén constancia.\n\nVamos!',
 '["nombre","programa","enlace_programa"]'),

('Recordatorio - No se ha registrado', 'recordatorio', 'email',
 'Aún estás a tiempo - {{programa}}',
 'Hola {{nombre}},\n\nNotamos que aún no te has registrado en el programa \"{{programa}}\".\n\nEl registro es rápido y sencillo. Haz clic aquí:\n{{enlace_registro}}\n\nSi tienes dudas o problemas para acceder, responde a este correo y te ayudamos.\n\nSaludos.',
 '["nombre","programa","enlace_registro"]'),

('Recordatorio - No ha iniciado', 'recordatorio', 'email',
 'Tu programa {{programa}} te espera',
 'Hola {{nombre}},\n\nYa estás registrado en \"{{programa}}\" pero aún no has iniciado.\n\nIngresa aquí para comenzar tu primer módulo:\n{{enlace_programa}}\n\nRecuerda que el programa tiene fechas límite. No pierdas tu lugar!\n\nAnimo!',
 '["nombre","programa","enlace_programa"]'),

('Recordatorio - No avanza', 'recordatorio', 'email',
 'Retoma tu progreso en {{programa}}',
 'Hola {{nombre}},\n\nVemos que llevas un tiempo sin avanzar en \"{{programa}}\".\n\nActualmente vas en el {{modulo}} con un {{progreso}}% completado.\n\nContinúa aquí: {{enlace_programa}}\n\nCada paso cuenta. Tu puedes!',
 '["nombre","programa","modulo","progreso","enlace_programa"]'),

('Felicitación por Módulo', 'felicitacion', 'email',
 'Excelente! Completaste {{modulo}} en {{programa}}',
 'Hola {{nombre}},\n\nFelicitaciones! Has completado el {{modulo}} del programa \"{{programa}}\".\n\nTu progreso actual: {{progreso}}%\n\nSigue adelante con el siguiente módulo: {{enlace_programa}}\n\nGran trabajo!',
 '["nombre","programa","modulo","progreso","enlace_programa"]'),

('Suspensión de Matrícula', 'suspension', 'email',
 'Información sobre tu matrícula en {{programa}}',
 'Hola {{nombre}},\n\nTu matrícula en el programa \"{{programa}}\" ha sido suspendida por inactividad prolongada.\n\nSi deseas reiniciar en una nueva cohorte, contáctanos y con gusto te ayudamos.\n\nSaludos.',
 '["nombre","programa"]'),

('Invitación WhatsApp', 'invitacion', 'whatsapp', NULL,
 'Hola {{nombre}}! Te invitamos al programa *{{programa}}*. Regístrate aquí: {{enlace_registro}}',
 '["nombre","programa","enlace_registro"]'),

('Recordatorio WhatsApp', 'recordatorio', 'whatsapp', NULL,
 'Hola {{nombre}}, te recordamos que tienes pendiente avanzar en *{{programa}}*. Ingresa aquí: {{enlace_programa}}',
 '["nombre","programa","enlace_programa"]');
