-- Crear base de datos
CREATE DATABASE IF NOT EXISTS voicemed;
USE voicemed;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Tabla de cursos
CREATE TABLE IF NOT EXISTS courses (
  id INT(11) NOT NULL AUTO_INCREMENT,
  titulo VARCHAR(100) NOT NULL,
  descripcion TEXT,
  imagen VARCHAR(255) DEFAULT NULL,
  created DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Tabla de lecciones
CREATE TABLE IF NOT EXISTS lessons (
  id INT(11) NOT NULL AUTO_INCREMENT,
  curso_id INT(11) NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  contenido TEXT NOT NULL,
  orden INT(11) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (curso_id) REFERENCES courses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Tabla de progreso de usuario
CREATE TABLE IF NOT EXISTS user_progress (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  lesson_id INT(11) NOT NULL,
  completado TINYINT(1) NOT NULL DEFAULT 0,
  fecha DATETIME NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Insertar datos de ejemplo para pruebas
INSERT INTO users (nombre, email, password, role, created) VALUES
('Administrador', 'admin@voicemed.com', '$2y$10$Aj/jmM3hCOl5t7FpvGH3weE3aIzKNMBERDToqpx0O.g8.fnRjwqjO', 'admin', NOW()),
('Usuario Test', 'usuario@voicemed.com', '$2y$10$Aj/jmM3hCOl5t7FpvGH3weE3aIzKNMBERDToqpx0O.g8.fnRjwqjO', 'user', NOW());
-- Nota: La contraseña para ambos usuarios es "password123"

-- Insertar cursos de ejemplo
INSERT INTO courses (titulo, descripcion, imagen, created) VALUES
('Introducción a Vilzermet', 'Curso completo sobre el medicamento Vilzermet para representantes médicos', '/assets/images/course1.jpg', NOW()),
('Técnicas de Presentación', 'Aprende las mejores técnicas para presentar productos médicos', '/assets/images/course2.jpg', NOW());

-- Insertar lecciones de ejemplo
INSERT INTO lessons (curso_id, titulo, contenido, orden) VALUES
(1, 'Denominación y Forma Farmacéutica', 'Vilzermet es un medicamento que contiene vildagliptina y metformina, indicado como complemento de la dieta y ejercicio para mejorar el control de la glucemia en pacientes con diabetes mellitus tipo 2.', 1),
(1, 'Mecanismo de Acción', 'Vildagliptina mejora el control de la glucemia mediante la inhibición potente y selectiva de la enzima dipeptidil peptidaza 4 (DDP-4). Metformina disminuye la producción hepática y la absorción intestinal de glucosa.', 2),
(1, 'Indicaciones y Usos', 'Vilzermet está indicado como complemento de la dieta y ejercicio para mejorar el control de la glucemia en pacientes con DM2, cuya enfermedad no pueda controlarse óptimamente con monoterapia.', 3),
(2, 'Preparación de la Presentación', 'Aprende a preparar una presentación efectiva para productos médicos.', 1),
(2, 'Manejo de Objeciones', 'Técnicas para manejar objeciones comunes durante la presentación de productos.', 2);