import { redirect } from "next/navigation";
import type { ModuleKey } from "@/lib/modules/constants";
import { loadCachedOrgEntitlements } from "@/lib/billing/entitlements";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireSuiteModule = async (key: ModuleKey) => {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding/organization");
  }

  const entitlements = await loadCachedOrgEntitlements(membership.organizationId);
  if (entitlements.suiteAccess === "blocked") {
    redirect("/billing");
  }

  const supabase = await createSupabaseServerClient();
  const modules = entitlements.effectiveModules;
  if (!modules[key]) {
    redirect("/settings");
  }

  return { membership, supabase, modules, entitlements };
};
