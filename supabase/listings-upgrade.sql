-- Inmuebles (listings), galería, visitas y vínculo con embudo/calendario.
-- Pegar en el SQL Editor de Supabase después de commerce-upgrade.sql.

alter table public.organization_modules
  drop constraint if exists organization_modules_key_check;

alter table public.organization_modules
  add constraint organization_modules_key_check
  check (module_key in ('funnels', 'calendar', 'catalog', 'orders', 'kitchen', 'listings'));

create table if not exists public.listings (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  property_type text not null default 'apartment',
  operation text not null default 'sale',
  status text not null default 'available',
  zone text,
  neighborhood text,
  city text,
  area_m2 numeric(12, 2),
  bedrooms integer,
  bathrooms integer,
  parking integer,
  year_built integer,
  price numeric(14, 2),
  currency text not null default 'USD',
  amenities text[] not null default '{}',
  owner_contact_id bigint references public.contacts(id) on delete set null,
  exclusive boolean not null default false,
  video_url text,
  tour_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_property_type_check
    check (property_type in ('house', 'apartment', 'commercial', 'land', 'office', 'warehouse')),
  constraint listings_operation_check
    check (operation in ('sale', 'rent', 'both')),
  constraint listings_status_check
    check (status in ('available', 'reserved', 'sold', 'rented', 'paused')),
  constraint listings_price_check check (price is null or price >= 0)
);

create unique index if not exists listings_org_code_idx
  on public.listings (organization_id, code);

create index if not exists listings_org_status_idx
  on public.listings (organization_id, status);

create index if not exists listings_org_updated_idx
  on public.listings (organization_id, updated_at desc);

create table if not exists public.listing_media (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  listing_id bigint not null references public.listings(id) on delete cascade,
  kind text not null default 'image',
  url text not null,
  path text,
  mime text,
  caption text,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  constraint listing_media_kind_check check (kind in ('image', 'floorplan'))
);

create index if not exists listing_media_listing_idx
  on public.listing_media (listing_id, sort_index);

alter table public.appointments
  add column if not exists listing_id bigint references public.listings(id) on delete set null;

alter table public.appointments
  add column if not exists visit_status text;

update public.appointments
set visit_status = 'pending'
where visit_status is null and listing_id is not null;

alter table public.appointments
  drop constraint if exists appointments_visit_status_check;

alter table public.appointments
  add constraint appointments_visit_status_check
  check (visit_status is null or visit_status in ('pending', 'attended', 'no_show', 'rescheduled'));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'purpose'
  ) then
    alter table public.appointments drop constraint if exists appointments_purpose_check;
    alter table public.appointments
      add constraint appointments_purpose_check
      check (
        purpose is null or purpose in (
          'consulta',
          'seguimiento',
          'demo',
          'cierre',
          'interno',
          'visita',
          'segunda_visita',
          'tasacion',
          'firma'
        )
      );
  end if;
end $$;

alter table public.funnel_cards
  add column if not exists listing_id bigint references public.listings(id) on delete set null;

create index if not exists appointments_listing_idx
  on public.appointments (listing_id)
  where listing_id is not null;

create index if not exists funnel_cards_listing_idx
  on public.funnel_cards (listing_id)
  where listing_id is not null;

alter table public.listings enable row level security;
alter table public.listing_media enable row level security;

drop policy if exists "Members can read listings" on public.listings;
create policy "Members can read listings"
on public.listings for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage listings" on public.listings;
create policy "Agents can manage listings"
on public.listings for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read listing media" on public.listing_media;
create policy "Members can read listing media"
on public.listing_media for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage listing media" on public.listing_media;
create policy "Agents can manage listing media"
on public.listing_media for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists listing_images_public_read on storage.objects;
create policy listing_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'listing-images');
