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
} from "@/lib/menu/types";

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
  kind?: string | null;
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

  const fromRecipes: MenuIngredient[] = [];
  for (const recipe of row.product_recipes ?? []) {
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

export const loadPublicMenuBySlug = async (slug: string): Promise<PublicCatalogPayload | null> => {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const admin = getSupabaseAdminClient();
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name, public_menu_slug, public_menu_enabled, business_template, tax_rate, default_currency")
    .eq("public_menu_slug", normalized)
    .eq("public_menu_enabled", true)
    .maybeSingle();

  if (orgError) {
    const fallback = await admin
      .from("organizations")
      .select("id, name, public_menu_slug, public_menu_enabled, business_template, tax_rate")
      .eq("public_menu_slug", normalized)
      .eq("public_menu_enabled", true)
      .maybeSingle();
    if (fallback.error || !fallback.data) return null;
    return assembleCatalog(admin, fallback.data as OrgRow);
  }

  if (!org) return null;
  return assembleCatalog(admin, org as OrgRow);
};

const assembleCatalog = async (
  admin: ReturnType<typeof getSupabaseAdminClient>,
  org: OrgRow,
): Promise<PublicCatalogPayload | null> => {
  const modules = await loadOrganizationModules(admin, org.id);
  const canLoadProducts = modules.catalog;
  const canLoadListings = modules.listings;
  const canOrder = modules.catalog && modules.orders;

  if (!canLoadProducts && !canLoadListings) {
    return null;
  }

  const items: CatalogItem[] = [];
  let promoPercent = 0;

  if (canLoadProducts) {
    const withRecipes = await admin
      .from("products")
      .select(
        "id, name, description, category, kind, price, currency, active, track_stock, image_url, menu_ingredients, inventory_items!inventory_item_id(on_hand), product_recipes(quantity, inventory_items(id, name))",
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
        console.error("[PUBLIC_CATALOG] products load failed", basic.error);
      } else {
        rows = (basic.data ?? []).map((row) => ({
          ...(row as ProductRow),
          menu_ingredients: [],
          product_recipes: [],
        }));
      }
    }

    const { data: promoRows } = await admin
      .from("promotions")
      .select("discount_percent")
      .eq("organization_id", org.id)
      .eq("active", true);

    promoPercent = Math.max(0, ...(promoRows ?? []).map((row) => toNumber(row.discount_percent)));

    for (const row of rows) {
      const inventory = asSingle(row.inventory_items);
      const onHand = inventory?.on_hand == null ? null : toNumber(inventory.on_hand);
      const price = toNumber(row.price);
      const kind = isProductKind(row.kind) ? row.kind : "physical";
      const available = !row.track_stock || onHand == null ? true : onHand > 0;
      items.push({
        id: `product:${row.id}`,
        sourceId: row.id,
        source: "product",
        kind,
        title: row.name,
        description: row.description,
        category: row.category?.trim() || null,
        price,
        currency: row.currency || org.default_currency || DEFAULT_CURRENCY,
        imageUrl: row.image_url?.trim() || null,
        available,
        availableQty: onHand,
        ingredients: kind === "food" ? resolveIngredients(row) : [],
        promoPrice:
          promoPercent > 0 ? Math.max(0, Math.round(price * (1 - promoPercent / 100) * 100) / 100) : null,
        metaLabel: kind === "food" ? "Plato" : kind === "service" ? "Servicio" : "Producto",
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
      console.error("[PUBLIC_CATALOG] listings load failed", listingError);
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
    modules: {
      catalog: modules.catalog,
      orders: modules.orders,
      kitchen: modules.kitchen,
      listings: modules.listings,
    },
  };

  const filters: Array<{ id: string; label: string }> = [{ id: "all", label: "Todos" }];
  if (items.some((item) => item.kind === "food")) filters.push({ id: "food", label: "Platos" });
  if (items.some((item) => item.kind === "physical")) filters.push({ id: "physical", label: "Productos" });
  if (items.some((item) => item.kind === "service")) filters.push({ id: "service", label: "Servicios" });
  if (items.some((item) => item.kind === "property")) filters.push({ id: "property", label: "Inmuebles" });

  const categories = [
    ...new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value))),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const products: MenuProduct[] = items
    .filter((item) => item.source === "product")
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
  };
};

export const formatRemovedIngredientsNote = (removedNames: string[]) => {
  const names = removedNames.map((name) => name.trim()).filter(Boolean);
  if (!names.length) return "";
  return `Sin: ${names.join(", ")}`;
};
