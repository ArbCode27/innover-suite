"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getCurrentMembership,
  loadCurrentMemberSession,
  canManageCatalog,
  canManageOrders,
  canMarkPayment,
} from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseCatalogCsv } from "@/lib/commerce/catalog";
import { isOrderStatus, isPaymentStatus, PAYMENT_STATUSES, PRODUCT_KINDS } from "@/lib/commerce/types";
import { recordAuditEvent } from "@/lib/organizations/audit";
import { loadOrganizationCurrencies, resolveOrganizationCurrency } from "@/lib/organizations/currencies";
import { readCatalogImageFile } from "@/lib/media/image-upload";
import { buildProductImagePath, removeProductImage, uploadPublicMedia } from "@/lib/media/storage";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/media/types";
import { zodErrorMessage } from "@/lib/validation/zod-es";

type ActionResult = {
  success?: string;
  error?: string;
  id?: number;
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

const productFields = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().max(80).optional(),
  kind: z.enum(PRODUCT_KINDS),
  price: z.number().nonnegative().max(10_000_000),
  trackStock: z.boolean(),
  initialStock: z.number().nonnegative().max(1_000_000).optional(),
  reorderPoint: z.number().nonnegative().max(1_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
});

const productSchema = productFields.superRefine((data, ctx) => {
  if (data.kind === "service") {
    return;
  }

  if (data.initialStock == null || Number.isNaN(data.initialStock)) {
    ctx.addIssue({
      code: "custom",
      path: ["initialStock"],
      message: "Indica el stock inicial del producto.",
    });
  }
});

const updateProductSchema = productFields
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
    return { error: zodErrorMessage(parsed.error, "Revisa los datos del producto.") };
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

  const orgCurrencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = resolveOrganizationCurrency(parsed.data.currency, orgCurrencies);

  const { data: inserted, error } = await supabase.from("products").insert({
    organization_id: access.membership.organizationId,
    inventory_item_id: inventoryItemId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    sku: parsed.data.sku || null,
    category: parsed.data.category || null,
    kind: parsed.data.kind,
    price: parsed.data.price,
    currency,
    active: true,
    track_stock: trackStock,
  }).select("id").single();

  if (error || !inserted?.id) {
    if (inventoryItemId) {
      await supabase.from("inventory_items").delete().eq("id", inventoryItemId);
    }
    return { error: error?.message || "No se pudo crear el producto." };
  }

  revalidatePath("/inventory");
  return { success: "Producto agregado al catálogo.", id: inserted.id as number };
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

  const orgCurrencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = resolveOrganizationCurrency(parsed.data.currency, orgCurrencies);

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      sku: parsed.data.sku || null,
      category: parsed.data.category || null,
      kind: parsed.data.kind,
      price: parsed.data.price,
      currency,
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

export const deleteProductAction = async (productId: number): Promise<ActionResult> => {
  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: product, error: loadError } = await supabase
    .from("products")
    .select("id, active, image_path")
    .eq("id", productId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (loadError || !product?.id) {
    return { error: "El producto no existe." };
  }

  if (product.active === true) {
    return { error: "Desactiva el producto antes de borrarlo." };
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo borrar el producto." };
  }

  const imagePath = typeof product.image_path === "string" ? product.image_path.trim() : "";
  if (imagePath) {
    await removeProductImage(imagePath).catch(() => undefined);
  }

  revalidatePath("/inventory");
  return { success: "Producto borrado del catálogo." };
};

const productImageSqlHint = (message: string) => {
  if (/bucket|not found|does not exist/i.test(message)) {
    return "No se encontró el bucket product-images. ¿Corriste supabase/storage-image-buckets.sql?";
  }
  if (/image_url|image_path|image_mime|image_send_policy/i.test(message)) {
    return "No se pudo guardar la imagen. ¿Corriste supabase/product-images.sql?";
  }
  return message;
};

