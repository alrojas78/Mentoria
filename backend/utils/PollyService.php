<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/AudioCleanupService.php';

use Aws\Polly\PollyClient;
use Aws\Exception\AwsException;

/**
 * Elimina emojis, simbolos y limpia el texto para AWS Polly
 */
function limpiarTextoParaPolly($texto)
{
    // 1. Eliminar TODOS los emojis
    $textoPlano = preg_replace('/[\x{1F000}-\x{1FFFF}]/u', '', $texto);
    $textoPlano = preg_replace('/[\x{2600}-\x{27BF}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{FE00}-\x{FE0F}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{1F900}-\x{1FAFF}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{200D}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{231A}-\x{231B}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{23E9}-\x{23F3}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{25A0}-\x{25FF}]/u', '', $textoPlano);
    $textoPlano = preg_replace('/[\x{2B00}-\x{2BFF}]/u', '', $textoPlano);

    // 2. Eliminar caracteres especiales de markdown
    $textoPlano = str_replace('**', '', $textoPlano);
    $textoPlano = str_replace('__', ' ', $textoPlano);
    $textoPlano = str_replace('_', ' ', $textoPlano);
    $textoPlano = str_replace('##', '', $textoPlano);
    $textoPlano = preg_replace('/\*([^\*]+)\*/', '$1', $textoPlano);

    // 3. Eliminar multiples puntos y caracteres repetidos
    $textoPlano = preg_replace('/\.{2,}/', '.', $textoPlano);
    $textoPlano = preg_replace('/\?{2,}/', '?', $textoPlano);
    $textoPlano = preg_replace('/!{2,}/', '!', $textoPlano);

    // 4. Normalizar saltos de linea
    $textoPlano = str_replace(["\r\n", "\r"], "\n", $textoPlano);

    // 5. Normalizar porcentajes cerrados
    $textoPlano = preg_replace('/\b(\d+)\.00\s*%/', '$1 %', $textoPlano);
    $textoPlano = preg_replace('/\b0\.00\s*%/', '0 %', $textoPlano);

    // 6. Colapsar espacios multiples
    $textoPlano = preg_replace('/[ \t]+/', ' ', $textoPlano);

    // 7. Quitar espacios antes de puntuacion
    $textoPlano = preg_replace('/[ \t]+([.,;:?!])/', '$1', $textoPlano);

    // 8. Trim global
    $textoPlano = trim($textoPlano);

    // 9. Eliminar punto final (si no hay URL/email)
    $tieneURL = (
        stripos($textoPlano, 'www.') !== false ||
        stripos($textoPlano, 'http') !== false ||
        stripos($textoPlano, '@') !== false ||
        preg_match('/\.(com|co|org|net|edu)$/i', $textoPlano)
    );

    if (!$tieneURL) {
        $textoPlano = rtrim($textoPlano, '. ');
    }

    // 10. Construir SSML con parrafos y pausas
    $parrafos = preg_split('/\n{2,}/', $textoPlano);

    $ssml = '<speak>';

    foreach ($parrafos as $pRaw) {
        $pRaw = trim($pRaw);
        if ($pRaw === '') {
            continue;
        }

        $segmentos = preg_split('/\n+/', $pRaw);
        $ssml .= '<p>';
        $primerSegmento = true;
        
        foreach ($segmentos as $seg) {
            $seg = trim($seg);
            if ($seg === '') {
                continue;
            }

            $segEscapado = htmlspecialchars($seg, ENT_QUOTES | ENT_XML1, 'UTF-8');
            // Entre segmentos del mismo parrafo, pausa corta
            if (!$primerSegmento) {
                $ssml .= '<break time="300ms"/>';
            }

            $ssml .= $segEscapado;
            $primerSegmento = false;
        }
        // Pausa entre parrafos
        $ssml .= '</p>';
        $ssml .= '<break time="400ms"/>';
    }

    $ssml .= '</speak>';

    return $ssml;
}

/**
 * Reemplaza abreviaciones medicas por su pronunciacion correcta
 */
