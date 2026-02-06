<?php
// models/Progress.php
class Progress {
    private $conn;
    private $table_name = "user_progress";

    public $id;
    public $user_id;
    public $lesson_id;
    public $completado;
    public $fecha;
    public $curso_id;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getUserProgress() {
        $query = "SELECT up.id, up.user_id, up.lesson_id, up.completado, up.fecha, 
                        l.titulo as lesson_title, l.curso_id, c.titulo as course_title
                 FROM " . $this->table_name . " up
                 LEFT JOIN lessons l ON up.lesson_id = l.id
                 LEFT JOIN courses c ON l.curso_id = c.id
                 WHERE up.user_id = ?
                 ORDER BY up.fecha DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->execute();

        return $stmt;
    }

    public function getLastActivity() {
        $query = "SELECT up.id, up.user_id, up.lesson_id, up.completado, up.fecha, 
                        l.titulo as lesson_title, l.curso_id, c.titulo as course_title
                 FROM " . $this->table_name . " up
                 LEFT JOIN lessons l ON up.lesson_id = l.id
                 LEFT JOIN courses c ON l.curso_id = c.id
                 WHERE up.user_id = ?
                 ORDER BY up.fecha DESC
                 LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $this->id = $row['id'];
            $this->lesson_id = $row['lesson_id'];
            $this->completado = $row['completado'];
            $this->fecha = $row['fecha'];
            return $row;
        }

        return false;
    }

    public function isLessonCompleted() {
        $query = "SELECT id 
                 FROM " . $this->table_name . " 
                 WHERE user_id = ? AND lesson_id = ? AND completado = 1
                 LIMIT 1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $this->lesson_id);
        $stmt->execute();

        return ($stmt->rowCount() > 0);
    }

    public function updateProgress() {
        error_log("updateProgress: user_id={$this->user_id}, lesson_id={$this->lesson_id}, completado={$this->completado}");
        
        try {
            $query = "SELECT id FROM " . $this->table_name . " 
                      WHERE user_id = ? AND lesson_id = ?
                      LIMIT 1";
    
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(1, $this->user_id);
            $stmt->bindParam(2, $this->lesson_id);
            $stmt->execute();
    
            if ($stmt->rowCount() > 0) {
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $this->id = $row['id'];
    
                $query = "UPDATE " . $this->table_name . "
                          SET completado = :completado, fecha = :fecha
                          WHERE id = :id";
    
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':completado', $this->completado);
                $stmt->bindParam(':fecha', $this->fecha);
                $stmt->bindParam(':id', $this->id);
            } else {
                $query = "INSERT INTO " . $this->table_name . "
                          (user_id, lesson_id, completado, fecha)
                          VALUES (:user_id, :lesson_id, :completado, :fecha)";
    
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':user_id', $this->user_id);
                $stmt->bindParam(':lesson_id', $this->lesson_id);
                $stmt->bindParam(':completado', $this->completado);
                $stmt->bindParam(':fecha', $this->fecha);
            }
    
            $result = $stmt->execute();
            error_log("Resultado de la consulta: " . ($result ? "éxito" : "fallo"));
            return $result;
        } catch (PDOException $e) {
            error_log("Error en updateProgress: " . $e->getMessage());
            return false;
        }
    }

    public function getCourseProgress($curso_id) {
        $query = "SELECT 
                    c.id as course_id, 
                    c.titulo as course_title,
                    COUNT(l.id) as total_lessons,
                    SUM(CASE WHEN up.completado = 1 THEN 1 ELSE 0 END) as completed_lessons
                  FROM 
                    courses c
                  LEFT JOIN 
                    lessons l ON c.id = l.curso_id
                  LEFT JOIN 
                    " . $this->table_name . " up ON l.id = up.lesson_id AND up.user_id = ?
                  WHERE 
                    c.id = ?
                  GROUP BY 
                    c.id";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $curso_id);
        $stmt->execute();

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getFullCourseProgress($curso_id, $module_id) {
        $query = "SELECT COUNT(id) as total FROM lessons WHERE curso_id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $curso_id);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalLessons = $row ? (int)$row['total'] : 0;

        $query = "SELECT COUNT(*) as completed FROM " . $this->table_name . " WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE curso_id = ?) AND completado = 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $curso_id);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $completedLessons = $row ? (int)$row['completed'] : 0;

        $query = "SELECT COUNT(*) as completed FROM evaluations WHERE user_id = ? AND module_id = ? AND completed_at IS NOT NULL";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->user_id);
        $stmt->bindParam(2, $module_id);
        $stmt->execute();
        $eval = $stmt->fetch(PDO::FETCH_ASSOC);
        $completedEval = $eval ? (int)$eval['completed'] : 0;

        $total = $totalLessons + 1;
        $completed = $completedLessons + $completedEval;

        $percentage = $total > 0 ? round(($completed / $total) * 100) : 0;

        return [
            'course_id' => $curso_id,
            'total_activities' => $total,
            'completed_activities' => $completed,
            'percentage' => $percentage
        ];
    }
    
    public function getNextActivity() {
        $query = "
            SELECT l.id AS lesson_id, l.titulo
            FROM lessons l
            WHERE l.curso_id = :curso_id
            AND l.id NOT IN (
                SELECT lesson_id
                FROM " . $this->table_name . "
                WHERE user_id = :user_id AND completado = 1
            )
            ORDER BY l.orden ASC
            LIMIT 1
        ";
    
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':curso_id', $this->curso_id);
        $stmt->bindParam(':user_id', $this->user_id);
        $stmt->execute();
    
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    

}
?>
