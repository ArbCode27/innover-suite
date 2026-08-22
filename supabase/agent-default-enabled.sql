-- Activar respuestas automáticas por defecto (y en filas ya creadas).
alter table public.organization_agent_settings
  alter column enabled set default true;

update public.organization_agent_settings
set enabled = true
where enabled = false;
