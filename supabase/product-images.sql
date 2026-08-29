-- Foto principal del producto y política de envío del agente.
-- Pegar en el SQL Editor de Supabase.

alter table public.products
  add column if not exists image_url text;

alter table public.products
  add column if not exists image_path text;

alter table public.products
  add column if not exists image_mime text;

alter table public.products
  add column if not exists image_send_policy text;

update public.products
set image_send_policy = 'on_request'
where image_send_policy is null;

alter table public.products
  alter column image_send_policy set default 'on_request';

alter table public.products
  drop constraint if exists products_image_send_policy_check;

alter table public.products
  add constraint products_image_send_policy_check
  check (image_send_policy in ('on_request', 'always'));
