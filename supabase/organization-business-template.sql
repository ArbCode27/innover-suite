-- Perfil de negocio elegido en el wizard de alta.
-- Pegar en el SQL Editor de Supabase.

alter table public.organizations
  add column if not exists business_template text;

alter table public.organizations
  drop constraint if exists organizations_business_template_check;

alter table public.organizations
  add constraint organizations_business_template_check
  check (
    business_template is null
    or business_template in ('restaurant', 'retail', 'services', 'realestate')
  );