export const saveProductAction = async (formData: FormData): Promise<ActionResult> => {
  const editingIdRaw = formData.get("id");
  const editingId = typeof editingIdRaw === "string" && editingIdRaw.trim() ? Number(editingIdRaw) : undefined;
  const fields = {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sku: formData.get("sku") || undefined,
    category: formData.get("category") || undefined,
    kind: formData.get("kind"),
    price: Number(formData.get("price")),
    trackStock: formData.get("trackStock") === "true",
    initialStock: formData.get("initialStock") ? Number(formData.get("initialStock")) : undefined,
    reorderPoint: formData.get("reorderPoint") ? Number(formData.get("reorderPoint")) : undefined,
    currency: formData.get("currency") || undefined,
  };

  const uploaded = await readCatalogImageFile(formData.get("image"));
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const imageSendPolicy = formData.get("imageSendAlways") === "true" ? "always" : "on_request";
  const removeImage = formData.get("removeImage") === "true";

  let productId = editingId;
  if (editingId) {
    const parsed = updateProductSchema.safeParse({ ...fields, id: editingId, active: true });
    if (!parsed.success) {
      return { error: zodErrorMessage(parsed.error, "Revisa los datos del producto.") };
    }
    const updated = await updateProductAction(parsed.data);
    if (updated.error) return updated;
  } else {
    const parsed = productSchema.safeParse(fields);
    if (!parsed.success) {
      return { error: zodErrorMessage(parsed.error, "Revisa los datos del producto.") };
    }
    const created = await createProductAction(parsed.data);
    if (created.error) return created;
    productId = created.id;
  }

  if (!productId) {
    return { error: "No se pudo guardar el producto." };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: target, error: targetError } = await supabase
    .from("products")
    .select("id, image_path")
    .eq("id", productId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (targetError || !target?.id) {
    if (targetError && /image_path|image_send_policy/i.test(targetError.message)) {
      return { error: "El producto se guardó, pero falta supabase/product-images.sql para la foto." };
    }
    return editingId ? { success: "Producto actualizado." } : { success: "Producto agregado al catálogo." };
  }

  const patch: Record<string, unknown> = { image_send_policy: imageSendPolicy };
  const previousPath = typeof target.image_path === "string" ? target.image_path : null;

  if (uploaded.file) {
    const imagePath = buildProductImagePath({
      organizationId: access.membership.organizationId,
      fileName: uploaded.file.fileName,
    });
    try {
      const imageUrl = await uploadPublicMedia({
        bucket: PRODUCT_IMAGES_BUCKET,
        path: imagePath,
        bytes: uploaded.file.bytes,
        mimeType: uploaded.file.mimeType,
      });
      patch.image_url = imageUrl;
      patch.image_path = imagePath;
      patch.image_mime = uploaded.file.mimeType;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir la imagen.";
      return { error: productImageSqlHint(message) };
    }
  } else if (removeImage) {
    patch.image_url = null;
    patch.image_path = null;
    patch.image_mime = null;
    patch.image_send_policy = "on_request";
  }

  const { error: imageError } = await supabase
    .from("products")
    .update(patch)
    .eq("id", target.id)
    .eq("organization_id", access.membership.organizationId);

  if (imageError) {
    return { error: productImageSqlHint(imageError.message || "No se pudo guardar la imagen.") };
  }

  if ((uploaded.file || removeImage) && previousPath && previousPath !== patch.image_path) {
    await removeProductImage(previousPath).catch(() => undefined);
  }

  revalidatePath("/inventory");
  revalidatePath("/onboarding/setup");
  if (uploaded.file) {
    return { success: editingId ? "Producto e imagen actualizados." : "Producto agregado con imagen." };
  }
  return { success: editingId ? "Producto actualizado." : "Producto agregado al catálogo." };
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
    return { error: zodErrorMessage(parsed.error, "Revisa la promoción.") };
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

/** Etiqueta de contacto que se asigna al aprobar un pago. */
const PAID_API_TAG_NAME = "PAGADO API";

const ensurePaidApiTagOnContact = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: number,
  contactId: number,
) => {
  const { data: existingTag } = await supabase
    .from("contact_tags")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", PAID_API_TAG_NAME)
    .maybeSingle();

  let tagId = existingTag?.id as number | undefined;

  if (!tagId) {
    const { data: createdTag, error: tagError } = await supabase
      .from("contact_tags")
      .insert({ organization_id: organizationId, name: PAID_API_TAG_NAME })
      .select("id")
      .single();

    if (tagError || !createdTag?.id) {
      console.warn("[orders] No se pudo crear la etiqueta PAGADO API", tagError?.message);
      return;
    }
    tagId = createdTag.id;
  }

  const { error: linkError } = await supabase.from("contact_tag_links").upsert({
    contact_id: contactId,
    tag_id: tagId,
  });

  if (linkError) {
    console.warn("[orders] No se pudo vincular PAGADO API al contacto", linkError.message);
  }
};

const resolveOrderConversationId = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: number,
  conversationId: number | null,
  contactId: number | null,
) => {
  if (conversationId) return conversationId;
  if (!contactId) return null;

  const { data: openConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .neq("status", "resolved")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openConversation?.id) return openConversation.id;

  const { data: latestConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestConversation?.id ?? null;
};

const assignConversationToAdvisor = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: number,
  conversationId: number,
  advisorUserId: string,
) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("conversations")
    .update({
      assigned_user_id: advisorUserId,
      assigned_at: now,
      mode: "human",
      status: "in_progress",
      updated_at: now,
    })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);

  if (error) {
    console.warn("[orders] No se pudo asignar el chat al asesor", error.message);
    return false;
  }

  return true;
};