function aplicarGlosarioMedico($texto) {
    error_log("Aplicando glosario medico mejorado...");
    
    $glosario = [
        '_______' => '.',
        
        'AINEs' => 'antiinflamatorios no esteroideos',
        'AINES' => 'antiinflamatorios no esteroideos',
        'AINE' => 'antiinflamatorio no esteroideo',
        
        'IBPs' => 'i be pe',
        'IBP'  => 'i be pe',
        
        'ATP' => 'adenosin trifosfato, por sus siglas A T P',
        'ATPasa' => 'atepeasa',
        'H+/K+ ATPasa' => 'atepeasa de hidrogeno y potasio',
        'H+/K+-ATPasa' => 'atepeasa de hidrogeno y potasio',
        
        'H pylori' => 'helicobacter pilori',
        'H. pylori' => 'helicobacter pilori',
        'Helicobacter pylori' => 'helicobacter pilori',
        'Clostridium difficile' => 'clostridio dificile',
        'C. difficile' => 'clostridio dificile',
        
        'CO2' => 'dioxido de carbono, por sus siglas C O 2',
        'H2O' => 'agua, por formula H 2 O',
        
        'HCl' => 'acido clorhidrico',
        'EEI' => 'esfinter esofagico inferior',
        'AAS' => 'acido acetil salicilico',
        'ERGE' => 'enfermedad por reflujo gastroesofagico',
        'Antagonistas H2' => 'antagonistas de histamina dos',
        'antagonistas H2' => 'antagonistas de histamina dos',
        
        'mg/kg' => 'miligramos por kilogramo',
        'mg/dl' => 'miligramos por decilitro',
        'mg' => 'miligramos',
        'ml' => 'mililitros',
        'kg' => 'kilogramos',
        'cm' => 'centimetros',
        'mm' => 'milimetros',
        
        'Ej.' => 'por ejemplo',
        'Dr.' => 'doctor',
        'Dra.' => 'doctora',
        'vs.' => 'versus',
        'vs' => 'versus',
        'etc.' => 'etcetera',
        'pH' => 'pe hache',
        'TC' => 'tac',
        'i.v.' => 'intravenoso',
        'v.o.' => 'via oral',
        
        '20 mg' => 'veinte miligramos',
        '40 mg' => 'cuarenta miligramos',
        '80 mg' => 'ochenta miligramos',
        '10 mg' => 'diez miligramos',
        '5 mg' => 'cinco miligramos',
    ];
    
    $textoModificado = $texto;

    $siglasExplicadas = [
        'IBP' => 'inhibidor(?:es)? de la bomba de protones',
        'IBPs' => 'inhibidor(?:es)? de la bomba de protones',
        'AINE' => 'antiinflamatorio(?:s)? no esteroideo(?:s)?',
        'AINEs' => 'antiinflamatorio(?:s)? no esteroideo(?:s)?',
        'ERGE' => 'enfermedad por reflujo gastroesofagico',
        'ATP' => 'adenosin trifosfato',
    ];

    foreach ($siglasExplicadas as $sigla => $explicacionPattern) {
        $patterns = [
            '/\b' . preg_quote($sigla, '/') . '\b\s*,\s*o\s+' . $explicacionPattern . '/i',
            '/\b' . preg_quote($sigla, '/') . '\b\s*\(\s*' . $explicacionPattern . '/i',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $textoModificado)) {
                error_log("Detectado '$sigla' ya explicado en contexto - NO se reemplazara");
                unset($glosario[$sigla]);
                break;
            }
        }
    }
    
    uksort($glosario, function($a, $b) {
        return strlen($b) - strlen($a);
    });
    
    foreach ($glosario as $termino => $pronunciacion) {
        $terminoEscapado = preg_quote($termino, '/');
        
        if (preg_match('/[^a-zA-Z0-9\s]/', $termino)) {
            $textoModificado = str_ireplace($termino, $pronunciacion, $textoModificado);
        } else {
            $textoModificado = preg_replace(
                '/\b' . $terminoEscapado . '\b/i', 
                $pronunciacion, 
                $textoModificado
            );
        }
    }
    
    error_log("Glosario aplicado. Muestra: " . substr($textoModificado, 0, 150));
    
    return $textoModificado;
}

/**
 * Elimina siglas redundantes de manera mas efectiva
 */
