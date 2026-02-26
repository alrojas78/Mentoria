<?php
class DocumentoBloque {
    private $conn;
    private $table_name = "documento_bloques";

    public $id;
    public $documento_id;
    public $orden;
    public $titulo;
    public $resumen_bloque;
    public $contenido;
    public $tokens_estimados;
    public $created;

    public function __construct($db) {
        $this->conn = $db;
    }

    // Obtener todos los bloques de un documento (sin contenido, solo metadata)
    public function getByDocumento($documentoId) {
        $query = "SELECT id, documento_id, orden, titulo, resumen_bloque, tokens_estimados
                  FROM {$this->table_name}
                  WHERE documento_id = ?
                  ORDER BY orden ASC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$documentoId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Obtener un bloque específico con contenido completo
    public function getById($bloqueId) {
        $query = "SELECT * FROM {$this->table_name} WHERE id = ? LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$bloqueId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Obtener bloque por documento_id y término de búsqueda (para function calling)
    // Busca progresivamente: titulo → resumen_bloque → contenido
    public function getByDocumentoAndTitulo($documentoId, $titulo) {
        // 1. Buscar en título
        $query = "SELECT * FROM {$this->table_name}
                  WHERE documento_id = ? AND titulo LIKE ?
                  LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$documentoId, "%{$titulo}%"]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) return $result;

        // 2. Buscar en resumen del bloque
        $query = "SELECT * FROM {$this->table_name}
                  WHERE documento_id = ? AND resumen_bloque LIKE ?
                  LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$documentoId, "%{$titulo}%"]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) return $result;

        // 3. Buscar en contenido del bloque
        $query = "SELECT * FROM {$this->table_name}
                  WHERE documento_id = ? AND contenido LIKE ?
                  LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$documentoId, "%{$titulo}%"]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Obtener bloque por documento_id y orden
    public function getByDocumentoAndOrden($documentoId, $orden) {
        $query = "SELECT * FROM {$this->table_name}
                  WHERE documento_id = ? AND orden = ?
                  LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$documentoId, $orden]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Verificar si un documento tiene bloques
    public function documentoTieneBloques($documentoId) {
        $query = "SELECT COUNT(*) as total FROM {$this->table_name} WHERE documento_id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$documentoId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return ($row['total'] > 0);
    }

    // Insertar un bloque
    public function create() {
        $query = "INSERT INTO {$this->table_name}
                  (documento_id, orden, titulo, resumen_bloque, contenido, tokens_estimados, created)
                  VALUES (?, ?, ?, ?, ?, ?, NOW())";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute([
            $this->documento_id,
            $this->orden,
            $this->titulo,
            $this->resumen_bloque,
            $this->contenido,
            $this->tokens_estimados
        ]);
    }

    // Eliminar todos los bloques de un documento (para regenerar)
    public function deleteByDocumento($documentoId) {
        $query = "DELETE FROM {$this->table_name} WHERE documento_id = ?";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute([$documentoId]);
    }
}
?>
