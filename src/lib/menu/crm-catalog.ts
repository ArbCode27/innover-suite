import type { SupabaseClient } from "@supabase/supabase-js";
import { mapMenuItemRow, type MenuItemRecord, type MenuItemRow } from "@/lib/menu/crm-types";

const MENU_COLUMNS =
  "id, name, description, category, item_type, price, currency, active, is_featured, sort_order, image_url, image_path, image_mime, ingredients, legacy_product_id";

const loadComboMap = async (
  supabase: SupabaseClient,
  organizationId: number,
  itemIds: number[],
) => {
  const map = new Map<number, number[]>();
  if (!itemIds.length) return map;

  const { data, error } = await supabase
    .from("menu_combo_components")
    .select("combo_item_id, component_item_id")
    .eq("organization_id", organizationId)
    .in("combo_item_id", itemIds);

  if (error) return map;

  for (const row of data ?? []) {
    const comboId = row.combo_item_id as number;
    const itemId = row.component_item_id as number;
    const current = map.get(comboId) ?? [];
    current.push(itemId);
    map.set(comboId, current);
  }
  return map;
};

export const loadMenuItems = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<MenuItemRecord[]> => {
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_COLUMNS)
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(
      error.message.includes("menu_items")
        ? "No se pudo cargar el menú. ¿Corriste supabase/menu-items.sql?"
        : error.message || "No se pudo cargar el menú.",
    );
  }

  const rows = (data ?? []) as MenuItemRow[];
  const comboMap = await loadComboMap(
    supabase,
    organizationId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => mapMenuItemRow(row, comboMap.get(row.id) ?? []));
};
