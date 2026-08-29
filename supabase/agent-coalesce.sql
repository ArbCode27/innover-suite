-- Un solo turno de agente running por conversación.
-- Pegar en el SQL Editor de Supabase.

with ranked as (
  select
    id,
    row_number() over (
      partition by conversation_id
      order by updated_at desc nulls last, id desc
    ) as rn
  from public.agent_turns
  where status = 'running'
)
update public.agent_turns
set
  status = 'skipped',
  error = 'superseded_duplicate_running',
  retryable = false,
  next_retry_at = null,
  updated_at = now()
where id in (select id from ranked where rn > 1);

create unique index if not exists agent_turns_one_running_per_conversation_idx
  on public.agent_turns (conversation_id)
  where status = 'running';
