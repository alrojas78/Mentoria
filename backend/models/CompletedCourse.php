<?php
class CompletedCourse {
    private $conn;
    private $table_name = "completed_courses";

    public $user_id;
    public $curso_id;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function markCompleted() {
        $query = "INSERT IGNORE INTO " . $this->table_name . " (user_id, curso_id)
                  VALUES (:user_id, :curso_id)";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $this->user_id);
        $stmt->bindParam(':curso_id', $this->curso_id);
        return $stmt->execute();
    }

    public function isCompleted() {
        $query = "SELECT id FROM " . $this->table_name . "
                  WHERE user_id = :user_id AND curso_id = :curso_id LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $this->user_id);
        $stmt->bindParam(':curso_id', $this->curso_id);
        $stmt->execute();
        return $stmt->rowCount() > 0;
    }

    public function getCompletedByUser($user_id) {
        $query = "SELECT c.id AS course_id, c.titulo AS course_title, c.descripcion, c.imagen, cc.completed_at AS fecha
                  FROM completed_courses cc
                  JOIN courses c ON cc.curso_id = c.id
                  WHERE cc.user_id = :user_id";
                  
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
}
?>
