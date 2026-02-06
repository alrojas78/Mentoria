<?php
require_once __DIR__ . '/vendor/autoload.php';
use Dompdf\Dompdf;
use Dompdf\Options;

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Course.php';

// Validar POST
$userId = $_POST['user_id'] ?? null;
$courseId = $_POST['course_id'] ?? null;

if (!$userId || !$courseId) {
    die('Faltan parámetros');
}

// Obtener datos
$db = (new Database())->getConnection();

$stmt = $db->prepare("SELECT nombre FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

$stmt = $db->prepare("SELECT titulo, duracion FROM courses WHERE id = ?");
$stmt->execute([$courseId]);
$course = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user || !$course) {
    die('Datos no encontrados');
}

$nombre = $user['nombre'];
$titulo = $course['titulo'];
$duracion = $course['duracion'] ?? 'N/A';
$fecha = date('d/m/Y');
$folio = strtoupper(substr(md5($userId . $courseId . $fecha), 0, 10));

// HTML del certificado
$html = "
<style>
    body {
        font-family: 'Segoe UI', sans-serif;
        margin: 0;
        padding: 0;
    }

    .certificado {
        width: 93%;
        height: auto;
        padding: 2rem 3rem;
        box-sizing: border-box;
        border: 2px solid #2b4361;
        border-radius: 12px;
        text-align: center;
    }

    h1 {
        color: #2b4361;
        font-size: 28px;
        margin-bottom: 1rem;
    }

    .nombre {
        font-size: 22px;
        font-weight: bold;
        color: #34495e;
    }

    .curso {
        font-size: 20px;
        color: #2b4361;
        margin: 1rem 0;
    }

    .firma {
        margin: 1.5rem auto 0.5rem;
        width: 120px;
        height: auto;
    }

    .footer {
        margin-top: 1rem;
        font-size: 12px;
        color: #7f8c8d;
    }
</style>
<div class='certificado'>
    <img src='https://voicemed.edtechsm.com/backend/assets/logo.png' style='height: 70px; margin-bottom: 1rem;'>
    <h1>Certificado de Finalización</h1>
    <p>Otorgado a:</p>
    <div class='nombre'>{$nombre}</div>
    <p>por completar satisfactoriamente el curso:</p>
    <div class='curso'>“{$titulo}”</div>
    <p>Duración estimada: <strong>{$duracion} horas</strong></p>
    <img src='https://voicemed.edtechsm.com/backend/assets/firma.png' class='firma' alt='Firma' />
    <div class='footer'>
        <p>Fecha de finalización: {$fecha}</p>
        <p>Código de verificación: <strong>{$folio}</strong></p>
        <p style='font-style: italic;'>Firmado electrónicamente por VoiceMed</p>
    </div>
</div>
";


// Configurar Dompdf
$options = new Options();
$options->set('isRemoteEnabled', true);
$options->set('defaultFont', 'Segoe UI');
$dompdf = new Dompdf($options);

// Cargar HTML y establecer tamaño legal horizontal (8.5x14 pulgadas)
$dompdf->loadHtml($html);
$dompdf->setPaper('legal', 'landscape');


$dompdf->render();
$dompdf->stream("certificado_{$nombre}.pdf", ["Attachment" => true]);
