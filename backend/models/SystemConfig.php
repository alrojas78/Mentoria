<?php
class SystemConfig {
    private $conn;
    private $table_name = "system_config";

    // Propiedades
    public $id;
    public $config_key;
    public $config_value;
    public $updated_at;

    // Constructor
    public function __construct($db) {
        $this->conn = $db;
    }

    // Obtener configuración por clave
    public function getByKey($key) {
        $query = "SELECT * FROM " . $this->table_name . " WHERE config_key = ? LIMIT 1";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $key);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row) {
            $this->id = $row['id'];
            $this->config_key = $row['config_key'];
            $this->config_value = $row['config_value'];
            $this->updated_at = $row['updated_at'];
            return true;
        }
        
        return false;
    }

    // Actualizar o crear configuración
    public function save() {
        // Verificar si la clave ya existe
        $check_query = "SELECT id FROM " . $this->table_name . " WHERE config_key = ? LIMIT 1";
        $check_stmt = $this->conn->prepare($check_query);
        $check_stmt->bindParam(1, $this->config_key);
        $check_stmt->execute();
        
        if ($check_stmt->rowCount() > 0) {
            // Actualizar registro existente
            $query = "UPDATE " . $this->table_name . " 
                      SET config_value = :config_value 
                      WHERE config_key = :config_key";
            
            $stmt = $this->conn->prepare($query);
            
            // Sanitizar datos
            $this->config_key = htmlspecialchars(strip_tags($this->config_key));
            
            // Vincular parámetros
            $stmt->bindParam(':config_value', $this->config_value);
            $stmt->bindParam(':config_key', $this->config_key);
            
            // Ejecutar consulta
            if ($stmt->execute()) {
                return true;
            }
        } else {
            // Crear nuevo registro
            $query = "INSERT INTO " . $this->table_name . " 
                      (config_key, config_value) 
                      VALUES 
                      (:config_key, :config_value)";
            
            $stmt = $this->conn->prepare($query);
            
            // Sanitizar datos
            $this->config_key = htmlspecialchars(strip_tags($this->config_key));
            
            // Vincular parámetros
            $stmt->bindParam(':config_key', $this->config_key);
            $stmt->bindParam(':config_value', $this->config_value);
            
            // Ejecutar consulta
            if ($stmt->execute()) {
                $this->id = $this->conn->lastInsertId();
                return true;
            }
        }
        
        return false;
    }
}
?>