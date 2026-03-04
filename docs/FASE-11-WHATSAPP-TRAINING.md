# Fase 11: Sistema de Entrenamiento por WhatsApp

## Resumen Ejecutivo

Crear un sistema donde clientes de Mentoria conecten su WhatsApp Business desde su proyecto, programen contenidos educativos (PDF, imágenes, multimedia) que se envían automáticamente a estudiantes por WhatsApp, con preguntas de evaluación y retroalimentación por texto o audio. Operatix actúa como puente invisible — el cliente nunca interactúa con Operatix directamente.

## Concepto

```
MENTOR (cliente)                    ESTUDIANTE
    │                                    │
    │ Configura programa                 │
    │ en Mentoria                        │
    ▼                                    │
┌─────────────┐                          │
│  MENTORIA   │──── Operatix Bridge ─────┤
│  (cerebro)  │     (puente invisible)   │
│             │◄── webhook respuestas ───┤
│  IA evalúa  │                          │
└─────────────┘                     WhatsApp
```

## Arquitectura

- **Mentoria**: programa, evalúa, reporta (toda la lógica educativa)
- **Operatix**: envía/recibe WhatsApp via Meta API oficial (solo transporte)
- **Meta**: WhatsApp Business API (el cliente conecta SU número)
- **IA de Mentoria**: evalúa respuestas con OpenAI/SemanticEvaluator
- **Audio**: MiniMax TTS para retroalimentación por audio (costos bajos)

## Dependencias

- Fase 8.1-8.2 ✅ (Sistema de Seguimiento: cohortes, contactos, matrículas)
- Fase 9 ✅ (Multi-Proyecto: proyectos con config_json)
- Operatix Meta OAuth ✅ (ya funciona Embedded Signup + proyectos)

---

## Sub-fases

### Fase 11.0: API Key Bridge en Operatix ⬜
**Complejidad: BAJA | Estimado: ~50 líneas en Operatix**
**PRERREQUISITO para todo lo demás**

Agregar autenticación por API Key a Operatix para llamadas server-to-server desde Mentoria. No afecta clientes existentes.

**Cambios en Operatix (100.50.146.169):**
- [ ] Agregar API Key auth en `SessionHelper.php`:
  - Detectar header `X-API-Key`
  - Validar contra `system_config` tabla (key: `mentoria_api_key`)
  - Si válido, cargar `usuario_id` del service account en sesión
  - Si no viene header, flujo normal de sesión (cero impacto en clientes)
- [ ] Insertar API key en `system_config`:
  ```sql
  INSERT INTO system_config (config_key, config_value)
  VALUES ('mentoria_api_key', 'GENERATED_SECURE_KEY');
  ```
- [ ] Crear usuario service account en Operatix para Mentoria:
  ```sql
  INSERT INTO usuarios (nombre, email, password, role, user_type)
  VALUES ('Mentoria Bridge', 'bridge@mentoria.ateneo.co', 'HASH', 'admin', 'main');
  ```

**Verificación:** Desde Mentoria backend, llamar `GET operatix.co/api/v2/auth/session` con header `X-API-Key` → debe retornar sesión válida.

---

### Fase 11.1: OperatixBridge — Servicio PHP en Mentoria ⬜
**Complejidad: MEDIA**

Crear el servicio PHP que encapsula TODA la comunicación con Operatix.

**Archivos nuevos en Mentoria:**
- [ ] `backend/utils/OperatixBridge.php` — clase principal:
  ```php
  class OperatixBridge {
      // Configuración
      private $apiKey;
      private $baseUrl = 'https://operatix.co';
      private $sessionCookie; // se obtiene al autenticar

      // Autenticación
      public function authenticate(): bool
      // Usuarios
      public function getOrCreateUser(string $email, string $nombre): array
      // Proyectos
      public function getOrCreateProject(int $userId, string $nombre): array
      // Meta OAuth
      public function connectWhatsApp(string $code, int $projectId): array
      public function getWhatsAppStatus(int $projectId): array
      public function disconnectWhatsApp(int $projectId): bool
      // Envío de mensajes
      public function sendTemplateMessage(int $projectId, string $phone, string $templateName, array $vars): array
      public function sendFreeMessage(int $projectId, string $phone, string $text): array
      public function sendMediaMessage(int $projectId, string $phone, string $mediaUrl, string $type): array
      // Templates
      public function getTemplates(int $projectId): array
      public function syncTemplates(int $projectId): array
      // Contactos
      public function importContacts(int $projectId, array $contacts): array
      // Conversaciones (leer respuestas)
      public function getMessages(int $projectId, string $phone, ?string $since = null): array
  }
  ```
