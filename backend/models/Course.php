<?php
class Course {
    private $conn;
    private $table_name = "courses";

    public $id;
    public $titulo;
    public $descripcion;
    public $imagen;
    public $duracion;
    public $created;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function readWithModulesAndLessons() {
        $query = "SELECT * FROM " . $this->table_name;
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
    
        $courses = [];
    
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $course_id = $row['id'];
            $row['modules'] = $this->getModulesWithLessons($course_id);
            $courses[] = $row;
        }
    
        return $courses;
    }
    
    private function getModulesWithLessons($course_id) {
        $query = "SELECT * FROM modules WHERE curso_id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $course_id);
        $stmt->execute();
    
        $modules = [];
    
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $module_id = $row['id'];
            $row['lessons'] = $this->getLessonsByModule($module_id);
            $modules[] = $row;
        }
    
        return $modules;
    }
    
    private function getLessonsByModule($module_id) {
        $query = "SELECT * FROM lessons WHERE module_id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $module_id);
        $stmt->execute();
    
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    

    // Obtener todos los cursos
    public function read() {
        $query = "SELECT id, titulo, descripcion, imagen, created 
                  FROM " . $this->table_name . " 
                  ORDER BY created DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        return $stmt;
    }

    // Obtener un curso específico
    public function readOne() {
        $query = "SELECT id, titulo, descripcion, imagen, duracion, created 
                  FROM " . $this->table_name . " 
                  WHERE id = ? 
                  LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if($row) {
            $this->titulo = $row['titulo'];
            $this->descripcion = $row['descripcion'];
            $this->imagen = $row['imagen'];
            $this->duracion = $row['duracion'];
            $this->created = $row['created'];
            return true;
        }

        return false;
    }
}
?>