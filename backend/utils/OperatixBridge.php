<?php
/**
 * OperatixBridge - Puente de comunicación Mentoria → Operatix
 *
 * Encapsula toda la comunicación server-to-server con Operatix
 * usando API Key authentication. Operatix actúa como transporte
 * WhatsApp (Meta Business API) — Mentoria maneja toda la lógica educativa.
 *
 * @package Mentoria
 * @since Fase 11
 */

require_once __DIR__ . '/../config/config.php';

class OperatixBridge {

    private string $baseUrl;
    private string $apiKey;
    private int $timeout = 30;

    private static ?OperatixBridge $instance = null;

    public function __construct() {
        $this->baseUrl = rtrim(OPERATIX_BASE_URL, '/');
        $this->apiKey = OPERATIX_API_KEY;

        if (empty($this->apiKey)) {
            error_log('OperatixBridge: OPERATIX_API_KEY no configurada');
        }
    }

    /**
     * Singleton
     */
    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // =========================================================================
    // PROYECTOS
    // =========================================================================

    /**
     * Buscar proyecto en Operatix por nombre, o crearlo si no existe
     * @param string $nombre Nombre del proyecto
     * @param string|null $descripcion Descripción opcional
     * @return array|null Proyecto de Operatix {id, name, ...} o null si error
     */
    public function getOrCreateProject(string $nombre, ?string $descripcion = null): ?array {
        // Buscar existente
        $projects = $this->request('GET', '/api/v2/projects', ['search' => $nombre]);

        if ($projects && !empty($projects['projects'])) {
            foreach ($projects['projects'] as $p) {
                if (strcasecmp($p['name'], $nombre) === 0) {
                    return $p;
                }
            }
        }

        // Crear nuevo
        $result = $this->request('POST', '/api/v2/projects', [
            'name' => $nombre,
            'description' => $descripcion ?? "Proyecto vinculado desde Mentoria",
            'status' => 'active',
            'priority' => 'medium'
        ]);

        if ($result && isset($result['project']['id'])) {
            return $result['project'];
        }

        // Algunos endpoints retornan project_id
        if ($result && isset($result['project_id'])) {
            return $this->getProject((int)$result['project_id']);
        }

        error_log('OperatixBridge::getOrCreateProject - Error creando proyecto: ' . json_encode($result));
        return null;
    }

    /**
     * Obtener un proyecto por ID
     */
    public function getProject(int $projectId): ?array {
        $result = $this->request('GET', "/api/v2/projects/{$projectId}");
        return $result['project'] ?? $result ?? null;
    }

    // =========================================================================
    // META / WHATSAPP OAUTH
    // =========================================================================

    /**
     * Conectar WhatsApp usando Embedded Signup (sin redirect)
     * El code viene del Meta JavaScript SDK ejecutado en el frontend de Mentoria
     *
     * @param string $code Authorization code del Meta SDK
     * @param int $operatixProjectId ID del proyecto en Operatix
     * @return array {success, whatsapp: {connected, phone, display_name}, ...}
     */
    public function connectWhatsApp(string $code, int $operatixProjectId): array {
        $result = $this->request('POST', '/api/v2/meta/oauth/embedded-callback', [
            'code' => $code,
            'project_id' => $operatixProjectId
        ]);

        if (!$result) {
            return ['success' => false, 'error' => 'Error de comunicación con Operatix'];
        }

        return $result;
    }

    /**
     * Obtener estado de conexión WhatsApp para un proyecto
     */
    public function getWhatsAppStatus(int $operatixProjectId): array {
        $result = $this->request('GET', "/api/v2/projects/{$operatixProjectId}");

        if (!$result || !isset($result['project'])) {
            return ['connected' => false];
        }

        $project = $result['project'];
        $metaAccounts = $project['meta_accounts'] ?? [];

        if (empty($metaAccounts)) {
            return ['connected' => false];
        }

        $account = $metaAccounts[0];
        return [
            'connected' => true,
            'phone_number' => $account['wa_phone_number'] ?? null,
            'display_name' => $account['wa_phone_display_name'] ?? null,
            'business_name' => $account['meta_business_name'] ?? null,
            'waba_id' => $account['waba_id'] ?? null
        ];
    }

