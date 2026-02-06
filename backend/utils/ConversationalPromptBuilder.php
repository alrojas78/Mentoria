<?php
/**
 * ConversationalPromptBuilder
 * 
 * Servicio especializado para construir prompts conversacionales inteligentes
 * que manejan fuzzy matching, comprensión semántica y personalización.
 * 
 * @author MentorIA Team
 * @version 1.0
 */

class ConversationalPromptBuilder {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Obtiene el nombre del usuario desde la base de datos
     * 
     * @param int $userId ID del usuario
     * @return string Nombre del usuario o 'estudiante' como fallback
     */
    public function getUserName($userId) {
        try {
            $stmt = $this->db->prepare("SELECT nombre, role FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user && !empty($user['nombre'])) {
                // Extraer solo el primer nombre si hay varios
                $nombres = explode(' ', trim($user['nombre']));
                $primerNombre = $nombres[0];
                
                // Solo considerar como rol si el campo 'nombre' es EXACTAMENTE igual al campo 'role'
                // O si es un placeholder genérico obvio
                $placeholdersGenericos = ['user', 'usuario', 'test', 'prueba', 'demo'];
                $nombreLower = strtolower($primerNombre);
                
                // Si el nombre es un placeholder genérico, intentar segundo nombre
                if (in_array($nombreLower, $placeholdersGenericos)) {
                    if (isset($nombres[1])) {
                        return $nombres[1];
                    }
                    return 'estudiante';
                }
                
                // Si el nombre es "Administrador" pero el usuario tiene rol admin, es su nombre real
                // Lo usamos tal cual
                return $primerNombre;
            }
            
            return 'estudiante';
        } catch (Exception $e) {
            error_log("Error obteniendo nombre de usuario: " . $e->getMessage());
            return 'estudiante';
        }
    }
    
    /**
     * Obtiene una variación del nombre (diminutivo o nombre completo) para conversación más natural
     * 
     * @param string $nombreCompleto Nombre completo del usuario
     * @return string Nombre o diminutivo apropiado
     */
    public function getNameVariation($nombreCompleto) {
        // Mapeo de nombres comunes a sus diminutivos formales/cálidos
        $diminutivos = [
            'Alexander' => 'Alex',
            'Alejandro' => 'Ale',
            'Alexandra' => 'Alex',
            'Alejandra' => 'Ale',
            'Francisco' => 'Fran',
            'Francisca' => 'Fran',
            'Fernando' => 'Fer',
            'Fernanda' => 'Fer',
            'Roberto' => 'Rober',
            'Rafael' => 'Rafa',
            'Carolina' => 'Caro',
            'Carlos' => 'Carlitos',
            'Daniel' => 'Dani',
            'Daniela' => 'Dani',
            'Diana' => 'Diani',
            'Gabriel' => 'Gabi',
            'Gabriela' => 'Gabi',
            'Sebastian' => 'Seba',
            'Sebastián' => 'Seba',
            'Andrés' => 'Andre',
            'Andrea' => 'Andre',
            'José' => 'Pepe',
            'Jose' => 'Pepe',
            'María' => 'Mari',
            'Maria' => 'Mari',
            'Isabel' => 'Isa',
            'Catalina' => 'Cata',
            'Valentina' => 'Vale',
            'Santiago' => 'Santi',
            'Cristian' => 'Cris',
            'Cristina' => 'Cris',
            'Natalia' => 'Nati',
            'Camila' => 'Cami',
            'Juliana' => 'Juli',
            'Julian' => 'Juli',
            'Leonardo' => 'Leo',
            'Patricia' => 'Pati',
            'Patricio' => 'Pato',
            'Ricardo' => 'Ricky',
            'Luis' => 'Lucho',
            'Luisa' => 'Lu',
            'Miguel' => 'Migue',
            'Victoria' => 'Vicky',
            'Victor' => 'Vico',
            'Administrador' => 'Admin' // Para tu caso específico
        ];
        
        // 30% de probabilidad de usar diminutivo (no siempre, para naturalidad)
        $usarDiminutivo = (rand(1, 100) <= 30);
        
        if ($usarDiminutivo && isset($diminutivos[$nombreCompleto])) {
            return $diminutivos[$nombreCompleto];
        }
        
        return $nombreCompleto;
    }
    
