"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GLASS_CARD } from "@/lib/dashboard/glass";
import type { BiKpiCard } from "@/lib/dashboard/bi-metrics";
import { cn } from "@/lib/utils";

type HomeBiKpisProps = {
  kpis: BiKpiCard[];
};

const Trend = ({ value }: { value: number | null }) => {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        Sin base
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        up ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-destructive/15 text-destructive",
      )}
    >
      {up ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
      {up ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
};

export const HomeBiKpis = ({ kpis }: HomeBiKpisProps) => (
  <section aria-label="KPIs globales" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {kpis.map((kpi) => (
      <Card key={kpi.id} className={cn(GLASS_CARD, "min-h-[8.5rem]")}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardDescription className="text-xs font-medium tracking-wide uppercase">
              {kpi.label}
            </CardDescription>
            <Trend value={kpi.deltaPercent} />
          </div>
          <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
            {kpi.value}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground dark:text-foreground/70">{kpi.hint}</p>
          {typeof kpi.progress === "number" ? (
            <Progress value={kpi.progress} className="h-2" aria-label={`Meta ${kpi.progress}%`} />
          ) : null}
        </CardContent>
      </Card>
    ))}
  </section>
);
