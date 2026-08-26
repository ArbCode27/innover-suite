-- WhatsApp Embedded Signup: estados OAuth de un solo uso.
-- Pegar en el SQL Editor de Supabase. El cliente de servicio escribe estos registros;
-- los usuarios autenticados no leen ni mutan la tabla.

create table if not exists public.whatsapp_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_oauth_states_org_idx
  on public.whatsapp_oauth_states (organization_id);

create index if not exists whatsapp_oauth_states_expires_idx
  on public.whatsapp_oauth_states (expires_at);

alter table public.whatsapp_oauth_states enable row level security;
