import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CURRENCY } from "@/lib/organizations/currencies";
import { DEFAULT_TAX_RATE, isProductKind, toNumber } from "@/lib/commerce/types";
import {
  LISTING_OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  type ListingOperation,
  type PropertyType,
} from "@/lib/listings/types";
import { loadOrganizationModules } from "@/lib/modules/settings";
import type {
  CatalogItem,
  MenuIngredient,
  MenuProduct,
  PublicCatalogPayload,
  PublicSurface,
} from "@/lib/menu/types";
import { parseStoredIngredients } from "@/lib/menu/crm-types";
import { parsePaletteId } from "@/lib/theme/palettes";
import { isMenuType, MENU_TYPE_LABELS } from "@/lib/commerce/types";

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const buildPublicMenuSlug = (organizationName: string, organizationId: number) => {
  const base = slugify(organizationName) || "catalogo";
  return `${base}-${organizationId}`;
};

type OrgRow = {
  id: number;
  name: string;
  public_menu_slug: string | null;
  public_menu_enabled?: boolean | null;
  public_catalog_enabled?: boolean | null;
  business_template: string | null;
  tax_rate: number | string | null;
  default_currency?: string | null;
  logo_url?: string | null;
  theme_palette?: string | null;
};

type ProductRow = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  kind?: string | null;
  menu_type?: string | null;
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

type ListingRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  property_type: string | null;
  operation: string | null;
  status: string;
  zone: string | null;
  neighborhood: string | null;
  city: string | null;
  area_m2: number | string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  price: number | string | null;
  currency: string | null;
  listing_media:
    | Array<{ url?: string | null; kind?: string | null; sort_index?: number | null }>
    | null;
};

const asSingle = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const resolveMenuIngredients = (
  ingredients: unknown,
  itemId: number,
): MenuIngredient[] =>
  parseStoredIngredients(ingredients).map((ingredient, index) => ({
    id: `mi-${itemId}-${index}`,
    name: ingredient.name,
    removable: true,
    imageUrl: ingredient.imageUrl,
  }));

const resolveIngredients = (row: ProductRow): MenuIngredient[] => {
  const fromColumn = (row.menu_ingredients ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name, index) => ({
      id: `mi-${row.id}-${index}`,
      name,
      removable: true,
      imageUrl: null as string | null,
    }));

  if (fromColumn.length) return fromColumn;

  const fromRecipes: MenuIngredient[] = [];
  for (const recipe of row.product_recipes ?? []) {
    const item = asSingle(recipe.inventory_items);
    if (!item?.name?.trim()) continue;
    fromRecipes.push({
      id: `pr-${item.id}`,
      name: item.name.trim(),
      removable: true,
      imageUrl: null,
    });
  }
  return fromRecipes;
};

const listingCover = (row: ListingRow) => {
  const media = [...(row.listing_media ?? [])].sort(
    (a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0),
  );
  const image = media.find((item) => item.kind === "image" && item.url?.trim()) ?? media[0];
  return image?.url?.trim() || null;
};

const listingMeta = (row: ListingRow) => {
  const parts: string[] = [];
  const propertyType = row.property_type as PropertyType | null;
  const operation = row.operation as ListingOperation | null;
  if (propertyType && propertyType in PROPERTY_TYPE_LABELS) {
    parts.push(PROPERTY_TYPE_LABELS[propertyType]);
  }
  if (operation && operation in LISTING_OPERATION_LABELS) {
    parts.push(LISTING_OPERATION_LABELS[operation]);
  }
  if (row.bedrooms != null) parts.push(`${toNumber(row.bedrooms)} hab`);
  if (row.bathrooms != null) parts.push(`${toNumber(row.bathrooms)} baños`);
  if (row.area_m2 != null) parts.push(`${toNumber(row.area_m2)} m²`);
  const place = [row.neighborhood, row.zone, row.city].filter(Boolean).join(", ");
  if (place) parts.push(place);
  return parts.join(" · ") || null;
};

const ORG_SELECT_FULL =
  "id, name, public_menu_slug, public_menu_enabled, public_catalog_enabled, business_template, tax_rate, default_currency, logo_url, theme_palette";
const ORG_SELECT_MID =
  "id, name, public_menu_slug, public_menu_enabled, public_catalog_enabled, business_template, tax_rate, default_currency";
const ORG_SELECT_LEGACY =
  "id, name, public_menu_slug, public_menu_enabled, business_template, tax_rate, default_currency";
const ORG_SELECT_BASIC =
  "id, name, public_menu_slug, public_menu_enabled, business_template, tax_rate";

