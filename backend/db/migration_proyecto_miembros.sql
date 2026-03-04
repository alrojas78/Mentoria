-- Fase 11.8b: Sistema proyecto_miembros — Acceso por membresía
-- Permite asignar usuarios a proyectos con roles específicos (coordinador, supervisor)

CREATE TABLE IF NOT EXISTS proyecto_miembros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    user_id INT NOT NULL,
    rol_proyecto ENUM('coordinador', 'supervisor') NOT NULL DEFAULT 'supervisor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_proyecto_user (proyecto_id, user_id),
    INDEX idx_user_id (user_id)
);
