-- Innover Suite multi-tenant schema (MVP)
-- Apply in a fresh Supabase project for this repository.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists organizations (
  id bigint generated always as identity primary key,
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists organizations_set_updated_at on organizations;
create trigger organizations_set_updated_at
before update on organizations
for each row execute function public.set_updated_at();

create table if not exists organization_members (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner', 'admin', 'agent', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, user_id)
);

drop trigger if exists organization_members_set_updated_at on organization_members;
create trigger organization_members_set_updated_at
before update on organization_members
for each row execute function public.set_updated_at();

create table if not exists organization_invitations (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent', 'viewer')),
  token uuid not null default gen_random_uuid(),
  invited_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  unique(organization_id, email)
);

create table if not exists messenger_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(target_organization_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.has_org_role(
  target_organization_id bigint,
  allowed_roles text[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_organization_for_current_user(org_name text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  created_organization_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.organizations (name, owner_user_id)
  values (nullif(trim(org_name), ''), auth.uid())
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (created_organization_id, auth.uid(), 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;

  return created_organization_id;
end;
$$;

revoke all on function public.create_organization_for_current_user(text) from public;
grant execute on function public.create_organization_for_current_user(text) to authenticated;

create table if not exists contacts (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  source text not null default 'meta',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at
before update on contacts
for each row execute function public.set_updated_at();

create table if not exists contact_channels (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  contact_id bigint not null references contacts(id) on delete cascade,
  channel text not null check (channel in ('messenger', 'instagram', 'whatsapp')),
  external_id text not null,
  created_at timestamptz not null default now(),
  unique(organization_id, channel, external_id)
);

create table if not exists channel_accounts (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('messenger', 'instagram', 'whatsapp')),
  external_account_id text not null,
  display_name text,
  connected_by_user_id uuid references auth.users(id) on delete set null,
  access_token text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel, external_account_id)
);

drop trigger if exists channel_accounts_set_updated_at on channel_accounts;
create trigger channel_accounts_set_updated_at
before update on channel_accounts
for each row execute function public.set_updated_at();

create table if not exists conversations (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  contact_id bigint references contacts(id) on delete set null,
  channel_account_id bigint references channel_accounts(id) on delete set null,
  channel text not null check (channel in ('messenger', 'instagram', 'whatsapp')),
  mode text not null default 'ai' check (mode in ('ai', 'human')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  customer_phone text,
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists conversations_set_updated_at on conversations;
create trigger conversations_set_updated_at
before update on conversations
for each row execute function public.set_updated_at();

create table if not exists messages (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  conversation_id bigint not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('contact', 'agent', 'ai', 'system')),
  sender_user_id uuid references auth.users(id) on delete set null,
  content text,
  media_url text,
  external_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id bigint generated always as identity primary key,
  organization_id bigint references organizations(id) on delete set null,
  provider text not null default 'meta',
  channel text not null check (channel in ('messenger', 'instagram', 'whatsapp')),
  external_event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, channel, external_event_id)
);

create table if not exists google_oauth_states (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state_token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists calendar_connections (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  provider text not null default 'google',
  email text,
  google_user_id text,
  google_calendar_id text not null default 'primary',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  connected_by_user_id uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists calendar_connections_set_updated_at on calendar_connections;
create trigger calendar_connections_set_updated_at
before update on calendar_connections
for each row execute function public.set_updated_at();

create table if not exists appointments (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  contact_id bigint not null references contacts(id) on delete cascade,
  conversation_id bigint references conversations(id) on delete set null,
  external_calendar_event_id text,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists appointments_set_updated_at on appointments;
create trigger appointments_set_updated_at
before update on appointments
for each row execute function public.set_updated_at();

create table if not exists funnels (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists funnels_organization_uidx
  on funnels (organization_id);

create table if not exists funnel_stages (
  id bigint generated always as identity primary key,
  funnel_id bigint not null references funnels(id) on delete cascade,
  name text not null,
  order_index integer not null
);

create index if not exists funnel_stages_funnel_order_idx
  on funnel_stages (funnel_id, order_index);

create table if not exists funnel_cards (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  funnel_id bigint not null references funnels(id) on delete cascade,
  stage_id bigint not null references funnel_stages(id) on delete cascade,
  contact_id bigint not null references contacts(id) on delete cascade,
  conversation_id bigint references conversations(id) on delete set null,
  title text not null,
  value_amount numeric(12,2),
  owner_user_id uuid references auth.users(id) on delete set null,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists funnel_cards_set_updated_at on funnel_cards;
create trigger funnel_cards_set_updated_at
before update on funnel_cards
for each row execute function public.set_updated_at();

create unique index if not exists messages_external_message_id_uidx
  on messages (external_message_id)
  where external_message_id is not null;

create unique index if not exists conversations_open_contact_channel_uidx
  on conversations (organization_id, contact_id, channel)
  where contact_id is not null and status in ('open', 'in_progress');

create index if not exists organization_members_user_idx
  on organization_members (user_id);

create index if not exists conversations_org_status_idx
  on conversations (organization_id, status, updated_at desc);

create index if not exists conversations_assigned_user_idx
  on conversations (assigned_user_id)
  where assigned_user_id is not null;

create index if not exists messages_org_created_idx
  on messages (organization_id, created_at desc);

create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at asc);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_invitations enable row level security;
alter table messenger_oauth_states enable row level security;
alter table google_oauth_states enable row level security;
alter table calendar_connections enable row level security;
alter table channel_accounts enable row level security;
alter table contacts enable row level security;
alter table contact_channels enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table webhook_events enable row level security;
alter table funnels enable row level security;
alter table funnel_stages enable row level security;
alter table funnel_cards enable row level security;

drop policy if exists "Members can read organizations" on organizations;
create policy "Members can read organizations"
on organizations
for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "Owners and admins can update organizations" on organizations;
create policy "Owners and admins can update organizations"
on organizations
for update
to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

drop policy if exists "Members can read organization members" on organization_members;
create policy "Members can read organization members"
on organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage organization members" on organization_members;
create policy "Owners and admins can manage organization members"
on organization_members
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Owners and admins can manage invitations" on organization_invitations;
create policy "Owners and admins can manage invitations"
on organization_invitations
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members can read channel accounts" on channel_accounts;
create policy "Members can read channel accounts"
on channel_accounts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage channel accounts" on channel_accounts;
create policy "Owners and admins can manage channel accounts"
on channel_accounts
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members can read contacts" on contacts;
create policy "Members can read contacts"
on contacts
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage contacts" on contacts;
create policy "Agents can manage contacts"
on contacts
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read contact channels" on contact_channels;
create policy "Members can read contact channels"
on contact_channels
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage contact channels" on contact_channels;
create policy "Agents can manage contact channels"
on contact_channels
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read conversations" on conversations;
create policy "Members can read conversations"
on conversations
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage conversations" on conversations;
create policy "Agents can manage conversations"
on conversations
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read messages" on messages;
create policy "Members can read messages"
on messages
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can create outbound messages" on messages;
create policy "Agents can create outbound messages"
on messages
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'agent'])
  and direction = 'outbound'
);

drop policy if exists "Agents can update outbound messages" on messages;
create policy "Agents can update outbound messages"
on messages
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'agent'])
  and direction = 'outbound'
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'agent'])
  and direction = 'outbound'
);

drop policy if exists "Owners and admins can read webhook events" on webhook_events;
create policy "Owners and admins can read webhook events"
on webhook_events
for select
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));

