# Innover Suite

CRM independiente para:

- atencion de chats por IA e intervencion humana
- afiliacion de clientes desde Meta/WhatsApp
- agenda de citas con Google Calendar
- embudos de venta con tablero tipo Kanban

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (DB, auth, realtime, storage)
- Gemini (IA)
- Meta WhatsApp Cloud API
- Google Calendar API

## Arranque local

1. Copia variables:

```bash
cp .env.example .env.local
```

2. Instala dependencias:

```bash
npm install
```

3. Ejecuta la app:

```bash
npm run dev
```

4. Abre:

`http://localhost:3000`

## Estructura inicial

- `src/app/(suite)/inbox`: bandeja de conversaciones
- `src/app/(suite)/calendar`: agenda de citas
- `src/app/(suite)/funnels`: embudos de venta
- `src/app/(suite)/contacts`: contactos/afiliaciones
- `src/app/(suite)/settings`: configuracion del CRM

## API base incluida

- `GET /api/health`
- `GET|POST /api/webhooks/meta/social` (Messenger e Instagram)
- `GET|POST /api/webhooks/meta/whatsapp` (WhatsApp Cloud API)
- `GET|POST /api/meta/webhook` (compatibilidad: despacha según `object`)
- `POST /api/ai/reply`
- `POST /api/calendar/events`

## Webhooks Meta

En Meta Developers configura:

- Messenger/Instagram: `https://tu-dominio/api/webhooks/meta/social`
- WhatsApp: `https://tu-dominio/api/webhooks/meta/whatsapp`

Variables necesarias:

- `META_WEBHOOK_VERIFY_TOKEN` para el `GET` de validación
- `META_APP_SECRET` para validar `X-Hub-Signature-256`
- `SUPABASE_SERVICE_ROLE_KEY` para persistir contactos, conversaciones y mensajes

Aplica `supabase/schema.sql` antes de recibir tráfico real. Los eventos se deduplican por `external_message_id`.

## Base de datos

El esquema base de este proyecto vive en:

- `supabase/schema.sql`

Incluye tablas para contactos, conversaciones, mensajes, agenda, funnels, cuentas de canal y eventos de webhook.

## Siguientes pasos recomendados

1. Configurar proyecto Supabase y aplicar `supabase/schema.sql`.
2. Aplicar `supabase/schema.sql` y configurar `META_WEBHOOK_VERIFY_TOKEN` + `META_APP_SECRET`.
3. Integrar OAuth de Google Calendar.
4. Crear motor de tools del agente IA (calendar, funnels, handoff).
5. Añadir drag & drop real en embudos + auditoria de movimientos.