export const updateOrderPaymentAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = paymentSchema.safeParse(rawValues);
  if (!parsed.success || !isPaymentStatus(parsed.data.paymentStatus)) {
    return { error: "El estado de pago no es válido." };
  }

  const access = await requirePaymentMembership();
  if ("error" in access) return { error: access.error };

  const { user } = await loadCurrentMemberSession();
  if (!user) {
    return { error: "Sesión no válida. Vuelve a iniciar sesión." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .update({
      payment_status: parsed.data.paymentStatus,
      payment_method: parsed.data.paymentMethod || null,
    })
    .eq("id", parsed.data.orderId)
    .eq("organization_id", access.membership.organizationId)
    .select("id, contact_id, conversation_id")
    .single();

  if (error) {
    return { error: error.message || "No se pudo actualizar el pago." };
  }

  if (parsed.data.paymentStatus === "paid" && order?.contact_id) {
    await ensurePaidApiTagOnContact(
      supabase,
      access.membership.organizationId,
      order.contact_id,
    );
  }

  const conversationId = await resolveOrderConversationId(
    supabase,
    access.membership.organizationId,
    order?.conversation_id ?? null,
    order?.contact_id ?? null,
  );

  let assignedConversation = false;
  if (conversationId) {
    assignedConversation = await assignConversationToAdvisor(
      supabase,
      access.membership.organizationId,
      conversationId,
      user.id,
    );
  }

  revalidatePath("/orders");
  revalidatePath("/contacts");
  revalidatePath("/inbox");
  if (order?.contact_id) {
    revalidatePath(`/contacts/${order.contact_id}`);
  }
  await recordAuditEvent({
    organizationId: access.membership.organizationId,
    action: "order.payment",
    entity: "order",
    entityId: parsed.data.orderId,
    payload: {
      paymentStatus: parsed.data.paymentStatus,
      paymentMethod: parsed.data.paymentMethod,
      taggedPaidApi: parsed.data.paymentStatus === "paid" && Boolean(order?.contact_id),
      assignedConversationId: assignedConversation ? conversationId : null,
      assignedUserId: assignedConversation ? user.id : null,
    },
  });

  if (parsed.data.paymentStatus === "paid") {
    return {
      success: assignedConversation
        ? "Pedido marcado como pagado y chat asignado a ti."
        : "Pedido marcado como pagado.",
    };
  }

  return {
    success: assignedConversation
      ? "Pago actualizado y chat asignado a ti."
      : "Pago actualizado.",
  };
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
      initialStock: row.initialStock,
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
  currency: z.string().trim().length(3).optional(),
});

export const createDeliveryZoneAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = deliveryZoneSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa la zona de delivery.") };
  }

  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const orgCurrencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = resolveOrganizationCurrency(parsed.data.currency, orgCurrencies);
  const payload = {
    organization_id: access.membership.organizationId,
    name: parsed.data.name,
    fee: parsed.data.fee,
    eta_minutes: parsed.data.etaMinutes ?? null,
    active: true,
    currency,
  };
  const { error } = await supabase.from("delivery_zones").insert(payload);

  if (error) {
    const { error: fallbackError } = await supabase.from("delivery_zones").insert({
      organization_id: payload.organization_id,
      name: payload.name,
      fee: payload.fee,
      eta_minutes: payload.eta_minutes,
      active: payload.active,
    });
    if (fallbackError) {
      return { error: fallbackError.message || "No se pudo crear la zona." };
    }
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

export const deleteDeliveryZoneAction = async (zoneId: number): Promise<ActionResult> => {
  const access = await requireCatalogMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: zone, error: loadError } = await supabase
    .from("delivery_zones")
    .select("id, active")
    .eq("id", zoneId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (loadError || !zone?.id) {
    return { error: "La zona no existe." };
  }

  if (zone.active === true) {
    return { error: "Desactiva la zona antes de borrarla." };
  }

  const { error } = await supabase
    .from("delivery_zones")
    .delete()
    .eq("id", zoneId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo borrar la zona." };
  }

  revalidatePath("/inventory");
  return { success: "Zona de delivery borrada." };
};
