-- Agent IA: prompt por organización, turns idempotentes y auditoría de tools.

create table if not exists organization_agent_settings (
  organization_id bigint primary key references organizations(id) on delete cascade,
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

drop trigger if exists organization_agent_settings_set_updated_at on organization_agent_settings;
create trigger organization_agent_settings_set_updated_at
before update on organization_agent_settings
for each row execute function public.set_updated_at();

create table if not exists agent_turns (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  conversation_id bigint not null references conversations(id) on delete cascade,
  inbound_message_id bigint not null references messages(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'skipped', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_turns_inbound_message_uidx
  on agent_turns (inbound_message_id);

create index if not exists agent_turns_conversation_idx
  on agent_turns (conversation_id, created_at desc);

create table if not exists agent_tool_runs (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  conversation_id bigint not null references conversations(id) on delete cascade,
  turn_id bigint references agent_turns(id) on delete cascade,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  ok boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agent_tool_runs_conversation_idx
  on agent_tool_runs (conversation_id, created_at desc);

alter table organization_agent_settings enable row level security;
alter table agent_turns enable row level security;
alter table agent_tool_runs enable row level security;

grant select on table organization_agent_settings to authenticated;
grant update, insert on table organization_agent_settings to authenticated;
grant select on table agent_turns to authenticated;
grant select on table agent_tool_runs to authenticated;

drop policy if exists "Members can read agent settings" on organization_agent_settings;
create policy "Members can read agent settings"
on organization_agent_settings
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage agent settings" on organization_agent_settings;
create policy "Owners and admins can manage agent settings"
on organization_agent_settings
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members can read agent turns" on agent_turns;
create policy "Members can read agent turns"
on agent_turns
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Members can read agent tool runs" on agent_tool_runs;
create policy "Members can read agent tool runs"
on agent_tool_runs
for select
to authenticated
using (public.is_org_member(organization_id));
