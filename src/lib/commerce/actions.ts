"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentMembership, canManageCatalog, canManageOrders, canMarkPayment } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCatalogCsv } from "@/lib/commerce/catalog";
import { isOrderStatus, isPaymentStatus, PAYMENT_STATUSES, PRODUCT_KINDS } from "@/lib/commerce/types";
import { recordAuditEvent } from "@/lib/organizations/audit";

type ActionResult = {
  success?: string;
  error?: string;
};

const requireCatalogMembership = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !canManageCatalog(membership)) {
    return { error: "No tienes permisos para gestionar el catálogo." } as const;
  }
  return { membership } as const;
};

const requireOrdersMembership = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !canManageOrders(membership)) {
    return { error: "No tienes permisos para gestionar pedidos." } as const;
  }
  return { membership } as const;
};

const requirePaymentMembership = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !canMarkPayment(membership)) {
    return { error: "No tienes permisos para marcar pagos." } as const;
  }
  return { membership } as const;
};

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().max(80).optional(),
  kind: z.enum(PRODUCT_KINDS),
  price: z.number().nonnegative().max(10_000_000),
  trackStock: z.boolean(),
  initialStock: z.number().nonnegative().max(1_000_000).optional(),
  reorderPoint: z.number().nonnegative().max(1_000_000).optional(),
});

const updateProductSchema = productSchema
  .omit({ initialStock: true })
  .extend({ id: z.number().int().positive(), active: z.boolean() });

const receiveStockSchema = z.object({
  inventoryItemId: z.number().int().positive(),
  quantity: z.number().positive().max(1_000_000),
  note: z.string().trim().max(240).optional(),
});

const promotionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

const updateOrderStatusSchema = z.object({
  orderId: z.number().int().positive(),
  status: z.enum(["received", "preparing", "ready", "completed", "cancelled"]),
});

const cancelOrderSchema = z.object({
  orderId: z.number().int().positive(),
  reason: z.string().trim().max(240).optional(),
});

export const createProductAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = productSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del producto." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const trackStock = parsed.data.kind === "service" ? false : parsed.data.trackStock;
  let inventoryItemId: number | null = null;

  if (trackStock) {
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory_items")
      .insert({
        organization_id: access.membership.organizationId,
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        on_hand: parsed.data.initialStock ?? 0,
        reorder_point: parsed.data.reorderPoint ?? 0,
        track_stock: true,
      })
      .select("id")
      .single();

    if (inventoryError || !inventory?.id) {
      return { error: inventoryError?.message || "No se pudo crear el stock inicial." };
    }
    inventoryItemId = inventory.id as number;
  }

  const { error } = await supabase.from("products").insert({
    organization_id: access.membership.organizationId,
    inventory_item_id: inventoryItemId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    sku: parsed.data.sku || null,
    category: parsed.data.category || null,
    kind: parsed.data.kind,
    price: parsed.data.price,
    currency: "DOP",
    active: true,
    track_stock: trackStock,
  });

  if (error) {
    if (inventoryItemId) {
      await supabase.from("inventory_items").delete().eq("id", inventoryItemId);
    }
    return { error: error.message || "No se pudo crear el producto." };
  }

  revalidatePath("/inventory");
  return { success: "Producto agregado al catálogo." };
};

export const updateProductAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = updateProductSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "Los datos del producto no son válidos." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const trackStock = parsed.data.kind === "service" ? false : parsed.data.trackStock;

  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id, inventory_item_id")
    .eq("id", parsed.data.id)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    return { error: "El producto no existe." };
  }

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      sku: parsed.data.sku || null,
      category: parsed.data.category || null,
      kind: parsed.data.kind,
      price: parsed.data.price,
      active: parsed.data.active,
      track_stock: trackStock,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar el producto." };
  }

  if (existing.inventory_item_id) {
    await supabase
      .from("inventory_items")
      .update({
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        reorder_point: parsed.data.reorderPoint ?? 0,
        track_stock: trackStock,
      })
      .eq("id", existing.inventory_item_id)
      .eq("organization_id", access.membership.organizationId);
  }

  revalidatePath("/inventory");
  return { success: "Producto actualizado." };
};

export const receiveStockAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = receiveStockSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "Indica una cantidad válida para reponer." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, on_hand")
    .eq("id", parsed.data.inventoryItemId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (itemError || !item?.id) {
    return { error: "El insumo no existe." };
  }

  const nextOnHand = Number(item.on_hand ?? 0) + parsed.data.quantity;
  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ on_hand: nextOnHand })
    .eq("id", item.id)
    .eq("organization_id", access.membership.organizationId);

  if (updateError) {
    return { error: updateError.message || "No se pudo reponer el stock." };
  }

  await supabase.from("inventory_movements").insert({
    organization_id: access.membership.organizationId,
    inventory_item_id: item.id,
    kind: "receive",
    quantity: parsed.data.quantity,
    balance_after: nextOnHand,
    note: parsed.data.note || "Reposición manual",
  });

  revalidatePath("/inventory");
  return { success: "Stock actualizado." };
};

