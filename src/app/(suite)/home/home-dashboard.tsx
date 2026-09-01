import Link from "next/link";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { formatMoney } from "@/lib/commerce/types";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { MODULE_CATALOG } from "@/lib/modules/constants";
import type { DashboardBoard } from "@/lib/dashboard/board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ActivityHeatmap,
  formatDuration,
} from "./home-charts";
import { HomeFinanceMetrics } from "./home-finance";
import { HomeRestaurantMetrics } from "./home-restaurant";
import { HomeServicesMetrics } from "./home-services";

type HomeDashboardProps = {
  organizationName: string;
  board: DashboardBoard;
  canUseInbox: boolean;
};

export const HomeDashboard = ({ organizationName, board, canUseInbox }: HomeDashboardProps) => {
  const { report, modules, agents, ai, stageFunnel, finance, activity, alerts } = board;
  const activeModuleLabels = MODULE_CATALOG.filter((item) => modules[item.key]).map((item) => item.label);
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical");
  const maxStageCount = Math.max(1, ...(stageFunnel?.stages.map((row) => row.count) ?? [0]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {activeModuleLabels.length ? (
          activeModuleLabels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))
        ) : (
          <Badge variant="outline">Solo inbox e IA</Badge>
        )}
      </div>

      {alerts.length ? (
        <section className="space-y-3" aria-label="Alertas operativas">
          <div>
            <h2 className="text-base font-semibold">Alertas operativas</h2>
            <p className="text-sm text-muted-foreground">
              {criticalAlerts.length
                ? `${criticalAlerts.length} críticas requieren atención ahora.`
                : "Revisa estos avisos para no perder ventas ni mensajes."}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {alerts.map((alert) => (
              <Link key={alert.id} href={alert.href}>
                <Card
                  className={`h-full transition hover:border-primary/40 ${
                    alert.severity === "critical"
                      ? "border-destructive/40 bg-destructive/8"
                      : "border-amber-400/35 bg-amber-500/8"
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardDescription>{alert.title}</CardDescription>
                      <CardTitle className="mt-1 text-2xl">{alert.count}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
                    </div>
                    <AlertTriangle
                      className={`size-5 ${alert.severity === "critical" ? "text-destructive" : "text-amber-500"}`}
                      aria-hidden
                    />
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="border-primary/15 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Conversaciones del negocio</CardTitle>
            <CardDescription>
              {report.conversationsTotal} hilos · {report.conversationsOpen} abiertos · {report.conversationsAi} en IA
            </CardDescription>
          </div>
          <TrendingUp className="size-5 text-primary" aria-hidden />
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          {[
            { label: "Abiertas", value: report.conversationsOpen },
            { label: "Bot IA", value: report.conversationsAi },
            { label: "Humanas", value: report.conversationsHuman },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-primary/10 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {canUseInbox ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Rendimiento de asesores</h2>
            <p className="text-sm text-muted-foreground">
              Carga actual, velocidad y conversión para balancear el equipo de {organizationName}.
            </p>
          </div>
          <Card className="border-primary/15 bg-card/80">
            <CardContent className="pt-6">
              {agents.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-3 font-medium">Asesor</th>
                        <th className="pb-3 font-medium">Chats atendidos</th>
                        <th className="pb-3 font-medium">TPR</th>
                        <th className="pb-3 font-medium">Conversión</th>
                        <th className="pb-3 font-medium">Carga abierta</th>
                        {modules.orders ? <th className="pb-3 font-medium">Ingresos</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => (
                        <tr key={agent.userId} className="border-t border-primary/10">
                          <td className="py-3 font-medium">{agent.label}</td>
                          <td className="py-3">{agent.chatsHandled}</td>
                          <td className="py-3">{formatDuration(agent.avgResponseMs)}</td>
                          <td className="py-3">
                            {agent.conversionPercent === null ? "—" : `${agent.conversionPercent}%`}
                          </td>
                          <td className="py-3">
                            <span className={agent.openAssigned >= 8 ? "font-semibold text-amber-600" : undefined}>
                              {agent.openAssigned}
                            </span>
                          </td>
                          {modules.orders ? <td className="py-3">{formatMoney(agent.revenue)}</td> : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Cuando el equipo atienda chats, aquí verás su carga y ritmo.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Rendimiento de la IA</h2>
          <p className="text-sm text-muted-foreground">
            Cuánto resuelve el bot solo, cuándo escala a humano y el ahorro que eso representa.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-primary/15 bg-card/80">
            <CardHeader>
              <CardDescription>Cierre 100% IA</CardDescription>
              <CardTitle className="text-3xl">
                {ai.resolvedByAiPercent === null ? "—" : `${ai.resolvedByAiPercent}%`}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {ai.resolvedByAi} de {ai.resolvedTotal} chats resueltos sin asesor.
              </p>
            </CardHeader>
          </Card>
          <Card className="border-primary/15 bg-card/80">
            <CardHeader>
              <CardDescription>Handoff a humano</CardDescription>
              <CardTitle className="text-3xl">{ai.handoffRate === null ? "—" : `${ai.handoffRate}%`}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {ai.handoffs} transferencias sobre {ai.conversationsWithAi} conversaciones con bot.
              </p>
            </CardHeader>
          </Card>
          <Card className="border-primary/15 bg-card/80">
            <CardHeader>
              <CardDescription>Ahorro estimado</CardDescription>
              <CardTitle className="text-3xl">{ai.hoursSaved} h</CardTitle>
              <p className="text-xs text-muted-foreground">{formatMoney(ai.estimatedSavingDop)} a tarifa de asesoría.</p>
            </CardHeader>
          </Card>
        </div>
      </section>

      {stageFunnel ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Embudo de ventas</h2>
              <p className="text-sm text-muted-foreground">
                Oportunidades actuales por etapa, conversión y tiempo promedio en cada una.
              </p>
            </div>
            <Link href="/funnels" className="text-sm text-primary hover:underline">
              Abrir embudos
            </Link>
          </div>
          <div
            className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--funnel-cols),minmax(0,1fr))]"
            style={{ "--funnel-cols": String(Math.max(stageFunnel.stages.length, 1)) } as CSSProperties}
          >
            {stageFunnel.stages.map((stage) => (
              <Card key={stage.id} className="h-full w-full border-primary/15 bg-card/80">
                <CardHeader>
                  <CardDescription>{stage.name}</CardDescription>
                  <CardTitle className="text-3xl">{stage.count}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {stage.conversionFromPrevious === null ? "—" : `${stage.conversionFromPrevious}%`} vs etapa anterior
                    · {formatDuration(stage.avgDwellMs)} en etapa
                  </p>
                  {stage.estimatedValue ? (
                    <p className="text-xs text-muted-foreground">{formatMoney(stage.estimatedValue)} estimado</p>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(8, Math.round((stage.count / maxStageCount) * 100))}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {stageFunnel.lostReasons.length ? (
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Motivos de pérdida</CardTitle>
                <CardDescription>Etiquetas de contactos que el equipo marcó como pérdida o rechazo.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {stageFunnel.lostReasons.map((item) => (
                  <Badge key={item.reason} variant="secondary">
                    {item.reason} · {item.count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Etiqueta un lead como “perdido: precio” o “no interesa” para ver motivos de pérdida aquí.
            </p>
          )}
        </section>
      ) : null}

      {finance ? <HomeFinanceMetrics finance={finance} /> : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Patrones de actividad</h2>
          <p className="text-sm text-muted-foreground">
            Horarios pico de mensajes para reforzar personal. Día con mejor conversión:{" "}
            {activity.bestConversionDay
              ? `${activity.bestConversionDay.label} (${activity.bestConversionDay.conversionPercent}%)`
              : "aún sin datos"}
            .
          </p>
        </div>
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Heatmap de mensajes</CardTitle>
            <CardDescription>Volumen inbound por hora y día en {CALENDAR_TIME_ZONE}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap activity={activity} />
          </CardContent>
        </Card>
      </section>

      {board.restaurant ? (
        <HomeRestaurantMetrics restaurant={board.restaurant} />
      ) : null}

      {board.services ? <HomeServicesMetrics services={board.services} /> : null}

      {board.retail ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Comercio</h2>
            <p className="text-sm text-muted-foreground">Productos más vendidos y su peso en los pedidos.</p>
          </div>
          <Card className="border-primary/15 bg-card/80">
            <CardContent className="space-y-3 pt-6">
              {board.retail.topProducts.length ? (
                board.retail.topProducts.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.quantity} uds · {formatMoney(item.revenue)}
                      {item.orderSharePercent === null ? "" : ` · ${item.orderSharePercent}% de pedidos`}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Todavía no hay productos vendidos.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
};
