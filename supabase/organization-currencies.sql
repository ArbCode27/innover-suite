-- Monedas de la organización. Pegar en el SQL Editor de Supabase.

alter table public.organizations
  add column if not exists currencies text[] not null default array['DOP']::text[];

alter table public.organizations
  add column if not exists default_currency text not null default 'DOP';

update public.organizations
set currencies = array['DOP']::text[]
where currencies is null or cardinality(currencies) = 0;

update public.organizations
set default_currency = 'DOP'
where default_currency is null or length(trim(default_currency)) = 0;

alter table public.delivery_zones
  add column if not exists currency text not null default 'DOP';

alter table if exists public.funnel_cards
  add column if not exists currency text;
