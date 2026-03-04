# Mentoria 4.0 - Roadmap de Actualización Mayor

## Estado actual: Fase 11 en progreso (WhatsApp Training, 11.0-11.6 completadas) | Fase 8 parcial

---

### Fase 0: Inicialización del repositorio ✅
- [x] Crear repositorio GitHub `alrojas78/Mentoria`
- [x] Primer commit con código base existente
- [x] Configurar `.gitignore` (excluir `.env`, `.claude/`, uploads, logs)
- [x] Crear estructura de documentación (`docs/`)
- [x] Actualizar `CLAUDE.md` con contexto del proyecto

### Fase 1: Segmentación de contenidos por roles ✅
**Complejidad: ALTA | Completada: 2026-02-06**

- [x] Migración DB: expandir ENUM de roles (`admin`, `mentor`, `estudiante`, `coordinador`)
- [x] Crear tabla `documento_roles` para mapeo documento-rol
- [x] Migrar usuarios `role='user'` → `'estudiante'`
- [x] Insertar acceso para todos los roles en documentos existentes
- [x] Backend: filtrar documentos por rol en `GET /documentos.php` (JOIN con `documento_roles`)
- [x] Backend: admin ve todos los documentos + `roles_asignados` en respuesta
- [x] Backend: validar roles permitidos en registro (`auth.php`) — whitelist: estudiante, mentor, coordinador
- [x] Backend: guardar roles en POST (crear) y PUT (actualizar) de documentos
- [x] Frontend: selector de rol (radio buttons) en `RegisterPage.js`
- [x] Frontend: checkboxes de roles en `AdminDocumentosPage.js` (crear/editar)
- [x] Frontend: mostrar badges de roles en listado admin

**Archivos modificados:**
- `backend/db/migration_fase1_roles.sql` (nuevo)
- `backend/db/voicemed.sql` (schema actualizado)
- `backend/api/documentos.php` (filtrado por rol, roles en CRUD)
- `backend/api/auth.php` (validación de rol en registro)
- `frontend/src/pages/RegisterPage.js` (selector de rol)
- `frontend/src/pages/admin/AdminDocumentosPage.js` (checkboxes de roles)

### Fase 2: Imágenes destacadas en documentos ✅
**Complejidad: MEDIA | Completada: 2026-02-06**

- [x] Verificar columna `imagen` existe en tabla `documentos`
- [x] Backend: upload de imagen en POST (crear documento) — validación JPEG/PNG/WebP, máx 2MB
- [x] Backend: PATCH `/documentos.php?id=X` para actualizar imagen
- [x] Backend: soporte de campo `imagen` en PUT (update)
- [x] Backend: crear directorio `uploads/documentos/`
- [x] Frontend: cards en `DocumentosPage.js` muestran thumbnail 16:9
- [x] Frontend: fallback con ícono SVG de documento cuando no hay imagen
- [x] Frontend: input file con preview en admin
- [x] Frontend: nuevo método `uploadDocumentoImagen` en `api.js`

**Archivos modificados:**
- `backend/api/documentos.php` (upload, PATCH handler)
- `frontend/src/pages/DocumentosPage.js` (imagen en cards)
- `frontend/src/pages/admin/AdminDocumentosPage.js` (upload UI)
- `frontend/src/services/api.js` (uploadDocumentoImagen)

### Fase 3: Mejora del Admin de Documentos ✅
**Complejidad: MEDIA | Completada: 2026-02-06**

- [x] Refactor completo de `AdminDocumentosPage.js`
- [x] Vista dual: lista de documentos ↔ formulario (ancho completo)
- [x] Formulario reorganizado en 3 tabs:
  - Tab "Información General": título, descripción, contenido, imagen, roles
  - Tab "Evaluación": preguntas, aprobación, intentos, certificado, puntuaciones avanzadas
  - Tab "Anexos y Media": AttachmentManager (disponible en creación y edición)
