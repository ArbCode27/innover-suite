import { redirect } from "next/navigation";
import { canManageOrganization, type OrganizationMembership } from "@/lib/organizations/membership";
import { loadOnboardingCompletedAt } from "@/lib/onboarding/progress";

export const redirectIfSetupIncomplete = async (membership: OrganizationMembership) => {
  if (!canManageOrganization(membership)) return;
  const completedAt = await loadOnboardingCompletedAt(membership.organizationId);
  if (!completedAt) {
    redirect("/onboarding/setup");
  }
};