export const createPromotionAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = promotionSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la promoción." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("promotions").insert({
    organization_id: access.membership.organizationId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    discount_percent: parsed.data.discountPercent ?? null,
    starts_at: parsed.data.startsAt || null,
    ends_at: parsed.data.endsAt || null,
    active: true,
  });

  if (error) {
    return { error: error.message || "No se pudo crear la promoción." };
  }

  revalidatePath("/inventory");
  return { success: "Promoción publicada." };
};

export const togglePromotionAction = async (promotionId: number, active: boolean): Promise<ActionResult> => {
  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("promotions")
    .update({ active })
    .eq("id", promotionId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar la promoción." };
  }

  revalidatePath("/inventory");
  return { success: active ? "Promoción activada." : "Promoción desactivada." };
};

export const updateOrderStatusAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = updateOrderStatusSchema.safeParse(rawValues);
  if (!parsed.success || !isOrderStatus(parsed.data.status)) {
    return { error: "El estado del pedido no es válido." };
  }

  const access = await requireOrdersMembership();
  if ("error" in access) return { error: access.error };

  if (parsed.data.status === "cancelled") {
    return cancelOrderAction({ orderId: parsed.data.orderId, reason: "Cancelado desde el tablero" });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.orderId)
    .eq("organization_id", access.membership.organizationId)
    .neq("status", "cancelled");

  if (error) {
    return { error: error.message || "No se pudo actualizar el pedido." };
  }

  revalidatePath("/orders");
  return { success: "Pedido actualizado." };
};

export const cancelOrderAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = cancelOrderSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "El pedido no es válido." };
  }

  const access = await requireOrdersMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cancel_commerce_order", {
    p_organization_id: access.membership.organizationId,
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason || "Cancelado por el equipo",
  });

  if (error) {
    return { error: error.message || "No se pudo cancelar el pedido." };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    return { error: result?.error || "No se pudo cancelar el pedido." };
  }

  revalidatePath("/orders");
  revalidatePath("/inventory");
  await recordAuditEvent({
    organizationId: access.membership.organizationId,
    action: "order.cancel",
    entity: "order",
    entityId: parsed.data.orderId,
  });
  return { success: "Pedido cancelado y stock restaurado." };
};

const paymentSchema = z.object({
  orderId: z.number().int().positive(),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  paymentMethod: z.string().trim().max(40).optional(),
});

export const updateOrderPaymentAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = paymentSchema.safeParse(rawValues);
  if (!parsed.success || !isPaymentStatus(parsed.data.paymentStatus)) {
    return { error: "El estado de pago no es válido." };
  }

  const access = await requirePaymentMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: parsed.data.paymentStatus,
      payment_method: parsed.data.paymentMethod || null,
    })
    .eq("id", parsed.data.orderId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar el pago." };
  }

  revalidatePath("/orders");
  await recordAuditEvent({
    organizationId: access.membership.organizationId,
    action: "order.payment",
    entity: "order",
    entityId: parsed.data.orderId,
    payload: { paymentStatus: parsed.data.paymentStatus, paymentMethod: parsed.data.paymentMethod },
  });
  return { success: parsed.data.paymentStatus === "paid" ? "Pedido marcado como pagado." : "Pago actualizado." };
};

export const importCatalogCsvAction = async (csvText: string): Promise<ActionResult> => {
  const rows = parseCatalogCsv(csvText);
  if (!rows.length) {
    return { error: "El CSV está vacío o no tiene columnas name,price." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  let created = 0;
  for (const row of rows.slice(0, 200)) {
    const result = await createProductAction({
      name: row.name,
      sku: row.sku,
      category: row.category,
      kind: row.kind,
      price: row.price,
      trackStock: row.kind !== "service",
      initialStock: row.initialStock ?? 0,
    });
    if (!result.error) created += 1;
  }

  revalidatePath("/inventory");
  return { success: `Se importaron ${created} de ${Math.min(rows.length, 200)} productos.` };
};

const deliveryZoneSchema = z.object({
  name: z.string().trim().min(2).max(80),
  fee: z.number().nonnegative().max(100_000),
  etaMinutes: z.number().int().positive().max(240).optional(),
});

export const createDeliveryZoneAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = deliveryZoneSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la zona de delivery." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("delivery_zones").insert({
    organization_id: access.membership.organizationId,
    name: parsed.data.name,
    fee: parsed.data.fee,
    eta_minutes: parsed.data.etaMinutes ?? null,
    active: true,
  });

  if (error) {
    return { error: error.message || "No se pudo crear la zona." };
  }

  revalidatePath("/inventory");
  return { success: "Zona de delivery creada." };
};

export const toggleDeliveryZoneAction = async (zoneId: number, active: boolean): Promise<ActionResult> => {
  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("delivery_zones")
    .update({ active })
    .eq("id", zoneId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo actualizar la zona." };
  }

  revalidatePath("/inventory");
  return { success: active ? "Zona activada." : "Zona desactivada." };
};
