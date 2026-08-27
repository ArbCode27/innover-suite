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
- `src/app/onboarding/organization`: alta inicial de organización

## API base incluida

- `GET /api/health`
- `GET|POST /api/webhooks/meta/social` (Messenger e Instagram)
- `GET|POST /api/webhooks/meta/whatsapp` (WhatsApp Cloud API)
- `GET|POST /api/meta/webhook` (compatibilidad: despacha según `object`)
- `GET /api/auth/instagram/start` (inicia OAuth por organización)
- `GET /api/auth/instagram/callback` (callback OAuth)
- `POST /api/auth/instagram/disconnect` (desconectar cuenta vinculada)
- `GET /api/auth/whatsapp/start` (inicia WhatsApp Embedded Signup por organización)
- `GET|POST /api/auth/whatsapp/callback` (callback OAuth / registro insertado de Meta y SDK)
- `POST /api/auth/whatsapp/disconnect` (desconectar números de WhatsApp)
- `GET /api/cron/instagram/refresh` (renovar tokens próximos a expirar)
- `GET /api/auth/google/start` (inicia OAuth de Google Calendar por organización)
- `GET /api/auth/google/callback` (callback OAuth de Google)
- `POST /api/auth/google/disconnect` (desconectar Google Calendar)
- `GET /api/cron/google/refresh` (renovar access tokens de Calendar)
- `POST /api/ai/reply`
- `POST /api/calendar/events`

## Webhooks Meta

En Meta Developers configura:

- Messenger/Instagram: `https://tu-dominio/api/webhooks/meta/social`
- WhatsApp: `https://tu-dominio/api/webhooks/meta/whatsapp`
- Registro insertado de WhatsApp (URI de redirección): `https://tu-dominio/api/auth/whatsapp/callback`

En el flujo alojado por Meta (Login for Business / “Generar enlace”), esa URI de redirección debe apuntar al callback de WhatsApp, no al de Messenger. El owner o admin debe tener sesión en el CRM (o iniciar sesión al volver) para guardar el número.

Variables necesarias:

- `META_WEBHOOK_VERIFY_TOKEN` para el `GET` de validación
- `META_APP_SECRET` para validar `X-Hub-Signature-256`
- `SUPABASE_SERVICE_ROLE_KEY` para persistir contactos, conversaciones y mensajes
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` y `INSTAGRAM_REDIRECT_URI` para OAuth
- `FACEBOOK_APP_ID` y `FACEBOOK_REDIRECT_URI` para OAuth de Messenger; usa `META_APP_SECRET` como clave de la app
- `WHATSAPP_EMBEDDED_CONFIG_ID` para WhatsApp Embedded Signup (mismo `FACEBOOK_APP_ID` + `META_APP_SECRET`)
- `CRON_SECRET` para proteger el endpoint de refresco de tokens
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_REDIRECT_URI` para OAuth de Google Calendar

Aplica `supabase/schema.sql` antes de recibir tráfico real. Si el proyecto ya existe, aplica también `supabase/calendar-upgrade.sql`, `supabase/appointments-upgrade.sql` y `supabase/whatsapp-embedded-signup.sql`.
Los eventos se deduplican por `external_message_id`.
Los eventos que no tengan cuenta conectada en `channel_accounts` se ignoran para evitar mezclar organizaciones.
Las respuestas del agente desde `/inbox` se envían a Graph API (Instagram, Messenger o WhatsApp) y el CRM guarda el estado de entrega (`pending`, `sent` o `failed`).

## Base de datos

El esquema base de este proyecto vive en:

- `supabase/schema.sql`

Incluye tablas multi-tenant para organizaciones, miembros, invitaciones, cuentas de canal, contactos, conversaciones, mensajes, agenda, funnels y eventos de webhook.

## Siguientes pasos recomendados

1. Configurar proyecto Supabase y aplicar `supabase/schema.sql`.
2. Configurar `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`.
3. Aplicar `supabase/appointments-upgrade.sql` y crear citas desde `/calendar`.
4. Crear motor de tools del agente IA (calendar, funnels, handoff).
5. Añadir drag & drop real en embudos + auditoria de movimientos.
