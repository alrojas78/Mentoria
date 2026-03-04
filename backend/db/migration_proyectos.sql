-- Fase 9: Sistema Multi-Proyecto
-- Migración: Tablas de proyectos

CREATE TABLE IF NOT EXISTS proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    dominio_personalizado VARCHAR(200) DEFAULT NULL,
    logo VARCHAR(500) DEFAULT NULL,
    color_primario VARCHAR(20) DEFAULT '#0f355b',
    color_secundario VARCHAR(20) DEFAULT '#14b6cb',
    titulo_landing VARCHAR(300) DEFAULT NULL,
    subtitulo_landing TEXT DEFAULT NULL,
    imagen_hero VARCHAR(500) DEFAULT NULL,
    rol_default VARCHAR(100) DEFAULT NULL,
    registro_abierto TINYINT(1) DEFAULT 1,
    config_json JSON DEFAULT NULL,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_dominio (dominio_personalizado)
);

CREATE TABLE IF NOT EXISTS proyecto_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    documento_id INT NOT NULL,
    orden INT DEFAULT 0,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    UNIQUE KEY uk_proyecto_documento (proyecto_id, documento_id)
);
