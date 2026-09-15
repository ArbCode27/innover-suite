import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadOnboardingCompletedAt } from "@/lib/onboarding/progress";
import { canManageOrganization, getCurrentMembership } from "@/lib/organizations/membership";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = {
  title: "Crear organización | Innover Suite",
  description: "Configura tu empresa para activar Instagram, asesores y conversaciones.",
};

const OrganizationOnboardingPage = async () => {
  const membership = await getCurrentMembership();

  if (membership) {
    if (canManageOrganization(membership)) {
      const completedAt = await loadOnboardingCompletedAt(membership.organizationId);
      if (!completedAt) redirect("/onboarding/setup");
    }
    redirect("/home");
  }

  redirect("/solicitud");
};

export default OrganizationOnboardingPage;
