import Link from "next/link";
import { AlertTriangle, Bot, CreditCard } from "lucide-react";
import type { OrgEntitlements } from "@/lib/billing/plans";

type BillingUsageBannerProps = {
  entitlements: OrgEntitlements;
};

const formatCount = (value: number) =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(value);

export const BillingUsageBanner = ({ entitlements }: BillingUsageBannerProps) => {
  const showGrace = entitlements.suiteAccess === "grace";
  const showQuota =
    entitlements.aiExhausted || entitlements.aiUsagePercent >= 80;

  if (!showGrace && !showQuota) {
    return null;
  }

  return (
    <div className="sticky top-0 z-20 space-y-2 px-1 pb-3 pt-1 md:px-0">
      {showGrace ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <CreditCard className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <p>
              Tu suscripción está en mora o el periodo venció. Renueva para evitar la suspensión del
              CRM.
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 text-sm font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
          >
            Ver facturación
          </Link>
        </div>
      ) : null}

      {showQuota ? (
        <div
          role="status"
          className={
            entitlements.aiExhausted
              ? "flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              : "flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          }
        >
          <div className="flex items-start gap-2">
            {entitlements.aiExhausted ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            ) : (
              <Bot className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            )}
            <p>
              {entitlements.aiExhausted
                ? `Se agotaron las respuestas IA de este periodo (${formatCount(entitlements.aiResponsesUsed)} / ${formatCount(entitlements.aiResponsesLimit)}). El asistente está pausado; el equipo puede seguir atendiendo en el inbox.`
                : `Has usado el ${entitlements.aiUsagePercent}% de las respuestas IA (${formatCount(entitlements.aiResponsesUsed)} / ${formatCount(entitlements.aiResponsesLimit)}).`}
            </p>
          </div>
          <Link
            href="/billing"
            className="shrink-0 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Ver plan
          </Link>
        </div>
      ) : null}
    </div>
  );
};
