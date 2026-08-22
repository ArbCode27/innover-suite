import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Package,
  UserRound,
  Wallet,
} from "lucide-react";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/commerce/types";
import { loadDashboardSnapshot } from "@/lib/dashboard/board";
import {
  canManageOrders,
  canUseInbox,
  canViewReports,
  getCurrentMembership,
} from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");

  const supabase = await createSupabaseServerClient();
  const snapshot = await loadDashboardSnapshot(supabase, membership.organizationId);
  const { data: org } = await supabase
    .from("organizations")
    .select("onboarding_completed_at, plan")
    .eq("id", membership.organizationId)
    .maybeSingle();

  const showOnboarding = !org?.onboarding_completed_at;
  const metrics = [
    { label: "Chats abiertos", value: String(snapshot.openChats), hint: `${snapshot.unreadChats} no leídos`, icon: MessageCircle, href: "/inbox" },
    { label: "Cola humana", value: String(snapshot.humanQueue), hint: "Sin asignar", icon: UserRound, href: "/inbox" },
    { label: "Pedidos hoy", value: String(snapshot.ordersToday), hint: formatMoney(snapshot.revenueToday), icon: ClipboardList, href: "/orders" },
    { label: "Sin pagar", value: String(snapshot.unpaidOrders), hint: "Caja pendiente", icon: Wallet, href: "/orders" },
    { label: "Citas hoy", value: String(snapshot.appointmentsToday), hint: "Calendario", icon: CalendarDays, href: "/calendar" },
    { label: "Stock bajo", value: String(snapshot.lowStock), hint: `${snapshot.contacts} contactos`, icon: Package, href: "/inventory" },
  ];

  return (
    <ModuleShell
      title={`Hoy en ${membership.organizationName}`}
      description="Resumen del día: chats, pedidos, caja y citas. El inbox sigue siendo el centro operativo."
      eyebrow={org?.plan ? `Plan ${org.plan}` : "Inicio"}
      actions={
        canViewReports(membership) ? (
          <Button asChild variant="outline">
            <Link href="/reports">Reportes</Link>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card className="h-full border-primary/15 bg-card/80 transition hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="mt-2 text-3xl">{metric.value}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                </div>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <metric.icon className="size-5" />
                </span>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {canUseInbox(membership) ? (
          <Button asChild>
            <Link href="/inbox">Ir al inbox</Link>
          </Button>
        ) : null}
        {canManageOrders(membership) ? (
          <Button asChild variant="outline">
            <Link href="/orders">Ver pedidos</Link>
          </Button>
        ) : null}
      </div>
    </ModuleShell>
  );
}
