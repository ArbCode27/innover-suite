-- Módulos del CRM, catálogo, inventario, promociones y pedidos.
-- Pegar en el SQL Editor de Supabase.

create table if not exists public.organization_modules (
  organization_id bigint not null references public.organizations(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key),
  constraint organization_modules_key_check
    check (module_key in ('funnels', 'calendar', 'catalog', 'orders', 'kitchen'))
);

create table if not exists public.inventory_items (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  unit text not null default 'unit',
  on_hand numeric(14, 3) not null default 0,
  reorder_point numeric(14, 3) not null default 0,
  track_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_on_hand_check check (on_hand >= 0),
  constraint inventory_items_unit_check check (unit in ('unit', 'portion', 'ml', 'g'))
);

create unique index if not exists inventory_items_org_sku_idx
  on public.inventory_items (organization_id, sku)
  where sku is not null;

create table if not exists public.products (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  inventory_item_id bigint references public.inventory_items(id) on delete set null,
  name text not null,
  description text,
  sku text,
  category text,
  kind text not null default 'physical',
  price numeric(12, 2) not null default 0,
  currency text not null default 'DOP',
  active boolean not null default true,
  track_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_kind_check check (kind in ('physical', 'food', 'service')),
  constraint products_price_check check (price >= 0)
);

create unique index if not exists products_org_sku_idx
  on public.products (organization_id, sku)
  where sku is not null;

create index if not exists products_org_active_idx
  on public.products (organization_id, active);

create table if not exists public.product_recipes (
  product_id bigint not null references public.products(id) on delete cascade,
  inventory_item_id bigint not null references public.inventory_items(id) on delete cascade,
  quantity numeric(14, 3) not null default 1,
  primary key (product_id, inventory_item_id),
  constraint product_recipes_quantity_check check (quantity > 0)
);

create table if not exists public.promotions (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  discount_percent numeric(5, 2),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  contact_id bigint references public.contacts(id) on delete set null,
  conversation_id bigint references public.conversations(id) on delete set null,
  turn_id bigint,
  status text not null default 'received',
  fulfillment text not null default 'unspecified',
  channel text,
  customer_note text,
  subtotal numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_status_check
    check (status in ('received', 'preparing', 'ready', 'completed', 'cancelled')),
  constraint orders_fulfillment_check
    check (fulfillment in ('pickup', 'delivery', 'dine_in', 'unspecified'))
);

create index if not exists orders_org_status_idx
  on public.orders (organization_id, status, created_at desc);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  name_snapshot text not null,
  quantity numeric(14, 3) not null,
  unit_price numeric(12, 2) not null,
  notes text,
  constraint order_items_quantity_check check (quantity > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id) on delete cascade,
  inventory_item_id bigint not null references public.inventory_items(id) on delete cascade,
  order_id bigint references public.orders(id) on delete set null,
  kind text not null,
  quantity numeric(14, 3) not null,
  balance_after numeric(14, 3) not null,
  note text,
  created_at timestamptz not null default now(),
  constraint inventory_movements_kind_check
    check (kind in ('sale', 'cancel_restore', 'receive', 'adjust'))
);

create index if not exists inventory_movements_org_idx
  on public.inventory_movements (organization_id, created_at desc);

drop trigger if exists organization_modules_set_updated_at on public.organization_modules;
create trigger organization_modules_set_updated_at
before update on public.organization_modules
for each row execute function public.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.organization_modules enable row level security;
alter table public.inventory_items enable row level security;
alter table public.products enable row level security;
alter table public.product_recipes enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "Members can read organization modules" on public.organization_modules;
create policy "Members can read organization modules"
on public.organization_modules for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Owners and admins can manage organization modules" on public.organization_modules;
create policy "Owners and admins can manage organization modules"
on public.organization_modules for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin']))
with check (public.has_org_role(organization_id, array['owner', 'admin']));

