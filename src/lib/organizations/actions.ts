"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRequestOrigin } from "@/lib/auth/origin";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import { readCatalogImageFile } from "@/lib/media/image-upload";
import {
  buildOrganizationLogoPath,
  removeOrganizationLogo,
  uploadPublicMedia,
} from "@/lib/media/storage";
import { ORGANIZATION_IMAGES_BUCKET } from "@/lib/media/types";
import { recordAuditEvent } from "@/lib/organizations/audit";
import { applyBusinessProfile } from "@/lib/organizations/business-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentMembership,
  hasOrganizationRole,
  loadMembershipForUser,
  type OrganizationRole,
} from "@/lib/organizations/membership";
import { createOrganizationSchema } from "@/lib/organizations/schema";
import { normalizeCurrencySettings } from "@/lib/organizations/currencies";
import { zodErrorMessage } from "@/lib/validation/zod-es";

const inviteAdvisorSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  role: z.enum(["admin", "agent", "viewer", "kitchen", "cashier"]),
});

export const createOrganizationAction = async (rawValues: unknown) => {
  const parsed = createOrganizationSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa los datos de la organización.") };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sessionExpiredResult();
  }

  const { error } = await supabase.rpc("create_organization_for_current_user", {
    org_name: parsed.data.name,
  });

  if (error) {
    return { error: error.message || "No se pudo crear la organización" };
  }

  const membership = await loadMembershipForUser(supabase, user.id);
  if (membership) {
    try {
      await applyBusinessProfile({
        supabase,
        organizationId: membership.organizationId,
        userId: user.id,
        templateId: parsed.data.templateId,
        currency: parsed.data.currency.toUpperCase(),
        taxRate: parsed.data.taxRate,
      });
      await recordAuditEvent({
        organizationId: membership.organizationId,
        actorUserId: user.id,
        action: "organization.create",
        entity: "organization",
        payload: { templateId: parsed.data.templateId },
      });
    } catch (profileError) {
      console.error("[ONBOARDING] apply business profile failed", profileError);
    }
  }

  redirect("/onboarding/setup");
};

export const inviteAdvisorAction = async (rawValues: unknown) => {
  const parsed = inviteAdvisorSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa los datos de la organización.") };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "No tienes permisos para invitar asesores." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sessionExpiredResult();
  }

  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("organization_invitations")
    .upsert(
      {
        organization_id: membership.organizationId,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        invited_by_user_id: user.id,
        accepted_at: null,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "organization_id,email" },
    )
    .select("token")
    .maybeSingle();

  if (error) {
    return { error: error.message || "No se pudo guardar la invitación" };
  }

  const inviteToken = (data?.token as string | undefined) || token;
  const inviteUrl = `${await getRequestOrigin()}/invite/${inviteToken}`;
  await recordAuditEvent({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    action: "invite.create",
    entity: "invitation",
    payload: { email: parsed.data.email.toLowerCase(), role: parsed.data.role },
  });
  revalidatePath("/settings");
  revalidatePath("/onboarding/setup");
  return {
    success: "Invitación lista. Copia el enlace y envíalo al asesor.",
    inviteUrl,
  };
};

export const completeOnboardingAction = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    redirect("/home");
  }

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("organizations")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", membership.organizationId);

  revalidatePath("/home");
  revalidatePath("/onboarding/setup");
  redirect("/home");
};

