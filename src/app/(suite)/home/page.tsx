import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeDashboard } from "./home-dashboard";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { loadDashboardBoard } from "@/lib/dashboard/board";
import {
  canUseInbox,
  canViewReports,
  getCurrentMembership,
} from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");

  const supabase = await createSupabaseServerClient();
  const board = await loadDashboardBoard(supabase, membership.organizationId);
  const { data: org } = await supabase
    .from("organizations")
    .select("onboarding_completed_at, plan")
    .eq("id", membership.organizationId)
    .maybeSingle();

  const showOnboarding = !org?.onboarding_completed_at;

  return (
    <ModuleShell
      title={`Dashboard de ${membership.organizationName}`}
      description="Métricas del negocio y chats recientes con pedidos, ingresos e impagos por conversación."
      eyebrow={org?.plan ? `Plan ${org.plan}` : "Inicio"}
      actions={
        canUseInbox(membership) ? (
          <Button asChild>
            <Link href="/inbox">Ir al inbox</Link>
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
            <Link href="/onboarding/setup">Continuar onboarding</Link>
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
