"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MENU_TYPES } from "@/lib/commerce/types";
import { normalizeIngredients, type StoredMenuIngredient } from "@/lib/menu/crm-types";
import { readCatalogImageFile } from "@/lib/media/image-upload";
import { buildProductImagePath, removeProductImage, uploadPublicMedia } from "@/lib/media/storage";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/media/types";
import { canManageCatalog, getCurrentMembership } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies, resolveOrganizationCurrency } from "@/lib/organizations/currencies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/validation/zod-es";

type ActionResult = {
  success?: string;
  error?: string;
  id?: number;
};

const requireMenuMembership = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !canManageCatalog(membership)) {
    return { error: "No tienes permisos para gestionar el menú." } as const;
  }
  return { membership } as const;
};

const menuItemFields = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  itemType: z.enum(MENU_TYPES),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  comboItemIds: z.array(z.number().int().positive()).max(20).optional(),
  price: z.number().nonnegative().max(10_000_000),
  currency: z.string().trim().length(3).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        imageUrl: z.string().trim().max(2000).nullable().optional(),
      }),
    )
    .max(40)
    .optional(),
  active: z.boolean().optional(),
});

const toStoredIngredients = (
  value: Array<{ name: string; imageUrl?: string | null }> | undefined,
): StoredMenuIngredient[] =>
  normalizeIngredients(
    (value ?? []).map((item) => ({
      name: item.name,
      imageUrl: item.imageUrl?.trim() ? item.imageUrl.trim() : null,
    })),
  );

const createSchema = menuItemFields;
const updateSchema = menuItemFields.extend({
  id: z.number().int().positive(),
  active: z.boolean(),
});

const syncComboComponents = async (params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: number;
  comboItemId: number;
  itemIds: number[];
}) => {
  const uniqueIds = [...new Set(params.itemIds)].filter((id) => id !== params.comboItemId);
  await params.supabase
    .from("menu_combo_components")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("combo_item_id", params.comboItemId);

  if (!uniqueIds.length) return;

  const { data: validItems } = await params.supabase
    .from("menu_items")
    .select("id")
    .eq("organization_id", params.organizationId)
    .in("id", uniqueIds);

  const rows = (validItems ?? []).map((item) => ({
    organization_id: params.organizationId,
    combo_item_id: params.comboItemId,
    component_item_id: item.id as number,
    quantity: 1,
  }));

  if (rows.length) {
    await params.supabase.from("menu_combo_components").insert(rows);
  }
};

const menuSqlHint = (message: string) => {
  if (/menu_items|menu_combo_components|does not exist/i.test(message)) {
    return "Falta el esquema de menú. Corre supabase/menu-items.sql en Supabase.";
  }
  if (/bucket|not found/i.test(message)) {
    return "No se encontró el bucket product-images. ¿Corriste supabase/storage-image-buckets.sql?";
  }
  return message;
};

export const createMenuItemAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = createSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa los datos del plato.") };
  }

  const access = await requireMenuMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const orgCurrencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = resolveOrganizationCurrency(parsed.data.currency, orgCurrencies);

  const { data: inserted, error } = await supabase
    .from("menu_items")
    .insert({
      organization_id: access.membership.organizationId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      item_type: parsed.data.itemType,
      price: parsed.data.price,
      currency,
      active: true,
      is_featured: parsed.data.isFeatured ?? false,
      sort_order: parsed.data.sortOrder ?? 0,
      ingredients: toStoredIngredients(parsed.data.ingredients),
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { error: menuSqlHint(error?.message || "No se pudo crear el plato.") };
  }

  if (parsed.data.itemType === "combo" || parsed.data.itemType === "promo") {
    await syncComboComponents({
      supabase,
      organizationId: access.membership.organizationId,
      comboItemId: inserted.id as number,
      itemIds: parsed.data.comboItemIds ?? [],
    });
  }

  revalidatePath("/carta");
  return { success: "Plato agregado al menú.", id: inserted.id as number };
};

