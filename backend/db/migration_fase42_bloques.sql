-- Migración Fase 4.2: Bloques temáticos para documentos
-- Estrategia híbrida: resumen + bloques + function calling en Realtime API

-- Agregar columna resumen a documentos
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS resumen TEXT DEFAULT NULL AFTER contenido;

-- Tabla de bloques temáticos por documento
CREATE TABLE IF NOT EXISTS documento_bloques (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documento_id INT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    titulo VARCHAR(255) NOT NULL,
    resumen_bloque VARCHAR(500) DEFAULT NULL,
    contenido LONGTEXT NOT NULL,
    tokens_estimados INT DEFAULT 0,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    INDEX idx_doc_orden (documento_id, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
