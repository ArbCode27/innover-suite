"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FULFILLMENT_TYPES } from "@/lib/commerce/types";
import { buildPublicMenuSlug } from "@/lib/menu/public-menu";
import { loadCachedOrganizationModules } from "@/lib/modules/settings";
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
    console.error("[PUBLIC_CATALOG] place order failed", error);
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

const inquirySchema = z.object({
  slug: z.string().trim().min(2).max(80),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(7).max(40),
  listingIds: z.array(z.number().int().positive()).min(1).max(20),
});

export const submitPublicCatalogInquiryAction = async (input: z.infer<typeof inquirySchema>) => {
  const parsed = inquirySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Indica nombre, teléfono e inmuebles de interés." };
  }

  const admin = getSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("public_menu_slug", parsed.data.slug.trim().toLowerCase())
    .eq("public_menu_enabled", true)
    .maybeSingle();

  if (!org) {
    return { ok: false as const, error: "Este catálogo no está disponible." };
  }

  const { data: listings } = await admin
    .from("listings")
    .select("id, title, code")
    .eq("organization_id", org.id)
    .in("id", parsed.data.listingIds);

  const titles = (listings ?? []).map((row) => row.title || row.code || `#${row.id}`);
  if (!titles.length) {
    return { ok: false as const, error: "No se encontraron los inmuebles seleccionados." };
  }

  const { error } = await admin.from("notifications").insert({
    organization_id: org.id,
    kind: "order",
    title: `Consulta catálogo · ${parsed.data.customerName}`,
    body: `${parsed.data.customerPhone}\nInterés: ${titles.join(", ")}`,
    href: "/listings",
  });

  if (error) {
    console.error("[PUBLIC_CATALOG] inquiry failed", error);
    return { ok: false as const, error: "No se pudo enviar la consulta." };
  }

  return { ok: true as const };
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

  const modules = await loadCachedOrganizationModules(membership.organizationId).catch(() => null);
  const canPublishCatalog = Boolean(modules?.catalog || modules?.listings);

  if (!org || !canPublishCatalog) {
    return {
      ok: false as const,
      error: "Activa Catálogo o Inmuebles en Funciones del CRM para publicar el catálogo.",
    };
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
    console.error("[PUBLIC_CATALOG] settings update failed", error);
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath(`/menu/${slug}`);
  return { ok: true as const, slug, enabled: parsed.data.enabled };
};
