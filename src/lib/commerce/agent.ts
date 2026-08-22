import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatMoney, toNumber, type FulfillmentType, type ProductKind } from "@/lib/commerce/types";

const CATALOG_LIMIT = 80;

type AgentCatalogItem = {
  id: number;
  name: string;
  kind: ProductKind;
  price: number;
  currency: string;
  category: string | null;
  available: number | null;
  soldOut: boolean;
  parentId: number | null;
};

type CreateOrderItemInput = {
  productId: number;
  quantity: number;
  notes?: string;
};

type RpcResult = {
  ok?: boolean;
  error?: string;
  orderId?: number;
  total?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  deliveryFee?: number;
  items?: Array<{ name?: string; quantity?: number; unitPrice?: number }>;
  available?: number;
};

const asRpcResult = (value: unknown): RpcResult =>
  value && typeof value === "object" ? (value as RpcResult) : { ok: false, error: "Respuesta inválida del inventario." };

export const loadAgentCommerceSnapshot = async (organizationId: number) => {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: productRows } = await admin
    .from("products")
    .select("id, name, kind, price, currency, category, active, track_stock, parent_id, inventory_items!inventory_item_id(on_hand, track_stock)")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(CATALOG_LIMIT);

  const products: AgentCatalogItem[] = (productRows ?? []).map((row) => {
    const inventory = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    const tracks = row.track_stock === true && row.kind !== "service";
    const onHand = inventory?.on_hand == null ? null : toNumber(inventory.on_hand);
    const inventoryTracks = inventory?.track_stock !== false;
    const soldOut = tracks && inventoryTracks && onHand !== null && onHand <= 0;
    return {
      id: row.id as number,
      name: row.name as string,
      kind: (row.kind as ProductKind) || "physical",
      price: toNumber(row.price),
      currency: (row.currency as string) || "DOP",
      category: (row.category as string | null) ?? null,
      available: tracks ? onHand : null,
      soldOut,
      parentId: (row.parent_id as number | null) ?? null,
    };
  });

  const { data: promoRows } = await admin
    .from("promotions")
    .select("name, description, discount_percent, starts_at, ends_at")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .limit(20);

  const promotions = (promoRows ?? []).map((row) => {
    const percent = row.discount_percent == null ? null : toNumber(row.discount_percent);
    const extra = percent ? ` (${percent}% off)` : "";
    const description = typeof row.description === "string" && row.description.trim() ? ` — ${row.description.trim()}` : "";
    return `${row.name as string}${extra}${description}`;
  });

  const { data: zoneRows } = await admin
    .from("delivery_zones")
    .select("name, fee, eta_minutes")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(40);

  const zones = (zoneRows ?? []).map((row) => {
    const fee = toNumber(row.fee);
    const eta = row.eta_minutes == null ? "" : ` · ETA ${row.eta_minutes} min`;
    return `${row.name as string} — envío ${formatMoney(fee)}${eta}`;
  });

  const { data: org } = await admin
    .from("organizations")
    .select("tax_rate")
    .eq("id", organizationId)
    .maybeSingle();

  const taxRate = org?.tax_rate == null ? 0.18 : toNumber(org.tax_rate);

  return { products, promotions, zones, taxRate };
};

export const formatCommerceContext = (snapshot: {
  products: AgentCatalogItem[];
  promotions: string[];
  zones?: string[];
  taxRate?: number;
}) => {
  const available = snapshot.products.filter((item) => !item.soldOut);
  const soldOut = snapshot.products.filter((item) => item.soldOut);
  const productLines =
    available
      .map((item) => {
        const stock =
          item.kind === "service" || item.available == null ? "sin stock" : `stock ${item.available}`;
        const category = item.category ? ` · ${item.category}` : "";
        const variant = item.parentId ? ` · variante de ${item.parentId}` : "";
        return `- [id:${item.id}] ${item.name}${category}${variant} — ${formatMoney(item.price, item.currency)} (${stock})`;
      })
      .join("\n") || "- (catálogo vacío)";

  const soldOutLines = soldOut.length
    ? soldOut.map((item) => `- [id:${item.id}] ${item.name} (agotado)`).join("\n")
    : "- ninguno";

  const promoLines = snapshot.promotions.length
    ? snapshot.promotions.map((item) => `- ${item}`).join("\n")
    : "- ninguna vigente";

  const zoneLines = snapshot.zones?.length
    ? snapshot.zones.map((item) => `- ${item}`).join("\n")
    : "- (sin zonas; si es delivery pregunta la dirección)";

  const taxPercent = Math.round((snapshot.taxRate ?? 0.18) * 100);

  return `Catálogo y precios (usa solo estos productId; el servidor aplica precio, promo e ITBIS ${taxPercent}%, no los inventes):
${productLines}
Agotados (no los vendas):
${soldOutLines}
Promociones vigentes (el servidor aplica el % mayor):
${promoLines}
Zonas de delivery:
${zoneLines}`;
};

export const createCommerceOrderForAgent = async (params: {
  organizationId: number;
  contactId: number;
  conversationId: number;
  turnId: number;
  channel: string;
  fulfillment: FulfillmentType;
  customerNote?: string;
  deliveryAddress?: string;
  deliveryZone?: string;
  items: CreateOrderItemInput[];
}) => {
  const admin = getSupabaseAdminClient();
  let deliveryFee = 0;
  if (params.fulfillment === "delivery" && params.deliveryZone) {
    const { data: zone } = await admin
      .from("delivery_zones")
      .select("fee, eta_minutes")
      .eq("organization_id", params.organizationId)
      .eq("active", true)
      .ilike("name", params.deliveryZone.trim())
      .maybeSingle();
    deliveryFee = toNumber(zone?.fee);
  }

  const { data, error } = await admin.rpc("create_commerce_order", {
    p_organization_id: params.organizationId,
    p_contact_id: params.contactId,
    p_conversation_id: params.conversationId,
    p_turn_id: params.turnId,
    p_channel: params.channel,
    p_fulfillment: params.fulfillment,
    p_customer_note: params.customerNote ?? "",
    p_items: params.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes ?? "",
    })),
    p_delivery_address: params.deliveryAddress ?? "",
    p_delivery_fee: deliveryFee,
    p_delivery_zone: params.deliveryZone ?? "",
  });

  if (error) {
    return { ok: false as const, error: error.message || "No se pudo crear el pedido." };
  }

  const result = asRpcResult(data);
  if (!result.ok || !result.orderId) {
    return { ok: false as const, error: result.error || "No se pudo crear el pedido." };
  }

  const lines = (result.items ?? [])
    .map((item) => `${item.quantity}× ${item.name}`)
    .filter(Boolean)
    .join(", ");

  return {
    ok: true as const,
    orderId: result.orderId,
    total: toNumber(result.total),
    subtotal: toNumber(result.subtotal),
    discount: toNumber(result.discount),
    tax: toNumber(result.tax),
    deliveryFee: toNumber(result.deliveryFee),
    summary: lines,
  };
};

export const cancelCommerceOrderForAgent = async (params: {
  organizationId: number;
  orderId: number;
  reason: string;
}) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("cancel_commerce_order", {
    p_organization_id: params.organizationId,
    p_order_id: params.orderId,
    p_reason: params.reason,
  });

  if (error) {
    return { ok: false as const, error: error.message || "No se pudo cancelar el pedido." };
  }

  const result = asRpcResult(data);
  if (!result.ok) {
    return { ok: false as const, error: result.error || "No se pudo cancelar el pedido." };
  }

  return { ok: true as const, orderId: result.orderId ?? params.orderId };
};
