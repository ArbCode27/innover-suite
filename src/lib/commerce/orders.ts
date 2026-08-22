import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isFulfillmentType,
  isOrderStatus,
  isPaymentStatus,
  toNumber,
  type OrderItemRecord,
  type OrderRecord,
} from "@/lib/commerce/types";

type OrderRow = {
  id: number;
  status: string;
  fulfillment: string;
  channel: string | null;
  customer_note: string | null;
  subtotal: number | string;
  discount_amount?: number | string | null;
  tax_amount?: number | string | null;
  delivery_fee?: number | string | null;
  total: number | string;
  delivery_address?: string | null;
  delivery_zone?: string | null;
  eta_minutes?: number | null;
  payment_status?: string | null;
  payment_method?: string | null;
  created_at: string;
  updated_at: string;
  contact_id: number | null;
  conversation_id: number | null;
  contacts: { full_name?: string | null } | { full_name?: string | null }[] | null;
  order_items:
    | Array<{
        id: number;
        product_id: number | null;
        name_snapshot: string;
        quantity: number | string;
        unit_price: number | string;
        notes: string | null;
      }>
    | null;
};

const contactName = (value: OrderRow["contacts"]) => {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.full_name?.trim() || "Cliente";
};

export const mapOrderRow = (row: OrderRow): OrderRecord => ({
  id: row.id,
  status: isOrderStatus(row.status) ? row.status : "received",
  fulfillment: isFulfillmentType(row.fulfillment) ? row.fulfillment : "unspecified",
  channel: row.channel,
  customerNote: row.customer_note,
  subtotal: toNumber(row.subtotal),
  discountAmount: toNumber(row.discount_amount),
  taxAmount: toNumber(row.tax_amount),
  deliveryFee: toNumber(row.delivery_fee),
  total: toNumber(row.total),
  deliveryAddress: row.delivery_address ?? null,
  deliveryZone: row.delivery_zone ?? null,
  etaMinutes: row.eta_minutes ?? null,
  paymentStatus: isPaymentStatus(row.payment_status) ? row.payment_status : "unpaid",
  paymentMethod: row.payment_method ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  contactId: row.contact_id,
  conversationId: row.conversation_id,
  contactName: contactName(row.contacts),
  items: (row.order_items ?? []).map(
    (item): OrderItemRecord => ({
      id: item.id,
      productId: item.product_id,
      name: item.name_snapshot,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unit_price),
      notes: item.notes,
    }),
  ),
});

export const ORDER_SELECT =
  "id, status, fulfillment, channel, customer_note, subtotal, discount_amount, tax_amount, delivery_fee, total, delivery_address, delivery_zone, eta_minutes, payment_status, payment_method, created_at, updated_at, contact_id, conversation_id, contacts(full_name), order_items(id, product_id, name_snapshot, quantity, unit_price, notes)";

export const loadOrders = async (supabase: SupabaseClient, organizationId: number, limit = 80) => {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    const fallback = await supabase
      .from("orders")
      .select(
        "id, status, fulfillment, channel, customer_note, subtotal, total, created_at, updated_at, contact_id, conversation_id, contacts(full_name), order_items(id, product_id, name_snapshot, quantity, unit_price, notes)",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fallback.error) {
      throw new Error(fallback.error.message || "No se pudieron cargar los pedidos.");
    }

    return (fallback.data ?? []).map((row) => mapOrderRow(row as unknown as OrderRow));
  }

  return (data ?? []).map((row) => mapOrderRow(row as unknown as OrderRow));
};

export const loadOrderById = async (supabase: SupabaseClient, organizationId: number, orderId: number) => {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  return mapOrderRow(data as unknown as OrderRow);
};
