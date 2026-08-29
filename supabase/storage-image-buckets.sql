-- Buckets públicos para fotos de catálogo y FAQs.
-- Pegar en el SQL Editor de Supabase. Meta descarga estas URLs HTTPS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'knowledge-images',
    'knowledge-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'product-images');

drop policy if exists knowledge_images_public_read on storage.objects;
create policy knowledge_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'knowledge-images');
