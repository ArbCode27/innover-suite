import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultAgentSettings, upsertAgentSettings } from "@/lib/agent/settings";
import { ensureDefaultFunnel } from "@/lib/funnels/board";
import {
  getBusinessTemplate,
  normalizeModules,
  type BusinessTemplateId,
} from "@/lib/modules/constants";
import { saveOrganizationModules } from "@/lib/modules/settings";
import { normalizeCurrencySettings } from "@/lib/organizations/currencies";

type ApplyBusinessProfileParams = {
  supabase: SupabaseClient;
  organizationId: number;
  userId: string;
  templateId: BusinessTemplateId;
  currency: string;
  taxRate: number;
};

export const applyBusinessProfile = async ({
  supabase,
  organizationId,
  userId,
  templateId,
  currency,
  taxRate,
}: ApplyBusinessProfileParams) => {
  const template = getBusinessTemplate(templateId);
  const modules = normalizeModules(template.modules);
  const currencies = normalizeCurrencySettings([currency], currency);
  const defaults = getDefaultAgentSettings(organizationId);

  const orgPatch: Record<string, unknown> = {
    tax_rate: taxRate,
    currencies: currencies.codes,
    default_currency: currencies.defaultCode,
    business_template: templateId,
  };

  const { error: orgError } = await supabase.from("organizations").update(orgPatch).eq("id", organizationId);
  if (orgError) {
    if (/business_template/i.test(orgError.message)) {
      const { business_template: _template, ...withoutTemplate } = orgPatch;
      const { error: retryError } = await supabase
        .from("organizations")
        .update(withoutTemplate)
        .eq("id", organizationId);
      if (retryError) {
        console.error("[ONBOARDING] update organization failed", retryError);
      }
    } else {
      console.error("[ONBOARDING] update organization failed", orgError);
    }
  }

  const { error: modulesError } = await saveOrganizationModules(supabase, organizationId, modules);
  if (modulesError) {
    console.error("[ONBOARDING] save modules failed", modulesError);
  }

  const agentError = await upsertAgentSettings(organizationId, userId, {
    ...defaults,
    systemPrompt: template.agentPrompt,
    toolsCalendar: modules.calendar,
    toolsFunnel: modules.funnels,
    toolsHandoff: true,
    requireBookingConfirmation: modules.calendar,
  });
  if (agentError) {
    console.error("[ONBOARDING] upsert agent settings failed", agentError);
  }

  try {
    await ensureDefaultFunnel(supabase, organizationId, template.funnelStages);
  } catch (error) {
    console.error("[ONBOARDING] seed funnel failed", error);
  }
};
