-- Resiliencia del agente: reintentos, modelo usado, cortesía y turnos colgados.
-- Pegar en el SQL Editor de Supabase.

alter table public.agent_turns add column if not exists retry_count integer;
alter table public.agent_turns add column if not exists last_model text;
alter table public.agent_turns add column if not exists retryable boolean;
alter table public.agent_turns add column if not exists next_retry_at timestamptz;
alter table public.agent_turns add column if not exists courtesy_sent boolean;
alter table public.agent_turns add column if not exists updated_at timestamptz;

update public.agent_turns
set
  retry_count = coalesce(retry_count, 0),
  retryable = coalesce(retryable, false),
  courtesy_sent = coalesce(courtesy_sent, false),
  updated_at = coalesce(updated_at, now());

alter table public.agent_turns alter column retry_count set default 0;
alter table public.agent_turns alter column retryable set default false;
alter table public.agent_turns alter column courtesy_sent set default false;
alter table public.agent_turns alter column updated_at set default now();

alter table public.agent_turns alter column retry_count set not null;
alter table public.agent_turns alter column retryable set not null;
alter table public.agent_turns alter column courtesy_sent set not null;

create index if not exists agent_turns_retry_idx
  on public.agent_turns (status, retryable, next_retry_at)
  where status = 'failed' and retryable = true;

create index if not exists agent_turns_stale_running_idx
  on public.agent_turns (status, updated_at)
  where status = 'running';
