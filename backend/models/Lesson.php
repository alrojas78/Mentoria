<?php
class Lesson {
    private $conn;
    private $table_name = "lessons";

    public $id;
    public $curso_id;
    public $module_id;
    public $titulo;
    public $contenido;
    public $orden;
   
    public function __construct($db) {
        $this->conn = $db;
    }

// Obtener la siguiente actividad (lección o evaluación) del mismo módulo
public function getNextActivity($currentLessonId, $cursoId) {
    $query = "SELECT id, 'lesson' as type
              FROM " . $this->table_name . " 
              WHERE curso_id = :curso_id AND orden > (
                SELECT orden FROM " . $this->table_name . " WHERE id = :current_id
              )
              ORDER BY orden ASC
              LIMIT 1";

    $stmt = $this->conn->prepare($query);
    $stmt->bindParam(':curso_id', $cursoId);
    $stmt->bindParam(':current_id', $currentLessonId);
    $stmt->execute();

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        return $row; // Siguiente lección
    }

    // Si no hay siguiente lección, devolver evaluación del módulo
    return [
        "type" => "evaluation",
        "module_id" => $cursoId
    ];
}

public function getNextLessonInModule($moduleId, $currentLessonId) {
    $query = "SELECT id, titulo
              FROM " . $this->table_name . "
              WHERE module_id = :module_id AND orden > (
                  SELECT orden FROM " . $this->table_name . " WHERE id = :current_id
              )
              ORDER BY orden ASC
              LIMIT 1";

    $stmt = $this->conn->prepare($query);
    $stmt->bindParam(':module_id', $moduleId, PDO::PARAM_INT);
    $stmt->bindParam(':current_id', $currentLessonId, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt;
}




    // Obtener lecciones por curso
    public function readByCourse() {
        $query = "SELECT id, curso_id, titulo, contenido, orden 
                  FROM " . $this->table_name . " 
                  WHERE curso_id = ? 
                  ORDER BY orden ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->curso_id);
        $stmt->execute();

        return $stmt;
    }

    // Obtener una lección específica
    public function readOne() {
        $query = "SELECT id, curso_id, module_id, titulo, contenido, orden 
          FROM " . $this->table_name . " 
          WHERE id = ? 
          LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if($row) {
            $this->curso_id = $row['curso_id'];
            $this->module_id = $row['module_id'];
            $this->titulo = $row['titulo'];
            $this->contenido = $row['contenido'];
            $this->orden = $row['orden'];
            return true;
        }

        return false;
    }
}
?>