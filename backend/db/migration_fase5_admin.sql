-- Fase 5: Reestructuración del Panel Admin
-- 1. Cambiar users.role de ENUM a VARCHAR para permitir grupos dinámicos
ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'estudiante';

-- 2. Crear tabla de grupos de contenido
CREATE TABLE IF NOT EXISTS content_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seed con grupos existentes (no incluir admin/mentor que son roles del sistema)
INSERT IGNORE INTO content_groups (name, description) VALUES
('estudiante', 'Grupo por defecto para estudiantes'),
('coordinador', 'Coordinadores de programa');