drop policy if exists "Members can read inventory items" on public.inventory_items;
create policy "Members can read inventory items"
on public.inventory_items for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage inventory items" on public.inventory_items;
create policy "Agents can manage inventory items"
on public.inventory_items for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read products" on public.products;
create policy "Members can read products"
on public.products for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage products" on public.products;
create policy "Agents can manage products"
on public.products for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read product recipes" on public.product_recipes;
create policy "Members can read product recipes"
on public.product_recipes for select to authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_recipes.product_id
      and public.is_org_member(products.organization_id)
  )
);

drop policy if exists "Agents can manage product recipes" on public.product_recipes;
create policy "Agents can manage product recipes"
on public.product_recipes for all to authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_recipes.product_id
      and public.has_org_role(products.organization_id, array['owner', 'admin', 'agent'])
  )
)
with check (
  exists (
    select 1 from public.products
    where products.id = product_recipes.product_id
      and public.has_org_role(products.organization_id, array['owner', 'admin', 'agent'])
  )
);

drop policy if exists "Members can read promotions" on public.promotions;
create policy "Members can read promotions"
on public.promotions for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage promotions" on public.promotions;
create policy "Agents can manage promotions"
on public.promotions for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read orders" on public.orders;
create policy "Members can read orders"
on public.orders for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage orders" on public.orders;
create policy "Agents can manage orders"
on public.orders for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read order items" on public.order_items;
create policy "Members can read order items"
on public.order_items for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage order items" on public.order_items;
create policy "Agents can manage order items"
on public.order_items for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

drop policy if exists "Members can read inventory movements" on public.inventory_movements;
create policy "Members can read inventory movements"
on public.inventory_movements for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Agents can manage inventory movements" on public.inventory_movements;
create policy "Agents can manage inventory movements"
on public.inventory_movements for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'agent']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'agent']));

create or replace function public.create_commerce_order(
  p_organization_id bigint,
  p_contact_id bigint,
  p_conversation_id bigint,
  p_turn_id bigint,
  p_channel text,
  p_fulfillment text,
  p_customer_note text,
  p_items jsonb
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

  insert into public.orders (
    organization_id, contact_id, conversation_id, turn_id, status, fulfillment, channel, customer_note, subtotal, total
  ) values (
    p_organization_id, p_contact_id, p_conversation_id, p_turn_id, 'received', v_fulfillment, p_channel, nullif(p_customer_note, ''), v_subtotal, v_subtotal
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

  return jsonb_build_object(
    'ok', true,
    'orderId', v_order_id,
    'total', v_subtotal,
    'items', v_lines
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

create or replace function public.cancel_commerce_order(
  p_organization_id bigint,
  p_order_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_inv public.inventory_items%rowtype;
begin
  if auth.uid() is not null and not public.has_org_role(p_organization_id, array['owner', 'admin', 'agent']) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado para cancelar pedidos.');
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and organization_id = p_organization_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'El pedido no existe.');
  end if;

  if v_order.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'orderId', v_order.id, 'alreadyCancelled', true);
  end if;

  for v_movement in
    select *
    from public.inventory_movements
    where order_id = v_order.id
      and organization_id = p_organization_id
      and kind = 'sale'
  loop
    update public.inventory_items
    set on_hand = on_hand + abs(v_movement.quantity)
    where id = v_movement.inventory_item_id
    returning * into v_inv;

    insert into public.inventory_movements (
      organization_id, inventory_item_id, order_id, kind, quantity, balance_after, note
    ) values (
      p_organization_id, v_inv.id, v_order.id, 'cancel_restore', abs(v_movement.quantity), v_inv.on_hand, coalesce(p_reason, 'Pedido cancelado')
    );
  end loop;

  update public.orders
  set status = 'cancelled',
      customer_note = case
        when p_reason is null or p_reason = '' then customer_note
        else trim(both from coalesce(customer_note || ' · ', '') || 'Cancelado: ' || p_reason)
      end
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'orderId', v_order.id);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.create_commerce_order(bigint, bigint, bigint, bigint, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.cancel_commerce_order(bigint, bigint, text) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_items;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
