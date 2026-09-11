-- =============================================================================
-- Innover Suite — Billing Fase 1
-- Planes, suscripciones, uso de respuestas IA, RPC de incremento atómico
-- Ejecutar en el SQL Editor de Supabase (después del schema base del CRM).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Catálogo de planes
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  vertical text not null check (vertical in ('restaurant', 'ventas', 'realestate')),
  tier text not null check (tier in ('basic', 'pro', 'plus')),
  name text not null,
  price_usd numeric(10, 2) not null,
  users_limit int not null,
  ai_responses_limit int not null,
  channels_limit int not null default 1,
  lead_recovery boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (vertical, tier)
);

create table if not exists public.plan_modules (
  plan_id text not null references public.plans (id) on delete cascade,
  module_key text not null check (
    module_key in ('funnels', 'calendar', 'catalog', 'orders', 'kitchen', 'listings')
  ),
  included boolean not null default true,
  primary key (plan_id, module_key)
);

-- ---------------------------------------------------------------------------
-- 2. Suscripción por organización
-- ---------------------------------------------------------------------------
create table if not exists public.organization_subscriptions (
  organization_id bigint primary key references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'canceled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_subscriptions_status_idx
  on public.organization_subscriptions (status);

create index if not exists organization_subscriptions_period_end_idx
  on public.organization_subscriptions (current_period_end);

-- ---------------------------------------------------------------------------
-- 3. Uso por periodo de facturación
-- ---------------------------------------------------------------------------
create table if not exists public.organization_usage_periods (
  organization_id bigint not null references public.organizations (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  ai_responses int not null default 0 check (ai_responses >= 0),
  ai_quota_exhausted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, period_start)
);

create index if not exists organization_usage_periods_org_end_idx
  on public.organization_usage_periods (organization_id, period_end);

-- ---------------------------------------------------------------------------
-- 4. Seed de planes (9 = 3 verticales × 3 tiers)
-- ---------------------------------------------------------------------------
insert into public.plans (
  id, vertical, tier, name, price_usd, users_limit, ai_responses_limit, channels_limit, lead_recovery
) values
  ('restaurant_basic', 'restaurant', 'basic', 'Restaurante Básico', 99, 4, 4000, 1, false),
  ('restaurant_pro', 'restaurant', 'pro', 'Restaurante Pro', 139, 8, 7000, 2, true),
  ('restaurant_plus', 'restaurant', 'plus', 'Restaurante Plus', 179, 12, 12000, 3, true),
  ('ventas_basic', 'ventas', 'basic', 'Ventas Básico', 119, 5, 5000, 1, false),
  ('ventas_pro', 'ventas', 'pro', 'Ventas Pro', 159, 8, 8000, 2, true),
  ('ventas_plus', 'ventas', 'plus', 'Ventas Plus', 199, 12, 12000, 3, true),
  ('realestate_basic', 'realestate', 'basic', 'Inmobiliaria Básico', 119, 5, 5000, 1, false),
  ('realestate_pro', 'realestate', 'pro', 'Inmobiliaria Pro', 159, 8, 8000, 2, true),
  ('realestate_plus', 'realestate', 'plus', 'Inmobiliaria Plus', 199, 12, 12000, 3, true)
on conflict (id) do update set
  name = excluded.name,
  price_usd = excluded.price_usd,
  users_limit = excluded.users_limit,
  ai_responses_limit = excluded.ai_responses_limit,
  channels_limit = excluded.channels_limit,
  lead_recovery = excluded.lead_recovery,
  is_active = true;

-- Módulos por vertical (mismo set en basic/pro/plus)
delete from public.plan_modules
where plan_id in (
  select id from public.plans
);

insert into public.plan_modules (plan_id, module_key, included)
select p.id, m.module_key, true
from public.plans p
cross join lateral (
  values
    ('restaurant', 'catalog'),
    ('restaurant', 'orders'),
    ('restaurant', 'kitchen'),
    ('ventas', 'funnels'),
    ('ventas', 'calendar'),
    ('ventas', 'catalog'),
    ('ventas', 'orders'),
    ('realestate', 'funnels'),
    ('realestate', 'calendar'),
    ('realestate', 'listings')
) as m(vertical, module_key)
where p.vertical = m.vertical;

-- ---------------------------------------------------------------------------
-- 5. RPC: incrementar respuestas IA de forma atómica
--    Devuelve: used, limit, exhausted (boolean)
-- ---------------------------------------------------------------------------
create or replace function public.increment_ai_responses(p_organization_id bigint)
returns table (
  ai_responses int,
  ai_responses_limit int,
  exhausted boolean,
  period_start timestamptz,
  period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.organization_subscriptions%rowtype;
  v_limit int;
  v_used int;
  v_exhausted_at timestamptz;
begin
  select * into v_sub
  from public.organization_subscriptions
  where organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'subscription_not_found';
  end if;

  if v_sub.status not in ('trialing', 'active', 'past_due') then
    raise exception 'subscription_inactive';
  end if;

  select p.ai_responses_limit into v_limit
  from public.plans p
  where p.id = v_sub.plan_id;

  if v_limit is null then
    raise exception 'plan_not_found';
  end if;

  insert into public.organization_usage_periods (
    organization_id, period_start, period_end, ai_responses, updated_at
  ) values (
    p_organization_id, v_sub.current_period_start, v_sub.current_period_end, 0, now()
  )
  on conflict (organization_id, period_start) do nothing;

  update public.organization_usage_periods u
  set
    ai_responses = u.ai_responses + 1,
    updated_at = now(),
    ai_quota_exhausted_at = case
      when u.ai_responses + 1 >= v_limit then coalesce(u.ai_quota_exhausted_at, now())
      else u.ai_quota_exhausted_at
    end
  where u.organization_id = p_organization_id
    and u.period_start = v_sub.current_period_start
  returning u.ai_responses, u.ai_quota_exhausted_at
  into v_used, v_exhausted_at;

  return query
  select
    v_used,
    v_limit,
    (v_used >= v_limit) as exhausted,
    v_sub.current_period_start,
    v_sub.current_period_end;
end;
$$;

revoke all on function public.increment_ai_responses(bigint) from public;
grant execute on function public.increment_ai_responses(bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Helper: asegurar periodo de uso para la suscripción actual
-- ---------------------------------------------------------------------------
create or replace function public.ensure_usage_period(p_organization_id bigint)
returns public.organization_usage_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.organization_subscriptions%rowtype;
  v_row public.organization_usage_periods%rowtype;
begin
  select * into v_sub
  from public.organization_subscriptions
  where organization_id = p_organization_id;

  if not found then
    raise exception 'subscription_not_found';
  end if;

  insert into public.organization_usage_periods (
    organization_id, period_start, period_end, ai_responses, updated_at
  ) values (
    p_organization_id, v_sub.current_period_start, v_sub.current_period_end, 0, now()
  )
  on conflict (organization_id, period_start) do update
    set period_end = excluded.period_end,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_usage_period(bigint) from public;
grant execute on function public.ensure_usage_period(bigint) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Backfill: suscripción trial 14 días para orgs existentes sin fila
-- ---------------------------------------------------------------------------
insert into public.organization_subscriptions (
  organization_id,
  plan_id,
  status,
  current_period_start,
  current_period_end,
  updated_at
)
select
  o.id,
  case
    when o.business_template = 'restaurant' then 'restaurant_basic'
    when o.business_template = 'realestate' then 'realestate_basic'
    else 'ventas_basic'
  end,
  'trialing',
  now(),
  now() + interval '14 days',
  now()
from public.organizations o
where not exists (
  select 1 from public.organization_subscriptions s where s.organization_id = o.id
);

insert into public.organization_usage_periods (
  organization_id, period_start, period_end, ai_responses
)
select
  s.organization_id,
  s.current_period_start,
  s.current_period_end,
  0
from public.organization_subscriptions s
where not exists (
  select 1
  from public.organization_usage_periods u
  where u.organization_id = s.organization_id
    and u.period_start = s.current_period_start
);

-- Sincronizar organizations.plan (caché de UI) si la columna existe
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'plan'
  ) then
    update public.organizations o
    set plan = s.plan_id
    from public.organization_subscriptions s
    where s.organization_id = o.id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.plan_modules enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_usage_periods enable row level security;

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated
  on public.plans for select
  to authenticated
  using (is_active = true);

drop policy if exists plan_modules_select_authenticated on public.plan_modules;
create policy plan_modules_select_authenticated
  on public.plan_modules for select
  to authenticated
  using (true);

drop policy if exists org_subscriptions_select_member on public.organization_subscriptions;
create policy org_subscriptions_select_member
  on public.organization_subscriptions for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = organization_subscriptions.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists org_usage_select_member on public.organization_usage_periods;
create policy org_usage_select_member
  on public.organization_usage_periods for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members m
      where m.organization_id = organization_usage_periods.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Escrituras solo service_role (sin policies de insert/update para authenticated)

comment on table public.plans is 'Catálogo de planes comerciales (vertical × tier).';
comment on table public.organization_subscriptions is 'Suscripción vigente por organización; fuente de verdad del plan y periodo.';
comment on table public.organization_usage_periods is 'Contador de respuestas IA por periodo de facturación.';
comment on function public.increment_ai_responses(bigint) is 'Suma 1 respuesta IA al periodo actual; marca exhausted al llegar al límite.';
