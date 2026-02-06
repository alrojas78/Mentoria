<?php
// models/Documento.php
class Documento {
    private $conn;
    private $table_name = "documentos";

    public $id;
    public $titulo;
    public $descripcion;
    public $contenido;
    public $imagen;
    public $created;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Obtener todos los documentos
    public function read() {
        $query = "SELECT id, titulo, descripcion, imagen, created 
                  FROM " . $this->table_name . " 
                  ORDER BY created DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();

        return $stmt;
    }

    // Obtener un documento específico
    public function readOne() {
        $query = "SELECT id, titulo, descripcion, contenido, imagen, created 
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
            $this->contenido = $row['contenido'];
            $this->imagen = $row['imagen'];
            $this->created = $row['created'];
            return true;
        }

        return false;
    }
}
?>