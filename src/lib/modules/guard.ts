import { redirect } from "next/navigation";
import type { ModuleKey } from "@/lib/modules/constants";
import { loadCachedOrganizationModules } from "@/lib/modules/settings";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireSuiteModule = async (key: ModuleKey) => {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding/organization");
  }

  const supabase = await createSupabaseServerClient();
  const modules = await loadCachedOrganizationModules(membership.organizationId);
  if (!modules[key]) {
    redirect("/settings");
  }

  return { membership, supabase, modules };
};
