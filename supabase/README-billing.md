# Billing Fase 1

Ejecuta en el SQL Editor de Supabase (proyecto de producción o staging):

1. Abre `supabase/billing-phase1.sql`
2. Pégalo completo y corre el script
3. En `.env.local` agrega tus emails de plataforma:

```
PLATFORM_ADMIN_EMAILS=tu@email.com,otro@email.com
```

4. Reinicia `next dev`
5. Entra a `/admin` con ese email

El script crea:

- `plans` + `plan_modules` (9 planes)
- `organization_subscriptions`
- `organization_usage_periods`
- RPC `increment_ai_responses`
- Backfill de suscripción trial 14 días para orgs existentes
- RLS de lectura para miembros

Escrituras de billing solo con `service_role` (server actions / admin client).
