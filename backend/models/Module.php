
<?php
// models/Module.php

class Module {
    private $conn;
    private $table_name = "modules";

    public $id;
    public $course_id;
    public $title;
    public $description;
    public $orden;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Obtener todos los módulos de un curso
    public function getByCourse() {
        $query = "SELECT id, curso_id, titulo, descripcion, orden 
                  FROM " . $this->table_name . " 
                  WHERE curso_id = ? 
                  ORDER BY orden ASC";
    
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->course_id);
        $stmt->execute();
    
        return $stmt;
    }

    // Obtener un módulo específico
    public function getOne() {
        $query = "SELECT id, curso_id, titulo, descripcion, orden
                  FROM " . $this->table_name . " 
                  WHERE id = ? 
                  LIMIT 0,1";
    
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();
    
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
        if ($row) {
            $this->course_id = $row['curso_id'];
            $this->title = $row['titulo'];
            $this->description = $row['descripcion'];
            $this->orden = $row['orden'];
            return true;
        }
    
        return false;
    }
    

    // Obtener todas las lecciones del módulo
    public function getLessons() {
        $query = "SELECT l.id, l.curso_id, l.titulo, l.contenido, l.orden, l.module_id
                  FROM lessons l
                  WHERE l.module_id = ?
                  ORDER BY l.orden ASC";
                  
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();
        
        return $stmt;
    }
}

?>

