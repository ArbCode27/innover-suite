-- Separar menú (platos) y catálogo público (productos/servicios/inmuebles).
-- Mismo slug: /menu/[slug] y /catalogo/[slug]
-- Pegar en el SQL Editor de Supabase.

alter table public.organizations
  add column if not exists public_catalog_enabled boolean not null default false;

-- Orgs que ya tenían el enlace unificado: activar ambas superficies.
update public.organizations
set public_catalog_enabled = true
where public_menu_enabled is true
  and public_catalog_enabled is false;