    /**
     * Construye un system prompt inteligente para modo CONSULTA
     * 
     * @param object $documento Objeto documento con titulo y contenido
     * @param string $userName Nombre del usuario
     * @param array $contextMessages Historial reciente de mensajes (opcional)
     * @return string System prompt completo
     */
    public function buildConsultaPrompt($documento, $userName, $contextMessages = [], $analisisRelevancia = null) {
    $tituloDocumento = $documento->titulo;
    $contenidoDocumento = $documento->contenido;
    
    // Obtener variación del nombre (a veces diminutivo, a veces completo)
    $nombreAUsar = $this->getNameVariation($userName);
    
    // Construir contexto conversacional si existe
    $contextoHistorial = '';
    if (!empty($contextMessages)) {
        $contextoHistorial = "\n\n**CONTEXTO DE LA CONVERSACIÓN RECIENTE:**\n";
        foreach ($contextMessages as $msg) {
            $rol = $msg['role'] === 'user' ? "{$nombreAUsar}" : "Tú (IA)";
            $contextoHistorial .= "- {$rol}: {$msg['content']}\n";
        }
        $contextoHistorial .= "\n**REGLAS CRÍTICAS DE USO DE CONTEXTO:**\n";
        $contextoHistorial .= "1. 🚫 NUNCA repitas información que YA DISTE en el contexto anterior\n";
        $contextoHistorial .= "2. ✅ Si {$nombreAUsar} responde con afirmación (\"sí\", \"claro\", \"me gustaría\"), CONTINÚA donde lo dejaste\n";
        $contextoHistorial .= "3. ✅ Si ofreciste hablar sobre un tema, y acepta, habla DIRECTAMENTE de ese tema nuevo\n";
        $contextoHistorial .= "4. ✅ Asume que {$nombreAUsar} recuerda todo lo que ya conversaron\n";
        $contextoHistorial .= "5. 🎯 Cuando acepte tu oferta, NO repitas lo anterior, avanza al tema nuevo ofrecido\n\n";
    }
    
    // NUEVA SECCIÓN: Manejo de relevancia baja
    $instruccionesRelevancia = '';
    if ($analisisRelevancia && isset($analisisRelevancia['confianza'])) {
        if ($analisisRelevancia['confianza'] < 0.6) {
            $instruccionesRelevancia = "\n\n**⚠️ INSTRUCCIONES ESPECIALES DE RELEVANCIA:**\n";
            $instruccionesRelevancia .= "La pregunta del usuario podría no estar directamente relacionada con el documento.\n";
            $instruccionesRelevancia .= "- Si encuentras CUALQUIER conexión relevante con el contenido, responde de manera útil\n";
            $instruccionesRelevancia .= "- Busca términos similares, conceptos relacionados o analogías aplicables\n";
            $instruccionesRelevancia .= "- Si la pregunta usa términos médicos generales (IBP, inhibidores, tratamiento), búscalos en el contenido\n";
            $instruccionesRelevancia .= "- Solo si REALMENTE no hay ninguna relación posible, sugiere amablemente reorientar hacia el documento\n";
            $instruccionesRelevancia .= "- Razón del análisis: " . ($analisisRelevancia['razon'] ?? 'Pregunta ambigua') . "\n\n";
        } elseif ($analisisRelevancia['confianza'] < 0.8) {
            $instruccionesRelevancia = "\n\n**💡 NOTA DE RELEVANCIA:**\n";
            $instruccionesRelevancia .= "La pregunta está relacionada con el tema. Sé flexible en tu interpretación.\n";
            $instruccionesRelevancia .= "- Interpreta términos médicos de manera amplia\n";
            $instruccionesRelevancia .= "- Conecta conceptos aunque no sean mencionados exactamente igual\n\n";
        }
    }
    
    $prompt = "Eres un mentor educativo experto especializado en '{$tituloDocumento}'.

**TU IDENTIDAD:**
- Eres un tutor paciente, empático y conversacional
- Tu estudiante se llama {$nombreAUsar} - úsalo naturalmente en la conversación
- Respondes de manera clara, directa y amigable
- No eres un robot, eres un mentor que conoce a su estudiante

**CAPACIDADES CONVERSACIONALES AVANZADAS:**

1. **FUZZY MATCHING (Tolerancia a errores de transcripción de voz):**
   - Si el usuario menciona palabras que suenan similares a términos del contenido, DEDUCE la palabra correcta
   - Ejemplos de corrección automática:
     * \"vozama\" o \"bosama\" o \"vo sama\" → Busca en el contenido si existe \"Vozama\" o similar
     * \"ácido clorhídrico\" mal pronunciado → Entiende que se refiere al concepto correcto
     * Errores de ortografía o pronunciación → Corrige internamente y responde
   - NUNCA digas \"no entiendo esa palabra\" si puedes deducir el término correcto del contexto

2. **COMPRENSIÓN SEMÁNTICA (Variaciones de la misma pregunta):**
   - Estas preguntas son EQUIVALENTES y deben responderse igual:
     * \"¿Cómo se secreta el ácido clorhídrico?\"
     * \"¿Cuál es el proceso de secreción del ácido clorhídrico?\"
     * \"Explícame paso a paso la secreción de ácido clorhídrico\"
     * \"¿De qué manera se produce la secreción del HCl?\"
   - Entiende la INTENCIÓN, no las palabras exactas
   - Si dos preguntas buscan la misma información, responde consistentemente

3. **CONVERSACIÓN NATURAL Y PERSONALIZADA:**
   - Usa el nombre {$nombreAUsar} ocasionalmente (1-2 veces por respuesta si es natural)
   - NO inicies TODAS las respuestas con 'Hola'
   - Solo saluda cuando:
     * Sea el primer mensaje de la conversación
     * El usuario salude primero
     * Haya pasado mucho tiempo entre mensajes
   - Haz preguntas de seguimiento para verificar comprensión
   - Ofrece profundizar en temas relacionados cuando sea relevante
   - Mantén un tono cálido pero profesional

4. **MANEJO DE PREGUNTAS DE SEGUIMIENTO Y CONTINUACIÓN:**
   - **CRÍTICO:** Usa el contexto previo para mantener coherencia conversacional
   - Si {$nombreAUsar} dice 'sí', 'claro', 'me gustaría', significa que acepta tu oferta anterior
   - **EJEMPLO DE USO CORRECTO DEL CONTEXTO:**
     
     **Mal (X):**
     Tú ofreciste hablar sobre bloqueadores de potasio
     {$nombreAUsar}: sí me gustaría
     Respuesta INCORRECTA: Repites todo sobre IBP de nuevo
     
     **Bien (OK):**
     Tú ofreciste hablar sobre bloqueadores de potasio
     {$nombreAUsar}: sí me gustaría
     Respuesta CORRECTA: Hablas directamente sobre bloqueadores de potasio SIN repetir IBP
   
   - Si {$nombreAUsar} dice '¿y eso?', '¿por qué?' o '¿cómo?', se refiere al ÚLTIMO tema que mencionaste
   - **NO vuelvas a explicar desde cero** si ya lo explicaste, solo elabora o profundiza
   - Mantén coherencia con lo que ya explicaste, avanza la conversación

**REGLAS DE CONTENIDO:**

1. **VERIFICACIÓN DE RELEVANCIA INTELIGENTE:**
   - Sé FLEXIBLE al interpretar si una pregunta está relacionada
   - Busca conexiones indirectas, términos médicos generales, o conceptos aplicables
   - Términos como \"IBP\", \"inhibidor\", \"tratamiento\", \"Osama\" pueden estar en el contenido con variaciones
   - Solo rechaza preguntas CLARAMENTE no relacionadas (deportes, clima, entretenimiento)
   - Si rechazas, responde: \"Lo siento {$nombreAUsar}, eso no está relacionado con {$tituloDocumento}. ¿Tienes alguna pregunta sobre el contenido del documento?\"

2. **SUGERENCIAS PROACTIVAS:**
   - Cuando respondas algo complejo, sugiere temas relacionados que podrían interesar
   - Ejemplo: \"¿Te gustaría que profundice en [tema relacionado]?\"
   - Si el contenido tiene múltiples aspectos, ofrece explorarlos

3. **FORMATO DE RESPUESTA:**
   - Respuestas CONCISAS (máximo 150 palabras para conceptos simples)
   - Si el tema es complejo, pregunta si quiere versión resumida o detallada
   - Usa analogías cuando ayuden a la comprensión
   - Incluye ejemplos prácticos si están en el contenido

{$instruccionesRelevancia}
{$contextoHistorial}

**CONTENIDO DEL DOCUMENTO:**
Título: {$tituloDocumento}
Contenido completo:
{$contenidoDocumento}

**IMPORTANTE:** 
- Si hay imágenes disponibles en los anexos y son relevantes, SIEMPRE usa las etiquetas [IMG:ID]
- Mantén el tono conversacional como si {$nombreAUsar} estuviera frente a ti
- Adapta tu nivel de explicación según las señales del estudiante
- Sé PERMISIVO con preguntas que podrían estar relacionadas - busca siempre una conexión útil";

    return $prompt;
}
    
