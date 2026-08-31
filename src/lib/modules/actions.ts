"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MODULE_KEYS, normalizeModules, type OrganizationModules } from "@/lib/modules/constants";
import { saveOrganizationModules } from "@/lib/modules/settings";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const saveModulesSchema = z.object({
  funnels: z.boolean(),
  calendar: z.boolean(),
  catalog: z.boolean(),
  orders: z.boolean(),
  kitchen: z.boolean(),
  listings: z.boolean(),
});

type ActionResult = {
  success?: string;
  error?: string;
  modules?: OrganizationModules;
};

export const saveOrganizationModulesAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = saveModulesSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "La configuración de módulos no es válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden cambiar las funciones del CRM." };
  }

  const supabase = await createSupabaseServerClient();
  const { error, modules } = await saveOrganizationModules(
    supabase,
    membership.organizationId,
    normalizeModules(parsed.data),
  );

  if (error) {
    return {
      error:
        "No se pudieron guardar los módulos. ¿Corriste el SQL de supabase/commerce-upgrade.sql y supabase/listings-upgrade.sql?",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/inventory");
  revalidatePath("/orders");
  revalidatePath("/funnels");
  revalidatePath("/calendar");
  revalidatePath("/listings");
  revalidatePath("/onboarding/setup");
  revalidatePath("/home");
  for (const key of MODULE_KEYS) {
    revalidatePath(`/${key}`);
  }

  return { success: "Funciones del CRM actualizadas.", modules };
};
