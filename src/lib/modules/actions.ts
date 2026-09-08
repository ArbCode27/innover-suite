"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadAgentSettings, upsertAgentSettings } from "@/lib/agent/settings";
import {
  BUSINESS_TEMPLATE_IDS,
  MODULE_KEYS,
  normalizeModules,
  type OrganizationModules,
} from "@/lib/modules/constants";
import { saveOrganizationModules } from "@/lib/modules/settings";
import { hasOrganizationRole, loadCurrentMemberSession } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const saveModulesSchema = z.object({
  funnels: z.boolean(),
  calendar: z.boolean(),
  catalog: z.boolean(),
  orders: z.boolean(),
  kitchen: z.boolean(),
  listings: z.boolean(),
  templateId: z.enum(BUSINESS_TEMPLATE_IDS).optional(),
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

  const { membership, user } = await loadCurrentMemberSession();
  if (!membership || !user || !hasOrganizationRole(membership, ["owner", "admin"])) {
    return { error: "Solo owner o admin pueden cambiar las funciones del CRM." };
  }

  const supabase = await createSupabaseServerClient();
  const modules = normalizeModules(parsed.data);
  const { error, modules: saved } = await saveOrganizationModules(
    supabase,
    membership.organizationId,
    modules,
  );

  if (error) {
    return {
      error:
        "No se pudieron guardar los módulos. ¿Corriste el SQL de supabase/commerce-upgrade.sql y supabase/listings-upgrade.sql?",
    };
  }

  const templateId =
    parsed.data.templateId ??
    (modules.kitchen && !modules.funnels ? ("restaurant" as const) : undefined);

  if (templateId) {
    const { error: templateError } = await supabase
      .from("organizations")
      .update({ business_template: templateId })
      .eq("id", membership.organizationId);

    if (templateError && !/business_template/i.test(templateError.message)) {
      console.error("[MODULES] business_template update failed", templateError);
    }

    if (templateId === "restaurant") {
      const settings = await loadAgentSettings(membership.organizationId);
      await upsertAgentSettings(membership.organizationId, user.id, {
        ...settings,
        toolsFunnel: false,
        toolsCalendar: false,
      });
    }
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

  return { success: "Funciones del CRM actualizadas.", modules: saved };
};
