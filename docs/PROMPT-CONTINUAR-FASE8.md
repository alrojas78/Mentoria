# Prompt para Continuar Fase 8: Sistema de Seguimiento

## Contexto para nueva sesión

Copia y pega esto al iniciar una nueva sesión de Claude Code para continuar con la Fase 8 del Sistema de Seguimiento:

---

**Prompt:**

```
Continuamos con la Fase 8 del Sistema de Seguimiento de Mentoria 4.0.

## Estado actual
- Fase 8.1 ✅: 7 tablas DB creadas (cohortes, contactos, matriculas, reglas_recordatorio, plantillas_mensaje, seguimiento_log, campanas_operatix)
- Fase 8.2 ✅: Admin UI completo con 6 sub-tabs + 6 endpoints PHP + seguimientoService en api.js
- Las tablas ya están en la DB de voicemed (MentoriaAteneo). Aún NO están en Adium (AdiumAteneo).

## Lo que falta (en orden)

### Fase 8.3: Motor de Email (AWS SES) — SIGUIENTE
- Crear EmailService.php usando AWS SES SDK (ya instalado en composer: aws/aws-sdk-php)
- Renderizar plantillas con variables reales: {{nombre}}, {{programa}}, {{enlace_registro}}, etc.
- Crear endpoint de registro tokenizado: cuando un contacto se registra vía link con token, el sistema vincula automáticamente contacto → user + asigna rol de la cohorte (cohortes.rol_asignar)
- Cada contacto ya tiene token_registro único en la tabla contactos
- Crear endpoint de envío manual desde admin (botón "Enviar invitaciones" a toda la cohorte)
- Unsubscribe con token

### Fase 8.4: Motor de Reglas + Cron
- SeguimientoService.php con lógica de evaluación de etapas
- /backend/cron/evaluar_seguimiento.php (cron cada hora)
- Detectar automáticamente la etapa de cada matrícula:
  - pre_registro: no tiene user_id
  - registrado_sin_iniciar: tiene user_id pero no doc_mentor_progreso
  - en_progreso: tiene progreso con ultima_actualizacion reciente
  - inactivo: progreso con ultima_actualizacion > X días
- Evaluar reglas de recordatorio configuradas por cohorte
- Enviar recordatorios por el canal configurado (email por ahora)
- Cambiar estado a suspendido tras máximo de recordatorios

### Fase 8.5: Dashboard Avanzado
- Funnel visual gráfico
- Timeline por matrícula
- Métricas y alertas

### Fase 8.6: Integración Operatix (WhatsApp + Llamadas) — ÚLTIMO
- Host: 100.50.146.169, SSH: operatixssh.pem, path: /var/www/operatix.co
- Esta fase se deja para el final deliberadamente

## Archivos clave
- docs/FASE-N-SEGUIMIENTO.md — roadmap detallado con modelo de datos
- backend/db/migration_seguimiento.sql — schema completo
- backend/api/admin/ — cohortes.php, contactos.php, matriculas.php, reglas-recordatorio.php, plantillas-mensaje.php, seguimiento-stats.php
- frontend/src/components/admin/AdminSeguimiento.js — UI admin con 6 sub-tabs
- frontend/src/services/api.js — seguimientoService con todos los endpoints

## Modelo de datos clave
- contactos.institucion, contactos.convenio — campos de segmentación
- cohortes.rol_asignar — rol/content_group que se asigna automáticamente al registrarse
- Flujo: importar contactos CSV → crear cohorte → vincular → enviar invitación → contacto se registra vía token → sistema asigna rol → seguimiento de progreso → recordatorios automáticos

## Notas importantes
- Todo el código está en español
- Backend PHP con AuthMiddleware (requireAdmin para endpoints admin)
- Frontend React 18 + styled-components
- Ya hay un cron funcional como referencia: /backend/cron/generar_retos.php
- AWS SDK ya está en composer, solo falta crear el servicio de email

Revisa los docs y archivos, y continuemos con la Fase 8.3.
```

---

*Creado: 2026-02-27*
