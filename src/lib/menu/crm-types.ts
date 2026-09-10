import {
  MENU_TYPE_LABELS,
  MENU_TYPES,
  formatMoney,
  isMenuType,
  toNumber,
  type MenuType,
} from "@/lib/commerce/types";
import { DEFAULT_CURRENCY } from "@/lib/organizations/currencies";

export { MENU_TYPES, MENU_TYPE_LABELS, formatMoney, isMenuType, type MenuType };

export type StoredMenuIngredient = {
  name: string;
  imageUrl: string | null;
};

export type MenuItemRecord = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  itemType: MenuType;
  price: number;
  currency: string;
  active: boolean;
  isFeatured: boolean;
  sortOrder: number;
  imageUrl: string | null;
  imagePath: string | null;
  imageMime: string | null;
  ingredients: StoredMenuIngredient[];
  comboItemIds: number[];
  legacyProductId: number | null;
};

export type MenuItemRow = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  item_type: string;
  price: number | string;
  currency: string;
  active: boolean;
  is_featured: boolean | null;
  sort_order: number | string | null;
  image_url: string | null;
  image_path: string | null;
  image_mime: string | null;
  ingredients: unknown;
  legacy_product_id: number | null;
};

export const parseStoredIngredients = (raw: unknown): StoredMenuIngredient[] => {
  if (!Array.isArray(raw)) return [];

  const result: StoredMenuIngredient[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry === "string") {
      const name = entry.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      result.push({ name, imageUrl: null });
      continue;
    }

    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const imageRaw = record.imageUrl ?? record.image_url;
    const imageUrl =
      typeof imageRaw === "string" && imageRaw.trim() ? imageRaw.trim() : null;
    result.push({ name, imageUrl });
  }

  return result;
};

export const mapMenuItemRow = (
  row: MenuItemRow,
  comboItemIds: number[] = [],
): MenuItemRecord => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  itemType: isMenuType(row.item_type) ? row.item_type : "dish",
  price: toNumber(row.price),
  currency: row.currency || DEFAULT_CURRENCY,
  active: row.active,
  isFeatured: Boolean(row.is_featured),
  sortOrder: row.sort_order == null ? 0 : toNumber(row.sort_order),
  imageUrl: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url.trim() : null,
  imagePath: typeof row.image_path === "string" && row.image_path.trim() ? row.image_path.trim() : null,
  imageMime: typeof row.image_mime === "string" && row.image_mime.trim() ? row.image_mime.trim() : null,
  ingredients: parseStoredIngredients(row.ingredients),
  comboItemIds,
  legacyProductId: row.legacy_product_id,
});

export const normalizeIngredients = (
  value: Array<string | StoredMenuIngredient> | undefined,
): StoredMenuIngredient[] => {
  if (!value?.length) return [];
  return parseStoredIngredients(value);
};