const isSurfaceEnabled = (org: OrgRow, surface: PublicSurface) => {
  if (surface === "menu") return Boolean(org.public_menu_enabled);
  // Legacy DBs without public_catalog_enabled: fall back to menu flag so links keep working until SQL runs.
  if (org.public_catalog_enabled == null) return Boolean(org.public_menu_enabled);
  return Boolean(org.public_catalog_enabled);
};

export const loadPublicSurfaceBySlug = async (
  slug: string,
  surface: PublicSurface,
): Promise<PublicCatalogPayload | null> => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = getSupabaseAdminClient();
  const attempts = [ORG_SELECT_FULL, ORG_SELECT_MID, ORG_SELECT_LEGACY, ORG_SELECT_BASIC];

  let org: OrgRow | null = null;
  for (const select of attempts) {
    const { data, error } = await admin
      .from("organizations")
      .select(select)
      .eq("public_menu_slug", normalized)
      .maybeSingle();
    if (!error && data && typeof data === "object" && "id" in data) {
      org = data as unknown as OrgRow;
      break;
    }
  }

  if (!org || !isSurfaceEnabled(org, surface)) return null;
  return assembleCatalog(admin, org, surface);
};

/** @deprecated Prefer loadPublicSurfaceBySlug(slug, "menu") */
export const loadPublicMenuBySlug = async (slug: string): Promise<PublicCatalogPayload | null> =>
  loadPublicSurfaceBySlug(slug, "menu");