function eliminarSiglasRedundantes($texto) {
    error_log("Eliminando redundancias del texto...");
    error_log("   Texto antes: " . substr($texto, 0, 200));

    $normalizarNumero = function($cadena) {
        return preg_replace('/([a-zA-Z]{4,})(es|s)\b/u', '$1', $cadena);
    };
    
    $textoLimpio = preg_replace_callback(
        '/\s*\(([^\)]{10,})\)/i',
        function($matches) use ($texto, $normalizarNumero) {
            $contenidoParentesis = trim($matches[1]);
            
            $textoSinEsteParentesis = str_replace($matches[0], '', $texto);
            
            $contenidoNorm = strtolower(eliminarAcentos($contenidoParentesis));
            $textoNorm    = strtolower(eliminarAcentos($textoSinEsteParentesis));

            $contenidoNormSimple = $normalizarNumero($contenidoNorm);
            $textoNormSimple     = $normalizarNumero($textoNorm);
            
            if (
                strpos($textoNorm, $contenidoNorm) !== false ||
                strpos($textoNormSimple, $contenidoNormSimple) !== false
            ) {
                error_log("   Eliminando parentesis redundante: ($contenidoParentesis)");
                return '';
            }
            
            return $matches[0];
        },
        $texto
    );
    
    $textoLimpio = preg_replace('/\s{2,}/', ' ', $textoLimpio);
    $textoLimpio = preg_replace('/\s+([.,;:?!])/', '$1', $textoLimpio);
    $textoLimpio = preg_replace('/\(\s*\)/', '', $textoLimpio);
    
    error_log("   Texto despues: " . substr($textoLimpio, 0, 200));
    
    return trim($textoLimpio);
}

/**
 * Elimina acentos de un texto para comparacion
 */
function eliminarAcentos($texto) {
    $acentos = [
        'a' => 'a', 'e' => 'e', 'i' => 'i', 'o' => 'o', 'u' => 'u',
        'A' => 'A', 'E' => 'E', 'I' => 'I', 'O' => 'O', 'U' => 'U',
        'n' => 'n', 'N' => 'N'
    ];
    return strtr($texto, $acentos);
}


class PollyService {
    private $client;
    private $cleanupService;
    
    public function __construct() {
        try {
            $this->client = new PollyClient([
                'version' => 'latest',
                'region' => AWS_REGION,
                'credentials' => [
                    'key' => AWS_ACCESS_KEY,
                    'secret' => AWS_SECRET_KEY
                ]
            ]);
            
            $this->cleanupService = new AudioCleanupService();
            
        } catch (Exception $e) {
            error_log("Error inicializando Polly: " . $e->getMessage());
        }
    }
    
    /**
     * Extrae el glosario medico como instrucciones para OpenAI Realtime
     * @return string Instrucciones de pronunciacion formateadas
     */
    public static function getMedicalGlossaryForInstructions() {
        $glossary = [
            'IBPs' => 'i be pe (inhibidores de bomba de protones)',
            'IBP' => 'i be pe',
            'ATP' => 'adenosin trifosfato',
            'ERGE' => 'enfermedad por reflujo gastroesofagico',
            'ECG' => 'electrocardiograma',
            'TA' => 'tension arterial',
            'FC' => 'frecuencia cardiaca',
            'FR' => 'frecuencia respiratoria',
            'SatO2' => 'saturacion de oxigeno',
            'mg/kg' => 'miligramos por kilogramo',
            'mcg' => 'microgramos',
            'mEq' => 'miliequivalentes',
            'UI' => 'unidades internacionales',
            'AINEs' => 'antiinflamatorios no esteroideos',
            'AINE' => 'antiinflamatorio no esteroideo',
            'H. pylori' => 'helicobacter pilori',
            'pH' => 'pe hache',
            'CO2' => 'dioxido de carbono',
            'H2O' => 'agua',
            'HCl' => 'acido clorhidrico',
            'EEI' => 'esfinter esofagico inferior',
            'AAS' => 'acido acetil salicilico',
            'TC' => 'tac',
            'i.v.' => 'intravenoso',
            'v.o.' => 'via oral',
        ];
        
        $instructions = [];
        foreach ($glossary as $term => $pronunciation) {
            $instructions[] = "- " . $term . ": pronunciar como \"" . $pronunciation . "\"";
        }
        
        return implode("\n", $instructions);
    }
    
