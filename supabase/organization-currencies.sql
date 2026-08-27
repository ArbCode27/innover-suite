-- Monedas de la organización. Pegar en el SQL Editor de Supabase.
-- Default: Venezuela (VES). Cambia orgs que solo tenían el default DOP; no pisa catálogos mixtos.

alter table public.organizations
  add column if not exists currencies text[] not null default array['VES']::text[];

alter table public.organizations
  add column if not exists default_currency text not null default 'VES';

alter table public.organizations
  alter column currencies set default array['VES']::text[];

alter table public.organizations
  alter column default_currency set default 'VES';

update public.organizations
set currencies = array['VES']::text[]
where currencies is null or cardinality(currencies) = 0;

update public.organizations
set default_currency = 'VES'
where default_currency is null or length(trim(default_currency)) = 0;

-- Orgs que nunca personalizaron monedas y quedaron con el default dominicano.
update public.organizations
set currencies = array['VES']::text[],
    default_currency = 'VES'
where default_currency = 'DOP'
  and currencies = array['DOP']::text[];

alter table if exists public.products
  alter column currency set default 'VES';

alter table public.delivery_zones
  add column if not exists currency text not null default 'VES';

alter table if exists public.delivery_zones
  alter column currency set default 'VES';

alter table if exists public.funnel_cards
  add column if not exists currency text;
