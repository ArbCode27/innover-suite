-- Apply in the production Supabase SQL editor if funnels already exist
-- without RLS, organization_id or position.

alter table funnel_stages drop constraint if exists funnel_stages_funnel_id_order_index_key;

alter table funnel_cards add column if not exists organization_id bigint references organizations(id) on delete cascade;
alter table funnel_cards add column if not exists funnel_id bigint references funnels(id) on delete cascade;
alter table funnel_cards add column if not exists position integer not null default 0;

update funnel_cards as cards
set
  funnel_id = stages.funnel_id,
  organization_id = funnels.organization_id
from funnel_stages as stages
join funnels on funnels.id = stages.funnel_id
where cards.stage_id = stages.id
  and (cards.funnel_id is null or cards.organization_id is null);

create unique index if not exists funnels_organization_uidx
  on funnels (organization_id);

create index if not exists funnel_stages_funnel_order_idx
  on funnel_stages (funnel_id, order_index);

create unique index if not exists funnel_cards_funnel_contact_uidx
  on funnel_cards (funnel_id, contact_id)
  where funnel_id is not null;

create index if not exists funnel_cards_stage_position_idx
  on funnel_cards (stage_id, position, id);

alter table funnels enable row level security;
alter table funnel_stages enable row level security;
alter table funnel_cards enable row level security;

drop policy if exists "Members can read funnels" on funnels;
create policy "Members can read funnels"
on funnels
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage funnels" on funnels;
create policy "Agents can manage funnels"
on funnels
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read funnel stages" on funnel_stages;
create policy "Members can read funnel stages"
on funnel_stages
for select
to authenticated
using (
  exists (
    select 1
    from funnels
    where funnels.id = funnel_stages.funnel_id
      and public.is_org_member(funnels.organization_id)
  )
);

drop policy if exists "Agents can manage funnel stages" on funnel_stages;
create policy "Agents can manage funnel stages"
on funnel_stages
for all
to authenticated
using (
  exists (
    select 1
    from funnels
    where funnels.id = funnel_stages.funnel_id
      and public.has_org_role(funnels.organization_id, array['owner', 'admin', 'agent'])
  )
)
with check (
  exists (
    select 1
    from funnels
    where funnels.id = funnel_stages.funnel_id
      and public.has_org_role(funnels.organization_id, array['owner', 'admin', 'agent'])
  )
);

drop policy if exists "Members can read funnel cards" on funnel_cards;
create policy "Members can read funnel cards"
on funnel_cards
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage funnel cards" on funnel_cards;
create policy "Agents can manage funnel cards"
on funnel_cards
for all
to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'agent'])
  and exists (
    select 1
    from funnel_stages
    join funnels on funnels.id = funnel_stages.funnel_id
    where funnel_stages.id = funnel_cards.stage_id
      and funnels.id = funnel_cards.funnel_id
      and funnels.organization_id = funnel_cards.organization_id
  )
);
