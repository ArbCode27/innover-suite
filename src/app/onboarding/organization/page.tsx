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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Onboarding de empresa
          </p>
          <CardTitle className="text-2xl">Crea tu organización</CardTitle>
          <CardDescription>
            Elige cómo opera tu negocio. El menú, el embudo y la IA se configuran con esa plantilla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationOnboardingPage;
