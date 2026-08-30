import { DEFAULT_CURRENCY } from "@/lib/organizations/currencies";

export const PROPERTY_TYPES = ["house", "apartment", "commercial", "land", "office", "warehouse"] as const;
export const LISTING_OPERATIONS = ["sale", "rent", "both"] as const;
export const LISTING_STATUSES = ["available", "reserved", "sold", "rented", "paused"] as const;
export const LISTING_MEDIA_KINDS = ["image", "floorplan"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type ListingOperation = (typeof LISTING_OPERATIONS)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ListingMediaKind = (typeof LISTING_MEDIA_KINDS)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: "Casa",
  apartment: "Apartamento",
  commercial: "Local",
  land: "Terreno",
  office: "Oficina",
  warehouse: "Galpón",
};

export const LISTING_OPERATION_LABELS: Record<ListingOperation, string> = {
  sale: "Venta",
  rent: "Alquiler",
  both: "Venta y alquiler",
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
  rented: "Alquilado",
  paused: "Pausado",
};

export type ListingMedia = {
  id: number;
  kind: ListingMediaKind;
  url: string;
  path: string | null;
  mime: string | null;
  caption: string | null;
  sortIndex: number;
};

export type ListingRecord = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  propertyType: PropertyType;
  operation: ListingOperation;
  status: ListingStatus;
  zone: string | null;
  neighborhood: string | null;
  city: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  yearBuilt: number | null;
  price: number | null;
  currency: string;
  amenities: string[];
  ownerContactId: number | null;
  ownerName: string | null;
  exclusive: boolean;
  videoUrl: string | null;
  tourUrl: string | null;
  coverUrl: string | null;
  media: ListingMedia[];
  updatedAt: string;
};

export type ListingOption = {
  id: number;
  title: string;
  code: string;
  status: ListingStatus;
  city: string | null;
};

export const isPropertyType = (value: unknown): value is PropertyType =>
  typeof value === "string" && PROPERTY_TYPES.includes(value as PropertyType);

export const isListingOperation = (value: unknown): value is ListingOperation =>
  typeof value === "string" && LISTING_OPERATIONS.includes(value as ListingOperation);

export const isListingStatus = (value: unknown): value is ListingStatus =>
  typeof value === "string" && LISTING_STATUSES.includes(value as ListingStatus);

export const isListingMediaKind = (value: unknown): value is ListingMediaKind =>
  typeof value === "string" && LISTING_MEDIA_KINDS.includes(value as ListingMediaKind);

export const toListingNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatListingLocation = (listing: Pick<ListingRecord, "zone" | "neighborhood" | "city">) =>
  [listing.neighborhood, listing.zone, listing.city].filter(Boolean).join(" · ") || "Sin ubicación";

export const formatListingPrice = (listing: Pick<ListingRecord, "price" | "currency">) => {
  if (listing.price == null) return "Precio a consultar";
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: listing.currency || DEFAULT_CURRENCY,
    maximumFractionDigits: 0,
  }).format(listing.price);
};

export const formatListingSummary = (listing: Pick<ListingRecord, "bedrooms" | "bathrooms" | "areaM2">) => {
  const specs = [
    listing.bedrooms != null ? `${listing.bedrooms} hab` : null,
    listing.bathrooms != null ? `${listing.bathrooms} baños` : null,
    listing.areaM2 != null ? `${listing.areaM2} m²` : null,
  ].filter(Boolean);
  return specs.join(" · ");
};

export const parseAmenitiesInput = (value: string) =>
  value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);

export const LISTING_STATUS_STYLES: Record<ListingStatus, string> = {
  available: "border-emerald-300/70 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
  reserved: "border-amber-300/70 bg-amber-500/12 text-amber-800 dark:text-amber-200",
  sold: "border-slate-300/70 bg-slate-500/12 text-slate-800 dark:text-slate-200",
  rented: "border-sky-300/70 bg-sky-500/12 text-sky-800 dark:text-sky-200",
  paused: "border-muted bg-muted/60 text-muted-foreground",
};
