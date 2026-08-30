import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isListingMediaKind,
  isListingOperation,
  isListingStatus,
  isPropertyType,
  toListingNumber,
  type ListingMedia,
  type ListingOption,
  type ListingRecord,
  type ListingStatus,
} from "@/lib/listings/types";
import { DEFAULT_CURRENCY } from "@/lib/organizations/currencies";

type ListingRow = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  property_type: string;
  operation: string;
  status: string;
  zone: string | null;
  neighborhood: string | null;
  city: string | null;
  area_m2: unknown;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  year_built: number | null;
  price: unknown;
  currency: string | null;
  amenities: string[] | null;
  owner_contact_id: number | null;
  exclusive: boolean;
  video_url: string | null;
  tour_url: string | null;
  updated_at: string;
  contacts?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  listing_media?: MediaRow[] | null;
};

type MediaRow = {
  id: number;
  kind: string;
  url: string;
  path: string | null;
  mime: string | null;
  caption: string | null;
  sort_index: number;
};

const LISTING_SELECT =
  "id, code, title, description, property_type, operation, status, zone, neighborhood, city, area_m2, bedrooms, bathrooms, parking, year_built, price, currency, amenities, owner_contact_id, exclusive, video_url, tour_url, updated_at, contacts(full_name), listing_media(id, kind, url, path, mime, caption, sort_index)";

const mapMedia = (rows: MediaRow[] | null | undefined): ListingMedia[] =>
  (rows ?? [])
    .filter((row): row is MediaRow & { kind: ListingMedia["kind"] } => isListingMediaKind(row.kind) && Boolean(row.url))
    .sort((left, right) => left.sort_index - right.sort_index)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      url: row.url,
      path: row.path,
      mime: row.mime,
      caption: row.caption,
      sortIndex: row.sort_index,
    }));

const ownerNameFrom = (row: ListingRow) => {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  return contact?.full_name?.trim() || null;
};

export const mapListing = (row: ListingRow): ListingRecord => {
  const media = mapMedia(row.listing_media);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    propertyType: isPropertyType(row.property_type) ? row.property_type : "apartment",
    operation: isListingOperation(row.operation) ? row.operation : "sale",
    status: isListingStatus(row.status) ? row.status : "available",
    zone: row.zone,
    neighborhood: row.neighborhood,
    city: row.city,
    areaM2: toListingNumber(row.area_m2),
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    yearBuilt: row.year_built,
    price: toListingNumber(row.price),
    currency: row.currency || DEFAULT_CURRENCY,
    amenities: Array.isArray(row.amenities) ? row.amenities.filter(Boolean) : [],
    ownerContactId: row.owner_contact_id,
    ownerName: ownerNameFrom(row),
    exclusive: row.exclusive === true,
    videoUrl: row.video_url,
    tourUrl: row.tour_url,
    coverUrl: media.find((item) => item.kind === "image")?.url ?? media[0]?.url ?? null,
    media,
    updatedAt: row.updated_at,
  };
};

export type ListingFilters = {
  query?: string;
  status?: ListingStatus | "all";
  operation?: ListingRecord["operation"] | "all";
};

export const loadListings = async (
  supabase: SupabaseClient,
  organizationId: number,
  filters: ListingFilters = {},
): Promise<ListingRecord[]> => {
  let request = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filters.status && filters.status !== "all") {
    request = request.eq("status", filters.status);
  }
  if (filters.operation && filters.operation !== "all") {
    request = request.eq("operation", filters.operation);
  }

  const query = filters.query?.trim();
  if (query) {
    const like = `%${query.replaceAll("%", "")}%`;
    request = request.or(
      `title.ilike.${like},code.ilike.${like},city.ilike.${like},zone.ilike.${like},neighborhood.ilike.${like}`,
    );
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(error.message || "No se pudieron cargar los inmuebles.");
  }

  return ((data ?? []) as ListingRow[]).map(mapListing);
};

export const loadListing = async (
  supabase: SupabaseClient,
  organizationId: number,
  listingId: number,
): Promise<ListingRecord | null> => {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "No se pudo cargar el inmueble.");
  }
  if (!data) return null;
  return mapListing(data as ListingRow);
};

export const loadListingOptions = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<ListingOption[]> => {
  const { data, error } = await supabase
    .from("listings")
    .select("id, code, title, status, city")
    .eq("organization_id", organizationId)
    .neq("status", "paused")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    title: row.title as string,
    code: row.code as string,
    status: isListingStatus(row.status) ? row.status : "available",
    city: (row.city as string | null) ?? null,
  }));
};

export const nextListingCode = async (supabase: SupabaseClient, organizationId: number) => {
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  return `INM-${String((count ?? 0) + 1).padStart(4, "0")}`;
};