- [x] Content preview: toggle editar/vista previa del contenido
- [x] AttachmentManager disponible después de guardar un documento nuevo (no solo en edición)
- [x] Lista de documentos con thumbnail, metadata compacta, badges de roles
- [x] Estilos mejorados: accent color cyan (#0891B2), layout responsivo
- [x] Botón "Volver a lista" para navegación clara

**Archivos modificados:**
- `frontend/src/pages/admin/AdminDocumentosPage.js` (refactor completo)

### Fase 4: OpenAI Realtime API — Conversación fluida ✅ (implementación inicial)
**Complejidad: ALTA | Completada: 2026-02-06**

- [x] Crear `frontend/src/services/realtimeService.js`
- [x] Crear `frontend/src/components/RealtimePanel.js`
- [x] Modo dual en `ConsultaAsistentePage.js`: botón "Modo Realtime"
- [x] Modo dual en `ConsultaAsistenteiPhone.js`: mismo botón
- [x] Agregar `realtimeSessionService` en `api.js`

**Nota:** La implementación inicial usaba endpoint BETA `/v1/realtime/sessions` que generaba error de version mismatch con el WebSocket GA. Corregido en Fase 4.1.

### Fase 4.1: Fix API GA + Realtime Inline ✅
**Complejidad: ALTA | Completada: 2026-02-06**

**Problemas corregidos:**
1. Error "beta client secret with GA session" — migrado a `/v1/realtime/client_secrets`
2. UX de botón separado — integrado inline, todos los modos inician en realtime automáticamente

**Cambios backend:**
- [x] `realtime-session.php`: Migrar de `/v1/realtime/sessions` (BETA) a `/v1/realtime/client_secrets` (GA)
- [x] Enviar body vacío a OpenAI, retornar `client_secret` string directo (no objeto)
- [x] Construir instrucciones en backend y enviarlas al frontend (instructions, voice, model)
- [x] Leer configuración de voz desde `system_config` (voice_mode, realtime_voice, realtime_model)
- [x] Si `voice_mode` no es `realtime`, retornar `realtime_available: false` para fallback

**Cambios admin:**
- [x] `voice-service.php`: Agregar campo `voice_mode` (realtime/polly/elevenlabs)
- [x] Validación de voces realtime: alloy, ash, ballad, coral, echo, sage, shimmer, verse
- [x] Default config incluye `voice_mode: 'realtime'`, `realtime_voice: 'sage'`
- [x] `VoiceServiceAdmin.js`: Radio buttons para modo de voz, selector de voz realtime
- [x] Sección TTS siempre visible como fallback/respaldo

**Cambios frontend RealtimeService:**
- [x] `connect()`: Recibir `client_secret` (string), `instructions`, `voice`, `model` desde backend
- [x] WebSocket URL: `wss://api.openai.com/v1/realtime?model={model}`
- [x] Subprotocol: `['realtime', 'openai-insecure-api-key.{client_secret}']`
- [x] Tras `session.created`: enviar `session.update` con instructions + audio config GA
- [x] Tras `session.updated`: enviar `response.create` para auto-saludo
- [x] iOS: AudioContext resume si suspendido
- [x] Error `REALTIME_NOT_AVAILABLE` si backend dice que no está habilitado

**Cambios frontend ConsultaAsistentePage + ConsultaAsistenteiPhone:**
- [x] Eliminar botón "Modo Realtime" separado del welcome modal
- [x] Todos los modos (consulta, mentor, evaluación) inician realtime automáticamente si soportado
- [x] Excepto modo Reto: mantiene flujo texto
- [x] UI inline: orbe animado con estados (conectando, listo, escuchando, AI hablando, error)
- [x] Panel de transcripción colapsable con diálogo en tiempo real
- [x] Botones: "Modo Texto" (fallback), "Finalizar" (desconecta y vuelve), "Interrumpir" (durante AI)
- [x] Cleanup de sesión realtime en handleGoBack y unmount
- [x] `RealtimePanel.js` deprecado (funcionalidad absorbida)

**Archivos modificados:**
- `backend/api/realtime-session.php` (migración GA + config de system_config)
- `backend/api/admin/voice-service.php` (voice_mode, realtime_voice, validaciones)
- `frontend/src/services/realtimeService.js` (reescrito para GA: session.update, auto-saludo)
- `frontend/src/components/admin/VoiceServiceAdmin.js` (radio buttons modo voz, selector realtime)
- `frontend/src/pages/ConsultaAsistentePage.js` (realtime inline, eliminar botón separado)
- `frontend/src/pages/ConsultaAsistenteiPhone.js` (misma integración para iOS)
- `frontend/src/components/RealtimePanel.js` (deprecado, stub vacío)
- `docs/ROADMAP.md` (actualizado)

**Flujo técnico:**
```
1. Usuario selecciona modo en welcome modal (consulta/mentor/evaluación)
2. Frontend → POST /realtime-session.php { document_id, mode }
3. Backend:
   a. Lee voice_mode de system_config
   b. Si voice_mode !== 'realtime' → retorna realtime_available: false
   c. Construye instrucciones (buildSystemInstructions)
   d. POST /v1/realtime/client_secrets {} → obtiene ek_xxx
   e. Retorna { client_secret, instructions, voice, model }
4. Frontend:
   a. getUserMedia (micrófono)
   b. WebSocket → wss://api.openai.com/v1/realtime?model=MODEL
   c. session.created → session.update con instructions + audio config
   d. session.updated → response.create (auto-saludo)
   e. MentorIA saluda por voz → VAD activo → conversación natural
5. Finalizar: desconectar → volver a documentos
```

---

### Fase 4.2: Bloques Temáticos + Function Calling ✅
**Complejidad: ALTA | Completada: 2026-02-06**

**Problema resuelto:**
El Realtime API tiene un límite de 16384 tokens en instrucciones. Documentos grandes (como VOZAMA con ~52000 tokens) no caben completos. La truncación perdía información.

**Solución: Estrategia Híbrida**
1. Dividir documentos en **bloques temáticos** almacenados en `documento_bloques`
2. Generar un **resumen ejecutivo** con GPT (~1500 tokens) almacenado en `documentos.resumen`
3. Enviar al Realtime API: resumen + lista de bloques + **tool definition** `obtener_bloque`
4. Cuando el AI necesita detalles, invoca `obtener_bloque("titulo")` → frontend fetcha el bloque del backend → inyecta como function_call_output → AI responde con info completa

**Modelo de referencia: VOZAMA (ID 19)**
El documento VOZAMA fue reestructurado en 10 bloques como modelo para futuros documentos:

| # | Bloque | Tokens |
|---|--------|--------|
| 1 | Introducción y Glosario Parcial | ~332 |
| 2 | Capítulo 1: Fisiopatología de la Digestión | ~4,365 |
| 3 | Capítulo 2: Secreción del Ácido Gástrico | ~2,032 |
| 4 | Capítulo 3: Enfermedad Ácido Péptica | ~10,752 |
| 5 | Capítulo 4: Producto VOZAMA - Monografía | ~5,322 |
| 6 | Capítulo 5: Monografía para Médicos | ~2,906 |
| 7 | Palabras Clave del Producto | ~36 |
| 8 | Glosario Médico Completo | ~2,806 |
| 9 | Base de Preguntas de Entrenamiento | ~4,299 |
| 10 | Artículo Científico: P-CABs | ~19,341 |
| | **Total** | **~52,191** |

**Cambios DB:**
- [x] Tabla `documento_bloques` (id, documento_id, orden, titulo, resumen_bloque, contenido, tokens_estimados)
- [x] Columna `resumen` en tabla `documentos` (TEXT)
- [x] Migración: `backend/db/migration_fase42_bloques.sql`

**Cambios backend:**
- [x] `models/DocumentoBloque.php`: CRUD de bloques (getByDocumento, getByDocumentoAndTitulo, etc.)
- [x] `api/documento-bloques.php`: GET endpoint para consultar bloques por documento_id + titulo/bloque_id
- [x] `api/realtime-session.php`: Estrategia híbrida — si documento tiene bloques usa resumen+tools, sino truncación (fallback)
- [x] Tool definition `obtener_bloque` con parámetro `bloque_titulo` enviado al frontend
- [x] Script modelo: `scripts/split_vozama.php` — referencia para crear bloques en otros documentos

**Cambios frontend RealtimeService:**
- [x] `realtimeService.js`: Recibe y envía tools en session.update
- [x] Maneja `response.function_call_arguments.delta/done` → parsea argumentos
- [x] `_handleFunctionCall()`: Fetcha bloque de `/documento-bloques.php` → envía `conversation.item.create` + `response.create`
- [x] Tracking de function calls pendientes en `_pendingFunctionCalls`

**Cambios frontend Admin:**
- [x] `AdminDocumentosPage.js`: Nueva tab "Bloques Temáticos" (4ta pestaña)
- [x] Botón "Generar Bloques con IA" → llama a `/admin/generar-bloques.php` → GPT analiza estructura
- [x] Botón "Regenerar Bloques" si ya existen (elimina anteriores y recrea)
- [x] Botón "Eliminar Bloques" para limpiar todo
- [x] Lista de bloques con: número, título, resumen, tokens estimados
- [x] Expandir/colapsar cada bloque para ver su contenido (lazy load)
- [x] Mostrar resumen ejecutivo generado por GPT
- [x] Indicador de cantidad de bloques en la pestaña
- [x] Spinner de carga durante generación
- [x] Info box explicando para qué sirven los bloques

**Flujo técnico con bloques:**
```
1. Usuario selecciona modo en welcome modal
2. Frontend → POST /realtime-session.php { document_id, mode }
3. Backend detecta que documento tiene bloques:
   a. Carga resumen ejecutivo + lista de bloques (solo títulos+resúmenes)
   b. Construye instructions con resumen + bloquesTexto
   c. Define tool: obtener_bloque(bloque_titulo)
   d. Retorna { client_secret, instructions, voice, model, tools, bloques }
4. Frontend:
   a. session.update incluye tools en session config
   b. MentorIA saluda con contexto del resumen
5. Conversación:
   a. Estudiante pregunta algo general → AI responde con resumen
   b. Estudiante pregunta algo específico → AI invoca obtener_bloque("Enfermedad")
   c. Frontend fetcha bloque completo → conversation.item.create(function_call_output)
   d. response.create → AI responde con información detallada del bloque
6. Documentos sin bloques: fallback a truncación (comportamiento anterior)
```

**Guía para crear bloques en nuevos documentos:**
1. Identificar secciones/capítulos naturales del documento
2. Crear script similar a `scripts/split_vozama.php` con marcadores de sección
3. Ejecutar: `php scripts/split_NOMBRE.php`
4. Verificar en DB: `SELECT * FROM documento_bloques WHERE documento_id = X`
5. El resumen se genera automáticamente con GPT

**Archivos nuevos:**
- `backend/db/migration_fase42_bloques.sql`
- `backend/models/DocumentoBloque.php`
- `backend/api/documento-bloques.php`
- `backend/api/admin/generar-bloques.php` (GET bloques, POST generar con GPT, DELETE eliminar)
- `backend/scripts/split_vozama.php` (modelo/referencia manual)

**Archivos modificados:**
- `backend/api/realtime-session.php` (estrategia híbrida + tool definition)
- `frontend/src/services/realtimeService.js` (function calling + tools en session.update)
- `frontend/src/pages/admin/AdminDocumentosPage.js` (nueva tab Bloques Temáticos)
- `docs/ROADMAP.md` (actualizado)

---

## Fases futuras

### Fase 5: Reestructuración del Panel Admin ✅
**Complejidad: ALTA | Completada: 2026-02-06 | Diseño: Equipo DevCopilot (Claude + ChatGPT + Gemini)**

**Objetivo:** Consolidar todo el admin en una sola vista con tabs, eliminar módulos legacy, agregar gestión de grupos de contenido.

**Estructura del AdminDashboard (5 tabs):**

| Tab | Contenido | Estado |
|-----|-----------|--------|
| Dashboard | KPIs: usuarios registrados, tasa activos, documentos, distribución por grupo | ✅ Nuevo |
| Usuarios | CRUD usuarios (mantener actual) | ✅ Mantener |
| Grupos de Contenido | CRUD de grupos/roles visibles para contenido | ✅ Nuevo |
| Documentos | CRUD documentos con sub-tabs (Info, Evaluación, Bloques, Anexos) | ✅ Movido de /admin/documentos |
| Configuración | Config de voz (modos, voces) | ✅ Movido de /admin/voice-service |

**Tareas completadas:**
- [x] Eliminar tab Evaluaciones del AdminDashboard (módulo legacy)
- [x] Eliminar tab Cursos del AdminDashboard (módulo legacy)
- [x] Integrar AdminDocumentosPage como tab del panel (prop `embedded`)
- [x] Integrar VoiceServiceAdmin como tab del panel
- [x] Crear módulo Grupos de Contenido (CRUD tabla `content_groups`)
- [x] Dashboard simplificado: 3 cards con métricas reales + barra distribución por roles
- [x] Ajustar RegisterPage: dropdown "Grupo de Contenido" dinámico (excluir admin/mentor)
- [x] Simplificar Header: un solo link "Panel Admin" (eliminar "Administrar Conocimientos")
- [x] Limpiar código muerto: eliminados AdminEvaluationManagement, AdminCourseManagement, AdminAnalytics, VoiceAdminPage
- [x] Rutas legacy `/admin/documentos` y `/admin/voice-service` redirigen a `/admin-panel`

**Cambios DB:**
- [x] `ALTER TABLE users MODIFY COLUMN role VARCHAR(50)` — roles dinámicos en lugar de ENUM
- [x] Tabla `content_groups` (id, name, description, created_at)
- [x] Seeded: estudiante, coordinador
- [x] Migración: `backend/db/migration_fase5_admin.sql`

**Archivos nuevos:**
- `backend/api/admin/content-groups.php` (CRUD grupos con protección)
- `backend/api/admin/dashboard-stats.php` (métricas: usuarios, activos, distribución, documentos)
- `backend/api/public-groups.php` (grupos públicos para registro, sin auth)
- `frontend/src/components/admin/AdminDashboardStats.js` (3 cards + barra roles)
- `frontend/src/components/admin/AdminGruposContenido.js` (CRUD tabla + modales)

**Archivos modificados:**
- `frontend/src/pages/AdminDashboard.js` (reescrito: 5 tabs, sin imports legacy)
- `frontend/src/pages/admin/AdminDocumentosPage.js` (prop embedded, roles dinámicos de content_groups)
- `frontend/src/pages/RegisterPage.js` (dropdown dinámico en lugar de radio buttons)
- `frontend/src/components/layout/Header.js` (simplificado: solo "Panel Admin")
- `frontend/src/App.js` (rutas legacy redirigidas, imports muertos eliminados)

**Archivos eliminados:**
- `frontend/src/components/admin/AdminCourseManagement.js` (825 líneas)
- `frontend/src/components/admin/AdminEvaluationManagement.js` (767 líneas)
- `frontend/src/components/admin/AdminAnalytics.js` (273 líneas)
- `frontend/src/pages/admin/VoiceAdminPage.js` (25 líneas)

### Fase 6: Correcciones Críticas + Sistema de Notificaciones ✅
**Complejidad: MEDIA | Completada: 2026-02-26**

**Correcciones realizadas:**
- [x] Fix: Login Adium apuntaba a base de datos incorrecta (mentoria.ateneo.co → adium.ateneomentoria.com)
- [x] Fix: Auditoría completa de URLs en todas las vistas frontend de Adium
- [x] Fix: Progreso de mentor se reseteaba al reentrar — `consulta.php` ON DUPLICATE KEY UPDATE reseteaba estado/modulo/leccion
- [x] Fix: NotificacionModal overflow en pantallas pequeñas
- [x] Fix: Rol mounjaro no veía contenido asignado — roles hardcodeados 'estudiante' eliminados del frontend
- [x] Fix: Analytics dashboard devolvía datos hardcodeados — reemplazadas 4 funciones stub con queries reales
- [x] Fix: Ranking de preguntas vacío — eliminado filtro HAVING frecuencia >= 2
- [x] Fix: Correcciones STT para Mounjaro (variantes mal transcritas por voz)

**Sistema de Notificaciones:**
- [x] Migración DB: tablas `notificaciones` y `notificaciones_leidas`
- [x] Backend admin: CRUD notificaciones (`/admin/notificaciones.php`)
- [x] Backend usuario: pendientes + marcar leída (`/notificaciones.php`)
- [x] Frontend admin: tab Notificaciones en AdminDashboard con tabla, modal crear/editar, toggle activa
- [x] Frontend usuario: NotificacionModal (modal automático al login, dismiss individual)
- [x] Notificación "Bienvenido a Mentoria 4.0" creada para todos los usuarios

**Archivos nuevos:**
- `backend/db/migration_notificaciones.sql`
- `backend/api/admin/notificaciones.php`
- `backend/api/notificaciones.php`
- `frontend/src/components/admin/AdminNotificaciones.js`
- `frontend/src/components/NotificacionModal.js`

**Archivos modificados:**
- `backend/api/consulta.php` (fix progreso ON DUPLICATE KEY)
- `backend/api/analytics/dashboard-data.php` (4 funciones stub → queries reales)
- `backend/api/analytics/question-ranking.php` (eliminar HAVING frecuencia >= 2)
- `frontend/src/pages/AdminDashboard.js` (tab Notificaciones)
- `frontend/src/pages/admin/AdminDocumentosPage.js` (eliminar roles hardcodeados)
- `frontend/src/App.js` (montar NotificacionModal)
- `frontend/src/services/api.js` (notificacionService)

---

### Fase 7: Mentor 2.0 — Híbrido LMS + IA ✅
**Complejidad: MUY ALTA | Completada: 2026-02-27**

**Problema identificado (datos reales AdiumAteneo):**
- 23 usuarios inscritos en mentor, solo 2 completaron (8.7% completion rate)
- 6 usuarios (26%) abandonaron en la primera lección sin empezar
- El mentor autogenerativo es superficial (solo usa 3000 chars del documento)
- Los modales de confirmación pre-video añaden fricción innecesaria
- El flujo actual requiere 5 pasos para llegar a ver un video
- Frontend duplicado: 4,370 líneas (desktop + iPhone) con lógica repetida
- Mentor no usa Realtime API (flujo antiguo Whisper→Polly, latencia alta)

**Concepto: Lo mejor de LMS tradicional + IA conversacional**
- Navegación visual tipo LMS con sidebar de módulos/lecciones
- Video embebido directo en la página (sin popups ni modales de confirmación)
- Chat IA contextual debajo del video (preguntas, retroalimentación, dudas)
- Evaluación IA real (no pattern matching de "sí"/"no")
- Realtime voice disponible en el chat de mentor
- Un solo componente responsive (eliminar duplicación desktop/iPhone)
- Backend modular (sacar lógica de mentor de consulta.php)

**Sub-fases:**

**Implementación completada:**
- [x] MentorPage.js: componente único responsive (sidebar + video + chat)
- [x] Sidebar colapsable + posición izquierda/derecha con persistencia localStorage
- [x] Video Vimeo embebido directo (sin popups ni modales de confirmación)
- [x] Chat IA contextual con GPT-4o (preguntas sobre video actual)
- [x] Evaluación IA real: quiz 3 preguntas post-video con evaluación semántica
- [x] Navegación: botones Anterior/Siguiente, bloqueo de lecciones futuras
- [x] Backend modular: /api/mentor/start.php, advance.php, chat.php, quiz.php
- [x] Progreso robusto: CASE WHEN timestamp_maximo >= 90% duración = completado
- [x] Modales de consulta redirigen al nuevo Mentor 2.0
- [x] Desplegado en producción (Adium)

**Archivos nuevos:**
- `frontend/src/pages/MentorPage.js` (~1938 líneas)
- `backend/api/mentor/start.php`
- `backend/api/mentor/advance.php`
- `backend/api/mentor/chat.php`
- `backend/api/mentor/quiz.php`

**Archivos modificados:**
- `frontend/src/App.js` (ruta /mentor/:documentId)
- `frontend/src/pages/DocumentosPage.js` (botón Mentor)
- `frontend/src/pages/ConsultaAsistentePage.js` (redirect a Mentor 2.0)
- `frontend/src/pages/ConsultaAsistenteiPhone.js` (redirect a Mentor 2.0)
- `frontend/src/services/api.js` (mentor2Service)

---

### Fase 8: Sistema de Seguimiento y Notificaciones ⏳
**Complejidad: ALTA | Estado: Fases 8.1-8.2 completadas**

Ver detalle completo en `docs/FASE-N-SEGUIMIENTO.md`

#### Fase 8.1: Base de Datos ✅
- [x] 7 tablas: cohortes, contactos, matriculas, reglas_recordatorio, plantillas_mensaje, seguimiento_log, campanas_operatix
- [x] 10 plantillas seed, campos institucion/convenio, rol_asignar en cohortes

#### Fase 8.2: Admin UI ✅
- [x] Tab "Seguimiento" en AdminDashboard con 6 sub-tabs
- [x] 6 endpoints PHP backend completos
- [x] CRUD Cohortes (vinculado a documentos + rol auto-asignado)
- [x] CRUD Contactos + importación CSV masiva
- [x] Gestión de matrículas con cambio de estado
- [x] Configuración de reglas de recordatorio por cohorte
- [x] CRUD de plantillas de mensaje con variables

#### Fase 8.3: Motor de Email (AWS SES) — PENDIENTE
#### Fase 8.4: Motor de Reglas + Cron — PENDIENTE
#### Fase 8.5: Dashboard Avanzado — PENDIENTE
#### Fase 8.6: Integración Operatix (WhatsApp + Llamadas) — PENDIENTE

---

### Fase 9: Multi-Proyecto ✅
**Complejidad: ALTA | Completada: 2026-02-27**

- [x] URLs relativas (eliminar hardcoded mentoria.ateneo.co)
- [x] Tabla `proyectos` + `proyecto_documentos`
- [x] `ProjectContext.js` — detección por dominio/subdominio
- [x] `AdminProyectos.js` — CRUD completo de proyectos
- [x] `proyecto-info.php` — endpoint público para detección de proyecto
- [x] `admin/proyectos.php` — CRUD backend con logo upload
- [x] Landing personalizable por proyecto (título, subtítulo, colores, logo)

### Fase 10: Landing Page Builder ✅
**Complejidad: ALTA | Completada: 2026-02-27**

**Objetivo:** Cada proyecto puede tener una landing completamente custom con secciones dinámicas, diferentes contenidos, imágenes, orden y estilos.

**12 tipos de sección disponibles:**

| Tipo | Descripción |
|------|-------------|
| `header` | Header personalizado (logo, marca, botones login/registro) |
| `hero` | Banner principal con personalización completa (fuentes, alineación, alturas, colores, layout) |
| `stats` | Estadísticas con items valor/etiqueta |
| `feature_cards` | Tarjetas de características con imagen, título, descripción |
| `contenidos_carousel` | Carrusel tipo Netflix de contenidos (auto: docs del proyecto, o manual) |
| `icon_text_grid` | Grilla de iconos con texto (2-3 columnas) |
| `text_block` | Bloque de texto libre con HTML |
| `image_gallery` | Galería de imágenes con captions |
| `cta_button` | Call to Action con botón configurable |
| `testimonials` | Testimonios con nombre, cargo, foto |
| `custom_html` | HTML + CSS libre |
| `footer` | Footer personalizado con columnas de enlaces |

**Features globales:**
- [x] Fuentes personalizables por landing (Google Fonts dinámico: Roboto, Montserrat, Poppins, etc.)
- [x] Hero avanzado: alineación texto (izq/centro/der), layout (img-izq/img-der/solo texto), alturas, fuentes por campo, overlay fondo, colores individuales de botones
- [x] Carrusel Netflix: auto-carga documentos del proyecto o items manuales
- [x] Header/Footer como secciones configurables
- [x] Editor admin: lista + reorder ↑↓ + agregar + editar + ocultar + eliminar
- [x] Upload de imágenes por sección
- [x] Config guardada en `config_json.landing_secciones` + `config_json.landing_config`
- [x] Sin proyecto o sin secciones → landing MentorIA default sin cambios

**Archivos nuevos (19):**
- `frontend/src/components/landing/DynamicLanding.js` (orquestador + Google Fonts)
- `frontend/src/components/landing/SectionRenderer.js` (switch tipo→componente)
- `frontend/src/components/landing/sections/HeroSection.js`
- `frontend/src/components/landing/sections/StatsSection.js`
- `frontend/src/components/landing/sections/FeatureCardsSection.js`
- `frontend/src/components/landing/sections/IconTextGridSection.js`
- `frontend/src/components/landing/sections/TextBlockSection.js`
- `frontend/src/components/landing/sections/ImageGallerySection.js`
- `frontend/src/components/landing/sections/CtaButtonSection.js`
- `frontend/src/components/landing/sections/TestimonialsSection.js`
- `frontend/src/components/landing/sections/CustomHtmlSection.js`
- `frontend/src/components/landing/sections/HeaderSection.js`
- `frontend/src/components/landing/sections/FooterSection.js`
- `frontend/src/components/landing/sections/ContenidosCarouselSection.js`
- `frontend/src/components/admin/AdminLandingEditor.js`
- `frontend/src/components/admin/landing-forms/HeroForm.js`
- `frontend/src/components/admin/landing-forms/StatsForm.js`
- `frontend/src/components/admin/landing-forms/GenericSectionForm.js`
- `backend/api/admin/landing-upload.php`

**Archivos modificados:**
- `backend/api/admin/proyectos.php` (PUT parcial para config_json merge)
- `frontend/src/services/api.js` (saveLandingSections, uploadLandingImage)
- `frontend/src/pages/HomePage.js` (condicional DynamicLanding)
- `frontend/src/components/admin/AdminProyectos.js` (botón Landing + editor)

---

### Fase 11: Entrenamiento por WhatsApp ⏳
**Complejidad: MUY ALTA | Estado: Fases 11.0-11.6 completadas**

**Objetivo:** Sistema de entrenamiento programado por WhatsApp. Clientes conectan su número WhatsApp Business desde Mentoria, programan contenidos + preguntas que se envían automáticamente a estudiantes. La IA de Mentoria evalúa respuestas y genera retroalimentación. Operatix actúa como puente invisible para Meta WhatsApp API.

Ver detalle completo en `docs/FASE-11-WHATSAPP-TRAINING.md`

| Sub-fase | Descripción | Estado |
|----------|-------------|--------|
| 11.0 | API Key Bridge en Operatix (~35 líneas, cero impacto clientes) | ✅ |
| 11.1 | OperatixBridge.php — servicio de comunicación | ✅ |
| 11.2 | Conexión WhatsApp desde Mentoria (Meta Embedded Signup) | ✅ |
| 11.3 | Modelo de datos — 4 tablas (wa_programas, wa_entregas, wa_inscripciones, wa_interacciones) | ✅ |
| 11.4 | Admin UI — tab WA Training en AdminDashboard + 4 CRUD endpoints | ✅ |
| 11.5 | Motor de envío + Cron (cada 15 min) + auto-programación | ✅ |
| 11.6 | Webhook de respuestas (forward desde Operatix → Mentoria) | ✅ |
| 11.7 | Evaluación IA + retroalimentación (texto/audio MiniMax) | ⬜ |
| 11.8 | Dashboard y reportes | ⬜ |
| 11.9 | Templates de Meta + aprobación | ⬜ |

**Dependencias:** Fase 8.1-8.2 ✅, Fase 9 ✅, Operatix Meta OAuth ✅

#### Cambios realizados en Operatix (servidor 100.50.146.169)

**IMPORTANTE: Registro de cambios en servidor externo Operatix para rollback en caso de fallo.**

**Fase 11.0 — API Key Auth (2026-03-03):**
- **Archivo modificado:** `/var/www/operatix.co/app/helpers/SessionHelper.php`
- **Backup:** `/var/www/operatix.co/app/helpers/SessionHelper.php.bak_20260303`
- **Cambio:** ~35 líneas agregadas. Nuevo bloque en `init()` que detecta header `X-API-Key` y método privado `authenticateByApiKey()` antes del cierre de clase.
- **Lógica:** Si viene `X-API-Key` y no hay sesión PHP activa, valida contra `system_config.mentoria_api_key`. Si válido, carga sesión del service account (usuario ID 95). Si no viene header, flujo normal sin cambios.
- **DB inserts:** `system_config`: `mentoria_api_key` (hash), `mentoria_api_user_id` = 95. Tabla `usuarios`: ID 95, email `bridge@mentoria.ateneo.co`, role admin, user_type main.
- **Impacto clientes:** CERO — solo se activa con header X-API-Key que ningún cliente envía.
- **Rollback:** `cp SessionHelper.php.bak_20260303 SessionHelper.php`

**Fase 11.6 — Webhook Forward (2026-03-04):**
- **Archivo modificado:** `/var/www/operatix.co/app/controllers/MetaWebhookController.php`
- **Backup:** `/var/www/operatix.co/app/controllers/MetaWebhookController.php.bak_webhook_20260304`
- **Cambio:** ~25 líneas insertadas en `processWhatsAppMsg()`, justo después de `saveIncomingMessage()` y antes del chequeo de llamada activa.
- **Lógica:** Si el proyecto tiene `settings.webhook_forward_url` (campo JSON en tabla `projects`), hace POST con `{from, content, type, media_url, message_id, timestamp, project_id}` al URL configurado. Header `X-Operatix-Webhook: 1`. Timeout 5 segundos. Try/catch aislado — si falla, solo logea error, no afecta el flujo normal.
- **Impacto clientes:** CERO — solo se activa si `settings.webhook_forward_url` existe en el proyecto. Ningún proyecto existente tiene este campo. El campo se configura automáticamente al conectar WA desde Mentoria.
- **Rollback:** `cp MetaWebhookController.php.bak_webhook_20260304 MetaWebhookController.php`

#### Archivos clave Fase 11 en Mentoria

**Backend nuevos:**
- `backend/utils/OperatixBridge.php` — Singleton HTTP client hacia Operatix API
- `backend/utils/WaTrainingService.php` — Motor de programación y envío
- `backend/cron/wa-training-engine.php` — Cron job cada 15 min
- `backend/api/operatix/test-connection.php` — Test de conectividad
- `backend/api/operatix/connect-whatsapp.php` — Meta Embedded Signup + auto-config webhook
- `backend/api/operatix/whatsapp-status.php` — Estado de conexión WA
- `backend/api/operatix/disconnect-whatsapp.php` — Desconectar WA
- `backend/api/admin/wa-programas.php` — CRUD programas
- `backend/api/admin/wa-entregas.php` — CRUD entregas (reorder, validación)
- `backend/api/admin/wa-inscripciones.php` — CRUD inscripciones (bulk import)
- `backend/api/admin/wa-interacciones.php` — Log read-only paginado
- `backend/api/webhook/wa-respuesta.php` — Receptor de respuestas WhatsApp
- `backend/db/migration_fase11_wa_training.sql` — Migración 4 tablas

**Frontend nuevos:**
- `frontend/src/components/admin/AdminWhatsAppTraining.js` — Admin UI (4 sub-tabs)

**Frontend/Backend modificados:**
- `frontend/src/pages/AdminDashboard.js` — Tab "WA Training"
- `frontend/src/services/api.js` — waTrainingService + operatixService
- `frontend/src/components/admin/AdminProyectos.js` — Panel WhatsApp + FB SDK
- `backend/config/config.php` — Constantes OPERATIX_*

---

## Orden de ejecución

```
Fase 1 ✅ → 2 ✅ → 3 ✅ → 4 ✅ → 4.1 ✅ → 4.2 ✅ → 5 ✅ → 6 ✅ → 7 ✅ → 8 ⏳ → 9 ✅ → 10 ✅ → 11 ⏳
 roles     imgs    admin   realtime  fixGA    bloques  adminV2  fixes    Mentor2  Seguim   Multi    Landing   WA Train
```

## Verificación por fase

| Fase | Estado | Verificación |
|------|--------|-------------|
| **1** | ✅ | Registrar usuario con rol → solo ve documentos asignados → admin asigna roles |
| **2** | ✅ | Crear documento con imagen → card muestra thumbnail → fallback sin imagen |
| **3** | ✅ | Crear documento con tabs → anexos en creación → preview funciona |
| **4** | ✅ | Sesión Realtime creada (implementación inicial, tenía bug de API) |
| **4.1** | ✅ | Seleccionar modo → realtime conecta → MentorIA saluda → VAD → transcripción |
| **4.2** | ✅ | VOZAMA con bloques → resumen en instructions → preguntar detalle → AI invoca obtener_bloque → responde con info completa |
| **5** | ✅ | Panel admin consolidado → 5 tabs → grupos de contenido CRUD → registro con dropdown → código legacy eliminado |
| **6** | ✅ | Notificaciones admin→usuario, analytics reales, correcciones de progreso y URLs |
| **7** | ✅ | Mentor 2.0: video embebido + sidebar colapsable + chat IA + quiz semántico + desplegado en Adium |
| **8** | ⏳ | Seguimiento: DB (7 tablas) + Admin UI (6 sub-tabs) completados. Pendiente: email, cron, Operatix |
| **9** | ✅ | Multi-Proyecto: URLs relativas, ProjectContext, AdminProyectos, detección por dominio |
| **10** | ✅ | Landing Builder: 12 tipos de sección, fuentes globales, carrusel Netflix, header/footer custom |
| **11** | ⏳ | WhatsApp Training: 11.0-11.6 completados (bridge, conexión WA, DB, admin UI, motor envío, webhook). Pendiente: evaluación IA (11.7), dashboard (11.8), templates (11.9) |

---

*Última actualización: 2026-03-04*
*Cada fase se documenta en detalle en su archivo `FASE-N.md` correspondiente*
