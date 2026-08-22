import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isProductKind,
  toNumber,
  type InventoryMovementRecord,
  type ProductRecord,
  type PromotionRecord,
} from "@/lib/commerce/types";

type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  kind: string;
  price: number | string;
  currency: string;
  active: boolean;
  track_stock: boolean;
  inventory_item_id: number | null;
  inventory_items:
    | { on_hand?: number | string | null; reorder_point?: number | string | null }
    | { on_hand?: number | string | null; reorder_point?: number | string | null }[]
    | null;
};

const asInventory = (value: ProductRow["inventory_items"]) => (Array.isArray(value) ? value[0] : value) ?? null;

export const mapProductRow = (row: ProductRow): ProductRecord => {
  const inventory = asInventory(row.inventory_items);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    category: row.category,
    kind: isProductKind(row.kind) ? row.kind : "physical",
    price: toNumber(row.price),
    currency: row.currency || "DOP",
    active: row.active,
    trackStock: row.track_stock,
    inventoryItemId: row.inventory_item_id,
    onHand: inventory?.on_hand == null ? null : toNumber(inventory.on_hand),
    reorderPoint: inventory?.reorder_point == null ? null : toNumber(inventory.reorder_point),
  };
};

export const loadCatalog = async (supabase: SupabaseClient, organizationId: number) => {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, description, sku, category, kind, price, currency, active, track_stock, inventory_item_id, inventory_items!inventory_item_id(on_hand, reorder_point)",
    )
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message || "No se pudo cargar el catálogo.");
  }

  return (data ?? []).map((row) => mapProductRow(row as ProductRow));
};

export const loadPromotions = async (supabase: SupabaseClient, organizationId: number) => {
  const { data, error } = await supabase
    .from("promotions")
    .select("id, name, description, discount_percent, starts_at, ends_at, active")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "No se pudieron cargar las promociones.");
  }

  return (data ?? []).map(
    (row): PromotionRecord => ({
      id: row.id as number,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      discountPercent: row.discount_percent == null ? null : toNumber(row.discount_percent),
      startsAt: (row.starts_at as string | null) ?? null,
      endsAt: (row.ends_at as string | null) ?? null,
      active: row.active === true,
    }),
  );
};

export const loadInventoryMovements = async (supabase: SupabaseClient, organizationId: number, limit = 40) => {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("id, kind, quantity, balance_after, note, created_at, order_id, inventory_items(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "No se pudo cargar el historial de inventario.");
  }

  return (data ?? []).map((row): InventoryMovementRecord => {
    const item = row.inventory_items as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(item) ? item[0]?.name : item?.name;
    return {
      id: row.id as number,
      inventoryItemName: name || "Insumo",
      kind: row.kind as InventoryMovementRecord["kind"],
      quantity: toNumber(row.quantity),
      balanceAfter: toNumber(row.balance_after),
      note: (row.note as string | null) ?? null,
      createdAt: row.created_at as string,
      orderId: (row.order_id as number | null) ?? null,
    };
  });
};