    /**
     * Desconectar WhatsApp de un proyecto
     */
    public function disconnectWhatsApp(): array {
        $result = $this->request('POST', '/api/v2/meta/oauth/disconnect');
        return $result ?? ['success' => false];
    }

    // =========================================================================
    // ENVÍO DE MENSAJES
    // =========================================================================

    /**
     * Enviar mensaje de texto libre (requiere ventana de 24h abierta)
     *
     * @param string $phone Número de teléfono con código de país
     * @param string $text Texto del mensaje
     * @param int|null $metaAccountId ID de la cuenta Meta específica
     * @return array Resultado del envío
     */
    public function sendTextMessage(string $phone, string $text, ?int $metaAccountId = null): array {
        $data = [
            'phone' => $phone,
            'type' => 'free',
            'message' => $text
        ];

        if ($metaAccountId) {
            $data['meta_account_id'] = $metaAccountId;
        }

        $result = $this->request('POST', '/api/v2/send/message', $data);
        return $result ?? ['success' => false, 'error' => 'Error enviando mensaje'];
    }

    /**
     * Enviar mensaje con template aprobado por Meta
     *
     * @param string $phone Número de teléfono
     * @param string $templateName Nombre del template en Meta
     * @param array $variables Variables del template
     * @param string $language Idioma del template
     * @param int|null $metaAccountId ID de la cuenta Meta
     * @return array Resultado del envío
     */
    public function sendTemplateMessage(string $phone, string $templateName, array $variables = [], string $language = 'es', ?int $metaAccountId = null): array {
        $data = [
            'phone' => $phone,
            'type' => 'template',
            'template_name' => $templateName,
            'variables' => $variables,
            'language' => $language
        ];

        if ($metaAccountId) {
            $data['meta_account_id'] = $metaAccountId;
        }

        $result = $this->request('POST', '/api/v2/send/message', $data);
        return $result ?? ['success' => false, 'error' => 'Error enviando template'];
    }

    /**
     * Enviar archivo multimedia (imagen, PDF, audio, video)
     *
     * @param string $phone Número de teléfono
     * @param string $mediaUrl URL pública del archivo
     * @param string $mediaType Tipo: image, document, audio, video
     * @param string|null $caption Texto acompañante
     * @param int|null $metaAccountId ID de la cuenta Meta
     * @return array Resultado del envío
     */
    public function sendMediaMessage(string $phone, string $mediaUrl, string $mediaType = 'document', ?string $caption = null, ?int $metaAccountId = null): array {
        $data = [
            'phone' => $phone,
            'type' => 'free',
            'message_type' => $mediaType,
            'media_url' => $mediaUrl
        ];

        if ($caption) {
            $data['caption'] = $caption;
        }
        if ($metaAccountId) {
            $data['meta_account_id'] = $metaAccountId;
        }

        $result = $this->request('POST', '/api/v2/send/message', $data);
        return $result ?? ['success' => false, 'error' => 'Error enviando media'];
    }

    // =========================================================================
    // TEMPLATES
    // =========================================================================

    /**
     * Obtener templates aprobados
     */
    public function getTemplates(): array {
        $result = $this->request('GET', '/api/v2/templates');
        return $result['templates'] ?? [];
    }

    /**
     * Sincronizar templates desde Meta
     */
    public function syncTemplates(): array {
        $result = $this->request('POST', '/api/v2/templates/sync-meta');
        return $result ?? ['success' => false];
    }

    // =========================================================================
    // CONTACTOS
    // =========================================================================

    /**
     * Obtener contactos
     */
    public function getContacts(): array {
        $result = $this->request('GET', '/api/v2/contacts');
        return $result['contacts'] ?? [];
    }

