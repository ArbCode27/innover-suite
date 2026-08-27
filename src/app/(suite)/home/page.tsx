import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeDashboard } from "./home-dashboard";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { loadDashboardBoard } from "@/lib/dashboard/board";
import { loadCachedOrganizationModules } from "@/lib/modules/settings";
import {
  canUseInbox,
  canViewReports,
  loadCurrentMemberSession,
} from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { membership } = await loadCurrentMemberSession();
  if (!membership) redirect("/onboarding/organization");

  const supabase = await createSupabaseServerClient();
  const modules = await loadCachedOrganizationModules(membership.organizationId);
  const [board, orgResult] = await Promise.all([
    loadDashboardBoard(supabase, membership.organizationId, modules),
    supabase
      .from("organizations")
      .select("onboarding_completed_at, plan")
      .eq("id", membership.organizationId)
      .maybeSingle(),
  ]);
  const org = orgResult.data;
  const showOnboarding = !org?.onboarding_completed_at;

  return (
    <ModuleShell
      title={`Dashboard de ${membership.organizationName}`}
      description="KPIs en vivo según las funciones activas de tu CRM: equipo, IA, embudo, finanzas y operación."
      eyebrow={org?.plan ? `Plan ${org.plan}` : "Inicio"}
      actions={
        canUseInbox(membership) ? (
          <Button asChild>
            <Link href="/inbox" prefetch={false}>
              Ir al inbox
            </Link>
          </Button>
        ) : null
      }
    >
      {showOnboarding ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
          <p className="font-medium">Completa la configuración inicial</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Módulos, catálogo, agente e integración de un canal. Toma unos minutos.
          </p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/onboarding/setup" prefetch={false}>
              Continuar onboarding
            </Link>
          </Button>
        </div>
      ) : null}

      <HomeDashboard
        organizationName={membership.organizationName}
        board={board}
        showAudit={canViewReports(membership)}
        canUseInbox={canUseInbox(membership)}
      />
    </ModuleShell>
  );
}
