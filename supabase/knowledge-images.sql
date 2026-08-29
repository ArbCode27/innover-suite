-- Imágenes en la base de conocimiento para que el agente las envíe por chat.
-- Pegar en el SQL Editor de Supabase.

alter table public.knowledge_articles
  add column if not exists image_url text;

alter table public.knowledge_articles
  add column if not exists image_path text;

alter table public.knowledge_articles
  add column if not exists image_mime text;

alter table public.knowledge_articles
  add column if not exists use_when text;
