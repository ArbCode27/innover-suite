import Link from "next/link";
import { completeOnboardingAction } from "@/lib/organizations/actions";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { loadOrganizationModules } from "@/lib/modules/settings";
import { getBusinessTemplate, isBusinessTemplateId } from "@/lib/modules/constants";
import { loadCatalog } from "@/lib/commerce/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SetupStep = {
  done: boolean;
  title: string;
  href: string;
  hint: string;
};

export default async function OnboardingSetupPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");

  const supabase = await createSupabaseServerClient();
  const modules = await loadOrganizationModules(supabase, membership.organizationId);
  const { data: org } = await supabase
    .from("organizations")
    .select("business_template")
    .eq("id", membership.organizationId)
    .maybeSingle();

  const templateId =
    typeof org?.business_template === "string" && isBusinessTemplateId(org.business_template)
      ? org.business_template
      : null;
  const template = templateId ? getBusinessTemplate(templateId) : null;

  const [{ data: instagram }, { data: messenger }, { data: googleCalendar }, { count: productsCount }] =
    await Promise.all([
      supabase
        .from("instagram_connections")
        .select("id")
        .eq("organization_id", membership.organizationId)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("channel_accounts")
        .select("id")
        .eq("organization_id", membership.organizationId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("calendar_connections")
        .select("id")
        .eq("organization_id", membership.organizationId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", membership.organizationId),
    ]);

  let listingsCount = 0;
  if (modules.listings) {
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organizationId);
    listingsCount = error ? 0 : (count ?? 0);
  }

  let catalogCount = productsCount ?? 0;
  if (catalogCount === 0 && modules.catalog) {
    try {
      catalogCount = (await loadCatalog(supabase, membership.organizationId)).length;
    } catch {
      catalogCount = 0;
    }
  }

  const steps: SetupStep[] = [];

  if (modules.catalog) {
    steps.push({
      done: catalogCount > 0,
      title: "Catálogo",
      href: "/inventory",
      hint: "Carga productos o importa un CSV.",
    });
  }

  if (modules.listings) {
    steps.push({
      done: listingsCount > 0,
      title: "Inmuebles",
      href: "/listings",
      hint: "Carga fichas de propiedades para visitas y chat.",
    });
  }

  if (modules.calendar) {
    steps.push({
      done: Boolean(googleCalendar),
      title: "Google Calendar",
      href: "/settings#google-calendar",
      hint: "Conecta el calendario para que la IA pueda agendar.",
    });
  }

  steps.push({
    done: true,
    title: "Agente IA",
    href: "/settings#agent-ia",
    hint: "El prompt ya se adaptó a tu negocio. Revísalo si quieres afinar el tono.",
  });

  steps.push({
    done: Boolean(instagram || messenger),
    title: "Canal de chat",
    href: "/settings#integrations-heading",
    hint: "Conecta Instagram, Messenger o WhatsApp.",
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Onboarding</p>
          <CardTitle>Configura {membership.organizationName}</CardTitle>
          <CardDescription>
            {template
              ? `Quedó como ${template.label}. Completa estos pasos o saltalos y vuelve después.`
              : "Completa estos pasos o saltalos y vuelve después."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-primary/15 p-3">
                <p className="text-sm font-medium">
                  {index + 1}. {step.title} {step.done ? "✓" : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{step.hint}</p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link href={step.href}>Abrir</Link>
                </Button>
              </li>
            ))}
          </ol>
          <form action={completeOnboardingAction}>
            <Button type="submit" className="w-full">
              Terminar y ir al inicio
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
