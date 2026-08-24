"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import {
  APPOINTMENT_PURPOSE_LABELS,
  type AppointmentPurpose,
} from "@/lib/calendar/constants";
import type { DashboardServices } from "@/lib/dashboard/board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HomeServicesMetricsProps = {
  services: DashboardServices;
};

type ComparisonPeriod = "weekly" | "monthly" | "annual";

const COMPARISON_OPTIONS: Array<{ key: ComparisonPeriod; label: string; description: string }> = [
  { key: "weekly", label: "Semanal", description: "Los últimos 7 días comparados con los 7 anteriores." },
  { key: "monthly", label: "Mensual", description: "Los últimos 30 días comparados con los 30 anteriores." },
  { key: "annual", label: "Anual", description: "Los últimos 12 meses comparados con los 12 anteriores." },
];

const PURPOSE_BAR: Record<string, string> = {
  consulta: "bg-sky-500",
  seguimiento: "bg-amber-500",
  demo: "bg-violet-500",
  cierre: "bg-emerald-500",
  interno: "bg-slate-400",
};

const PURPOSE_STROKE: Record<string, string> = {
  consulta: "stroke-sky-500",
  seguimiento: "stroke-amber-500",
  demo: "stroke-violet-500",
  cierre: "stroke-emerald-500",
  interno: "stroke-slate-400",
};

const purposeLabel = (purpose: string) =>
  APPOINTMENT_PURPOSE_LABELS[purpose as AppointmentPurpose] ?? purpose;

const GrowthBadge = ({ value }: { value: number | null }) => {
  if (value === null) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Sin base</span>
    );
  }

  const positive = value >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        positive ? "bg-foreground text-background" : "bg-destructive/15 text-destructive",
      )}
    >
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
};

const ComparisonBars = ({ current, previous }: { current: number; previous: number }) => {
  const max = Math.max(current, previous, 1);

  return (
    <div className="grid grid-cols-2 items-end gap-5">
      <div className="space-y-2">
        <div
          className="rounded-xl bg-primary"
          style={{ height: `${Math.max(12, Math.round((current / max) * 120))}px` }}
        />
        <p className="text-xs text-muted-foreground">Actual</p>
        <p className="text-sm font-medium">{current}</p>
      </div>
      <div className="space-y-2">
        <div
          className="rounded-xl bg-sky-200"
          style={{ height: `${Math.max(12, Math.round((previous / max) * 120))}px` }}
        />
        <p className="text-xs text-muted-foreground">Anterior</p>
        <p className="text-sm font-medium">{previous}</p>
      </div>
    </div>
  );
};

const AttendanceRing = ({ value }: { value: number | null }) => {
  const percent = value ?? 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

  return (
    <svg viewBox="0 0 88 88" className="size-[4.5rem]" role="img" aria-label={`Asistencia ${percent}%`}>
      <circle cx="44" cy="44" r={radius} className="fill-none stroke-muted" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={radius}
        className="fill-none stroke-primary"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="48" textAnchor="middle" className="fill-foreground text-[14px] font-semibold">
        {value === null ? "—" : `${percent}%`}
      </text>
    </svg>
  );
};

