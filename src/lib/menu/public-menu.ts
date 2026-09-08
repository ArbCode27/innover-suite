import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CURRENCY } from "@/lib/organizations/currencies";
import { DEFAULT_TAX_RATE, toNumber } from "@/lib/commerce/types";
import type { MenuIngredient, MenuProduct, PublicMenuPayload } from "@/lib/menu/types";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const buildPublicMenuSlug = (organizationName: string, organizationId: number) => {
  const base = slugify(organizationName) || "menu";
  return `${base}-${organizationId}`;
};

type OrgRow = {
  id: number;
  name: string;
  public_menu_slug: string | null;
  public_menu_enabled: boolean | null;
  business_template: string | null;
  tax_rate: number | string | null;
  default_currency?: string | null;
};

type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  price: number | string;
  currency: string | null;
  active: boolean;
  track_stock: boolean;
  image_url: string | null;
  menu_ingredients: string[] | null;
  inventory_items:
    | { on_hand?: number | string | null }
    | { on_hand?: number | string | null }[]
    | null;
  product_recipes:
    | Array<{
        quantity: number | string;
        inventory_items: { id: number; name: string } | { id: number; name: string }[] | null;
      }>
    | null;
};

const asSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const resolveIngredients = (row: ProductRow): MenuIngredient[] => {
  const fromColumn = (row.menu_ingredients ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({
      id: `mi-${row.id}-${index}`,
      name,
      removable: true,
    }));

  if (fromColumn.length) return fromColumn;

  const recipes = row.product_recipes ?? [];
  const fromRecipes: MenuIngredient[] = [];
  for (const recipe of recipes) {
    const item = asSingle(recipe.inventory_items);
    if (!item?.name?.trim()) continue;
    fromRecipes.push({
      id: `pr-${item.id}`,
      name: item.name.trim(),
      removable: true,
    });
  }
  return fromRecipes;
};

export const loadPublicMenuBySlug = async (slug: string): Promise<PublicMenuPayload | null> => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = getSupabaseAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name, public_menu_slug, public_menu_enabled, business_template, tax_rate, default_currency")
    .eq("public_menu_slug", normalized)
    .eq("public_menu_enabled", true)
    .eq("business_template", "restaurant")
    .maybeSingle();

  if (orgError) {
    // Fallback if default_currency column does not exist yet.
    const fallback = await admin
      .from("organizations")
      .select("id, name, public_menu_slug, public_menu_enabled, business_template, tax_rate")
      .eq("public_menu_slug", normalized)
      .eq("public_menu_enabled", true)
      .eq("business_template", "restaurant")
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    return assembleMenu(admin, fallback.data as OrgRow);
  }

  if (!org) return null;
  return assembleMenu(admin, org as OrgRow);
};

const assembleMenu = async (
  admin: ReturnType<typeof getSupabaseAdminClient>,
  org: OrgRow,
): Promise<PublicMenuPayload | null> => {
  const withRecipes = await admin
    .from("products")
    .select(
      "id, name, description, category, price, currency, active, track_stock, image_url, menu_ingredients, inventory_items!inventory_item_id(on_hand), product_recipes(quantity, inventory_items(id, name))",
    )
    .eq("organization_id", org.id)
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  let rows: ProductRow[] = [];
  if (!withRecipes.error) {
    rows = (withRecipes.data ?? []) as ProductRow[];
  } else {
    const basic = await admin
      .from("products")
      .select(
        "id, name, description, category, price, currency, active, track_stock, image_url, inventory_items!inventory_item_id(on_hand)",
      )
      .eq("organization_id", org.id)
      .eq("active", true)
      .order("name", { ascending: true });
    if (basic.error) {
      console.error("[PUBLIC_MENU] products load failed", basic.error);
      return null;
    }
    rows = (basic.data ?? []).map((row) => ({
      ...(row as ProductRow),
      menu_ingredients: [],
      product_recipes: [],
    }));
  }

  const { data: promoRows } = await admin
    .from("promotions")
    .select("discount_percent")
    .eq("organization_id", org.id)
    .eq("active", true);

  const promoPercent = Math.max(
    0,
    ...(promoRows ?? []).map((row) => toNumber(row.discount_percent)),
  );

  const products: MenuProduct[] = rows.map((row) => {
    const inventory = asSingle(row.inventory_items);
    const onHand = inventory?.on_hand == null ? null : toNumber(inventory.on_hand);
    const price = toNumber(row.price);
    const available =
      !row.track_stock || onHand == null ? true : onHand > 0;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category?.trim() || null,
      price,
      currency: row.currency || org.default_currency || DEFAULT_CURRENCY,
      imageUrl: row.image_url?.trim() || null,
      available,
      availableQty: onHand,
      ingredients: resolveIngredients(row),
      promoPrice: promoPercent > 0 ? Math.max(0, Math.round(price * (1 - promoPercent / 100) * 100) / 100) : null,
    };
  });

  const categories = [
    ...new Set(products.map((product) => product.category).filter((value): value is string => Boolean(value))),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return {
    restaurant: {
      organizationId: org.id,
      name: org.name,
      slug: org.public_menu_slug || "",
      taxRate: org.tax_rate == null ? DEFAULT_TAX_RATE : toNumber(org.tax_rate),
      currency: org.default_currency || products[0]?.currency || DEFAULT_CURRENCY,
      promoPercent,
    },
    products,
    categories,
  };
};

export const formatRemovedIngredientsNote = (removedNames: string[]) => {
  const names = removedNames.map((name) => name.trim()).filter(Boolean);
  if (!names.length) return "";
  return `Sin: ${names.join(", ")}`;
};
