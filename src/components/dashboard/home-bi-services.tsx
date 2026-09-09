"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  APPOINTMENT_PURPOSE_LABELS,
  type AppointmentPurpose,
} from "@/lib/calendar/constants";
import type { DashboardBoard, DashboardServices } from "@/lib/dashboard/board";
import { GLASS_CARD, GLASS_PANEL } from "@/lib/dashboard/glass";
import { formatDuration } from "@/lib/dashboard/format";
import { CHART_AXIS_TICK } from "@/lib/dashboard/chart-axis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type HomeBiServicesProps = {
  services: DashboardServices;
  stageFunnel: DashboardBoard["stageFunnel"];
  agents: DashboardBoard["agents"];
};

const purposeLabel = (purpose: string) =>
  APPOINTMENT_PURPOSE_LABELS[purpose as AppointmentPurpose] ?? purpose;

const chartConfig = {
  count: { label: "Citas", color: "var(--primary)" },
} satisfies ChartConfig;

export const HomeBiServices = ({ services, stageFunnel, agents }: HomeBiServicesProps) => {
  const purposeData = services.byPurpose.map((row) => ({
    purpose: purposeLabel(row.purpose),
    count: row.count,
  }));
  const maxStage = Math.max(1, ...(stageFunnel?.stages.map((s) => s.count) ?? [0]));

  return (
    <section className="space-y-4" aria-label="Analíticas de servicios">
      <div>
        <h2 className="text-base font-semibold">Prestación de servicios</h2>
        <p className="text-sm text-muted-foreground dark:text-foreground/75">
          Pipeline, ciclo de venta y rendimiento del equipo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Agendados" value={String(services.scheduled)} hint="30 días" />
        <Metric title="Completados" value={String(services.done)} hint="Show rate" />
        <Metric
          title="Asistencia"
          value={services.showRate == null ? "—" : `${services.showRate}%`}
          hint="Completados / agendados"
        />
        <Metric
          title="Ciclo de venta"
          value={formatDuration(services.avgCycleMs)}
          hint="Tiempo medio en embudo"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {stageFunnel ? (
          <Card className={GLASS_CARD}>
            <CardHeader>
              <CardTitle>Pipeline de servicios</CardTitle>
              <CardDescription>Leads → etapas actuales del embudo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stageFunnel.stages.map((stage) => (
                <div key={stage.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.name}</span>
                    <span className="tabular-nums text-muted-foreground">{stage.count}</span>
                  </div>
                  <Progress value={Math.round((stage.count / maxStage) * 100)} className="h-2" />
                  <p className="text-[11px] text-muted-foreground">
                    {stage.conversionFromPrevious == null
                      ? "—"
                      : `${stage.conversionFromPrevious}% vs anterior`}{" "}
                    · {formatDuration(stage.avgDwellMs)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className={GLASS_CARD}>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
                Activa el módulo de embudos para ver el pipeline de servicios.
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Mix por tipo de servicio</CardTitle>
            <CardDescription>Propósito de las citas del periodo.</CardDescription>
          </CardHeader>
          <CardContent>
            {purposeData.length ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={purposeData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="purpose" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} />
                  <YAxis tickLine={false} axisLine={false} width={32} tick={CHART_AXIS_TICK} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={6} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className={cn(GLASS_PANEL, "flex h-48 items-center justify-center p-4 text-sm text-muted-foreground")}>
                Sin citas en el periodo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Renovación / recurrencia</CardTitle>
            <CardDescription>Servicios con más de una cita registrada.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {services.renewalRate == null ? "—" : `${services.renewalRate}%`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Estimado a partir de títulos de cita repetidos en el calendario.
            </p>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Rendimiento por responsable</CardTitle>
            <CardDescription>Asesores con chats y conversión.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agents.length ? (
              agents.slice(0, 6).map((agent) => (
                <div
                  key={agent.userId}
                  className={cn(GLASS_PANEL, "flex items-center justify-between gap-3 px-3 py-2")}
                >
                  <div>
                    <p className="text-sm font-medium">{agent.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {agent.chatsHandled} chats · TPR {formatDuration(agent.avgResponseMs)}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">
                    {agent.conversionPercent == null ? "—" : `${agent.conversionPercent}%`}
                  </p>
                </div>
              ))
            ) : (
              <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
                Cuando el equipo atienda, verás completados y conversión por persona.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

const Metric = ({ title, value, hint }: { title: string; value: string; hint: string }) => (
  <Card className={GLASS_CARD}>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </CardHeader>
  </Card>
);