- [ ] `backend/config/operatix.php` — credenciales (API key, service user)
- [ ] Almacenar credenciales en `.env`:
  ```
  OPERATIX_API_KEY=xxx
  OPERATIX_BASE_URL=https://operatix.co
  OPERATIX_SERVICE_EMAIL=bridge@mentoria.ateneo.co
  ```

**Verificación:** Test unitario que autentica, crea usuario, crea proyecto en Operatix.

---

### Fase 11.2: Conexión WhatsApp desde Mentoria ⬜
**Complejidad: ALTA**

Permitir que el cliente conecte su WhatsApp Business desde la UI de su proyecto en Mentoria, sin ver Operatix.

**Flujo:**
```
1. Admin del proyecto → Tab "WhatsApp" en configuración de proyecto
2. Click "Conectar WhatsApp"
3. Se carga Meta JavaScript SDK (Facebook Login for Business)
4. Popup de Meta → usuario autoriza → SDK retorna { code }
5. Frontend envía code al backend de Mentoria
6. Backend:
   a. OperatixBridge: busca/crea usuario en Operatix para este proyecto
   b. OperatixBridge: busca/crea proyecto en Operatix
   c. OperatixBridge: POST /api/v2/meta/oauth/embedded-callback { code, project_id }
   d. Operatix procesa OAuth completo (token, WABA, webhooks)
   e. Retorna { success, phone_number, display_name }
7. Mentoria guarda en proyectos.config_json:
   - operatix_user_id, operatix_project_id
   - whatsapp_connected: true
   - whatsapp_number, whatsapp_display_name
8. UI muestra estado "Conectado ✓" con número
```

**Archivos nuevos en Mentoria:**
- [ ] `backend/api/operatix/connect-whatsapp.php` — endpoint para recibir code y orquestar conexión
- [ ] `backend/api/operatix/whatsapp-status.php` — consultar estado de conexión
- [ ] `backend/api/operatix/disconnect-whatsapp.php` — desconectar

**Archivos modificados en Mentoria:**
- [ ] `frontend/src/components/admin/AdminProyectos.js` — nueva tab "WhatsApp" con:
  - Estado de conexión (conectado/desconectado)
  - Botón "Conectar WhatsApp" → carga Meta SDK
  - Info del número conectado
  - Botón "Desconectar"
- [ ] `frontend/public/index.html` — cargar Meta SDK (`https://connect.facebook.net/en_US/sdk.js`)
- [ ] `frontend/src/services/api.js` — operatixService (connect, status, disconnect)

**Nota sobre Meta SDK:** El `app_id` de Meta es el de Operatix (que ya está aprobado). El Embedded Signup usa este app_id. El code se intercambia en el backend de Operatix. Mentoria nunca necesita credenciales de Meta directamente.

**Verificación:** Conectar un número WhatsApp Business desde un proyecto de Mentoria → ver estado "Conectado" → verificar en Operatix que el proyecto tiene la cuenta vinculada.

---

### Fase 11.3: Modelo de Datos — Programas de Entrenamiento ⬜
**Complejidad: MEDIA**

Crear las tablas para programar contenidos educativos por WhatsApp.

