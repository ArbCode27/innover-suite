import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = {
  title: "Crear organización | Innover Suite",
  description: "Configura tu empresa para activar Instagram, asesores y conversaciones.",
};

const OrganizationOnboardingPage = async () => {
  const membership = await getCurrentMembership();

  if (membership) {
    redirect("/inbox");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Onboarding de empresa
          </p>
          <CardTitle className="text-2xl">Crea tu organización</CardTitle>
          <CardDescription>
            Este CRM es multiempresa. La organización será el contenedor de tus asesores,
            cuentas de Instagram, conversaciones y mensajes.
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
