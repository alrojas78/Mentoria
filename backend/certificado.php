<?php
require_once './config/db.php';
require_once './models/User.php';
require_once './models/Course.php';

$user_id = $_GET['user_id'] ?? null;
$course_id = $_GET['course_id'] ?? null;

if (!$user_id || !$course_id) {
    echo "Parámetros faltantes";
    exit;
}

$db = (new Database())->getConnection();

// Obtener datos del usuario
$stmt = $db->prepare("SELECT nombre FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Obtener datos del curso
$stmt = $db->prepare("SELECT titulo, duracion FROM courses WHERE id = ?");
$stmt->execute([$course_id]);
$course = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user || !$course) {
    echo "Usuario o curso no encontrado.";
    exit;
}

$nombre = $user['nombre'];
$curso = $course['titulo'];
$duracion = $course['duracion'] ?? 'N/A';
$fecha = date('Y-m-d');
$folio = strtoupper(substr(md5($user_id . $course_id . $fecha), 0, 10));
?>

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Certificado de Finalización</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      text-align: center;
      background-color: #f4f6f8;
      padding: 3rem;
    }
    .certificado {
      background-color: white;
      border: 2px solid #2b4361;
      border-radius: 12px;
      padding: 3rem;
      max-width: 800px;
      margin: auto;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    .titulo {
      font-size: 2rem;
      color: #2b4361;
      margin-bottom: 1rem;
    }
    .nombre {
      font-size: 1.5rem;
      font-weight: bold;
      color: #34495e;
    }
    .curso {
      font-size: 1.25rem;
      margin: 1rem 0;
      color: #2b4361;
    }
    .footer {
      margin-top: 3rem;
      font-size: 0.9rem;
      color: #7f8c8d;
    }
    .firma {
      margin-top: 2rem;
    }
    .firma img {
      width: 150px;
    }
    .boton {
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background-color: #2b4361;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="certificado">
    <div class="titulo">Certificado de Finalización</div>
    <p>Otorgado a:</p>
    <div class="nombre"><?= htmlspecialchars($nombre) ?></div>
    <p>por completar satisfactoriamente el curso</p>
    <div class="curso">“<?= htmlspecialchars($curso) ?>”</div>
    <p>con una duración estimada de <strong><?= htmlspecialchars($duracion) ?> horas</strong></p>
    <div class="firma">
      <img src="assets/firma.png" alt="Firma o sello" />
    </div>
    <div class="footer">
      <p>Fecha de finalización: <?= $fecha ?></p>
      <p>Código de verificación: <strong><?= $folio ?></strong></p>
    </div>
    <form method="post" action="descargar_certificado.php">
      <input type="hidden" name="user_id" value="<?= $user_id ?>">
      <input type="hidden" name="course_id" value="<?= $course_id ?>">
      <button class="boton" type="submit">Descargar en PDF</button>
    </form>
  </div>
</body>
</html>
