import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bot, CalendarRange, CreditCard, Users } from "lucide-react";
import { loadOrgEntitlements } from "@/lib/billing/entitlements";
import {
  getCurrentMembership,
  loadCurrentMemberSession,
} from "@/lib/organizations/membership";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeZone: "America/Caracas",
  }).format(new Date(iso));

const statusLabel: Record<string, string> = {
  trialing: "Prueba",
  active: "Activa",
  past_due: "En mora",
  suspended: "Suspendida",
  canceled: "Cancelada",
};

const BillingPage = async () => {
  const { user, membership, timedOut } = await loadCurrentMemberSession();
  if (timedOut || !user) {
    redirect("/login");
  }

  const current = membership ?? (await getCurrentMembership());
  if (!current) {
    redirect("/onboarding/organization");
  }

  const entitlements = await loadOrgEntitlements(current.organizationId);
  const blocked = entitlements.suiteAccess === "blocked";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        {!blocked ? (
          <Button asChild variant="ghost" className="w-fit px-0">
            <Link href="/home">
              <ArrowLeft className="size-4" aria-hidden />
              Volver al CRM
            </Link>
          </Button>
        ) : null}

        <div>
          <Badge variant="outline" className="border-primary/30 text-primary">
            Facturación
          </Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Plan de {current.organizationName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estado de la suscripción, periodo actual y cupo de respuestas del
            asistente IA.
          </p>
        </div>

        {blocked ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            El CRM está suspendido o el periodo venció. Contacta a soporte o
            pide reactivación a tu administrador de plataforma.
          </div>
        ) : null}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="size-5 text-primary" aria-hidden />
              {entitlements.plan.name}
            </CardTitle>
            <CardDescription>
              {formatUsd(entitlements.plan.priceUsd)} / mes ·{" "}
              {statusLabel[entitlements.subscriptionStatus] ??
                entitlements.subscriptionStatus}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarRange className="size-3.5" aria-hidden />
                Periodo
              </p>
              <p className="mt-2 text-sm">
                {formatDate(entitlements.periodStart)} —{" "}
                {formatDate(entitlements.periodEnd)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="size-3.5" aria-hidden />
                Equipo
              </p>
              <p className="mt-2 text-sm">
                Hasta {entitlements.usersLimit} usuarios
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:col-span-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Bot className="size-3.5" aria-hidden />
                Respuestas IA este periodo
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {entitlements.aiResponsesUsed.toLocaleString("es-VE")} /{" "}
                {entitlements.aiResponsesLimit.toLocaleString("es-VE")}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    entitlements.aiExhausted
                      ? "h-full rounded-full bg-destructive"
                      : "h-full rounded-full bg-primary"
                  }
                  style={{
                    width: `${Math.min(100, entitlements.aiUsagePercent)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {entitlements.aiExhausted
                  ? "Cupo agotado: el asistente está pausado hasta renovar o ampliar el plan."
                  : `Quedan ${entitlements.aiRemaining.toLocaleString("es-VE")} respuestas.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillingPage;
