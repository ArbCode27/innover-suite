import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Package,
  ShoppingBag,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { APPOINTMENT_PURPOSE_LABELS, type AppointmentPurpose } from "@/lib/calendar/constants";
import { formatMoney } from "@/lib/commerce/types";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { MODULE_CATALOG } from "@/lib/modules/constants";
import type { DashboardBoard } from "@/lib/dashboard/board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ActivityHeatmap,
  ChannelBars,
  FunnelDonut,
  RevenueSparkline,
  channelLabel,
  formatDuration,
  formatGrowth,
  percent,
} from "./home-charts";

type HomeDashboardProps = {
  organizationName: string;
  board: DashboardBoard;
  showAudit: boolean;
  canUseInbox: boolean;
};

const formatTime = (value: string | null) => {
  if (!value) return "Sin actividad";
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(new Date(value));
};

const purposeLabel = (purpose: string) =>
  APPOINTMENT_PURPOSE_LABELS[purpose as AppointmentPurpose] ?? purpose;

export const HomeDashboard = ({ organizationName, board, showAudit, canUseInbox }: HomeDashboardProps) => {
  const { today, report, funnel, modules, sla, agents, ai, stageFunnel, finance, retention, activity, alerts } = board;
  const conversion = funnel ? percent(funnel.buyers, funnel.leads) : 0;
  const activeModuleLabels = MODULE_CATALOG.filter((item) => modules[item.key]).map((item) => item.label);
  const criticalAlerts = alerts.filter((alert) => alert.severity === "critical");
  const maxChannelRevenue = Math.max(1, ...(finance?.byChannel.map((row) => row.revenue) ?? [0]));
  const maxStageCount = Math.max(1, ...(stageFunnel?.stages.map((row) => row.count) ?? [0]));

  const kpis = [
    canUseInbox
      ? {
          label: "Tiempo primera respuesta",
          value: formatDuration(sla.firstResponseAvgMs),
          hint: `${sla.slaHitPercent ?? 0}% dentro de ${sla.slaTargetMinutes} min · ${sla.unansweredStale} sin responder`,
          icon: MessageCircle,
          href: "/inbox",
          alert: sla.unansweredStale > 0,
        }
      : null,
    canUseInbox
      ? {
          label: "Chats abiertos",
          value: String(today.openChats),
          hint: `${today.unreadChats} no leídos · ${today.humanQueue} en cola humana`,
          icon: UserRound,
          href: "/inbox",
          alert: today.humanQueue > 5,
        }
      : null,
    {
      label: "Resueltos por IA",
      value: ai.resolvedByAiPercent === null ? "—" : `${ai.resolvedByAiPercent}%`,
      hint: `${ai.hoursSaved} h ahorradas · ${formatMoney(ai.estimatedSavingDop)} est.`,
      icon: Bot,
      href: "/inbox",
      alert: false,
    },
    modules.orders && finance
      ? {
          label: "Ingresos 30 días",
          value: formatMoney(finance.revenue30d),
          hint: `${finance.orders30d} pedidos · ${formatGrowth(finance.revenueGrowthPercent)}`,
          icon: ClipboardList,
          href: "/orders",
          alert: false,
        }
      : null,
    modules.orders
      ? {
          label: "Hoy",
          value: formatMoney(today.revenueToday),
          hint: `${today.ordersToday} pedidos del día`,
          icon: Wallet,
          href: "/orders",
          alert: today.unpaidOrders > 0,
        }
      : null,
    modules.orders && finance
      ? {
          label: "Ticket promedio",
          value: formatMoney(finance.aov),
          hint: `${today.unpaidOrders} sin pagar`,
          icon: ShoppingBag,
          href: "/orders",
          alert: false,
        }
      : null,
    modules.calendar
      ? {
          label: "Citas hoy",
          value: String(today.appointmentsToday),
          hint:
            typeof board.services?.showRate === "number"
              ? `${board.services.showRate}% de asistencia 30d`
              : "Agenda del día",
          icon: CalendarDays,
          href: "/calendar",
          alert: false,
        }
      : null,
    modules.catalog
      ? {
          label: "Stock bajo",
          value: String(today.lowStock),
          hint: `${today.contacts} contactos`,
          icon: Package,
          href: "/inventory",
          alert: today.lowStock > 0,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card
              className={`h-full bg-card/80 transition hover:border-primary/40 ${
                metric.alert ? "border-destructive/35" : "border-primary/15"
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="mt-2 text-3xl">{metric.value}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                </div>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <metric.icon className="size-5" aria-hidden />
                </span>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {canUseInbox ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Tiempos de respuesta y SLA</h2>
            <p className="text-sm text-muted-foreground">
              KPI #1 del CRM conversacional: primera respuesta, resolución y chats que se están enfriando.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>TPR promedio</CardDescription>
                <CardTitle className="text-3xl">{formatDuration(sla.firstResponseAvgMs)}</CardTitle>
                <p className="text-xs text-muted-foreground">Primera respuesta humana o IA.</p>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Resolución promedio</CardDescription>
                <CardTitle className="text-3xl">{formatDuration(sla.resolutionAvgMs)}</CardTitle>
                <p className="text-xs text-muted-foreground">Del primer mensaje al cierre.</p>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Dentro de SLA</CardDescription>
                <CardTitle className="text-3xl">{sla.slaHitPercent === null ? "—" : `${sla.slaHitPercent}%`}</CardTitle>
                <p className="text-xs text-muted-foreground">Objetivo: responder en menos de {sla.slaTargetMinutes} min.</p>
              </CardHeader>
            </Card>
            <Card className={sla.unansweredStale ? "border-destructive/40 bg-destructive/8" : "border-primary/15 bg-card/80"}>
              <CardHeader>
                <CardDescription>Sin responder +{sla.unansweredStaleMinutes} min</CardDescription>
                <CardTitle className="text-3xl">{sla.unansweredStale}</CardTitle>
                <p className="text-xs text-muted-foreground">Alerta visual: chats en espera demasiado tiempo.</p>
              </CardHeader>
            </Card>
          </div>
          <Card className="border-primary/15 bg-card/80">
            <CardHeader>
              <CardTitle>TPR por canal</CardTitle>
              <CardDescription>Promedio de primera respuesta en los últimos 30 días.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {sla.firstResponseByChannel.length ? (
                sla.firstResponseByChannel.map((row) => (
                  <div key={row.channel} className="rounded-xl border border-primary/10 bg-background/70 p-3">
                    <p className="text-xs text-muted-foreground">{channelLabel(row.channel)}</p>
                    <p className="mt-1 text-2xl font-semibold">{formatDuration(row.avgMs)}</p>
                    <p className="text-xs text-muted-foreground">{row.samples} chats medidos</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground sm:col-span-3">Aún no hay respuestas para medir el TPR.</p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

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
          <div className="grid gap-4 lg:grid-cols-5">
            {stageFunnel.stages.map((stage) => (
              <Card key={stage.id} className="border-primary/15 bg-card/80">
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

      {funnel ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Leads que compran vs. preguntan</h2>
              <p className="text-sm text-muted-foreground">
                Conversión comercial de {organizationName} a partir de chats y pedidos.
              </p>
            </div>
            {canUseInbox ? (
              <Link href="/inbox" className="text-sm text-primary hover:underline">
                Abrir inbox
              </Link>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Leads</CardDescription>
                <CardTitle className="text-3xl">{funnel.leads}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Compran</CardDescription>
                <CardTitle className="text-3xl">{funnel.buyers}</CardTitle>
                <p className="text-xs text-muted-foreground">{conversion}% de conversión.</p>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Solo preguntan</CardDescription>
                <CardTitle className="text-3xl">{funnel.inquirers}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Composición</CardTitle>
              </CardHeader>
              <CardContent>
                {funnel.leads ? (
                  <FunnelDonut funnel={funnel} />
                ) : (
                  <p className="text-sm text-muted-foreground">Cuando entren chats, aquí verás el embudo.</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Por canal</CardTitle>
                <CardDescription>Verde = compran. Azul = solo preguntan.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChannelBars funnel={funnel} />
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {finance ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Métricas financieras</h2>
            <p className="text-sm text-muted-foreground">
              Ticket promedio, ingresos por canal y tendencia frente a los 30 días anteriores.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Ticket promedio (AOV)</CardDescription>
                <CardTitle className="text-3xl">{formatMoney(finance.aov)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Crecimiento de ingresos</CardDescription>
                <CardTitle className="text-3xl">{formatGrowth(finance.revenueGrowthPercent)}</CardTitle>
                <p className="text-xs text-muted-foreground">Antes: {formatMoney(finance.revenuePrev30d)}</p>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Crecimiento de pedidos</CardDescription>
                <CardTitle className="text-3xl">{formatGrowth(finance.ordersGrowthPercent)}</CardTitle>
                <p className="text-xs text-muted-foreground">Antes: {finance.ordersPrev30d} pedidos</p>
              </CardHeader>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Ingresos 14 días</CardTitle>
                <CardDescription>Línea temporal, no solo el total del mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueSparkline daily={finance.daily} />
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Ingresos por canal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {finance.byChannel.length ? (
                  finance.byChannel.map((row) => (
                    <div key={row.channel} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>{channelLabel(row.channel)}</span>
                        <span>
                          {formatMoney(row.revenue)} · {row.orders} ventas
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(8, Math.round((row.revenue / maxChannelRevenue) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Aún no hay ventas en el período.</p>
                )}
              </CardContent>
            </Card>
          </div>
          {finance.byAgent.length ? (
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Ingresos por asesor</CardTitle>
                <CardDescription>Pedidos en chats asignados a cada vendedor.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {finance.byAgent.map((row) => (
                  <div key={row.userId} className="rounded-xl border border-primary/10 bg-background/70 p-3">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="mt-1 text-xl font-semibold">{formatMoney(row.revenue)}</p>
                    <p className="text-xs text-muted-foreground">{row.orders} pedidos</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {retention ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Retención y valor del cliente</h2>
            <p className="text-sm text-muted-foreground">Nuevos vs. recurrentes, frecuencia, LTV y riesgo de inactividad.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Nuevos / 30 días</CardDescription>
                <CardTitle className="text-3xl">{retention.newCustomers}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Recurrentes</CardDescription>
                <CardTitle className="text-3xl">{retention.returningCustomers}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Frecuencia / LTV</CardDescription>
                <CardTitle className="text-3xl">{retention.purchaseFrequency ?? "—"}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {retention.ltv === null ? "Sin LTV aún" : `${formatMoney(retention.ltv)} LTV`}
                </p>
              </CardHeader>
            </Card>
            <Card className={retention.inactiveCustomers ? "border-amber-400/35 bg-amber-500/8" : "border-primary/15 bg-card/80"}>
              <CardHeader>
                <CardDescription>Inactivos +{retention.churnRiskDays} días</CardDescription>
                <CardTitle className="text-3xl">{retention.inactiveCustomers}</CardTitle>
                <p className="text-xs text-muted-foreground">Clientes en riesgo de churn.</p>
              </CardHeader>
            </Card>
          </div>
        </section>
      ) : null}

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
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Restaurante</h2>
            <p className="text-sm text-muted-foreground">Productos más pedidos, hora pico y ticket promedio por comanda.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Ticket promedio</CardDescription>
                <CardTitle className="text-3xl">{formatMoney(board.restaurant.aov)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Hora pico de pedidos</CardDescription>
                <CardTitle className="text-3xl">
                  {board.restaurant.peakHour ? `${board.restaurant.peakHour.hour}:00` : "—"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {board.restaurant.peakHour ? `${board.restaurant.peakHour.orders} pedidos en esa hora` : "Sin pedidos aún"}
                </p>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Más pedidos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {board.restaurant.topProducts.length ? (
                  board.restaurant.topProducts.map((item) => (
                    <div key={item.name} className="flex justify-between gap-3">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.quantity} · {formatMoney(item.revenue)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Todavía no hay productos vendidos.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {board.services ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Servicios y citas</h2>
            <p className="text-sm text-muted-foreground">Visitas agendadas vs. realizadas y lo más consultado.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Agendadas</CardDescription>
                <CardTitle className="text-3xl">{board.services.scheduled}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Realizadas</CardDescription>
                <CardTitle className="text-3xl">{board.services.done}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {board.services.showRate === null ? "Sin tasa aún" : `${board.services.showRate}% de asistencia`}
                </p>
              </CardHeader>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardDescription>Canceladas</CardDescription>
                <CardTitle className="text-3xl">{board.services.cancelled}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Por tipo de visita</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {board.services.byPurpose.length ? (
                  board.services.byPurpose.map((row) => (
                    <div key={row.purpose} className="flex justify-between gap-3">
                      <span>{purposeLabel(row.purpose)}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Aún no hay citas en el período.</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-card/80">
              <CardHeader>
                <CardTitle>Más consultadas</CardTitle>
                <CardDescription>Títulos de citas más repetidos (propiedades, demos o consultas).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {board.services.topTitles.length ? (
                  board.services.topTitles.map((row) => (
                    <div key={row.title} className="flex justify-between gap-3">
                      <span>{row.title}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">Cuando se agenden visitas, aparecerán aquí.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

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
          {showAudit ? (
            <div className="col-span-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Auditoría</p>
              {report.audit.length ? (
                report.audit.slice(0, 5).map((event) => (
                  <p key={event.id} className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      {event.action} · {event.entity}
                    </span>
                    <span>{formatTime(event.createdAt)}</span>
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin eventos recientes.</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