const PurposeDonut = ({
  slices,
}: {
  slices: Array<{ purpose: string; count: number }>;
}) => {
  const total = slices.reduce((sum, row) => sum + row.count, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (!total) {
    return (
      <svg viewBox="0 0 96 96" className="size-28" aria-hidden>
        <circle cx="48" cy="48" r={radius} className="fill-none stroke-muted" strokeWidth="12" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 96 96" className="size-28" role="img" aria-label="Distribución por tipo de visita">
      <circle cx="48" cy="48" r={radius} className="fill-none stroke-muted" strokeWidth="12" />
      {slices.map((row) => {
        const length = (row.count / total) * circumference;
        const dashOffset = -offset;
        offset += length;
        return (
          <circle
            key={row.purpose}
            cx="48"
            cy="48"
            r={radius}
            className={cn("fill-none", PURPOSE_STROKE[row.purpose] ?? "stroke-primary")}
            strokeWidth="12"
            strokeDasharray={`${length} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 48 48)"
          />
        );
      })}
      <text x="48" y="52" textAnchor="middle" className="fill-foreground text-[18px] font-semibold">
        {total}
      </text>
    </svg>
  );
};

export const HomeServicesMetrics = ({ services }: HomeServicesMetricsProps) => {
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriod>("monthly");
  const pending = Math.max(services.scheduled - services.done, 0);
  const outcomeTotal = Math.max(services.scheduled + services.cancelled, 1);
  const cancelShare = Math.round((services.cancelled / outcomeTotal) * 100);
  const purposeTotal = Math.max(
    1,
    services.byPurpose.reduce((sum, row) => sum + row.count, 0),
  );
  const comparisonOption =
    COMPARISON_OPTIONS.find((option) => option.key === comparisonPeriod) ?? COMPARISON_OPTIONS[1];
  const comparison = services.comparisons[comparisonPeriod];

  const handleComparisonPeriodChange = (nextPeriod: ComparisonPeriod) => {
    setComparisonPeriod(nextPeriod);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Servicios y citas</h2>
        <p className="text-sm text-muted-foreground">
          Visitas agendadas vs. realizadas y el mix por tipo de cita.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="size-4" aria-hidden />
              </span>
              Agendadas
            </CardDescription>
            <CardTitle className="mt-3 text-3xl">{services.scheduled}</CardTitle>
            <p className="text-xs text-muted-foreground">{pending} pendientes de realizar</p>
          </CardHeader>
          <CardContent>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="h-full bg-emerald-500"
                style={{ width: `${Math.round((services.done / outcomeTotal) * 100)}%` }}
              />
              <span
                className="h-full bg-primary/50"
                style={{ width: `${Math.round((pending / outcomeTotal) * 100)}%` }}
              />
              <span
                className="h-full bg-destructive/70"
                style={{ width: `${Math.round((services.cancelled / outcomeTotal) * 100)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Hechas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/50" />
                Pendientes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-destructive/70" />
                Canceladas
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardDescription className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CheckCircle2 className="size-4" aria-hidden />
                </span>
                Realizadas
              </CardDescription>
              <CardTitle className="mt-3 text-3xl">{services.done}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {services.showRate === null ? "Sin tasa aún" : `${services.showRate}% de asistencia`}
              </p>
            </div>
            <AttendanceRing value={services.showRate} />
          </CardHeader>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="size-4" aria-hidden />
              </span>
              Canceladas
            </CardDescription>
            <CardTitle className="mt-3 text-3xl">{services.cancelled}</CardTitle>
            <p className="text-xs text-muted-foreground">{cancelShare}% del volumen total</p>
          </CardHeader>
          <CardContent>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive/80"
                style={{ width: `${Math.max(services.cancelled ? 8 : 0, cancelShare)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Actual vs anterior</h3>
            <p className="text-sm text-muted-foreground">{comparisonOption.description}</p>
          </div>
          <div
            role="tablist"
            aria-label="Periodo de comparación de citas"
            className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-primary/20 bg-background/80 p-1 sm:w-[22rem]"
          >
            {COMPARISON_OPTIONS.map((option) => {
              const isActive = comparisonPeriod === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                  )}
                  onClick={() => handleComparisonPeriodChange(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <Card className="border-primary/20 bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Agendadas</CardTitle>
                <GrowthBadge value={comparison.scheduledGrowthPercent} />
              </div>
              <CardDescription>
                Citas del periodo seleccionado frente al anterior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonBars current={comparison.scheduled} previous={comparison.previousScheduled} />
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Realizadas</CardTitle>
                <GrowthBadge value={comparison.doneGrowthPercent} />
              </div>
              <CardDescription>
                Citas completadas del periodo seleccionado frente al anterior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ComparisonBars current={comparison.done} previous={comparison.previousDone} />
              <p className="text-xs text-muted-foreground">
                {comparison.done} vs {comparison.previousDone} realizadas
                {comparison.doneGrowthPercent === null
                  ? ""
                  : ` (${comparison.doneGrowthPercent >= 0 ? "+" : ""}${comparison.doneGrowthPercent.toFixed(1)}%)`}
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-primary/15 bg-card/80">
        <CardHeader>
          <CardTitle>Por tipo de visita</CardTitle>
          <CardDescription>Mezcla de motivos en las citas del período.</CardDescription>
        </CardHeader>
        <CardContent>
          {services.byPurpose.length ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <PurposeDonut slices={services.byPurpose} />
              <ul className="w-full min-w-0 flex-1 space-y-3">
                {services.byPurpose.map((row) => (
                  <li key={row.purpose} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            PURPOSE_BAR[row.purpose] ?? "bg-primary",
                          )}
                        />
                        <span className="truncate">{purposeLabel(row.purpose)}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {row.count} · {Math.round((row.count / purposeTotal) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", PURPOSE_BAR[row.purpose] ?? "bg-primary")}
                        style={{ width: `${Math.max(8, Math.round((row.count / purposeTotal) * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay citas en el período.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