    /**
     * Construye un system prompt para verificar si una pregunta está relacionada con el tema
     * (Útil para pre-validación rápida)
     * 
     * @param string $documentTitle Título del documento
     * @param string $userQuestion Pregunta del usuario
     * @return string Prompt de verificación
     */
    public function buildRelevanceCheckPrompt($documentTitle, $userQuestion) {
        return "Eres un clasificador de relevancia de preguntas.

TAREA: Determina si la pregunta del usuario está relacionada con el tema '{$documentTitle}'.

PREGUNTA DEL USUARIO: {$userQuestion}

**CONSIDERACIONES:**
- Usa FUZZY MATCHING: si menciona palabras similares o mal pronunciadas relacionadas con el tema, es RELEVANTE
- Preguntas sobre conceptos, procesos, mecanismos del tema son RELEVANTES
- Preguntas genéricas sobre otros temas médicos NO relacionados son IRRELEVANTES

Responde en formato JSON:
{
  \"is_relevant\": true/false,
  \"confidence\": 0.0-1.0,
  \"detected_topic\": \"tema detectado en la pregunta\"
}";
    }
    
    /**
     * Construye mensaje de bienvenida personalizado
     * 
     * @param string $userName Nombre del usuario
     * @param string $documentTitle Título del documento
     * @return string Mensaje de bienvenida
     */
    public function buildWelcomeMessage($userName, $documentTitle) {
        return "¡Hola {$userName}! 👋 Soy tu mentor para '{$documentTitle}'. 

Estoy aquí para ayudarte a comprender este contenido de manera clara y conversacional. Puedes:
- Hacer cualquier pregunta sobre el tema
- Pedirme que profundice en conceptos específicos
- Solicitar ejemplos o analogías
- Pedirme que resuma o explique de otra manera

¿Cómo te gustaría comenzar?";
    }
    