**Nuevas tablas:**
```sql
-- Programa de entrenamiento (contenedor principal)
CREATE TABLE wa_programas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    documento_id INT DEFAULT NULL COMMENT 'Documento base opcional',
    estado ENUM('borrador','activo','pausado','finalizado') DEFAULT 'borrador',
    config_json JSON COMMENT 'Configuración adicional',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE SET NULL
);

-- Entregas programadas (cada envío del programa)
CREATE TABLE wa_entregas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    programa_id INT NOT NULL,
    orden INT NOT NULL DEFAULT 0,
    tipo ENUM('contenido','pregunta','retroalimentacion') NOT NULL,
    titulo VARCHAR(200),
    -- Contenido del envío
    texto TEXT COMMENT 'Texto del mensaje',
    media_url VARCHAR(500) COMMENT 'URL de PDF/imagen/audio/video',
    media_tipo ENUM('pdf','imagen','audio','video','documento') DEFAULT NULL,
    -- Si tipo=pregunta
    pregunta TEXT COMMENT 'Texto de la pregunta',
    respuesta_esperada TEXT COMMENT 'Respuesta correcta o criterios para IA',
    evaluacion_modo ENUM('ia_semantica','exacta','libre') DEFAULT 'ia_semantica',
    -- Programación
    dias_despues INT DEFAULT 0 COMMENT 'Días después del inicio o entrega anterior',
    hora_envio TIME DEFAULT '09:00:00',
    -- Meta template (para primer contacto o fuera de ventana 24h)
    template_name VARCHAR(100) COMMENT 'Nombre del template en Meta',
    -- Estado
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (programa_id) REFERENCES wa_programas(id) ON DELETE CASCADE
);

-- Inscripciones de estudiantes a programas
CREATE TABLE wa_inscripciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    programa_id INT NOT NULL,
    contacto_id INT COMMENT 'Referencia a tabla contactos del seguimiento',
    telefono VARCHAR(20) NOT NULL COMMENT 'Número WhatsApp del estudiante',
    nombre VARCHAR(200),
    estado ENUM('activo','pausado','completado','abandonado') DEFAULT 'activo',
    entrega_actual INT DEFAULT 0 COMMENT 'Índice de última entrega enviada',
    fecha_inicio DATE COMMENT 'Fecha de inicio para este estudiante',
    fecha_ultima_interaccion DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (programa_id) REFERENCES wa_programas(id) ON DELETE CASCADE,
    FOREIGN KEY (contacto_id) REFERENCES contactos(id) ON DELETE SET NULL,
    UNIQUE KEY uk_programa_telefono (programa_id, telefono)
);

-- Log de envíos y respuestas
CREATE TABLE wa_interacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscripcion_id INT NOT NULL,
    entrega_id INT COMMENT 'NULL si es respuesta libre del estudiante',
    tipo ENUM('envio_contenido','envio_pregunta','respuesta_estudiante',
             'retroalimentacion_texto','retroalimentacion_audio',
             'error_envio','recordatorio') NOT NULL,
    contenido TEXT COMMENT 'Texto enviado o recibido',
    media_url VARCHAR(500),
    -- Evaluación IA
    evaluacion_score DECIMAL(3,2) COMMENT '0.00-1.00',
    evaluacion_detalle TEXT COMMENT 'Retroalimentación de la IA',
    -- Operatix tracking
    operatix_message_id VARCHAR(100),
    estado_envio ENUM('pendiente','enviado','entregado','leido','fallido') DEFAULT 'pendiente',
    -- Timestamps
    fecha_programada DATETIME,
    fecha_enviado DATETIME,
    fecha_respuesta DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inscripcion_id) REFERENCES wa_inscripciones(id) ON DELETE CASCADE,
    FOREIGN KEY (entrega_id) REFERENCES wa_entregas(id) ON DELETE SET NULL,
    INDEX idx_inscripcion (inscripcion_id),
    INDEX idx_fecha_programada (fecha_programada, estado_envio)
);
```

**Archivo nuevo:**
- [ ] `backend/db/migration_fase11_wa_training.sql`

**Verificación:** Ejecutar migración → verificar 4 tablas creadas con índices.

---

### Fase 11.4: Admin UI — Gestión de Programas ⬜
**Complejidad: ALTA**

Crear la interfaz de administración para diseñar programas de entrenamiento WhatsApp.

**Nueva tab en AdminDashboard: "WhatsApp Training"**
(O sub-sección dentro del proyecto)