alter table calendar_connections add column if not exists google_user_id text;
alter table calendar_connections add column if not exists google_calendar_id text;
alter table calendar_connections add column if not exists connected_by_user_id uuid references auth.users(id) on delete set null;
alter table calendar_connections add column if not exists connected_at timestamptz;
alter table calendar_connections add column if not exists revoked_at timestamptz;
alter table calendar_connections add column if not exists updated_at timestamptz;

update calendar_connections
set
  google_calendar_id = coalesce(google_calendar_id, 'primary'),
  connected_at = coalesce(connected_at, created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

alter table calendar_connections
  alter column google_calendar_id set default 'primary';

alter table calendar_connections
  alter column connected_at set default now();

alter table calendar_connections
  alter column updated_at set default now();

alter table calendar_connections
  alter column google_calendar_id set not null;

delete from calendar_connections as older
using calendar_connections as newer
where older.organization_id = newer.organization_id
  and older.provider = newer.provider
  and older.id < newer.id;

create unique index if not exists calendar_connections_org_provider_uidx
  on calendar_connections (organization_id, provider);

create index if not exists calendar_connections_org_active_idx
  on calendar_connections (organization_id)
  where revoked_at is null;

drop trigger if exists calendar_connections_set_updated_at on calendar_connections;
create trigger calendar_connections_set_updated_at
before update on calendar_connections
for each row execute function public.set_updated_at();

grant select, update on table calendar_connections to authenticated;

drop policy if exists "Members can read calendar connections" on calendar_connections;
create policy "Members can read calendar connections"
on calendar_connections
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage calendar connections" on calendar_connections;
create policy "Owners and admins can manage calendar connections"
on calendar_connections
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

-- Funnel schema upgrades for existing databases
alter table funnel_stages drop constraint if exists funnel_stages_funnel_id_order_index_key;

alter table funnel_cards add column if not exists organization_id bigint references organizations(id) on delete cascade;
alter table funnel_cards add column if not exists funnel_id bigint references funnels(id) on delete cascade;
alter table funnel_cards add column if not exists position integer not null default 0;

update funnel_cards as cards
set
  funnel_id = stages.funnel_id,
  organization_id = funnels.organization_id
from funnel_stages as stages
join funnels on funnels.id = stages.funnel_id
where cards.stage_id = stages.id
  and (cards.funnel_id is null or cards.organization_id is null);

create unique index if not exists funnels_organization_uidx
  on funnels (organization_id);

create index if not exists funnel_stages_funnel_order_idx
  on funnel_stages (funnel_id, order_index);

create unique index if not exists funnel_cards_funnel_contact_uidx
  on funnel_cards (funnel_id, contact_id)
  where funnel_id is not null;

create index if not exists funnel_cards_stage_position_idx
  on funnel_cards (stage_id, position, id);

drop policy if exists "Members can read funnels" on funnels;
create policy "Members can read funnels"
on funnels
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage funnels" on funnels;
create policy "Agents can manage funnels"
on funnels
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read funnel stages" on funnel_stages;
create policy "Members can read funnel stages"
on funnel_stages
for select
to authenticated
using (
  exists (
    select 1
    from funnels
    where funnels.id = funnel_stages.funnel_id
      and public.is_org_member(funnels.organization_id)
  )
);

drop policy if exists "Agents can manage funnel stages" on funnel_stages;
create policy "Agents can manage funnel stages"
on funnel_stages
for all
to authenticated
using (
  exists (
    select 1
    from funnels
    where funnels.id = funnel_stages.funnel_id
      and public.has_org_role(funnels.organization_id, array['owner', 'admin', 'agent'])
  )
)
with check (
  exists (
    select 1
    from funnels
    where funnels.id = funnel_stages.funnel_id
      and public.has_org_role(funnels.organization_id, array['owner', 'admin', 'agent'])
  )
);

drop policy if exists "Members can read funnel cards" on funnel_cards;
create policy "Members can read funnel cards"
on funnel_cards
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage funnel cards" on funnel_cards;
create policy "Agents can manage funnel cards"
on funnel_cards
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'agent'])
  and exists (
    select 1
    from funnel_stages
    join funnels on funnels.id = funnel_stages.funnel_id
    where funnel_stages.id = funnel_cards.stage_id
      and funnels.id = funnel_cards.funnel_id
      and funnels.organization_id = funnel_cards.organization_id
  )
);
