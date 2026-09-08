"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FULFILLMENT_TYPES } from "@/lib/commerce/types";
import { buildPublicMenuSlug } from "@/lib/menu/public-menu";
import { hasOrganizationRole, loadCurrentMemberSession } from "@/lib/organizations/membership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const placeOrderSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  customerName: z.string().trim().min(2).max(120),
  partySize: z.number().int().min(1).max(50),
  fulfillment: z.enum(FULFILLMENT_TYPES),
  customerNote: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive().max(99),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(40),
});

export const placePublicMenuOrderAction = async (input: z.infer<typeof placeOrderSchema>) => {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Revisa el pedido e inténtalo de nuevo." };
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_public_menu_order", {
    p_slug: parsed.data.slug,
    p_customer_name: parsed.data.customerName,
    p_party_size: parsed.data.partySize,
    p_fulfillment: parsed.data.fulfillment,
    p_customer_note: parsed.data.customerNote ?? "",
    p_items: parsed.data.items,
  });

  if (error) {
    console.error("[PUBLIC_MENU] place order failed", error);
    return { ok: false as const, error: error.message || "No se pudo crear el pedido." };
  }

  const result = data as { ok?: boolean; error?: string; orderId?: number; total?: number } | null;
  if (!result?.ok) {
    return { ok: false as const, error: result?.error || "No se pudo crear el pedido." };
  }

  return {
    ok: true as const,
    orderId: result.orderId ?? null,
    total: result.total ?? null,
  };
};

const menuSettingsSchema = z.object({
  enabled: z.boolean(),
});

export const updatePublicMenuSettingsAction = async (input: z.infer<typeof menuSettingsSchema>) => {
  const parsed = menuSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos." };
  }

  const { membership } = await loadCurrentMemberSession();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { ok: false as const, error: "No autorizado." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, business_template, public_menu_slug")
    .eq("id", membership.organizationId)
    .maybeSingle();

  if (!org || org.business_template !== "restaurant") {
    return { ok: false as const, error: "El auto-pedido solo está disponible para restaurantes." };
  }

  const slug = org.public_menu_slug || buildPublicMenuSlug(org.name || membership.organizationName, org.id);

  const { error } = await supabase
    .from("organizations")
    .update({
      public_menu_enabled: parsed.data.enabled,
      public_menu_slug: slug,
    })
    .eq("id", membership.organizationId);

  if (error) {
    console.error("[PUBLIC_MENU] settings update failed", error);
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath(`/menu/${slug}`);
  return { ok: true as const, slug, enabled: parsed.data.enabled };
};
