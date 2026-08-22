-- Innover Suite: media, realtime, agente y citas.
-- Pegar en el SQL Editor de Supabase. Es idempotente.

-- ---------------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------------
alter table public.messages add column if not exists media_url text;
alter table public.messages add column if not exists metadata jsonb;
update public.messages set metadata = '{}'::jsonb where metadata is null;
alter table public.messages alter column metadata set default '{}'::jsonb;

create unique index if not exists messages_external_message_id_uidx
  on public.messages (external_message_id)
  where external_message_id is not null;

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_org_created_idx
  on public.messages (organization_id, created_at desc);

-- Realtime: el inbox actualiza fotos/audios cuando termina la ingesta.
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: bucket público para que Meta pueda leer los archivos de salida
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  true,
  20971520,
  null
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "Public can read message attachments" on storage.objects;
create policy "Public can read message attachments"
on storage.objects
for select
to public
using (bucket_id = 'message-attachments');

drop policy if exists "Members can upload message attachments" on storage.objects;
create policy "Members can upload message attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-attachments'
  and (
    (
      (storage.foldername(name))[1] = 'org'
      and public.is_org_member(((storage.foldername(name))[2])::bigint)
    )
    or (
      (storage.foldername(name))[1] = 'conversations'
      and exists (
        select 1
        from public.conversations c
        where c.id = ((storage.foldername(name))[2])::bigint
          and public.is_org_member(c.organization_id)
          and public.has_org_role(c.organization_id, array['owner', 'admin', 'agent'])
      )
    )
  )
);

drop policy if exists "Members can update message attachments" on storage.objects;
create policy "Members can update message attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'message-attachments'
  and (
    (
      (storage.foldername(name))[1] = 'org'
      and public.is_org_member(((storage.foldername(name))[2])::bigint)
    )
    or (
      (storage.foldername(name))[1] = 'conversations'
      and exists (
        select 1
        from public.conversations c
        where c.id = ((storage.foldername(name))[2])::bigint
          and public.is_org_member(c.organization_id)
          and public.has_org_role(c.organization_id, array['owner', 'admin', 'agent'])
      )
    )
  )
)
with check (
  bucket_id = 'message-attachments'
);

-- ---------------------------------------------------------------------------
-- Agente IA
-- ---------------------------------------------------------------------------
create table if not exists public.organization_agent_settings (
  organization_id bigint primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  system_prompt text not null default '',
  model text not null default 'gemini-2.0-flash',
  tools_calendar boolean not null default true,
  tools_funnel boolean not null default true,
  tools_handoff boolean not null default true,
  require_booking_confirmation boolean not null default true,
  language text not null default 'es-DO',
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organization_agent_settings_set_updated_at on public.organization_agent_settings;
create trigger organization_agent_settings_set_updated_at
before update on public.organization_agent_settings
for each row execute function public.set_updated_at();

create table if not exists public.agent_turns (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  inbound_message_id bigint not null references public.messages(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'skipped', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_turns_inbound_message_uidx
  on public.agent_turns (inbound_message_id);

create index if not exists agent_turns_conversation_idx
  on public.agent_turns (conversation_id, created_at desc);

create table if not exists public.agent_tool_runs (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  conversation_id bigint not null references public.conversations(id) on delete cascade,
  turn_id bigint references public.agent_turns(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agent_tool_runs_conversation_idx
  on public.agent_tool_runs (conversation_id, created_at desc);

alter table public.organization_agent_settings enable row level security;
alter table public.agent_turns enable row level security;
alter table public.agent_tool_runs enable row level security;

grant select on table public.organization_agent_settings to authenticated;
grant update, insert on table public.organization_agent_settings to authenticated;
grant select on table public.agent_turns to authenticated;
grant select on table public.agent_tool_runs to authenticated;

drop policy if exists "Members can read agent settings" on public.organization_agent_settings;
create policy "Members can read agent settings"
on public.organization_agent_settings
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage agent settings" on public.organization_agent_settings;
create policy "Owners and admins can manage agent settings"
on public.organization_agent_settings
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members can read agent turns" on public.agent_turns;
create policy "Members can read agent turns"
on public.agent_turns
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Members can read agent tool runs" on public.agent_tool_runs;
create policy "Members can read agent tool runs"
on public.agent_tool_runs
for select
to authenticated
using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------------------
alter table public.appointments add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table public.appointments add column if not exists source text;
alter table public.appointments add column if not exists purpose text;
alter table public.appointments add column if not exists meeting_url text;
alter table public.appointments add column if not exists attendees jsonb;

update public.appointments
set
  source = coalesce(source, 'manual'),
  purpose = coalesce(purpose, 'consulta'),
  attendees = coalesce(attendees, '[]'::jsonb);

alter table public.appointments alter column source set default 'manual';
alter table public.appointments alter column purpose set default 'consulta';
alter table public.appointments alter column attendees set default '[]'::jsonb;
alter table public.appointments alter column contact_id drop not null;

create index if not exists appointments_org_starts_idx
  on public.appointments (organization_id, starts_at);

create unique index if not exists appointments_org_google_event_uidx
  on public.appointments (organization_id, external_calendar_event_id)
  where external_calendar_event_id is not null;
