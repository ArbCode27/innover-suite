"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import { nextListingCode } from "@/lib/listings/board";
import { listingSchema } from "@/lib/listings/schema";
import { LISTING_MEDIA_KINDS } from "@/lib/listings/types";
import { readCatalogImageFile } from "@/lib/media/image-upload";
import { LISTING_IMAGES_BUCKET } from "@/lib/media/types";
import { buildListingImagePath, removeStoredMedia, uploadPublicMedia } from "@/lib/media/storage";
import { canManageListings, getCurrentMembership } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies, resolveOrganizationCurrency } from "@/lib/organizations/currencies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/validation/zod-es";

type ActionResult = {
  success?: string;
  error?: string;
  listingId?: number;
};

const requireListingManager = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !canManageListings(membership)) {
    return { error: "No tienes permisos para gestionar inmuebles." } as const;
  }
  return { membership } as const;
};

const emptyToNull = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const upsertListingAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = listingSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa los datos del inmueble.") };
  }

  const access = await requireListingManager();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return sessionExpiredResult();

  if (parsed.data.ownerContactId) {
    const { data: owner } = await supabase
      .from("contacts")
      .select("id")
      .eq("id", parsed.data.ownerContactId)
      .eq("organization_id", access.membership.organizationId)
      .maybeSingle();
    if (!owner?.id) {
      return { error: "El propietario no pertenece a tu organización." };
    }
  }

  const currencies = await loadOrganizationCurrencies(supabase, access.membership.organizationId);
  const currency = parsed.data.price
    ? resolveOrganizationCurrency(parsed.data.currency, currencies)
    : currencies.defaultCode;
  const code = parsed.data.code?.trim() || (await nextListingCode(supabase, access.membership.organizationId));

  const payload = {
    organization_id: access.membership.organizationId,
    code,
    title: parsed.data.title,
    description: emptyToNull(parsed.data.description),
    property_type: parsed.data.propertyType,
    operation: parsed.data.operation,
    status: parsed.data.status,
    zone: emptyToNull(parsed.data.zone),
    neighborhood: emptyToNull(parsed.data.neighborhood),
    city: emptyToNull(parsed.data.city),
    area_m2: parsed.data.areaM2 ?? null,
    bedrooms: parsed.data.bedrooms ?? null,
    bathrooms: parsed.data.bathrooms ?? null,
    parking: parsed.data.parking ?? null,
    year_built: parsed.data.yearBuilt ?? null,
    price: parsed.data.price ?? null,
    currency,
    amenities: parsed.data.amenities ?? [],
    owner_contact_id: parsed.data.ownerContactId ?? null,
    exclusive: parsed.data.exclusive ?? false,
    video_url: emptyToNull(parsed.data.videoUrl),
    tour_url: emptyToNull(parsed.data.tourUrl),
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("listings")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("organization_id", access.membership.organizationId);

    if (error) {
      if (error.message.toLowerCase().includes("listings")) {
        return { error: "No se pudo guardar. ¿Corriste el SQL de supabase/listings-upgrade.sql?" };
      }
      if (error.code === "23505") {
        return { error: "Ya existe un inmueble con ese código interno." };
      }
      return { error: error.message || "No se pudo actualizar el inmueble." };
    }

    revalidatePath("/listings");
    revalidatePath(`/listings/${parsed.data.id}`);
    return { success: "Inmueble actualizado.", listingId: parsed.data.id };
  }

  const { data, error } = await supabase.from("listings").insert(payload).select("id").single();

  if (error || !data?.id) {
    if (error?.message.toLowerCase().includes("listings")) {
      return { error: "No se pudo crear. ¿Corriste el SQL de supabase/listings-upgrade.sql?" };
    }
    if (error?.code === "23505") {
      return { error: "Ya existe un inmueble con ese código interno." };
    }
    return { error: error?.message || "No se pudo crear el inmueble." };
  }

  revalidatePath("/listings");
  revalidatePath("/onboarding/setup");
  return { success: "Inmueble creado.", listingId: data.id as number };
};

export const addListingMediaAction = async (formData: FormData): Promise<ActionResult> => {
  const listingId = Number(formData.get("listingId"));
  const kindParsed = z.enum(LISTING_MEDIA_KINDS).safeParse(formData.get("kind") || "image");
  if (!Number.isInteger(listingId) || listingId <= 0 || !kindParsed.success) {
    return { error: "La foto no es válida." };
  }

  const access = await requireListingManager();
  if ("error" in access) return { error: access.error };

  const uploaded = await readCatalogImageFile(formData.get("image"));
  if ("error" in uploaded) return { error: uploaded.error };
  if (!uploaded.file) return { error: "Selecciona una imagen JPG, PNG o WebP." };

  const supabase = await createSupabaseServerClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (!listing?.id) return { error: "El inmueble no existe." };

  const { data: last } = await supabase
    .from("listing_media")
    .select("sort_index")
    .eq("listing_id", listingId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const path = buildListingImagePath({
    organizationId: access.membership.organizationId,
    listingId,
    fileName: uploaded.file.fileName,
  });

  try {
    const url = await uploadPublicMedia({
      bucket: LISTING_IMAGES_BUCKET,
      path,
      bytes: uploaded.file.bytes,
      mimeType: uploaded.file.mimeType,
    });

    const { error } = await supabase.from("listing_media").insert({
      organization_id: access.membership.organizationId,
      listing_id: listingId,
      kind: kindParsed.data,
      url,
      path,
      mime: uploaded.file.mimeType,
      sort_index: typeof last?.sort_index === "number" ? last.sort_index + 1 : 0,
    });

    if (error) {
      await removeStoredMedia({ bucket: LISTING_IMAGES_BUCKET, path });
      return { error: error.message || "No se pudo guardar la imagen." };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo subir la imagen." };
  }

  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  return { success: "Imagen agregada." };
};

export const removeListingMediaAction = async (mediaId: number): Promise<ActionResult> => {
  if (!Number.isInteger(mediaId) || mediaId <= 0) {
    return { error: "La imagen no es válida." };
  }

  const access = await requireListingManager();
  if ("error" in access) return { error: access.error };

  const supabase = await createSupabaseServerClient();
  const { data: media } = await supabase
    .from("listing_media")
    .select("id, listing_id, path")
    .eq("id", mediaId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (!media?.id) return { error: "La imagen no existe." };

  const { error } = await supabase
    .from("listing_media")
    .delete()
    .eq("id", mediaId)
    .eq("organization_id", access.membership.organizationId);

  if (error) return { error: error.message || "No se pudo eliminar la imagen." };

  if (typeof media.path === "string" && media.path) {
    await removeStoredMedia({ bucket: LISTING_IMAGES_BUCKET, path: media.path });
  }

  revalidatePath("/listings");
  revalidatePath(`/listings/${media.listing_id}`);
  return { success: "Imagen eliminada." };
};
