-- =====================================================
-- FASE 1: Segmentación de contenidos por roles
-- Migración de base de datos
-- =====================================================

-- 1. Expandir roles de usuario
ALTER TABLE users MODIFY COLUMN role ENUM('admin','user','mentor','estudiante','coordinador') NOT NULL DEFAULT 'estudiante';

-- 2. Migrar usuarios existentes con role='user' a 'estudiante'
UPDATE users SET role = 'estudiante' WHERE role = 'user';

-- 3. Crear tabla de mapeo documento-rol
CREATE TABLE IF NOT EXISTS documento_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documento_id INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_doc_role (documento_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 4. Insertar acceso para todos los roles en documentos existentes (migración)
INSERT IGNORE INTO documento_roles (documento_id, role)
SELECT d.id, r.role
FROM documentos d
CROSS JOIN (
    SELECT 'admin' AS role
    UNION SELECT 'mentor'
    UNION SELECT 'estudiante'
    UNION SELECT 'coordinador'
) r;
