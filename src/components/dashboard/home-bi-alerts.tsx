"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { DashboardAlert } from "@/lib/dashboard/board";
import { GLASS_CARD } from "@/lib/dashboard/glass";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HomeBiAlertsProps = {
  alerts: DashboardAlert[];
};

export const HomeBiAlerts = ({ alerts }: HomeBiAlertsProps) => {
  if (!alerts.length) return null;
  const critical = alerts.filter((alert) => alert.severity === "critical").length;

  return (
    <section className="space-y-3" aria-label="Centro de alertas">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Centro de alertas</h2>
          <p className="text-sm text-muted-foreground">
            {critical
              ? `${critical} críticas requieren atención hoy.`
              : "Avisos operativos para no perder ventas ni stock."}
          </p>
        </div>
        <Badge variant="outline">{alerts.length} activas</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {alerts.map((alert) => (
          <Link key={alert.id} href={alert.href}>
            <Card
              className={cn(
                GLASS_CARD,
                "h-full transition hover:border-primary/40",
                alert.severity === "critical" && "border-destructive/40 bg-destructive/10",
                alert.severity === "warning" && "border-amber-400/35 bg-amber-500/10",
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardDescription>{alert.title}</CardDescription>
                  <CardTitle className="mt-1 text-2xl tabular-nums">{alert.count}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
                </div>
                <AlertTriangle
                  className={cn(
                    "size-5 shrink-0",
                    alert.severity === "critical" ? "text-destructive" : "text-amber-500",
                  )}
                  aria-hidden
                />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