const assembleCatalog = async (
  admin: ReturnType<typeof getSupabaseAdminClient>,
  org: OrgRow,
  surface: PublicSurface,
): Promise<PublicCatalogPayload | null> => {
  const modules = await loadOrganizationModules(admin, org.id);
  const canLoadProducts = modules.catalog;
  const canLoadListings = surface === "catalog" && modules.listings;
  const canOrder = modules.catalog && modules.orders;

  if (surface === "menu" && !canLoadProducts) return null;
  if (surface === "catalog" && !canLoadProducts && !canLoadListings) return null;

  const items: CatalogItem[] = [];
  let promoPercent = 0;

  const { data: promoRows } = await admin
    .from("promotions")
    .select("discount_percent")
    .eq("organization_id", org.id)
    .eq("active", true);

  promoPercent = Math.max(0, ...(promoRows ?? []).map((row) => toNumber(row.discount_percent)));

  if (surface === "menu" && canLoadProducts) {
    const { data: menuRows, error: menuError } = await admin
      .from("menu_items")
      .select(
        "id, name, description, category, item_type, price, currency, active, is_featured, sort_order, image_url, ingredients",
      )
      .eq("organization_id", org.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (menuError) {
      console.error("[PUBLIC_SURFACE] menu_items load failed", menuError);
    } else {
      for (const row of menuRows ?? []) {
        const price = toNumber(row.price);
        const menuType = isMenuType(row.item_type) ? row.item_type : "dish";
        items.push({
          id: `menu:${row.id}`,
          sourceId: row.id as number,
          source: "menu_item",
          kind: "food",
          menuType,
          title: row.name as string,
          description: (row.description as string | null) ?? null,
          category: typeof row.category === "string" ? row.category.trim() || null : null,
          price,
          currency: (row.currency as string) || org.default_currency || DEFAULT_CURRENCY,
          imageUrl:
            typeof row.image_url === "string" && row.image_url.trim() ? row.image_url.trim() : null,
          available: true,
          availableQty: null,
          ingredients: resolveMenuIngredients(row.ingredients, row.id as number),
          promoPrice:
            promoPercent > 0
              ? Math.max(0, Math.round(price * (1 - promoPercent / 100) * 100) / 100)
              : null,
          metaLabel: MENU_TYPE_LABELS[menuType],
          actionable: canOrder ? "order" : "inquire",
          isFeatured: Boolean(row.is_featured),
        });
      }
    }
  }

  if (surface === "catalog" && canLoadProducts) {
    const withRecipes = await admin
      .from("products")
      .select(
        "id, name, description, category, kind, menu_type, price, currency, active, track_stock, image_url, menu_ingredients, inventory_items!inventory_item_id(on_hand), product_recipes(quantity, inventory_items(id, name))",
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
          "id, name, description, category, kind, price, currency, active, track_stock, image_url, inventory_items!inventory_item_id(on_hand)",
        )
        .eq("organization_id", org.id)
        .eq("active", true)
        .order("name", { ascending: true });
      if (basic.error) {
        console.error("[PUBLIC_SURFACE] products load failed", basic.error);
      } else {
        rows = (basic.data ?? []).map((row) => ({
          ...(row as ProductRow),
          menu_ingredients: [],
          product_recipes: [],
        }));
      }
    }

    for (const row of rows) {
      const kind = isProductKind(row.kind) ? row.kind : "physical";
      if (kind === "food") continue;

      const inventory = asSingle(row.inventory_items);
      const onHand = inventory?.on_hand == null ? null : toNumber(inventory.on_hand);
      const price = toNumber(row.price);
      const available = !row.track_stock || onHand == null ? true : onHand > 0;
      items.push({
        id: `product:${row.id}`,
        sourceId: row.id,
        source: "product",
        kind,
        menuType: null,
        title: row.name,
        description: row.description,
        category: row.category?.trim() || null,
        price,
        currency: row.currency || org.default_currency || DEFAULT_CURRENCY,
        imageUrl: row.image_url?.trim() || null,
        available,
        availableQty: onHand,
        ingredients: [],
        promoPrice:
          promoPercent > 0 ? Math.max(0, Math.round(price * (1 - promoPercent / 100) * 100) / 100) : null,
        metaLabel: kind === "service" ? "Servicio" : "Producto",
        actionable: canOrder ? "order" : "inquire",
      });
    }
  }

  if (canLoadListings) {
    const { data: listingRows, error: listingError } = await admin
      .from("listings")
      .select(
        "id, code, title, description, property_type, operation, status, zone, neighborhood, city, area_m2, bedrooms, bathrooms, price, currency, listing_media(url, kind, sort_index)",
      )
      .eq("organization_id", org.id)
      .in("status", ["available", "reserved"])
      .order("updated_at", { ascending: false });

    if (listingError) {
      console.error("[PUBLIC_SURFACE] listings load failed", listingError);
    } else {
      for (const row of (listingRows ?? []) as ListingRow[]) {
        const price = row.price == null ? null : toNumber(row.price);
        items.push({
          id: `listing:${row.id}`,
          sourceId: row.id,
          source: "listing",
          kind: "property",
          title: row.title,
          description: row.description,
          category: "Inmuebles",
          price,
          currency: row.currency || org.default_currency || DEFAULT_CURRENCY,
          imageUrl: listingCover(row),
          available: row.status === "available",
          availableQty: null,
          ingredients: [],
          promoPrice: null,
          metaLabel: listingMeta(row),
          actionable: "inquire",
        });
      }
    }
  }

  const currency =
    org.default_currency ||
    items.find((item) => item.currency)?.currency ||
    DEFAULT_CURRENCY;

  const organization = {
    organizationId: org.id,
    name: org.name,
    slug: org.public_menu_slug || "",
    taxRate: org.tax_rate == null ? DEFAULT_TAX_RATE : toNumber(org.tax_rate),
    currency,
    promoPercent,
    canOrder,
    logoUrl: typeof org.logo_url === "string" && org.logo_url.trim() ? org.logo_url.trim() : null,
    themePalette: parsePaletteId(org.theme_palette),
    surface,
    modules: {
      catalog: modules.catalog,
      orders: modules.orders,
      kitchen: modules.kitchen,
      listings: modules.listings,
    },
  };

  if (surface === "catalog") {
    organization.canOrder = canOrder && items.some((item) => item.source === "product");
  } else {
    organization.canOrder = canOrder;
  }

  const filters: Array<{ id: string; label: string }> = [{ id: "all", label: "Todos" }];
  if (surface === "menu") {
    for (const type of ["dish", "drink", "dessert", "side", "combo", "promo"] as const) {
      if (items.some((item) => item.menuType === type)) {
        filters.push({ id: type, label: MENU_TYPE_LABELS[type] });
      }
    }
  } else {
    if (items.some((item) => item.kind === "physical")) filters.push({ id: "physical", label: "Productos" });
    if (items.some((item) => item.kind === "service")) filters.push({ id: "service", label: "Servicios" });
    if (items.some((item) => item.kind === "property")) filters.push({ id: "property", label: "Inmuebles" });
  }

  const categories = [
    ...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value))),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const products: MenuProduct[] = items
    .filter((item) => item.source === "menu_item" || item.source === "product")
    .map((item) => ({
      id: item.sourceId,
      name: item.title,
      description: item.description,
      category: item.category,
      price: item.price ?? 0,
      currency: item.currency,
      imageUrl: item.imageUrl,
      available: item.available,
      availableQty: item.availableQty,
      ingredients: item.ingredients,
      promoPrice: item.promoPrice,
    }));

  return {
    organization,
    restaurant: organization,
    items,
    products,
    categories,
    filters,
    surface,
  };
};
