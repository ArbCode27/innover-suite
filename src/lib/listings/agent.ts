import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  formatListingLocation,
  formatListingPrice,
  formatListingSummary,
  isListingOperation,
  isListingStatus,
  isPropertyType,
  toListingNumber,
  type ListingOperation,
  type ListingStatus,
  type PropertyType,
} from "@/lib/listings/types";
import { DEFAULT_CURRENCY } from "@/lib/organizations/currencies";

const LISTINGS_CONTEXT_LIMIT = 40;
const SEARCH_LIMIT = 12;

type AgentListingRow = {
  id: number;
  code: string;
  title: string;
  property_type: string;
  operation: string;
  status: string;
  zone: string | null;
  neighborhood: string | null;
  city: string | null;
  area_m2: unknown;
  bedrooms: number | null;
  bathrooms: number | null;
  price: unknown;
  currency: string | null;
  listing_media?: Array<{ url?: string | null; kind?: string | null; sort_index?: number }> | null;
};

export type AgentListingSummary = {
  id: number;
  code: string;
  title: string;
  propertyType: PropertyType;
  operation: ListingOperation;
  status: ListingStatus;
  city: string | null;
  zone: string | null;
  neighborhood: string | null;
  areaM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  currency: string;
  coverUrl: string | null;
};

export type SearchListingsInput = {
  query?: string;
  operation?: ListingOperation;
  city?: string;
  bedrooms?: number;
  maxPrice?: number;
  status?: ListingStatus;
};

const mapAgentListing = (row: AgentListingRow): AgentListingSummary => {
  const media = [...(row.listing_media ?? [])].sort(
    (left, right) => (left.sort_index ?? 0) - (right.sort_index ?? 0),
  );
  const coverUrl = media.find((item) => item.kind === "image" && item.url)?.url?.trim() || media[0]?.url?.trim() || null;

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    propertyType: isPropertyType(row.property_type) ? row.property_type : "apartment",
    operation: isListingOperation(row.operation) ? row.operation : "sale",
    status: isListingStatus(row.status) ? row.status : "available",
    city: row.city,
    zone: row.zone,
    neighborhood: row.neighborhood,
    areaM2: toListingNumber(row.area_m2),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    price: toListingNumber(row.price),
    currency: row.currency || DEFAULT_CURRENCY,
    coverUrl,
  };
};

const formatListingLine = (listing: AgentListingSummary) => {
  const location = formatListingLocation(listing);
  const specs = formatListingSummary(listing);
  const photo = listing.coverUrl ? " [foto]" : "";
  return `- [listingId:${listing.id}] ${listing.code} ${listing.title} — ${listing.operation} · ${formatListingPrice(listing)} · ${location}${specs ? ` · ${specs}` : ""} · ${listing.status}${photo}`;
};

const listingSelect =
  "id, code, title, property_type, operation, status, zone, neighborhood, city, area_m2, bedrooms, bathrooms, price, currency, listing_media(url, kind, sort_index)";

export const loadAgentListingsSnapshot = async (organizationId: number): Promise<AgentListingSummary[]> => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("listings")
    .select(listingSelect)
    .eq("organization_id", organizationId)
    .neq("status", "paused")
    .order("updated_at", { ascending: false })
    .limit(LISTINGS_CONTEXT_LIMIT);

  if (error) {
    return [];
  }

  return ((data ?? []) as AgentListingRow[]).map(mapAgentListing);
};

export const formatListingsContext = (listings: AgentListingSummary[]) => {
  if (!listings.length) {
    return `Inmuebles (usa listingId; no inventes disponibilidad ni precios):
- (sin fichas cargadas)`;
  }

  return `Inmuebles (usa listingId; no inventes disponibilidad ni precios. reserved/sold/rented no están disponibles):
${listings.map(formatListingLine).join("\n")}
Fotos: si el inmueble tiene [foto], llama send_listing con ese listingId (máximo un inmueble y una foto por respuesta). Luego escribe el mensaje en texto.`;
};

export const searchListingsForAgent = async (organizationId: number, filters: SearchListingsInput) => {
  const admin = getSupabaseAdminClient();
  let request = admin
    .from("listings")
    .select(listingSelect)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(SEARCH_LIMIT);

  if (filters.status) {
    request = request.eq("status", filters.status);
  } else {
    request = request.in("status", ["available", "reserved"]);
  }
  if (filters.operation) {
    request = request.in("operation", [filters.operation, "both"]);
  }
  if (filters.city?.trim()) {
    request = request.ilike("city", `%${filters.city.trim().replaceAll("%", "")}%`);
  }
  if (filters.bedrooms != null) {
    request = request.gte("bedrooms", filters.bedrooms);
  }
  if (filters.maxPrice != null) {
    request = request.lte("price", filters.maxPrice);
  }

  const query = filters.query?.trim();
  if (query) {
    const like = `%${query.replaceAll("%", "")}%`;
    request = request.or(
      `title.ilike.${like},code.ilike.${like},city.ilike.${like},zone.ilike.${like},neighborhood.ilike.${like},description.ilike.${like}`,
    );
  }

  const { data, error } = await request;
  if (error) {
    return { ok: false as const, error: error.message || "No se pudieron buscar inmuebles." };
  }

  return {
    ok: true as const,
    listings: ((data ?? []) as AgentListingRow[]).map(mapAgentListing),
  };
};

export const loadListingForAgent = async (organizationId: number, listingId: number) => {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("listings")
    .select(listingSelect)
    .eq("organization_id", organizationId)
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapAgentListing(data as AgentListingRow);
};

export const formatListingForAgent = (listing: AgentListingSummary) => ({
  listingId: listing.id,
  code: listing.code,
  title: listing.title,
  status: listing.status,
  available: listing.status === "available",
  operation: listing.operation,
  price: formatListingPrice(listing),
  location: formatListingLocation(listing),
  summary: formatListingSummary(listing),
  hasPhoto: Boolean(listing.coverUrl),
});
