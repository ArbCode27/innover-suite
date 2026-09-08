-- Public self-order menu for restaurant organizations.
-- Run in Supabase SQL editor after commerce-upgrade / suite-ops-upgrade.

alter table public.organizations
  add column if not exists public_menu_enabled boolean not null default false;

alter table public.organizations
  add column if not exists public_menu_slug text;

create unique index if not exists organizations_public_menu_slug_uidx
  on public.organizations (public_menu_slug)
  where public_menu_slug is not null;

alter table public.products
  add column if not exists menu_ingredients text[] not null default '{}';

comment on column public.organizations.public_menu_enabled is
  'When true and business_template=restaurant, exposes /menu/{slug} self-order UI.';
comment on column public.products.menu_ingredients is
  'Ingredient names shown on the public menu; customers may remove them per line.';

create or replace function public.create_public_menu_order(
  p_slug text,
  p_customer_name text,
  p_party_size integer,
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
  v_org public.organizations%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax numeric := 0;
  v_tax_rate numeric := 0;
  v_promo numeric := 0;
  v_total numeric := 0;
  v_order_id bigint;
  v_fulfillment text := coalesce(nullif(p_fulfillment, ''), 'dine_in');
  v_lines jsonb := '[]'::jsonb;
  v_note text;
  v_customer text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_party integer := greatest(coalesce(p_party_size, 1), 1);
  v_header text;
begin
  if p_slug is null or length(trim(p_slug)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Menú no encontrado.');
  end if;

  select * into v_org
  from public.organizations
  where public_menu_slug = lower(trim(p_slug))
    and public_menu_enabled = true
    and business_template = 'restaurant'
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Este menú no está disponible.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'El pedido no tiene productos.');
  end if;

  if v_fulfillment not in ('pickup', 'delivery', 'dine_in', 'unspecified') then
    v_fulfillment := 'dine_in';
  end if;

  if v_customer is null then
    return jsonb_build_object('ok', false, 'error', 'Indica el nombre del cliente.');
  end if;

  select coalesce(tax_rate, 0.16) into v_tax_rate
  from public.organizations
  where id = v_org.id;

  select coalesce(max(discount_percent), 0) into v_promo
  from public.promotions
  where organization_id = v_org.id
    and active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now());

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'productId')::bigint
      and organization_id = v_org.id
      and active = true;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'error', format('El producto %s no está disponible.', coalesce(v_item->>'productId', '?'))
      );
    end if;

    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    if v_qty <= 0 then
      return jsonb_build_object('ok', false, 'error', format('Cantidad inválida para %s.', v_product.name));
    end if;

    v_note := nullif(trim(coalesce(v_item->>'notes', '')), '');
    v_subtotal := v_subtotal + (v_product.price * v_qty);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'quantity', v_qty,
      'unitPrice', v_product.price,
      'notes', v_note
    ));
  end loop;

  v_discount := round(v_subtotal * (v_promo / 100), 2);
  v_tax := round((v_subtotal - v_discount) * coalesce(v_tax_rate, 0), 2);
  v_total := (v_subtotal - v_discount) + v_tax;

  v_header := format('Cliente: %s · Personas: %s', v_customer, v_party);
  if nullif(trim(coalesce(p_customer_note, '')), '') is not null then
    v_header := v_header || E'\n' || trim(p_customer_note);
  end if;

  insert into public.orders (
    organization_id, contact_id, conversation_id, turn_id, status, fulfillment, channel, customer_note,
    subtotal, discount_amount, tax_amount, delivery_fee, total, payment_status
  ) values (
    v_org.id, null, null, null, 'received', v_fulfillment, 'self_menu', v_header,
    v_subtotal, v_discount, v_tax, 0, v_total, 'unpaid'
  )
  returning id into v_order_id;

  insert into public.order_items (organization_id, order_id, product_id, name_snapshot, quantity, unit_price, notes)
  select
    v_org.id,
    v_order_id,
    (line->>'productId')::bigint,
    line->>'name',
    (line->>'quantity')::numeric,
    (line->>'unitPrice')::numeric,
    nullif(line->>'notes', '')
  from jsonb_array_elements(v_lines) as line;

  insert into public.notifications (organization_id, kind, title, body, href)
  values (
    v_org.id,
    'order',
    format('Auto-pedido #%s', v_order_id),
    format('%s · Total %s', v_customer, v_total),
    '/orders'
  );

  return jsonb_build_object(
    'ok', true,
    'orderId', v_order_id,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'tax', v_tax,
    'total', v_total,
    'items', v_lines
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.create_public_menu_order(text, text, integer, text, text, jsonb)
  to anon, authenticated, service_role;
