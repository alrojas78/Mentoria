<?php
/**
 * EstadisticasFilter.php
 * Filtro compartido para validar si una pregunta es relevante para estadísticas.
 * Usado por consulta.php (modo texto) y save-realtime-transcripts.php (modo voz).
 */

class EstadisticasFilter {

    /**
     * Detecta si el texto es un comando del sistema (no una pregunta real).
     * @return string|null  Tipo de comando detectado, o null si no es comando.
     */
    public static function detectarComandoMejorado($question) {
        $questionLower = strtolower(trim($question));

        // Comandos de modo mentor
        if (strpos($questionLower, 'activar modo mentor') !== false ||
            strpos($questionLower, 'activar el modo mentor') !== false ||
            strpos($questionLower, 'activa el modelo mentor') !== false ||
            strpos($questionLower, 'modo mentor') !== false) {
            return 'activar_mentor';
        }

        if (strpos($questionLower, 'salir modo mentor') !== false ||
            strpos($questionLower, 'salir del modo mentor') !== false ||
            strpos($questionLower, 'desactivar modo mentor') !== false) {
            return 'salir_mentor';
        }

        // Comandos de modo evaluación
        if (strpos($questionLower, 'activar modo evaluacion') !== false ||
            strpos($questionLower, 'activar modo evaluación') !== false ||
            strpos($questionLower, 'iniciar evaluacion') !== false ||
            strpos($questionLower, 'iniciar evaluación') !== false) {
            return 'activar_evaluacion';
        }

        if (strpos($questionLower, 'salir modo evaluacion') !== false ||
            strpos($questionLower, 'salir modo evaluación') !== false ||
            strpos($questionLower, 'cancelar evaluacion') !== false) {
            return 'salir_evaluacion';
        }

        // Comandos de modo consulta (para inicio desde popup)
        if (strpos($questionLower, 'iniciar modo consulta') !== false ||
            strpos($questionLower, 'comenzar modo consulta') !== false ||
            strpos($questionLower, 'activar modo consulta') !== false) {
            return 'iniciar_consulta';
        }

        // Detectar patrones de comandos/instrucciones del sistema
        $patronesComando = [
            '/^(ok|entendido)$/i',
            '/^(preparando|cargando|activando|procesando)/i',
            '/sistema:|error:|debug:/i',
            '/^(ready|loading|processing)/i'
        ];

        foreach ($patronesComando as $patron) {
            if (preg_match($patron, $questionLower)) {
                return 'comando_sistema';
            }
        }

        return null;
    }

    /**
     * Valida si una pregunta es relevante para estadísticas de consultas.
     * @return bool  true si es una pregunta real, false si es filler/comando/basura.
     */
    public static function esPreguntaValidaParaEstadisticas($question) {
        $questionTrimmed = trim($question);
        $questionLower = strtolower($questionTrimmed);
        $longitudPregunta = mb_strlen($questionTrimmed);

        // 1. Filtro por longitud mínima
        if ($longitudPregunta < 10) {
            return false;
        }

        // 2. Filtro por longitud máxima (texto pegado)
        if ($longitudPregunta > 500) {
            return false;
        }

        // 3. Detectar si es un comando
        if (self::detectarComandoMejorado($question) !== null) {
            return false;
        }

        // 4. Filtrar respuestas simples de una sola palabra
        $palabrasSimples = [
            'si', 'sí', 'no', 'ok', 'vale', 'bien', 'entendido', 'gracias',
            'listo', 'siguiente', 'continuar', 'claro', 'perfecto', 'excelente',
            'bueno', 'mal', 'regular', 'así', 'eso', 'esto', 'aquello',
            'ready', 'yes', 'yeah', 'nope', 'done', 'next', 'continue'
        ];

        $palabras = explode(' ', $questionLower);
        if (count($palabras) === 1 && in_array($questionLower, $palabrasSimples)) {
            return false;
        }

        // 5. Filtrar mensajes del sistema o instrucciones
        $patronesSistema = [
            '/^(activando|preparando|cargando|iniciando|procesando|finalizando)/i',
            '/^(sistema|error|debug|warning|info):/i',
            '/modo (consulta|mentor|evaluaci[oó]n) (activado|desactivado)/i',
            '/(bienvenido|welcome) (a|to)/i',
            '/^(¡|!)?(felicidades|congratulations)/i',
            '/evaluaci[oó]n completada/i',
            '/has (aprobado|reprobado)/i',
            '/intento n[uú]mero/i'
        ];

        foreach ($patronesSistema as $patron) {
            if (preg_match($patron, $question)) {
                return false;
            }
        }

        // 6. Filtrar respuestas de evaluación (números, letras sueltas)
        if (preg_match('/^[a-d]$/i', $questionLower) ||
            preg_match('/^[0-9]+$/', $questionLower) ||
            preg_match('/^respuesta\s*[a-d]$/i', $questionLower)) {
            return false;
        }

        // 7. Verificar indicadores de pregunta
        $esInterrogativa =
            preg_match('/\?$/', $questionTrimmed) ||
            preg_match('/^(qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|por qu[eé]|cu[aá]l|qui[eé]n|para qu[eé])/i', $questionLower) ||
            preg_match('/(explica|define|dime|indica|describe|menciona|enumera|lista)/i', $questionLower) ||
            preg_match('/(puedes|podrías|me ayudas|necesito|quisiera|quiero saber)/i', $questionLower);

        // Si no tiene indicador de pregunta y es muy corta, rechazar
        if (!$esInterrogativa && $longitudPregunta < 20) {
            return false;
        }

        // 8. Filtrar contenido repetitivo
        $palabrasUnicas = array_unique($palabras);
        $ratioRepeticion = count($palabrasUnicas) / count($palabras);

        if ($ratioRepeticion < 0.5) {
            return false;
        }

        return true;
    }
}
