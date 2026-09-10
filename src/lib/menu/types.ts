import type { FulfillmentType } from "@/lib/commerce/types";
import type { OrganizationModules } from "@/lib/modules/constants";

export type MenuIngredient = {
  id: string;
  name: string;
  removable: boolean;
  imageUrl: string | null;
};

export type CatalogItemKind = "food" | "physical" | "service" | "property";

export type CatalogItem = {
  id: string;
  sourceId: number;
  source: "product" | "listing" | "menu_item";
  kind: CatalogItemKind;
  menuType?: string | null;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  available: boolean;
  availableQty: number | null;
  ingredients: MenuIngredient[];
  promoPrice: number | null;
  metaLabel: string | null;
  actionable: "order" | "inquire";
  isFeatured?: boolean;
};

/** @deprecated Prefer CatalogItem — kept for gradual migration */
export type MenuProduct = {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  available: boolean;
  availableQty: number | null;
  ingredients: MenuIngredient[];
  promoPrice: number | null;
};

export type PublicSurface = "menu" | "catalog";

export type PublicCatalogOrg = {
  organizationId: number;
  name: string;
  slug: string;
  taxRate: number;
  currency: string;
  promoPercent: number;
  canOrder: boolean;
  logoUrl: string | null;
  themePalette: string;
  surface: PublicSurface;
  modules: Pick<OrganizationModules, "catalog" | "orders" | "kitchen" | "listings">;
};

export type PublicCatalogPayload = {
  organization: PublicCatalogOrg;
  items: CatalogItem[];
  filters: Array<{ id: string; label: string }>;
  surface: PublicSurface;
  /** @deprecated use organization */
  restaurant: PublicCatalogOrg;
  /** @deprecated use items */
  products: MenuProduct[];
  categories: string[];
};

export type PublicMenuRestaurant = PublicCatalogOrg;
export type PublicMenuPayload = PublicCatalogPayload;

export type CartLine = {
  key: string;
  productId: number;
  name: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  imageUrl: string | null;
  removedIngredientIds: string[];
  removedIngredientNames: string[];
  note: string;
};

export type InterestLine = {
  key: string;
  listingId: number;
  title: string;
  price: number | null;
  currency: string;
  imageUrl: string | null;
  metaLabel: string | null;
};

export type PlaceMenuOrderInput = {
  slug: string;
  customerName: string;
  partySize: number;
  fulfillment: FulfillmentType;
  customerNote?: string;
  items: Array<{
    productId: number;
    quantity: number;
    notes?: string;
  }>;
};
