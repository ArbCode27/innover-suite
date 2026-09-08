-- Marca de organización: logo + paleta del catálogo público.
-- Pegar en el SQL Editor de Supabase.

alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists logo_path text,
  add column if not exists logo_mime text,
  add column if not exists theme_palette text;

alter table public.organizations
  drop constraint if exists organizations_theme_palette_check;

alter table public.organizations
  add constraint organizations_theme_palette_check
  check (
    theme_palette is null
    or theme_palette in ('default', 'violet', 'emerald', 'rose', 'candy', 'amber')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-images',
  'organization-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organization_images_public_read on storage.objects;
create policy organization_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'organization-images');
