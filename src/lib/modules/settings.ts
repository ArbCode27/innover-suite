import { cache } from "react";
import {
  DEFAULT_MODULES,
  isModuleKey,
  normalizeModules,
  type ModuleKey,
  type OrganizationModules,
} from "@/lib/modules/constants";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type ModuleRow = {
  module_key: string;
  enabled: boolean;
};

const fromRows = (rows: ModuleRow[] | null): OrganizationModules => {
  const partial: Partial<OrganizationModules> = {};
  for (const row of rows ?? []) {
    if (isModuleKey(row.module_key)) {
      partial[row.module_key] = row.enabled;
    }
  }
  return normalizeModules({ ...DEFAULT_MODULES, ...partial });
};

export const loadOrganizationModules = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<OrganizationModules> => {
  const { data, error } = await supabase
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", organizationId);

  if (error) {
    return { ...DEFAULT_MODULES };
  }

  return fromRows(data as ModuleRow[] | null);
};

export const loadCachedOrganizationModules = cache(async (organizationId: number): Promise<OrganizationModules> => {
  const supabase = await createSupabaseServerClient();
  return loadOrganizationModules(supabase, organizationId);
});

export const loadOrganizationModulesAdmin = async (organizationId: number): Promise<OrganizationModules> => {
  try {
    const admin = getSupabaseAdminClient();
    return loadOrganizationModules(admin, organizationId);
  } catch {
    return { ...DEFAULT_MODULES };
  }
};

export const isModuleEnabled = (modules: OrganizationModules, key: ModuleKey) => modules[key] === true;

export const saveOrganizationModules = async (
  supabase: SupabaseClient,
  organizationId: number,
  modules: OrganizationModules,
) => {
  const normalized = normalizeModules(modules);
  const rows = (Object.keys(normalized) as ModuleKey[]).map((moduleKey) => ({
    organization_id: organizationId,
    module_key: moduleKey,
    enabled: normalized[moduleKey],
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("organization_modules").upsert(rows, {
    onConflict: "organization_id,module_key",
  });

  return { error, modules: normalized };
};