    /**
     * Crear un contacto
     */
    public function createContact(string $nombre, string $telefono, ?string $email = null): ?array {
        $data = [
            'nombre' => $nombre,
            'telefono' => $telefono
        ];
        if ($email) {
            $data['email'] = $email;
        }

        $result = $this->request('POST', '/api/v2/contacts/new', $data);
        return $result ?? null;
    }

    /**
     * Importar contactos masivamente
     */
    public function importContacts(int $listId, array $contacts): array {
        $result = $this->request('POST', '/api/v2/contacts/import', [
            'list_id' => $listId,
            'contacts' => $contacts
        ]);
        return $result ?? ['success' => false];
    }

    // =========================================================================
    // CONVERSACIONES (leer respuestas)
    // =========================================================================

    /**
     * Obtener mensajes de una conversación
     *
     * @param string $phone Número de teléfono del contacto
     * @return array Mensajes de la conversación
     */
    public function getMessages(string $phone): array {
        $result = $this->request('GET', "/api/v2/conversations/{$phone}/messages");
        return $result['messages'] ?? [];
    }

    /**
     * Obtener conversaciones recientes
     */
    public function getConversations(?int $projectId = null): array {
        $params = [];
        if ($projectId) {
            $params['project_id'] = $projectId;
        }
        $result = $this->request('GET', '/api/v2/conversations', $params);
        return $result['conversations'] ?? [];
    }

    // =========================================================================
    // LISTAS
    // =========================================================================

    /**
     * Crear una lista de contactos
     */
    public function createList(string $nombre): ?array {
        $result = $this->request('POST', '/api/v2/lists', [
            'nombre' => $nombre
        ]);
        return $result ?? null;
    }

    /**
     * Obtener listas
     */
    public function getLists(): array {
        $result = $this->request('GET', '/api/v2/lists');
        return $result['lists'] ?? [];
    }

    // =========================================================================
    // CONFIGURACIÓN DE PROYECTO
    // =========================================================================

    /**
     * Actualizar settings de un proyecto en Operatix (merge parcial)
     */
    public function updateProjectSettings(int $projectId, array $settings): ?array {
        return $this->request('PUT', "/api/v2/projects/{$projectId}", [
            'settings' => $settings
        ]);
    }

    // =========================================================================
    // UTILIDADES
    // =========================================================================

    /**
     * Verificar que la conexión con Operatix funciona
     * @return array {connected: bool, error: string|null}
     */
    public function testConnection(): array {
        $result = $this->request('GET', '/api/v2/projects', ['per_page' => 1]);

        if ($result && isset($result['success']) && $result['success']) {
            return [
                'connected' => true,
                'error' => null
            ];
        }

        return [
            'connected' => false,
            'error' => $result['error'] ?? 'No se pudo conectar con Operatix'
        ];
    }

    // =========================================================================
    // HTTP CLIENT INTERNO
    // =========================================================================

    /**
     * Ejecutar request HTTP a Operatix API
     *
     * @param string $method GET, POST, PUT, DELETE
     * @param string $endpoint Ruta del endpoint (ej: /api/v2/projects)
     * @param array $data Datos para enviar (query params en GET, body en POST/PUT)
     * @return array|null Respuesta decodificada o null si error
     */
    private function request(string $method, string $endpoint, array $data = []): ?array {
        $url = $this->baseUrl . $endpoint;

        // Para GET, agregar params a la URL
        if ($method === 'GET' && !empty($data)) {
            $url .= '?' . http_build_query($data);
        }

        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-API-Key: ' . $this->apiKey
            ]
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            error_log("OperatixBridge::request - cURL error [{$method} {$endpoint}]: {$curlError}");
            return null;
        }

        if ($httpCode >= 400) {
            error_log("OperatixBridge::request - HTTP {$httpCode} [{$method} {$endpoint}]: {$response}");
            $decoded = json_decode($response, true);
            return $decoded ?: ['success' => false, 'error' => "HTTP {$httpCode}"];
        }

        $decoded = json_decode($response, true);

        if ($decoded === null && !empty($response)) {
            error_log("OperatixBridge::request - JSON decode error [{$method} {$endpoint}]: {$response}");
            return null;
        }

        return $decoded;
    }
}
