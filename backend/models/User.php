<?php
class User {
    private $conn;
    private $table_name = "users";

    public $id;
    public $nombre;
    public $email;
    public $password;
    public $role;
    public $created;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Crear usuario
    public function create() {
        $query = "INSERT INTO " . $this->table_name . " 
                  SET nombre = :nombre, 
                      email = :email, 
                      password = :password, 
                      role = :role, 
                      created = :created";
    
        $stmt = $this->conn->prepare($query);
    
        // Sanitizar entradas
        $this->nombre = htmlspecialchars(strip_tags($this->nombre));
        $this->email = htmlspecialchars(strip_tags($this->email));
        $this->password = htmlspecialchars(strip_tags($this->password));
        $this->role = htmlspecialchars(strip_tags($this->role));
        $this->created = htmlspecialchars(strip_tags($this->created));
    
        // Vincular valores
        $stmt->bindParam(':nombre', $this->nombre);
        $stmt->bindParam(':email', $this->email);
        $stmt->bindParam(':password', $this->password);
        $stmt->bindParam(':role', $this->role);
        $stmt->bindParam(':created', $this->created);
    
        // Ejecutar consulta
        if($stmt->execute()) {
            // Obtener y asignar el ID generado
            $this->id = $this->conn->lastInsertId();
            return true;
        }
    
        return false;
    }

    // Verificar si el correo ya existe
    public function emailExists() {
        $query = "SELECT id, nombre, password, role 
                  FROM " . $this->table_name . " 
                  WHERE email = ? 
                  LIMIT 0,1";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $this->email);
        $stmt->execute();

        if($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $this->id = $row['id'];
            $this->nombre = $row['nombre'];
            $this->password = $row['password'];
            $this->role = $row['role'];
            
            return true;
        }

        return false;
    }
}
?>