export const updateMenuItemAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = updateSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "Los datos del plato no son válidos." };
  }

  const access = await requireMenuMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const orgCurrencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = resolveOrganizationCurrency(parsed.data.currency, orgCurrencies);

  const { error } = await supabase
    .from("menu_items")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      item_type: parsed.data.itemType,
      price: parsed.data.price,
      currency,
      active: parsed.data.active,
      is_featured: parsed.data.isFeatured ?? false,
      sort_order: parsed.data.sortOrder ?? 0,
      ingredients: toStoredIngredients(parsed.data.ingredients),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: menuSqlHint(error.message || "No se pudo actualizar el plato.") };
  }

  if (parsed.data.itemType === "combo" || parsed.data.itemType === "promo") {
    await syncComboComponents({
      supabase,
      organizationId: access.membership.organizationId,
      comboItemId: parsed.data.id,
      itemIds: parsed.data.comboItemIds ?? [],
    });
  } else {
    await syncComboComponents({
      supabase,
      organizationId: access.membership.organizationId,
      comboItemId: parsed.data.id,
      itemIds: [],
    });
  }

  revalidatePath("/carta");
  return { success: "Plato actualizado." };
};

export const deleteMenuItemAction = async (menuItemId: number): Promise<ActionResult> => {
  const access = await requireMenuMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: item, error: loadError } = await supabase
    .from("menu_items")
    .select("id, active, image_path")
    .eq("id", menuItemId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (loadError || !item?.id) {
    return { error: menuSqlHint(loadError?.message || "El plato no existe.") };
  }

  if (item.active === true) {
    const { error: deactivateError } = await supabase
      .from("menu_items")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", menuItemId)
      .eq("organization_id", access.membership.organizationId);
    if (deactivateError) {
      return { error: menuSqlHint(deactivateError.message || "No se pudo desactivar el plato.") };
    }
  }

  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", menuItemId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    return { error: menuSqlHint(error.message || "No se pudo borrar el plato.") };
  }

  const imagePath = typeof item.image_path === "string" ? item.image_path.trim() : "";
  if (imagePath) {
    await removeProductImage(imagePath).catch(() => undefined);
  }

  revalidatePath("/carta");
  return { success: "Plato eliminado del menú." };
};

