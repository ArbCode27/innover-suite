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
  ingredients: string[];
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
  ingredients: string[] | null;
  legacy_product_id: number | null;
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
  ingredients: Array.isArray(row.ingredients)
    ? row.ingredients.map((value) => String(value).trim()).filter(Boolean)
    : [],
  comboItemIds,
  legacyProductId: row.legacy_product_id,
});

export const normalizeIngredients = (value: string[] | undefined) =>
  [...new Set((value ?? []).map((item) => item.trim()).filter(Boolean))];
