-- Innover Suite base schema (MVP)
-- Apply in a fresh Supabase project for this repository.

create table if not exists organizations (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  source text not null default 'meta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contact_channels (
  id bigint generated always as identity primary key,
  contact_id bigint not null references contacts(id) on delete cascade,
  channel text not null,
  external_id text not null,
  unique(channel, external_id)
);

create table if not exists conversations (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  contact_id bigint references contacts(id) on delete set null,
  channel text not null default 'meta',
  mode text not null default 'ai',
  status text not null default 'open',
  assigned_user_id uuid,
  customer_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references conversations(id) on delete cascade,
  direction text not null,
  sender_type text not null,
  content text,
  media_url text,
  external_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists calendar_connections (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  provider text not null default 'google',
  email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

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

create table if not exists funnels (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists funnel_stages (
  id bigint generated always as identity primary key,
  funnel_id bigint not null references funnels(id) on delete cascade,
  name text not null,
  order_index integer not null,
  unique(funnel_id, order_index)
);

create table if not exists funnel_cards (
  id bigint generated always as identity primary key,
  stage_id bigint not null references funnel_stages(id) on delete cascade,
  contact_id bigint not null references contacts(id) on delete cascade,
  conversation_id bigint references conversations(id) on delete set null,
  title text not null,
  value_amount numeric(12,2),
  owner_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists channel_accounts (
  id bigint generated always as identity primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  channel text not null,
  external_account_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  unique(channel, external_account_id)
);

create table if not exists webhook_events (
  id bigint generated always as identity primary key,
  organization_id bigint references organizations(id) on delete set null,
  provider text not null default 'meta',
  channel text not null,
  external_event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, channel, external_event_id)
);

alter table conversations add column if not exists channel text not null default 'meta';
alter table messages add column if not exists external_message_id text;

create unique index if not exists messages_external_message_id_uidx
  on messages (external_message_id)
  where external_message_id is not null;

create unique index if not exists conversations_open_contact_channel_uidx
  on conversations (contact_id, channel)
  where contact_id is not null and status in ('open', 'in_progress');
