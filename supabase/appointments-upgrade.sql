-- Apply in the production Supabase SQL editor to enable CRM appointments.

alter table appointments add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table appointments add column if not exists source text;
alter table appointments add column if not exists purpose text;
alter table appointments add column if not exists meeting_url text;
alter table appointments add column if not exists attendees jsonb;

update appointments
set
  source = coalesce(source, 'manual'),
  purpose = coalesce(purpose, 'consulta'),
  attendees = coalesce(attendees, '[]'::jsonb);

alter table appointments
  alter column source set default 'manual';

alter table appointments
  alter column purpose set default 'consulta';

alter table appointments
  alter column attendees set default '[]'::jsonb;

alter table appointments
  alter column contact_id drop not null;

create index if not exists appointments_org_starts_idx
  on appointments (organization_id, starts_at);

create unique index if not exists appointments_org_google_event_uidx
  on appointments (organization_id, external_calendar_event_id)
  where external_calendar_event_id is not null;

alter table appointments enable row level security;

grant select, insert, update on table appointments to authenticated;

drop policy if exists "Members can read appointments" on appointments;
create policy "Members can read appointments"
on appointments
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage appointments" on appointments;
create policy "Agents can manage appointments"
on appointments
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));