export const saveMenuItemAction = async (formData: FormData): Promise<ActionResult> => {
  const editingIdRaw = formData.get("id");
  const editingId =
    typeof editingIdRaw === "string" && editingIdRaw.trim() ? Number(editingIdRaw) : undefined;

  let ingredientsDraft: Array<{ name: string; imageUrl?: string | null }> = [];
  const ingredientsJsonRaw = formData.get("ingredientsJson");
  if (typeof ingredientsJsonRaw === "string" && ingredientsJsonRaw.trim()) {
    try {
      const parsedJson = JSON.parse(ingredientsJsonRaw) as unknown;
      if (Array.isArray(parsedJson)) {
        ingredientsDraft = parsedJson
          .map((entry) => {
            if (typeof entry === "string") {
              return { name: entry.trim(), imageUrl: null as string | null };
            }
            if (entry && typeof entry === "object" && "name" in entry) {
              const record = entry as { name?: unknown; imageUrl?: unknown };
              return {
                name: String(record.name ?? "").trim(),
                imageUrl:
                  typeof record.imageUrl === "string" && record.imageUrl.trim()
                    ? record.imageUrl.trim()
                    : null,
              };
            }
            return null;
          })
          .filter((entry): entry is { name: string; imageUrl: string | null } =>
            Boolean(entry?.name),
          );
      }
    } catch {
      return { error: "Los ingredientes no son válidos." };
    }
  } else {
    const ingredientsRaw =
      typeof formData.get("ingredients") === "string"
        ? String(formData.get("ingredients"))
        : typeof formData.get("menuIngredients") === "string"
          ? String(formData.get("menuIngredients"))
          : "";
    ingredientsDraft = ingredientsRaw
      .split(/[,;\n]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((name) => ({ name, imageUrl: null as string | null }));
  }

  const accessEarly = await requireMenuMembership();
  if ("error" in accessEarly) return { error: accessEarly.error };

  const resolvedIngredients: StoredMenuIngredient[] = [];
  for (let index = 0; index < ingredientsDraft.length; index += 1) {
    const draft = ingredientsDraft[index];
    if (!draft?.name) continue;
    const uploadedIngredient = await readCatalogImageFile(formData.get(`ingredientImage_${index}`));
    if ("error" in uploadedIngredient) {
      return { error: uploadedIngredient.error };
    }
    let imageUrl = draft.imageUrl ?? null;
    if (formData.get(`removeIngredientImage_${index}`) === "true") {
      imageUrl = null;
    }
    if (uploadedIngredient.file) {
      const imagePath = buildProductImagePath({
        organizationId: accessEarly.membership.organizationId,
        fileName: `ingredient-${uploadedIngredient.file.fileName}`,
      });
      try {
        imageUrl = await uploadPublicMedia({
          bucket: PRODUCT_IMAGES_BUCKET,
          path: imagePath,
          bytes: uploadedIngredient.file.bytes,
          mimeType: uploadedIngredient.file.mimeType,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo subir la foto del ingrediente.";
        return { error: menuSqlHint(message) };
      }
    }
    resolvedIngredients.push({ name: draft.name, imageUrl });
  }

  const comboItemIds = String(formData.get("comboItemIds") || "")
    .split(/[,;\s]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  const itemTypeRaw = formData.get("itemType") || formData.get("menuType");
  const fields = {
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    itemType: typeof itemTypeRaw === "string" && itemTypeRaw.trim() ? itemTypeRaw.trim() : "dish",
    isFeatured: formData.get("isFeatured") === "true",
    sortOrder: formData.get("sortOrder") ? Number(formData.get("sortOrder")) : 0,
    comboItemIds,
    price: Number(formData.get("price")),
    currency: formData.get("currency") || undefined,
    ingredients: toStoredIngredients(resolvedIngredients),
  };

  const uploaded = await readCatalogImageFile(formData.get("image"));
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const removeImage = formData.get("removeImage") === "true";

  let menuItemId = editingId;
  if (editingId) {
    const parsed = updateSchema.safeParse({ ...fields, id: editingId, active: true });
    if (!parsed.success) {
      return { error: zodErrorMessage(parsed.error, "Revisa los datos del plato.") };
    }
    const updated = await updateMenuItemAction(parsed.data);
    if (updated.error) return updated;
  } else {
    const parsed = createSchema.safeParse(fields);
    if (!parsed.success) {
      return { error: zodErrorMessage(parsed.error, "Revisa los datos del plato.") };
    }
    const created = await createMenuItemAction(parsed.data);
    if (created.error) return created;
    menuItemId = created.id;
  }

  if (!menuItemId) {
    return { error: "No se pudo guardar el plato." };
  }

  const access = await requireMenuMembership();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: target, error: targetError } = await supabase
    .from("menu_items")
    .select("id, image_path")
    .eq("id", menuItemId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (targetError || !target?.id) {
    return {
      error: menuSqlHint(targetError?.message || "El plato se guardó, pero no se pudo actualizar la imagen."),
    };
  }

  if (!uploaded.file && !removeImage) {
    revalidatePath("/carta");
    return { success: editingId ? "Plato actualizado." : "Plato agregado al menú." };
  }

  const patch: Record<string, unknown> = {};
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
      return { error: menuSqlHint(message) };
    }
  } else if (removeImage) {
    patch.image_url = null;
    patch.image_path = null;
    patch.image_mime = null;
  }

  const { error: imageError } = await supabase
    .from("menu_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", target.id)
    .eq("organization_id", access.membership.organizationId);

  if (imageError) {
    return { error: menuSqlHint(imageError.message || "No se pudo guardar la imagen.") };
  }

  if ((uploaded.file || removeImage) && previousPath && previousPath !== patch.image_path) {
    await removeProductImage(previousPath).catch(() => undefined);
  }

  revalidatePath("/carta");
  return {
    success: uploaded.file
      ? editingId
        ? "Plato e imagen actualizados."
        : "Plato agregado con imagen."
      : editingId
        ? "Plato actualizado."
        : "Plato agregado al menú.",
  };
};
