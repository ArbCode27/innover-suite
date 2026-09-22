"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  format,
  isToday,
  isYesterday,
  isThisWeek,
  parseISO,
  subDays,
  startOfMonth,
  isAfter,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  MessageCircle,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CHANNEL_BADGE_CLASSNAMES,
  CHANNEL_LABELS,
} from "@/lib/contacts/display";
import type { ContactConversationItem } from "@/lib/contacts/board";
import type { MetaChannel } from "@/types/domain";
import { cn } from "@/lib/utils";

type ContactConversationHistoryProps = {
  conversations: ContactConversationItem[];
  contactName: string;
};

type StatusFilter = "all" | "resolved" | "active";
type ChannelFilter = "all" | MetaChannel;
type DatePeriodFilter = "all" | "today" | "week" | "month";

const formatDateTime = (isoString: string) => {
  try {
    return format(parseISO(isoString), "d MMM yyyy, h:mm a", { locale: es });
  } catch {
    return isoString;
  }
};

const getDateGroupTitle = (isoString: string) => {
  try {
    const date = parseISO(isoString);
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    if (isThisWeek(date, { weekStartsOn: 1 })) return "Esta semana";
    return format(date, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return "Fecha no especificada";
  }
};

export const ContactConversationHistory = ({
  conversations,
  contactName,
}: ContactConversationHistoryProps) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [dateFilter, setDateFilter] = useState<DatePeriodFilter>("all");
  const [expandedHistories, setExpandedHistories] = useState<Record<number, boolean>>({});

  const toggleHistoryExpanded = (conversationId: number) => {
    setExpandedHistories((prev) => ({
      ...prev,
      [conversationId]: !prev[conversationId],
    }));
  };

  const counts = useMemo(() => {
    const total = conversations.length;
    const resolved = conversations.filter((c) => c.status === "resolved").length;
    const active = total - resolved;
    return { total, resolved, active };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const now = new Date();

    return conversations.filter((conv) => {
      // 1. Filtro por estado
      if (statusFilter === "resolved" && conv.status !== "resolved") return false;
      if (statusFilter === "active" && conv.status === "resolved") return false;

      // 2. Filtro por canal
      if (channelFilter !== "all" && conv.channel !== channelFilter) return false;

      // 3. Filtro por periodo de fecha
      if (dateFilter !== "all") {
        const convDate = parseISO(conv.resolvedAt || conv.lastMessageAt || conv.updatedAt || conv.createdAt);
        if (dateFilter === "today" && !isToday(convDate)) return false;
        if (dateFilter === "week" && !isAfter(convDate, subDays(now, 7))) return false;
        if (dateFilter === "month" && !isAfter(convDate, startOfMonth(now))) return false;
      }

      return true;
    });
  }, [conversations, statusFilter, channelFilter, dateFilter]);

  // Agrupación cronológica por sección de fecha
  const groupedConversations = useMemo(() => {
    const groups: Array<{ title: string; items: ContactConversationItem[] }> = [];
    const groupMap = new Map<string, ContactConversationItem[]>();

    filteredConversations.forEach((conv) => {
      const primaryDate = conv.resolvedAt || conv.lastMessageAt || conv.updatedAt || conv.createdAt;
      const groupKey = getDateGroupTitle(primaryDate);

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
        groups.push({ title: groupKey, items: groupMap.get(groupKey)! });
      }
      groupMap.get(groupKey)!.push(conv);
    });

    return groups;
  }, [filteredConversations]);

  if (!conversations.length) {
    return (
      <Card className="border-primary/15 bg-card/80">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessagesSquare className="size-4 text-primary" />
            Historial de Conversaciones
          </CardTitle>
          <CardDescription>
            Registro de interacciones y resoluciones con {contactName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Este cliente todavía no tiene conversaciones registradas.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessagesSquare className="size-4 text-primary" />
              Historial de Conversaciones
            </CardTitle>
            <CardDescription className="text-xs">
              Historial consolidado por cliente con separación por fecha y auditoría de resolución.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground">
              {counts.total} en total
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
              {counts.resolved} culminadas
            </span>
            {counts.active > 0 ? (
              <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 font-medium text-blue-600 dark:text-blue-400">
                {counts.active} activas
              </span>
            ) : null}
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Todas ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("resolved")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                statusFilter === "resolved"
                  ? "bg-emerald-600 text-white font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Culminadas ({counts.resolved})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                statusFilter === "active"
                  ? "bg-primary text-primary-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              En curso ({counts.active})
            </button>
          </div>

          {/* Filtro Canal */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
            className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filtrar por canal"
          >
            <option value="all">Todos los canales</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="messenger">Messenger</option>
          </select>

          {/* Filtro Fecha */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DatePeriodFilter)}
            className="h-7 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filtrar por periodo de fecha"
          >
            <option value="all">Cualquier fecha</option>
            <option value="today">Hoy</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Este mes</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-2">
        {!groupedConversations.length ? (
          <div className="rounded-xl border border-dashed border-border/80 py-8 text-center text-sm text-muted-foreground">
            No se encontraron conversaciones que coincidan con los filtros aplicados.
          </div>
        ) : (
          groupedConversations.map((group) => (
            <div key={group.title} className="space-y-3">
              {/* Separador de Fecha */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="size-3.5 text-primary" />
                  {group.title}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>

              {/* Tarjetas de Conversación en esta fecha */}
              <div className="space-y-2.5">
                {group.items.map((conv) => {
                  const isResolved = conv.status === "resolved";
                  const channel = conv.channel as MetaChannel;
                  const channelLabel = CHANNEL_LABELS[channel] || conv.channel;
                  const channelBadgeClass = CHANNEL_BADGE_CLASSNAMES[channel] || "";
                  const historyExpanded = Boolean(expandedHistories[conv.id]);
                  const pastResolutions = conv.resolutionHistory || [];

                  return (
                    <article
                      key={conv.id}
                      className={cn(
                        "rounded-xl border p-3.5 transition-all",
                        isResolved
                          ? "border-emerald-500/20 bg-background/70 hover:border-emerald-500/35"
                          : "border-primary/20 bg-background/70 hover:border-primary/35",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                              channelBadgeClass,
                            )}
                          >
                            {channelLabel}
                          </span>

                          {isResolved ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="size-3" />
                              Culminada con éxito
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            >
                              <Clock className="size-3" />
                              {conv.status === "in_progress" ? "En atención" : "Abierta"}
                            </Badge>
                          )}

                          <span className="text-muted-foreground">#{conv.id}</span>
                        </div>

                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTime(conv.resolvedAt || conv.lastMessageAt || conv.updatedAt)}
                        </span>
                      </div>

                      {/* Motivo de culminación */}
                      {isResolved && conv.resolutionReason ? (
                        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                          <Sparkles className="size-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">{conv.resolutionReason}</p>
                            {conv.resolutionSummary ? (
                              <p className="text-muted-foreground italic font-normal">
                                &ldquo;{conv.resolutionSummary}&rdquo;
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {/* Vista previa del último mensaje */}
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {conv.lastMessagePreview || "Sin vista previa de mensajes"}
                      </p>

                      {/* Historial anterior si ha tenido múltiples ciclos de resolución */}
                      {pastResolutions.length > 1 ? (
                        <div className="mt-2 pt-2 border-t border-border/40">
                          <button
                            type="button"
                            onClick={() => toggleHistoryExpanded(conv.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            <History className="size-3" />
                            {historyExpanded
                              ? "Ocultar culminaciones anteriores"
                              : `Ver ${pastResolutions.length - 1} culminación(es) previa(s)`}
                          </button>

                          {historyExpanded ? (
                            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-muted text-[11px]">
                              {pastResolutions.slice(0, -1).map((item, idx) => (
                                <div key={item.id || idx} className="text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {formatDateTime(item.resolvedAt)}:
                                  </span>{" "}
                                  {item.reason || "Culminada"}
                                  {item.summary ? ` — "${item.summary}"` : ""}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Acción para abrir el chat en el Inbox */}
                      <div className="mt-2.5 flex items-center justify-end">
                        <Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-primary">
                          <Link href={`/inbox?conversation=${conv.id}`}>
                            <MessageCircle className="size-3.5" />
                            <span>Abrir chat</span>
                            <ChevronRight className="size-3" />
                          </Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
