-- Operación del CRM: contactos, pagos, impuestos, delivery, notificaciones, roles, knowledge, auditoría.
-- Pegar en el SQL Editor de Supabase DESPUÉS de commerce-upgrade.sql.

alter table public.organizations add column if not exists plan text default 'starter';
alter table public.organizations add column if not exists onboarding_completed_at timestamptz;
alter table public.organizations add column if not exists tax_rate numeric(6, 4) default 0.18;

alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner', 'admin', 'agent', 'viewer', 'kitchen', 'cashier'));

alter table public.organization_invitations drop constraint if exists organization_invitations_role_check;
alter table public.organization_invitations
  add constraint organization_invitations_role_check
  check (role in ('admin', 'agent', 'viewer', 'kitchen', 'cashier'));

alter table public.organization_invitations add column if not exists token uuid default gen_random_uuid();
create unique index if not exists organization_invitations_token_idx
  on public.organization_invitations (token)
  where token is not null;

alter table public.products add column if not exists parent_id bigint references public.products(id) on delete cascade;
create index if not exists products_parent_idx on public.products (parent_id);

alter table public.orders add column if not exists discount_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists tax_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists delivery_fee numeric(12, 2) not null default 0;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_zone text;
alter table public.orders add column if not exists eta_minutes integer;
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_method text;
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid', 'refunded'));

alter table public.organization_agent_settings add column if not exists business_hours jsonb;
alter table public.organization_agent_settings add column if not exists closed_message text;

alter table public.agent_turns add column if not exists review_score integer;
alter table public.agent_turns add column if not exists review_notes text;
alter table public.agent_turns add column if not exists reviewed_at timestamptz;

create table if not exists public.contact_tags (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.contact_tag_links (
  contact_id bigint not null references public.contacts(id) on delete cascade,
  tag_id bigint not null references public.contact_tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

create table if not exists public.contact_notes (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  contact_id bigint not null references public.contacts(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  visible_to_agent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_zones (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  name text not null,
  fee numeric(12, 2) not null default 0,
  eta_minutes integer,
  active boolean not null default true
);

create table if not exists public.knowledge_articles (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_org_unread_idx
  on public.notifications (organization_id, created_at desc);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists knowledge_articles_set_updated_at on public.knowledge_articles;
create trigger knowledge_articles_set_updated_at
before update on public.knowledge_articles
for each row execute function public.set_updated_at();

alter table public.contact_tags enable row level security;
alter table public.contact_tag_links enable row level security;
alter table public.contact_notes enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "Members can read contact tags" on public.contact_tags;
create policy "Members can read contact tags" on public.contact_tags
for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Agents can manage contact tags" on public.contact_tags;
create policy "Agents can manage contact tags" on public.contact_tags
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read contact tag links" on public.contact_tag_links;
create policy "Members can read contact tag links" on public.contact_tag_links
for select to authenticated
using (exists (select 1 from public.contacts c where c.id = contact_tag_links.contact_id and public.is_org_member(c.organization_id)));
drop policy if exists "Agents can manage contact tag links" on public.contact_tag_links;
create policy "Agents can manage contact tag links" on public.contact_tag_links
for all to authenticated
using (exists (select 1 from public.contacts c where c.id = contact_tag_links.contact_id and public.has_org_role(c.organization_id, array['owner', 'admin', 'agent'])))
with check (exists (select 1 from public.contacts c where c.id = contact_tag_links.contact_id and public.has_org_role(c.organization_id, array['owner', 'admin', 'agent'])));

drop policy if exists "Members can read contact notes" on public.contact_notes;
create policy "Members can read contact notes" on public.contact_notes
for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Agents can manage contact notes" on public.contact_notes;
create policy "Agents can manage contact notes" on public.contact_notes
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read delivery zones" on public.delivery_zones;
create policy "Members can read delivery zones" on public.delivery_zones
for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Agents can manage delivery zones" on public.delivery_zones;
create policy "Agents can manage delivery zones" on public.delivery_zones
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read knowledge articles" on public.knowledge_articles;
create policy "Members can read knowledge articles" on public.knowledge_articles
for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "Owners can manage knowledge articles" on public.knowledge_articles;
create policy "Owners can manage knowledge articles" on public.knowledge_articles
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members can read notifications" on public.notifications;
create policy "Members can read notifications" on public.notifications
for select to authenticated
using (public.is_org_member(organization_id) and (user_id is null or user_id = auth.uid()));
drop policy if exists "Members can update notifications" on public.notifications;
create policy "Members can update notifications" on public.notifications
for update to authenticated
using (public.is_org_member(organization_id) and (user_id is null or user_id = auth.uid()))
with check (public.is_org_member(organization_id));
drop policy if exists "Agents can insert notifications" on public.notifications;
create policy "Agents can insert notifications" on public.notifications
for insert to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen', 'cashier']));

drop policy if exists "Owners can read audit events" on public.audit_events;
create policy "Owners can read audit events" on public.audit_events
for select to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']));
drop policy if exists "Agents can insert audit events" on public.audit_events;
create policy "Agents can insert audit events" on public.audit_events
for insert to authenticated
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Agents can manage orders" on public.orders;
create policy "Agents can manage orders" on public.orders
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen', 'cashier']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen', 'cashier']));

drop policy if exists "Agents can manage order items" on public.order_items;
create policy "Agents can manage order items" on public.order_items
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen', 'cashier']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen', 'cashier']));

