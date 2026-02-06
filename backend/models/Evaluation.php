<?php
// models/Evaluation.php
class Evaluation {
    private $conn;
    private $table_name = "evaluations";

    public $id;
    public $user_id;
    public $module_id;
    public $score;
    public $completed_at;
    public $answers;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Crear una nueva evaluación
    public function create() {
        $query = "INSERT INTO " . $this->table_name . " 
                  (user_id, module_id, score, answers, completed_at) 
                  VALUES (?, ?, ?, ?, ?)";

        $stmt = $this->conn->prepare($query);

        // Sanitizar datos
        $this->user_id = htmlspecialchars(strip_tags($this->user_id));
        $this->module_id = htmlspecialchars(strip_tags($this->module_id));
        $this->score = htmlspecialchars(strip_tags($this->score));
        // $this->answers es un JSON

        // Vincular valores
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->module_id);
        $stmt->bindParam(3, $this->score);
        $stmt->bindParam(4, $this->answers);
        $stmt->bindParam(5, $this->completed_at);

        // Ejecutar consulta
        if($stmt->execute()) {
            return true;
        }

        return false;
    }

    // Obtener evaluaciones por usuario
    public function getByUser() {
        $query = "SELECT id, module_id, score, completed_at 
                  FROM " . $this->table_name . " 
                  WHERE user_id = ? 
                  ORDER BY completed_at DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->execute();

        return $stmt;
    }

    // Obtener evaluación específica
    public function getOne() {
        $query = "SELECT id, user_id, module_id, score, answers, completed_at 
                  FROM " . $this->table_name . " 
                  WHERE id = ? 
                  LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if($row) {
            $this->id = $row['id'];
            $this->user_id = $row['user_id'];
            $this->module_id = $row['module_id'];
            $this->score = $row['score'];
            $this->answers = $row['answers'];
            $this->completed_at = $row['completed_at'];
            return true;
        }

        return false;
    }
}
?>