export const updateOrganizationTaxAction = async (rawValues: unknown) => {
  const parsed = z.object({ taxRate: z.number().min(0).max(1) }).safeParse(rawValues);
  if (!parsed.success) {
    return { error: "El IVA debe estar entre 0 y 1 (ej. 0.16)." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden cambiar el IVA." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ tax_rate: parsed.data.taxRate })
    .eq("id", membership.organizationId);

  if (error) {
    return { error: error.message || "No se pudo guardar el IVA." };
  }

  revalidatePath("/settings");
  return { success: "IVA actualizado. Se aplicará en el próximo pedido." };
};

export const updateOrganizationCurrenciesAction = async (rawValues: unknown) => {
  const parsed = z
    .object({
      codes: z.array(z.string()).min(1, "Elige al menos una moneda."),
      defaultCode: z.string().trim().min(3),
    })
    .safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Revisa las monedas seleccionadas.") };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden cambiar las monedas." };
  }

  const settings = normalizeCurrencySettings(parsed.data.codes, parsed.data.defaultCode);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      currencies: settings.codes,
      default_currency: settings.defaultCode,
    })
    .eq("id", membership.organizationId);

  if (error) {
    return {
      error: error.message || "No se pudieron guardar las monedas. ¿Corriste supabase/organization-currencies.sql?",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/funnels");
  revalidatePath("/orders");
  revalidatePath("/home");
  return { success: "Monedas actualizadas." };
};

const brandingSqlHint =
  "¿Corriste supabase/organization-branding.sql?";

export const updateOrganizationLogoAction = async (formData: FormData) => {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden actualizar el logo." };
  }

  const remove = formData.get("remove") === "1";
  const uploaded = await readCatalogImageFile(formData.get("image"));
  if ("error" in uploaded && uploaded.error) {
    return { error: uploaded.error };
  }

  if (!remove && !uploaded.file) {
    return { error: "Selecciona una imagen JPG, PNG o WebP." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: current, error: loadError } = await supabase
    .from("organizations")
    .select("logo_url, logo_path, logo_mime")
    .eq("id", membership.organizationId)
    .maybeSingle();

  if (loadError) {
    return {
      error: loadError.message?.includes("logo_")
        ? `No se pudo leer el logo. ${brandingSqlHint}`
        : loadError.message || "No se pudo leer la organización.",
    };
  }

  const previousPath =
    typeof current?.logo_path === "string" && current.logo_path.trim()
      ? current.logo_path.trim()
      : null;

  let logoUrl: string | null = null;
  let logoPath: string | null = null;
  let logoMime: string | null = null;

  if (uploaded.file) {
    try {
      logoPath = buildOrganizationLogoPath({
        organizationId: membership.organizationId,
        fileName: uploaded.file.fileName,
      });
      logoUrl = await uploadPublicMedia({
        bucket: ORGANIZATION_IMAGES_BUCKET,
        path: logoPath,
        bytes: uploaded.file.bytes,
        mimeType: uploaded.file.mimeType,
      });
      logoMime = uploaded.file.mimeType;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir el logo.";
      return {
        error: /bucket|not found|does not exist/i.test(message)
          ? `No se encontró el bucket organization-images. ${brandingSqlHint}`
          : message,
      };
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      logo_url: logoUrl,
      logo_path: logoPath,
      logo_mime: logoMime,
    })
    .eq("id", membership.organizationId);

  if (error) {
    if (logoPath) {
      await removeOrganizationLogo(logoPath).catch(() => undefined);
    }
    return {
      error: error.message?.includes("logo_")
        ? `No se pudo guardar el logo. ${brandingSqlHint}`
        : error.message || "No se pudo guardar el logo.",
    };
  }

  if (previousPath && previousPath !== logoPath) {
    await removeOrganizationLogo(previousPath).catch(() => undefined);
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/menu", "layout");
  return {
    success: logoUrl ? "Logo actualizado." : "Logo eliminado.",
    logoUrl,
  };
};

export const updateOrganizationPaletteAction = async (rawValues: unknown) => {
  const parsed = z
    .object({
      paletteId: z.enum(["default", "violet", "emerald", "rose", "candy", "amber"]),
    })
    .safeParse(rawValues);

  if (!parsed.success) {
    return { error: "Paleta no válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden guardar la paleta de marca." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({ theme_palette: parsed.data.paletteId })
    .eq("id", membership.organizationId);

  if (error) {
    return {
      error: error.message?.includes("theme_palette")
        ? `No se pudo guardar la paleta. ${brandingSqlHint}`
        : error.message || "No se pudo guardar la paleta.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/menu", "layout");
  return { success: "Paleta de marca guardada." };
};

export type InviteRole = Extract<OrganizationRole, "admin" | "agent" | "viewer" | "kitchen" | "cashier">;
