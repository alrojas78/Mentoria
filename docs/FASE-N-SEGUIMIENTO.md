# Fase 8: Sistema de Seguimiento y Notificaciones

## Estado: Fase 8.1 y 8.2 completadas | 8.3 siguiente

---

### Fase 8.1: Base de Datos + Modelos (Fundamentos) ✅
**Completada: 2026-02-27**

- [x] Migración SQL: 7 tablas nuevas (cohortes, contactos, matriculas, reglas_recordatorio, plantillas_mensaje, seguimiento_log, campanas_operatix)
- [x] Seed data: 10 plantillas base (invitación, confirmación, bienvenida, recordatorios x3, felicitación, suspensión, WhatsApp x2)
- [x] Campos: contactos.institucion, contactos.convenio (renombrado de empresa)
- [x] Campo: cohortes.rol_asignar (rol/content_group auto-asignado al registrarse)

### Fase 8.2: Admin UI - Gestión de Cohortes y Contactos ✅
**Completada: 2026-02-27**

- [x] Tab "Seguimiento" en AdminDashboard (7 tabs total)
- [x] 6 sub-tabs internos: Dashboard, Cohortes, Contactos, Matrículas, Reglas, Plantillas
- [x] 6 endpoints PHP backend (cohortes, contactos, matriculas, reglas-recordatorio, plantillas-mensaje, seguimiento-stats)
- [x] seguimientoService en api.js con todos los endpoints
- [x] Cohortes: CRUD vinculado a documentos + selector de rol a asignar + auto-genera 12 reglas default
- [x] Contactos: CRUD + importación masiva CSV + selector de cohorte (individual y masivo)
- [x] Matrículas: filtros por cohorte/estado, cambio de estado con log, stats por estado
- [x] Reglas: configurar días/canal/plantilla por etapa (no_registro, no_inicia, no_avanza), guardado masivo
- [x] Plantillas: CRUD con variables {{nombre}}, {{programa}}, {{enlace}}, etc.
- [x] Dashboard: StatCards funnel + tabla cohortes + actividad reciente

**Archivos nuevos:**
- `backend/db/migration_seguimiento.sql`
- `backend/api/admin/cohortes.php`
- `backend/api/admin/contactos.php`
- `backend/api/admin/matriculas.php`
- `backend/api/admin/reglas-recordatorio.php`
- `backend/api/admin/plantillas-mensaje.php`
- `backend/api/admin/seguimiento-stats.php`
- `frontend/src/components/admin/AdminSeguimiento.js`

**Archivos modificados:**
- `frontend/src/pages/AdminDashboard.js` (tab Seguimiento)
- `frontend/src/services/api.js` (seguimientoService)

---

### Fase 8.3: Motor de Email (AWS SES) ⏳
- [ ] EmailService.php usando AWS SES SDK (ya instalado en composer)
- [ ] Renderizado de plantillas con variables reales
- [ ] Link de registro tokenizado: mentoria.ateneo.co/registro?token=ABC → vincula contacto → usuario
- [ ] Endpoint de registro tokenizado (detectar token, vincular matrícula)
- [ ] Unsubscribe con token único
- [ ] Endpoint de envío manual desde admin (enviar invitaciones a cohorte)

### Fase 8.4: Motor de Reglas + Cron
- [ ] SeguimientoService.php - lógica de evaluación de etapas
- [ ] /backend/cron/evaluar_seguimiento.php - cron horario
- [ ] Detección automática de etapa basada en:
  - matriculas.user_id (registro)
  - doc_mentor_progreso.estado + ultima_actualizacion (progreso)
- [ ] Disparo de recordatorios según reglas configuradas
- [ ] Cambio automático de estado (suspensión tras máx recordatorios)
- [ ] Log completo en seguimiento_log

### Fase 8.5: Dashboard de Seguimiento Avanzado
- [ ] Funnel visual gráfico: invitados → registrados → activos → completados
- [ ] Timeline detallada por matrícula (todos los eventos)
- [ ] Métricas: tasa conversión por etapa, efectividad por canal
- [ ] Alertas: matrículas próximas a suspensión

### Fase 8.6: Integración Operatix (WhatsApp + Llamadas)
- [ ] Explorar API/servidor Operatix (100.50.146.169)
- [ ] OperatixService.php - wrapper API
- [ ] Webhook receiver /api/webhook/operatix.php
- [ ] Sync listas contactos → Operatix
- [ ] Disparo WhatsApp + Llamadas
- [ ] IA Reactiva en WhatsApp (bot conversacional)

---

## Modelo de Datos

### Relación clave
```
documentos → cohortes (1:N) → matriculas (1:N) → contactos (N:1)
                 ↓                   ↓
           rol_asignar         users (cuando se registra)
                                     ↓
                           doc_mentor_progreso (progreso real)
```

### Flujo de registro vinculado
1. Admin importa CSV con contactos (nombre, email, teléfono, institución, convenio)
2. Sistema genera token_registro único por contacto
3. Se envía invitación con link: mentoria.ateneo.co/registro?token=ABC123
4. Al registrarse, el token vincula contacto → user + asigna rol de la cohorte
5. Matrícula se actualiza: user_id, estado=registrado, fecha_registro
6. Motor de reglas evalúa progreso y envía recordatorios automáticos

### Etapas de seguimiento
| Etapa | Trigger | Recordatorios |
|-------|---------|---------------|
| No se registra | Sin registro tras invitación | Días 3, 5, 7, 10 |
| No inicia | Registrado pero no entra a M1 | Días 6, 10, 14, 18 |
| No avanza | Inició pero inactivo | Días 7, 12, 17, 25 |

### Canales
| Canal | Proveedor | Estado |
|-------|-----------|--------|
| Email | AWS SES | Pendiente (SDK listo) |
| WhatsApp | Operatix | Pendiente (Fase 8.6) |
| Llamada | Operatix | Pendiente (Fase 8.6) |
| In-App | NotificacionModal existente | Listo |
