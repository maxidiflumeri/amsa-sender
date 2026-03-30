# AMSA Sender — Claude Configuration

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | NestJS + TypeScript |
| Frontend | React + Vite + MUI |
| ORM | Prisma + MySQL |
| Colas | BullMQ + Redis |
| Realtime | Socket.io |
| Infra | Docker + AWS EC2 (Ubuntu) |
| Logging | Winston |

## Reglas globales (siempre aplicar)

- **NUNCA** usar `console.log`, `console.error`, `console.warn`. Siempre usar el logger de Winston inyectado.
- **SIEMPRE** tipar todo con TypeScript estricto. Prohibido usar `any` salvo justificación explícita.
- **SIEMPRE** generar interfaces que soporten dark mode y light mode (MUI `useTheme` / `sx`).
- **SIEMPRE** usar DTOs con `class-validator` en los endpoints NestJS.
- Los workers de BullMQ deben tener retry logic y manejo de errores exhaustivo.
- Las respuestas HTTP de error deben usar `HttpException` o filtros globales, nunca `throw new Error()` crudo.
- El código generado debe ser production-ready, no de demo o ejemplo.

## Módulos principales

- `WhatsApp`: campañas masivas, sesiones persistentes, progreso en tiempo real.
- `Email`: campañas con Unlayer editor, SMTP management, validación SPF/DKIM/DMARC.
- `Sockets`: progreso de campañas vía socket.io.
- `Auth`: Google OAuth + JWT.

## Skills disponibles

Ver `.claude/skills/` para guías específicas:

| Skill | Cuándo usarlo |
|-------|---------------|
| `nestjs-module` | Crear módulos, servicios, controladores, guards, interceptors |
| `bullmq-worker` | Crear o modificar workers/processors de BullMQ |
| `react-component` | Crear componentes React con MUI y soporte dark/light mode |
| `prisma-migration` | Modificar schema, generar migraciones, seeds |
| `amsa-general` | Patrones transversales: DTOs, errores, logging, sockets |