    /**
     * Sintetiza texto a voz usando AWS Polly
     * @param string $text Texto a sintetizar
     * @param string $voiceId ID de la voz de Polly
     * @param string|null $sessionToken Token de sesion del usuario
     * @return array Resultado de la sintesis
     */
    public function synthesizeSpeech($text, $voiceId = 'Lupe', $sessionToken = null) {
        try {
            $textoOriginal = $text;
            
            error_log("=== PROCESAMIENTO DE TEXTO PARA POLLY ===");
            error_log("Paso 0 - Original: " . substr($textoOriginal, 0, 150));
            error_log("SessionToken: " . ($sessionToken ? substr($sessionToken, 0, 8) . '...' : 'No proporcionado'));
            
            // 1. Aplicar glosario medico PRIMERO
            $textoConGlosario = aplicarGlosarioMedico($textoOriginal);
            error_log("Paso 1 - Con glosario: " . substr($textoConGlosario, 0, 150));
            
            // 2. Eliminar siglas redundantes en parentesis
            $textoSinRedundancias = eliminarSiglasRedundantes($textoConGlosario);
            error_log("Paso 2 - Sin redundancias: " . substr($textoSinRedundancias, 0, 150));
            
            // 3. Limpiar caracteres especiales y crear SSML
            $textLimpio = limpiarTextoParaPolly($textoSinRedundancias);
            error_log("Paso 3 - SSML final: " . substr($textLimpio, 0, 150));
            
            // Verificar cache por sesion
            $cachedFile = $this->cleanupService->getCachedAudio($textoOriginal, $sessionToken);
            if ($cachedFile) {
                $fileName = basename($cachedFile);
                
                if ($sessionToken && strpos($cachedFile, 'session_') !== false) {
                    $sessionFolder = 'session_' . $sessionToken;
                    $url = '/backend/audio/' . $sessionFolder . '/' . $fileName;
                } else {
                    $url = '/backend/audio/' . $fileName;
                }
                
                error_log("Audio encontrado en cache: $fileName");
                
                return [
                    'success' => true,
                    'file' => $fileName,
                    'url' => $url,
                    'cached' => true
                ];
            }
            
            // Obtener carpeta de audio por sesion
            $audioDir = $this->cleanupService->getSessionAudioPath($sessionToken);
            error_log("Guardando en: $audioDir");
            
            // Llamar a AWS Polly con texto limpio
            error_log("Sintetizando con AWS Polly...");
            
            $result = $this->client->synthesizeSpeech([
                'OutputFormat' => 'mp3',
                'Text'         => $textLimpio,
                'VoiceId'      => $voiceId,
                'Engine'       => 'neural',
                'TextType'     => 'ssml',
            ]);
            
            $audioStream = $result->get('AudioStream')->getContents();
            
            // Guardar archivo con hash del texto original
            $textHash = substr(md5($textoOriginal), 0, 8);
            $fileName = 'speech_' . $textHash . '_' . time() . '.mp3';
            $filePath = $audioDir . '/' . $fileName;
            
            file_put_contents($filePath, $audioStream);
            
            if (!file_exists($filePath)) {
                throw new Exception("No se pudo escribir el archivo de audio");
            }
            
            error_log("Audio generado exitosamente: $fileName");
            
            // Limpieza automatica periodica
            if (rand(1, 5) === 1) {
                if ($sessionToken) {
                    $this->cleanupService->cleanup($sessionToken);
                }
                
                if (rand(1, 4) === 1) {
                    $this->cleanupService->cleanup();
                }
            }
            
            // Construir URL correcta segun carpeta
            if ($sessionToken) {
                $sessionFolder = 'session_' . $sessionToken;
                $url = '/backend/audio/' . $sessionFolder . '/' . $fileName;
            } else {
                $url = '/backend/audio/' . $fileName;
            }
            
            return [
                'success' => true,
                'file' => $fileName,
                'url' => $url,
                'cached' => false
            ];
            
        } catch (AwsException $e) {
            error_log("AWS Error en Polly: " . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        } catch (Exception $e) {
            error_log("Error general en Polly: " . $e->getMessage());
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
}
?>
