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