drop policy if exists "Agents can manage inventory items" on public.inventory_items;
create policy "Agents can manage inventory items" on public.inventory_items
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen']));

drop policy if exists "Agents can manage products" on public.products;
create policy "Agents can manage products" on public.products
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent', 'kitchen']));

drop function if exists public.create_commerce_order(bigint, bigint, bigint, bigint, text, text, text, jsonb);

create or replace function public.create_commerce_order(
  p_organization_id bigint,
  p_contact_id bigint,
  p_conversation_id bigint,
  p_turn_id bigint,
  p_channel text,
  p_fulfillment text,
  p_customer_note text,
  p_items jsonb,
  p_delivery_address text default '',
  p_delivery_fee numeric default 0,
  p_delivery_zone text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_recipe record;
  v_inv public.inventory_items%rowtype;
  v_needs jsonb := '{}'::jsonb;
  v_key text;
  v_qty numeric;
  v_need numeric;
  v_available numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax numeric := 0;
  v_tax_rate numeric := 0;
  v_promo numeric := 0;
  v_delivery numeric := coalesce(p_delivery_fee, 0);
  v_total numeric := 0;
  v_order_id bigint;
  v_fulfillment text := coalesce(nullif(p_fulfillment, ''), 'unspecified');
  v_lines jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null and not public.has_org_role(p_organization_id, array['owner', 'admin', 'agent']) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para crear pedidos.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El pedido no tiene productos.');
  end if;

  if v_fulfillment not in ('pickup', 'delivery', 'dine_in', 'unspecified') then
    v_fulfillment := 'unspecified';
  end if;

  select coalesce(tax_rate, 0.18) into v_tax_rate
  from public.organizations
  where id = p_organization_id;

  select coalesce(max(discount_percent), 0) into v_promo
  from public.promotions
  where organization_id = p_organization_id
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'productId')::bigint
      and organization_id = p_organization_id;

    if not found or v_product.active is not true then
      return jsonb_build_object(
        'ok', false,
        'error', format('El producto %s no existe o no está activo.', coalesce(v_item->>'productId', '?'))
      );
    end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_qty <= 0 then
      return jsonb_build_object('ok', false, 'error', format('Cantidad inválida para %s.', v_product.name));
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'quantity', v_qty,
      'unitPrice', v_product.price,
      'notes', nullif(v_item->>'notes', '')
    ));

    if v_product.kind = 'service' or v_product.track_stock is not true then
      continue;
    end if;

    if exists (select 1 from public.product_recipes where product_id = v_product.id) then
      for v_recipe in
        select inventory_item_id, quantity
        from public.product_recipes
        where product_id = v_product.id
      loop
        v_key := v_recipe.inventory_item_id::text;
        v_needs := jsonb_set(
          v_needs,
          array[v_key],
          to_jsonb(coalesce((v_needs->>v_key)::numeric, 0) + (v_recipe.quantity * v_qty))
        );
      end loop;
    elsif v_product.inventory_item_id is not null then
      v_key := v_product.inventory_item_id::text;
      v_needs := jsonb_set(
        v_needs,
        array[v_key],
        to_jsonb(coalesce((v_needs->>v_key)::numeric, 0) + v_qty)
      );
    end if;
  end loop;

  for v_key, v_need in select key, value::numeric from jsonb_each_text(v_needs)
  loop
    select * into v_inv
    from public.inventory_items
    where id = v_key::bigint
      and organization_id = p_organization_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'Falta el insumo de inventario para un producto.');
    end if;

    if v_inv.track_stock is true and v_inv.on_hand < v_need then
      v_available := v_inv.on_hand;
      return jsonb_build_object(
        'ok', false,
        'error', format('No hay stock suficiente de %s. Disponible: %s.', v_inv.name, trim(to_char(v_available, 'FM999999990.###'))),
        'inventoryItemId', v_inv.id,
        'available', v_available
      );
    end if;
  end loop;

  v_discount := round(v_subtotal * (v_promo / 100), 2);
  v_tax := round((v_subtotal - v_discount) * coalesce(v_tax_rate, 0), 2);
  v_total := (v_subtotal - v_discount) + v_tax + v_delivery;

  insert into public.orders (
    organization_id, contact_id, conversation_id, turn_id, status, fulfillment, channel, customer_note,
    subtotal, discount_amount, tax_amount, delivery_fee, total, delivery_address, delivery_zone, payment_status
  ) values (
    p_organization_id, p_contact_id, p_conversation_id, p_turn_id, 'received', v_fulfillment, p_channel, nullif(p_customer_note, ''),
    v_subtotal, v_discount, v_tax, v_delivery, v_total, nullif(p_delivery_address, ''), nullif(p_delivery_zone, ''), 'unpaid'
  )
  returning id into v_order_id;

  insert into public.order_items (organization_id, order_id, product_id, name_snapshot, quantity, unit_price, notes)
  select
    p_organization_id,
    v_order_id,
    (line->>'productId')::bigint,
    line->>'name',
    (line->>'quantity')::numeric,
    (line->>'unitPrice')::numeric,
    nullif(line->>'notes', '')
  from jsonb_array_elements(v_lines) as line;

  for v_key, v_need in select key, value::numeric from jsonb_each_text(v_needs)
  loop
    update public.inventory_items
    set on_hand = on_hand - v_need
    where id = v_key::bigint
    returning * into v_inv;

    insert into public.inventory_movements (
      organization_id, inventory_item_id, order_id, kind, quantity, balance_after, note
    ) values (
      p_organization_id, v_inv.id, v_order_id, 'sale', -v_need, v_inv.on_hand, 'Pedido confirmado por IA'
    );
  end loop;

  insert into public.notifications (organization_id, kind, title, body, href)
  values (
    p_organization_id,
    'order',
    format('Pedido #%s', v_order_id),
    format('Total %s', v_total),
    '/orders'
  );

  return jsonb_build_object(
    'ok', true,
    'orderId', v_order_id,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'tax', v_tax,
    'deliveryFee', v_delivery,
    'total', v_total,
    'items', v_lines
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.create_commerce_order(bigint, bigint, bigint, bigint, text, text, text, jsonb, text, numeric, text) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
