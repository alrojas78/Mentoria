<?php
// Cargar .env
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (!empty($key)) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
        }
    }
}

// Configuracion general
define('BASE_URL', '/vozama/api');

// Constantes desde env
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'voicemed_secret_key_change_in_production');

// Configuracion de AWS/Polly
define('AWS_ACCESS_KEY', getenv('AWS_ACCESS_KEY'));
define('AWS_SECRET_KEY', getenv('AWS_SECRET_KEY'));
define('AWS_REGION', getenv('AWS_REGION') ?: 'us-east-1');

// Configuracion de ElevenLabs
define('ELEVENLABS_API_KEY', getenv('ELEVENLABS_API_KEY'));

// Configuracion de OpenAI
define('OPENAI_API_KEY', getenv('OPENAI_API_KEY'));

// Configuracion de Operatix (Fase 11 - WhatsApp Training)
define('OPERATIX_BASE_URL', getenv('OPERATIX_BASE_URL') ?: 'https://operatix.co');
define('OPERATIX_API_KEY', getenv('OPERATIX_API_KEY') ?: '');
define('OPERATIX_SERVICE_EMAIL', getenv('OPERATIX_SERVICE_EMAIL') ?: 'bridge@mentoria.ateneo.co');
?>
