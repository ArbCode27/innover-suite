-- Inbox en tiempo real: publica conversaciones y mensajes y envía la fila completa en UPDATE.
-- Pegar en el SQL Editor de Supabase (el mismo proyecto del CRM).

alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