**Sub-componentes:**

1. **Lista de Programas** por proyecto
   - Nombre, documento vinculado, estado, entregas, inscritos
   - Crear / Editar / Activar / Pausar / Finalizar

2. **Editor de Programa** (timeline visual)
   - Drag & reorder de entregas
   - Agregar entrega: contenido, pregunta, o retroalimentación
   - Por cada entrega:
     - Tipo: contenido (PDF/imagen/texto), pregunta, retroalimentación
     - Contenido: texto + upload de media
     - Programación: "X días después de la anterior" + hora
     - Si pregunta: respuesta esperada + modo de evaluación
   - Preview del timeline: "Día 1: Contenido → Día 3: Pregunta → Día 5: Retro..."

3. **Inscripciones**
   - Importar desde contactos existentes (del sistema de seguimiento)
   - Agregar individual (nombre + teléfono)
   - Cambiar estado (activo/pausado)
   - Ver progreso por estudiante

4. **Monitor de Interacciones**
   - Feed en tiempo real de envíos y respuestas
   - Estado de entrega (enviado/entregado/leído/fallido)
   - Respuestas con evaluación IA

**Archivos nuevos en Mentoria:**
- [ ] `backend/api/admin/wa-programas.php` — CRUD programas
- [ ] `backend/api/admin/wa-entregas.php` — CRUD entregas por programa
- [ ] `backend/api/admin/wa-inscripciones.php` — gestión de inscritos
- [ ] `backend/api/admin/wa-interacciones.php` — log de envíos/respuestas
- [ ] `frontend/src/components/admin/AdminWhatsAppTraining.js` — componente principal
- [ ] `frontend/src/components/admin/WaProgramaEditor.js` — editor de programa + entregas
- [ ] `frontend/src/components/admin/WaInscripciones.js` — gestión de inscritos
- [ ] `frontend/src/components/admin/WaMonitor.js` — monitor de interacciones

**Archivos modificados:**
- [ ] `frontend/src/pages/AdminDashboard.js` — nueva tab "WhatsApp Training"
- [ ] `frontend/src/services/api.js` — waTrainingService

**Verificación:** Crear programa → agregar 3 entregas (contenido, pregunta, retro) → inscribir 2 contactos → ver timeline.

---

### Fase 11.5: Motor de Envío + Cron ⬜
**Complejidad: ALTA**

El corazón del sistema: evalúa qué entregas deben enviarse y las ejecuta.

**Archivos nuevos:**
- [ ] `backend/cron/wa-training-engine.php` — cron job (cada 15 min):
  ```
  1. Buscar inscripciones activas con entregas pendientes
  2. Para cada entrega cuya fecha_programada <= NOW():
     a. Si es contenido: OperatixBridge->sendMediaMessage() o sendFreeMessage()
     b. Si es pregunta: OperatixBridge->sendFreeMessage(pregunta)
     c. Registrar en wa_interacciones
     d. Actualizar inscripcion.entrega_actual
  3. Log de errores
  ```
- [ ] `backend/utils/WaTrainingService.php` — lógica de negocio:
  - `calcularProximaEntrega($inscripcionId)` — calcula fecha basado en dias_despues
  - `programarEntregas($inscripcionId)` — crea registros en wa_interacciones con fecha_programada
  - `procesarRespuesta($inscripcionId, $texto)` — evalúa respuesta con IA
  - `generarRetroalimentacion($interaccionId)` — genera texto o audio de retro

**Cron setup:**
```bash
*/15 * * * * php /var/www/voicemed/backend/cron/wa-training-engine.php >> /var/www/voicemed/backend/logs/wa-training.log 2>&1
```

**Nota sobre ventana de 24h de Meta:**
- Primer mensaje a un contacto DEBE ser template aprobado
- Después de que el contacto responde, se abre ventana de 24h para mensajes libres
- El motor debe manejar esto: usar template si no hay ventana, mensaje libre si hay

**Verificación:** Programa activo con inscripciones → cron ejecuta → mensajes enviados via Operatix → log registrado.

