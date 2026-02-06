<?php
// models/Question.php
class Question {
    private $conn;
    private $table_name = "questions";

    public $id;
    public $module_id;
    public $question_text;
    public $expected_answer;
    public $orden;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Obtener preguntas por módulo
    public function getByModule() {
        $query = "SELECT id, module_id, question_text, expected_answer, orden 
                  FROM " . $this->table_name . " 
                  WHERE module_id = ? 
                  ORDER BY orden ASC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->module_id);
        $stmt->execute();

        return $stmt;
    }
}
?>