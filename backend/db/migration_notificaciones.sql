-- Migración: Sistema de Notificaciones Modal
-- Fecha: 2026-02-24

-- Tabla principal de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo ENUM('info', 'warning', 'success') NOT NULL DEFAULT 'info',
    rol_destino VARCHAR(50) DEFAULT NULL COMMENT 'NULL = todos los usuarios',
    activa TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de notificaciones leídas/descartadas por usuario
CREATE TABLE IF NOT EXISTS notificaciones_leidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notificacion_id INT NOT NULL,
    user_id INT NOT NULL,
    leida_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_notif_user (notificacion_id, user_id),
    FOREIGN KEY (notificacion_id) REFERENCES notificaciones(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