---

### Fase 11.6: Webhook de Respuestas ⬜
**Complejidad: MEDIA**

Recibir las respuestas de los estudiantes cuando llegan a Operatix.

**Opción A: Polling (sin cambios en Operatix):**
- Cron en Mentoria consulta `OperatixBridge->getMessages()` cada 5 min
- Detecta mensajes nuevos y los procesa
- Simple pero con delay de hasta 5 min

**Opción B: Webhook forward (20 líneas en Operatix) — RECOMENDADA:**
- Operatix reenvía mensajes entrantes a URL configurada por proyecto
- Mentoria expone endpoint público: `/api/webhook/wa-respuesta.php`
- Respuesta inmediata

**Archivos nuevos:**
- [ ] `backend/api/webhook/wa-respuesta.php` — recibe webhook de Operatix:
  ```
  1. Validar firma/token del webhook
  2. Identificar inscripción por teléfono + proyecto
  3. Guardar respuesta en wa_interacciones
  4. Si hay pregunta pendiente → evaluar con IA:
     a. OpenAIService: comparar respuesta vs respuesta_esperada
     b. Calcular score (0.00 - 1.00)
     c. Generar retroalimentación
  5. Si retroalimentación por audio:
     a. MiniMax TTS genera audio
     b. OperatixBridge->sendMediaMessage(audio)
  6. Si retroalimentación por texto:
     a. OperatixBridge->sendFreeMessage(retroalimentacion)
  ```
- [ ] `backend/utils/MiniMaxService.php` — TTS con MiniMax API (alternativa económica a Polly/ElevenLabs)

**Si se elige Opción B, cambio en Operatix (~20 líneas):**
- [ ] En `MetaWebhookController.php` → `processWhatsAppMsg()`:
  - Si el proyecto tiene `webhook_forward_url` en config, reenviar payload
  - El URL se configura vía `ProjectApiController` (campo en projects table)

**Verificación:** Estudiante responde por WhatsApp → webhook llega a Mentoria → IA evalúa → retroalimentación enviada automáticamente.

---

### Fase 11.7: Evaluación IA + Retroalimentación ⬜
**Complejidad: MEDIA**

La inteligencia educativa del sistema.

**Archivos nuevos:**
- [ ] `backend/utils/WaEvaluator.php`:
  ```php
  class WaEvaluator {
      // Evalúa respuesta del estudiante contra criterios
      public function evaluar(string $respuesta, string $pregunta, string $criterios, string $modo): array
      // Retorna: { score, aprobado, retroalimentacion, detalle }

      // Genera retroalimentación personalizada
      public function generarRetroalimentacion(float $score, string $pregunta, string $respuesta, string $contexto): string

      // Genera audio de retroalimentación
      public function generarAudioRetro(string $texto): string  // retorna URL del audio
  }
  ```
- [ ] Integración con `SemanticEvaluator.php` existente (reutilizar lógica de Mentor 2.0)

**Modos de evaluación:**
- `ia_semantica`: GPT evalúa semánticamente (como quiz del Mentor 2.0)
- `exacta`: match textual (para datos concretos como dosis, nombres)
- `libre`: solo registra la respuesta, no evalúa (para reflexiones)

**Verificación:** Enviar pregunta → estudiante responde → IA evalúa → score correcto → retroalimentación relevante.

---

### Fase 11.8: Dashboard y Reportes ⬜
**Complejidad: MEDIA**

Métricas del programa para el administrador del proyecto.

**Métricas:**
- Funnel: inscritos → activos → respondiendo → completados
- Tasa de respuesta por entrega
- Score promedio por pregunta
- Tiempo promedio de respuesta
- Estudiantes rezagados (sin responder en X días)
- Timeline visual de envíos/respuestas

**Archivos nuevos:**
- [ ] `backend/api/admin/wa-dashboard.php` — estadísticas agregadas
- [ ] `frontend/src/components/admin/WaDashboard.js` — gráficos y métricas

---

### Fase 11.9: Templates de Meta + Aprobación ⬜
**Complejidad: MEDIA**

