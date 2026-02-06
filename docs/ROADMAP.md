# Mentoria 4.0 - Roadmap de Actualización Mayor

## Estado actual: Fase 4 completada — Todas las fases implementadas

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

### Fase 4: OpenAI Realtime API — Conversación fluida ✅
**Complejidad: ALTA | Completada: 2026-02-06**

- [x] Crear `frontend/src/services/realtimeService.js`:
  - Clase `RealtimeSession` con WebSocket + AudioWorklet (fallback ScriptProcessor)
  - Captura de micrófono vía `getUserMedia` + envío PCM16
  - Recepción y reproducción de audio PCM16 con cola de buffers
  - Manejo de eventos: session.created, speech_started, response.audio.delta, etc.
  - Interrupciones: cancela respuesta cuando usuario habla
  - Helper `isRealtimeSupported()` para verificar compatibilidad
- [x] Crear `frontend/src/components/RealtimePanel.js`:
  - UI tipo llamada con indicador visual animado por estado
  - Ondas rojas cuando el usuario habla, ondas cyan cuando AI responde
  - Botón central para iniciar/terminar sesión
  - Botón interrumpir durante respuesta AI
  - Panel de transcripción en tiempo real (toggle mostrar/ocultar)
  - Timer de duración de sesión
- [x] Modo dual en `ConsultaAsistentePage.js`: botón "Modo Realtime" en welcome modal
- [x] Modo dual en `ConsultaAsistenteiPhone.js`: mismo botón con manejo iOS
- [x] Fallback automático a modo texto si WebSocket falla
- [x] Agregar `realtimeSessionService` en `api.js`

**Archivos creados:**
- `frontend/src/services/realtimeService.js`
- `frontend/src/components/RealtimePanel.js`

**Archivos modificados:**
- `frontend/src/pages/ConsultaAsistentePage.js` (import + estado + render condicional + botón modal)
- `frontend/src/pages/ConsultaAsistenteiPhone.js` (import + estado + render condicional + botón modal)
- `frontend/src/services/api.js` (realtimeSessionService)

**Infraestructura backend (ya existente):**
- `backend/api/realtime-session.php`: sesión efímera con `client_secret`
- Modelo: `gpt-4o-realtime-preview-2024-12-17`, voz: `sage`
- VAD: server_vad, threshold 0.5, silence 500ms
- 3 modos: consulta, mentor, evaluación

---

## Orden de ejecución

```
Fase 1 ✅ → Fase 2 ✅ → Fase 3 ✅ → Fase 4 ✅
 roles      imágenes     admin       realtime
 (ALTA)     (MEDIA)     (MEDIA)      (ALTA)
```

## Verificación por fase

| Fase | Estado | Verificación |
|------|--------|-------------|
| **1** | ✅ | Registrar usuario con rol → solo ve documentos asignados → admin asigna roles |
| **2** | ✅ | Crear documento con imagen → card muestra thumbnail → fallback sin imagen |
| **3** | ✅ | Crear documento con tabs → anexos en creación → preview funciona |
| **4** | ✅ | Sesión Realtime → conversación bidireccional → fallback a modo texto |

---

*Última actualización: 2026-02-06*
*Cada fase se documenta en detalle en su archivo `FASE-N.md` correspondiente*
