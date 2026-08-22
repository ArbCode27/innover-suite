import { redirect } from "next/navigation";
import { ModuleShell } from "@/components/suite/module-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, toNumber } from "@/lib/commerce/types";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { canViewReports, getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const startOfRange = (days: number) => {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString();
};

export default async function ReportsPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");
  if (!canViewReports(membership)) redirect("/home");

  const supabase = await createSupabaseServerClient();
  const since = startOfRange(30);

  const [{ data: orders }, { data: conversations }, { data: audit }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, status, payment_status, channel, created_at")
      .eq("organization_id", membership.organizationId)
      .gte("created_at", since)
      .limit(500),
    supabase
      .from("conversations")
      .select("id, channel, mode, status")
      .eq("organization_id", membership.organizationId)
      .limit(500),
    supabase
      .from("audit_events")
      .select("id, action, entity, created_at")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const paid = (orders ?? []).filter((row) => row.status !== "cancelled");
  const revenue = paid.reduce((sum, row) => sum + toNumber(row.total), 0);
  const byChannel = paid.reduce<Record<string, number>>((acc, row) => {
    const key = (row.channel as string) || "otro";
    acc[key] = (acc[key] ?? 0) + toNumber(row.total);
    return acc;
  }, {});
  const cancelled = (orders ?? []).filter((row) => row.status === "cancelled").length;

  return (
    <ModuleShell
      title="Reportes"
      description={`Últimos 30 días en ${CALENDAR_TIME_ZONE}. Ventas, canales y auditoría reciente.`}
      eyebrow="Dirección"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription>Ingresos</CardDescription>
            <CardTitle className="text-3xl">{formatMoney(revenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription>Pedidos</CardDescription>
            <CardTitle className="text-3xl">{paid.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription>Cancelados</CardDescription>
            <CardTitle className="text-3xl">{cancelled}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-primary/15 bg-card/80 p-4">
          <h2 className="text-sm font-semibold">Ventas por canal</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(byChannel).length ? (
              Object.entries(byChannel).map(([channel, amount]) => (
                <li key={channel} className="flex justify-between">
                  <span className="capitalize">{channel}</span>
                  <span>{formatMoney(amount)}</span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">Sin ventas en el período.</li>
            )}
          </ul>
        </section>
        <section className="rounded-2xl border border-primary/15 bg-card/80 p-4">
          <h2 className="text-sm font-semibold">Conversaciones</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {(conversations ?? []).length} hilos · {(conversations ?? []).filter((row) => row.mode === "ai").length} en IA ·{" "}
            {(conversations ?? []).filter((row) => row.status !== "resolved").length} abiertos
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-primary/15 bg-card/80 p-4">
        <h2 className="text-sm font-semibold">Auditoría reciente</h2>
        {(audit ?? []).length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {audit?.map((event) => (
              <li key={event.id} className="flex justify-between gap-3">
                <span>
                  {event.action} · {event.entity}
                </span>
                <span className="text-muted-foreground">
                  {new Intl.DateTimeFormat("es-DO", { dateStyle: "short", timeStyle: "short" }).format(
                    new Date(event.created_at as string),
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin eventos aún. Se registran invitaciones, pagos y cancelaciones.
          </p>
        )}
      </section>
    </ModuleShell>
  );
}
