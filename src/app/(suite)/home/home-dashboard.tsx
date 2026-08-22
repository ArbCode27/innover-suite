import Link from "next/link";
import {
  Bot,
  CalendarDays,
  Camera,
  ClipboardList,
  MessageCircle,
  MessagesSquare,
  Package,
  UserRound,
  Wallet,
} from "lucide-react";
import type { DashboardBoard } from "@/lib/dashboard/board";
import { CHANNEL_BADGE_CLASSNAMES, CHANNEL_LABELS, formatSocialHandle } from "@/lib/contacts/display";
import { formatMoney } from "@/lib/commerce/types";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MetaChannel } from "@/types/domain";

type HomeDashboardProps = {
  organizationName: string;
  board: DashboardBoard;
  showAudit: boolean;
  canUseInbox: boolean;
};

const channelIcon = (channel: MetaChannel) => {
  if (channel === "instagram") return Camera;
  if (channel === "messenger") return MessagesSquare;
  return MessageCircle;
};

const formatTime = (value: string | null) => {
  if (!value) return "Sin actividad";
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(new Date(value));
};

const statusLabel: Record<DashboardBoard["chats"][number]["status"], string> = {
  open: "Abierta",
  in_progress: "En curso",
  resolved: "Resuelta",
};

const orderStatusLabel: Record<string, string> = {
  received: "Nuevo",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const HomeDashboard = ({ organizationName, board, showAudit, canUseInbox }: HomeDashboardProps) => {
  const { today, report, chats } = board;
  const maxChannelRevenue = Math.max(1, ...Object.values(report.byChannel));

  const kpis = [
    {
      label: "Ingresos 30 días",
      value: formatMoney(report.revenue30d),
      hint: `${report.orders30d} pedidos · ${report.cancelled30d} cancelados`,
      icon: ClipboardList,
      href: "/orders",
    },
    {
      label: "Hoy",
      value: formatMoney(today.revenueToday),
      hint: `${today.ordersToday} pedidos del día`,
      icon: Wallet,
      href: "/orders",
    },
    {
      label: "Chats abiertos",
      value: String(today.openChats),
      hint: `${today.unreadChats} no leídos · ${today.humanQueue} en cola`,
      icon: MessageCircle,
      href: "/inbox",
    },
    {
      label: "Cola humana",
      value: String(today.humanQueue),
      hint: `${report.conversationsAi} en IA · ${report.conversationsHuman} humanas`,
      icon: UserRound,
      href: "/inbox",
    },
    {
      label: "Sin pagar",
      value: String(today.unpaidOrders),
      hint: "Pedidos activos pendientes de caja",
      icon: Wallet,
      href: "/orders",
    },
    {
      label: "Operación",
      value: String(today.appointmentsToday),
      hint: `${today.lowStock} stock bajo · ${today.contacts} contactos`,
      icon: today.appointmentsToday ? CalendarDays : Package,
      href: today.appointmentsToday ? "/calendar" : "/inventory",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card className="h-full border-primary/15 bg-card/80 transition hover:border-primary/40">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Ventas por canal</CardTitle>
            <CardDescription>Últimos 30 días en {CALENDAR_TIME_ZONE}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.byChannel).length ? (
              Object.entries(report.byChannel).map(([channel, amount]) => (
                <div key={channel} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{CHANNEL_LABELS[channel as MetaChannel] ?? channel}</span>
                    <span>{formatMoney(amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(8, Math.round((amount / maxChannelRevenue) * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay ventas en el período.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Conversaciones del negocio</CardTitle>
            <CardDescription>
              {report.conversationsTotal} hilos · {report.conversationsOpen} abiertos · {report.conversationsAi} en IA
            </CardDescription>
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

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Chats con métricas</h2>
            <p className="text-sm text-muted-foreground">
              Actividad reciente de {organizationName}: pedidos, ingresos e impagos por conversación.
            </p>
          </div>
          {canUseInbox ? (
            <Link href="/inbox" className="text-sm text-primary hover:underline">
              Abrir inbox
            </Link>
          ) : null}
        </div>

        {chats.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {chats.map((chat) => {
              const ChannelIcon = channelIcon(chat.channel);
              const handle = formatSocialHandle(chat.contactUsername);
              const href = canUseInbox ? `/inbox?conversation=${chat.id}` : "/home";
              return (
                <Link key={chat.id} href={href}>
                  <Card className="h-full border-primary/15 bg-card/80 transition hover:border-primary/40">
                    <CardHeader className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{chat.contactName}</CardTitle>
                          <CardDescription className="truncate">
                            {handle ? `${handle} · ` : ""}
                            {formatTime(chat.lastMessageAt)}
                          </CardDescription>
                        </div>
                        {chat.unreadCount > 0 ? <Badge>{chat.unreadCount}</Badge> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn("h-7 px-2.5 text-[13px] [&>svg]:size-3.5!", CHANNEL_BADGE_CLASSNAMES[chat.channel])}
                        >
                          <ChannelIcon aria-hidden />
                          {CHANNEL_LABELS[chat.channel]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-7 px-2.5 text-[13px]",
                            chat.mode === "ai" &&
                              "border-cyan-400 bg-cyan-400/15 text-cyan-700 dark:text-cyan-300",
                          )}
                        >
                          {chat.mode === "ai" ? <Bot className="size-3.5" aria-hidden /> : null}
                          {chat.mode === "ai" ? "IA" : "Humano"}
                        </Badge>
                        <Badge variant="outline">{statusLabel[chat.status]}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4 pt-0">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {chat.lastMessagePreview || "Sin mensajes recientes"}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-primary/8 px-2 py-2">
                          <p className="text-[11px] text-muted-foreground">Pedidos</p>
                          <p className="text-sm font-semibold">{chat.ordersCount}</p>
                        </div>
                        <div className="rounded-xl bg-primary/8 px-2 py-2">
                          <p className="text-[11px] text-muted-foreground">Ingresos</p>
                          <p className="text-sm font-semibold">{formatMoney(chat.revenue)}</p>
                        </div>
                        <div className="rounded-xl bg-primary/8 px-2 py-2">
                          <p className="text-[11px] text-muted-foreground">Impagos</p>
                          <p className="text-sm font-semibold">{chat.unpaidCount}</p>
                        </div>
                      </div>
                      {chat.lastOrderStatus ? (
                        <p className="text-xs text-muted-foreground">
                          Último pedido: {orderStatusLabel[chat.lastOrderStatus] ?? chat.lastOrderStatus}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-primary/20 bg-card/70">
            <CardHeader>
              <CardTitle>Aún no hay chats</CardTitle>
              <CardDescription>
                Cuando entren mensajes de WhatsApp, Instagram o Messenger, verás aquí el pulso de cada conversación.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </div>
  );
};