    /**
     * Genera un prompt para crear una pregunta de verificación de comprensión
     * (Para que el sistema pregunte al estudiante si entendió)
     * 
     * @param string $topicExplained Tema que se acaba de explicar
     * @param string $userName Nombre del usuario
     * @return string Prompt para generar pregunta
     */
    public function buildComprehensionCheckPrompt($topicExplained, $userName) {
        return "Acabas de explicarle a {$userName} sobre: {$topicExplained}

Genera UNA pregunta natural y breve para verificar si comprendió el concepto. 
La pregunta debe:
- Ser conversacional (como un mentor real preguntaría)
- Enfocarse en el concepto clave, no en detalles triviales
- Permitir respuesta abierta
- Sonar natural (ej: \"¿Te quedó claro cómo...?\" o \"¿Entendiste la diferencia entre...?\")

Responde SOLO con la pregunta, sin explicaciones adicionales.";
    }
    
    /**
     * Construye un prompt para generar sugerencias de temas relacionados
     * 
     * @param string $currentTopic Tema actual de discusión
     * @param string $documentContent Contenido completo del documento
     * @param string $userName Nombre del usuario
     * @return string Prompt para sugerencias
     */
    public function buildRelatedTopicsSuggestionPrompt($currentTopic, $documentContent, $userName) {
        return "El estudiante {$userName} acaba de preguntar sobre: {$currentTopic}

CONTENIDO DEL DOCUMENTO:
{$documentContent}

Identifica 2-3 temas relacionados del MISMO documento que podrían interesarle naturalmente después de este tema.

Responde en formato JSON:
{
  \"suggestions\": [
    \"Tema relacionado 1\",
    \"Tema relacionado 2\",
    \"Tema relacionado 3\"
  ]
}

Los temas DEBEN estar en el documento proporcionado.";
    }
    
    /**
     * Construye un prompt para analizar la intención del usuario
     * (Detecta si quiere profundizar, cambiar de tema, o tiene duda)
     * 
     * @param string $userMessage Mensaje del usuario
     * @param array $recentContext Contexto reciente (últimos 2-3 mensajes)
     * @return string Prompt de análisis de intención
     */
    public function buildIntentAnalysisPrompt($userMessage, $recentContext = []) {
        $contextStr = '';
        if (!empty($recentContext)) {
            $contextStr = "\n\nCONTEXTO PREVIO:\n";
            foreach ($recentContext as $msg) {
                $contextStr .= "- {$msg['role']}: {$msg['content']}\n";
            }
        }
        
        return "Analiza la intención del usuario en su mensaje.

MENSAJE DEL USUARIO: \"{$userMessage}\"
{$contextStr}

Clasifica la intención en una de estas categorías:
- \"new_question\": Nueva pregunta sobre un tema
- \"follow_up\": Pregunta de seguimiento sobre el tema anterior
- \"clarification\": Pide aclaración o no entendió algo
- \"deeper_dive\": Quiere profundizar en el tema actual
- \"change_topic\": Quiere cambiar a otro tema
- \"confirmation\": Confirma que entendió (ej: \"ok\", \"entiendo\", \"claro\")

Responde en formato JSON:
{
  \"intent\": \"categoría\",
  \"confidence\": 0.0-1.0,
  \"needs_context\": true/false
}";
    }
}
?>