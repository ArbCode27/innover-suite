-- Preview denormalizado en conversaciones + configuración de recuperación de leads.
-- Pegar en el SQL Editor de Supabase.

alter table public.conversations
  add column if not exists last_message_preview text,
  add column if not exists last_message_direction text;

alter table public.conversations
  drop constraint if exists conversations_last_message_direction_check;

alter table public.conversations
  add constraint conversations_last_message_direction_check
  check (
    last_message_direction is null
    or last_message_direction in ('inbound', 'outbound')
  );

update public.conversations
set last_message_preview = left(trim(metadata ->> 'last_message_preview'), 180)
where last_message_preview is null
  and coalesce(trim(metadata ->> 'last_message_preview'), '') <> '';

update public.conversations as conversation
set
  last_message_preview = left(
    trim(
      coalesce(
        nullif(trim(latest.content), ''),
        conversation.last_message_preview,
        'Sin mensajes recientes'
      )
    ),
    180
  ),
  last_message_direction = latest.direction
from (
  select distinct on (messages.conversation_id)
    messages.conversation_id,
    messages.content,
    messages.direction
  from public.messages
  where messages.sender_type is distinct from 'system'
  order by messages.conversation_id, messages.created_at desc, messages.id desc
) as latest
where conversation.id = latest.conversation_id
  and (
    conversation.last_message_preview is null
    or conversation.last_message_direction is null
  );

alter table public.organization_agent_settings
  add column if not exists lead_recovery_enabled boolean not null default false,
  add column if not exists lead_recovery_idle_hours integer not null default 6,
  add column if not exists lead_recovery_stage_id bigint references public.funnel_stages(id) on delete set null,
  add column if not exists lead_recovery_respect_hours boolean not null default true,
  add column if not exists lead_recovery_cooldown_hours integer not null default 24,
  add column if not exists lead_recovery_prompt text;

alter table public.organization_agent_settings
  drop constraint if exists agent_settings_lead_recovery_idle_hours_check;

alter table public.organization_agent_settings
  add constraint agent_settings_lead_recovery_idle_hours_check
  check (lead_recovery_idle_hours between 2 and 24);

alter table public.organization_agent_settings
  drop constraint if exists agent_settings_lead_recovery_cooldown_hours_check;

alter table public.organization_agent_settings
  add constraint agent_settings_lead_recovery_cooldown_hours_check
  check (lead_recovery_cooldown_hours between 6 and 168);
