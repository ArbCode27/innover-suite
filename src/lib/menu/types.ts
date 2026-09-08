import type { FulfillmentType } from "@/lib/commerce/types";

export type MenuIngredient = {
  id: string;
  name: string;
  removable: boolean;
};

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

export type PublicMenuRestaurant = {
  organizationId: number;
  name: string;
  slug: string;
  taxRate: number;
  currency: string;
  promoPercent: number;
};

export type PublicMenuPayload = {
  restaurant: PublicMenuRestaurant;
  products: MenuProduct[];
  categories: string[];
};

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
