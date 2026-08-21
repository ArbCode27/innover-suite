-- Apply in the production Supabase SQL editor to enable Google Calendar OAuth.

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

alter table google_oauth_states enable row level security;
alter table calendar_connections enable row level security;

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
