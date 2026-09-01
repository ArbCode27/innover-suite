import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeDashboard } from "./home-dashboard";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { loadDashboardBoard } from "@/lib/dashboard/board";
import { loadCachedOrganizationModules } from "@/lib/modules/settings";
import {
  canUseInbox,
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
    supabase.from("organizations").select("plan").eq("id", membership.organizationId).maybeSingle(),
  ]);
  const org = orgResult.data;

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
      <HomeDashboard
        organizationName={membership.organizationName}
        board={board}
        canUseInbox={canUseInbox(membership)}
      />
    </ModuleShell>
  );
}