Gestionar templates de WhatsApp Business desde Mentoria.

**Funcionalidad:**
- Crear templates estándar para el programa (desde Mentoria)
- Enviar a aprobación de Meta (vía Operatix)
- Sincronizar estado de aprobación
- Templates prediseñados: "Bienvenida al programa", "Nuevo contenido disponible", "Pregunta de evaluación"

**Archivos nuevos:**
- [ ] `backend/api/admin/wa-templates.php` — CRUD + sync con Operatix
- [ ] `frontend/src/components/admin/WaTemplates.js` — gestión de templates

---

## Resumen de cambios por sistema

### Operatix (cambios mínimos, aislados)
| Cambio | Archivo | Líneas | Riesgo clientes |
|--------|---------|--------|-----------------|
| API Key auth | `SessionHelper.php` | ~30 | CERO |
| Service account | SQL insert | 1 | CERO |
| API Key en system_config | SQL insert | 1 | CERO |
| *(Opcional)* Webhook forward | `MetaWebhookController.php` | ~20 | CERO |
| **Total** | | **~52** | **CERO** |

### Mentoria (trabajo principal)
| Fase | Archivos nuevos | Archivos modificados |
|------|-----------------|---------------------|
| 11.1 | 2 (Bridge + config) | 0 |
| 11.2 | 3 (endpoints) | 3 (AdminProyectos, api.js, index.html) |
| 11.3 | 1 (migración SQL) | 0 |
| 11.4 | 8 (backend + frontend) | 2 (AdminDashboard, api.js) |
| 11.5 | 2 (cron + service) | 0 |
| 11.6 | 2 (webhook + MiniMax) | 0 |
| 11.7 | 1 (evaluator) | 0 |
| 11.8 | 2 (backend + frontend) | 0 |
| 11.9 | 2 (backend + frontend) | 0 |
| **Total** | **~23** | **~5** |

---

## Orden de ejecución recomendado

```
11.0 (API Key Operatix) ──→ 11.1 (Bridge) ──→ 11.2 (Conectar WhatsApp)
     PRERREQUISITO              PRERREQUISITO        PRIMER HITO VISIBLE
                                     │
                                     ▼
                              11.3 (DB Schema) ──→ 11.4 (Admin UI)
                                                        │
                                                        ▼
                                            11.5 (Motor envío) ──→ 11.6 (Webhook respuestas)
                                                                        │
                                                                        ▼
                                                                  11.7 (Evaluación IA)
                                                                        │
                                                              ┌─────────┴─────────┐
                                                              ▼                   ▼
                                                        11.8 (Dashboard)    11.9 (Templates)
```

### Por dónde empezar:

**Bloque 1 — Fundamentos (11.0 → 11.1 → 11.2):**
Establece la conexión Mentoria↔Operatix y la conexión WhatsApp. Sin esto, nada más funciona. Al final de este bloque, un cliente puede conectar su WhatsApp desde Mentoria.

**Bloque 2 — Programación (11.3 → 11.4):**
Modelo de datos y UI para crear programas de entrenamiento. Al final, se pueden diseñar programas completos.

**Bloque 3 — Ejecución (11.5 → 11.6 → 11.7):**
Motor de envío + recepción + evaluación. Al final, el sistema funciona end-to-end.

**Bloque 4 — Polish (11.8 → 11.9):**
Dashboard de métricas y gestión de templates. Mejora la experiencia pero no es crítico para MVP.

---

## MVP vs Full

### MVP (Bloques 1-3):
- Conectar WhatsApp ✓
- Crear programa con entregas ✓
- Inscribir estudiantes ✓
- Envío automático de contenido + preguntas ✓
- Recibir y evaluar respuestas con IA ✓
- Retroalimentación automática (texto) ✓

### Full (+ Bloque 4):
- Dashboard con métricas ✓
- Gestión de templates desde Mentoria ✓
- Retroalimentación por audio (MiniMax) ✓
- Reportes exportables ✓

---

*Creado: 2026-03-03*
*Relacionado con: Fase 8 (Seguimiento), Fase 9 (Multi-Proyecto)*
