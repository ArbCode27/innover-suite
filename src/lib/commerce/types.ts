export const PRODUCT_KINDS = ["physical", "food", "service"] as const;
export const ORDER_STATUSES = ["received", "preparing", "ready", "completed", "cancelled"] as const;
export const FULFILLMENT_TYPES = ["pickup", "delivery", "dine_in", "unspecified"] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export type ProductRecord = {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  kind: ProductKind;
  price: number;
  currency: string;
  active: boolean;
  trackStock: boolean;
  inventoryItemId: number | null;
  onHand: number | null;
  reorderPoint: number | null;
};

export type PromotionRecord = {
  id: number;
  name: string;
  description: string | null;
  discountPercent: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type OrderItemRecord = {
  id: number;
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
};

export type OrderRecord = {
  id: number;
  status: OrderStatus;
  fulfillment: FulfillmentType;
  channel: string | null;
  customerNote: string | null;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  contactId: number | null;
  conversationId: number | null;
  contactName: string | null;
  items: OrderItemRecord[];
};

export type InventoryMovementRecord = {
  id: number;
  inventoryItemName: string;
  kind: "sale" | "cancel_restore" | "receive" | "adjust";
  quantity: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  orderId: number | null;
};

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  physical: "Producto",
  food: "Comida / plato",
  service: "Servicio",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Nuevo",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const KITCHEN_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Nuevo",
  preparing: "En cocina",
  ready: "Listo",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  pickup: "Para recoger",
  delivery: "Delivery",
  dine_in: "En el local",
  unspecified: "Sin especificar",
};

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["received", "preparing", "ready"];

export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "preparing",
  preparing: "ready",
  ready: "completed",
};

export const formatMoney = (value: number, currency = "DOP") =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

export const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const isProductKind = (value: unknown): value is ProductKind =>
  typeof value === "string" && PRODUCT_KINDS.includes(value as ProductKind);

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);

export const isFulfillmentType = (value: unknown): value is FulfillmentType =>
  typeof value === "string" && FULFILLMENT_TYPES.includes(value as FulfillmentType);
