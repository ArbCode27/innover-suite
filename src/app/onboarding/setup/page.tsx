import Link from "next/link";
import { completeOnboardingAction } from "@/lib/organizations/actions";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { loadOrganizationModules } from "@/lib/modules/settings";
import { loadCatalog } from "@/lib/commerce/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OnboardingSetupPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");

  const supabase = await createSupabaseServerClient();
  const modules = await loadOrganizationModules(supabase, membership.organizationId);
  const [{ data: instagram }, { data: messenger }, { count: productsCount }, { count: listingsCountRaw }] = await Promise.all([
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
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organizationId),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organizationId),
  ]);

  const listingsCount = listingsCountRaw ?? 0;
  let catalogCount = productsCount ?? 0;
  if (catalogCount === 0) {
    try {
      catalogCount = (await loadCatalog(supabase, membership.organizationId)).length;
    } catch {
      catalogCount = 0;
    }
  }

  const steps = [
    { done: Boolean(modules.orders || modules.catalog || modules.funnels || modules.calendar || modules.listings), title: "Módulos", href: "/settings", hint: "Activa pedidos, catálogo, inmuebles, embudos o calendario." },
    { done: !modules.catalog || catalogCount > 0, title: "Catálogo", href: "/inventory", hint: "Carga productos o importa un CSV." },
    { done: !modules.listings || listingsCount > 0, title: "Inmuebles", href: "/listings", hint: "Carga fichas de propiedades para visitas y chat." },
    { done: true, title: "Agente IA", href: "/settings#agent-ia", hint: "Revisa el prompt. El horario de oficina está aparte: la IA atiende 24/7." },
    { done: Boolean(instagram || messenger), title: "Canal Meta", href: "/settings", hint: "Conecta Instagram, Messenger o WhatsApp." },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Onboarding</p>
          <CardTitle>Configura {membership.organizationName}</CardTitle>
          <CardDescription>Pasos para dejar el CRM listo. Puedes saltarlos y volver después.</CardDescription>
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
