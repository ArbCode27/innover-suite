"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import {
  CalendarDays,
  Check,
  CheckCheck,
  ChefHat,
  ClipboardList,
  Loader2,
  PackageCheck,
  Printer,
  RotateCcw,
  Undo2,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { cancelOrderAction, updateOrderPaymentAction, updateOrderStatusAction } from "@/lib/commerce/actions";
import { loadOrdersByDateRange, mapOrderRow, ORDER_SELECT } from "@/lib/commerce/orders";
import {
  ACTIVE_ORDER_STATUSES,
  FULFILLMENT_LABELS,
  formatMoney,
  KITCHEN_STATUS_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABELS,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/commerce/types";
import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDateFilterLabel,
  OrdersDateFilter,
  type DateFilterValue,
} from "@/components/orders/orders-date-filter";
import type { MetaChannel } from "@/types/domain";

type OrdersBoardProps = {
  organizationId: number;
  kitchenMode: boolean;
  initialOrders: OrderRecord[];
  canManage: boolean;
  canMarkPayment: boolean;
};

type StatusViewFilter = "active" | "completed" | "cancelled" | "all";

const isMetaChannel = (value: string | null): value is MetaChannel =>
  value === "whatsapp" || value === "instagram" || value === "messenger";

const statusLabel = (status: OrderStatus, kitchenMode: boolean) =>
  kitchenMode ? KITCHEN_STATUS_LABELS[status] : ORDER_STATUS_LABELS[status];

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const playNewOrderTone = () => {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch {
    // El navegador puede bloquear audio hasta un gesto del usuario.
  }
};

const STAGE_ACCENT: Record<OrderStatus, string> = {
  received: "bg-sky-500",
  preparing: "bg-amber-500",
  ready: "bg-emerald-500",
  completed: "bg-teal-500",
  cancelled: "bg-rose-500",
};

const emptyColumnIcon = (status: OrderStatus) => {
  if (status === "preparing") return ChefHat;
  if (status === "ready") return PackageCheck;
  if (status === "completed") return CheckCheck;
  if (status === "cancelled") return XCircle;
  return ClipboardList;
};

export const OrdersBoard = ({
  organizationId,
  kitchenMode,
  initialOrders,
  canManage,
  canMarkPayment,
}: OrdersBoardProps) => {
  const [orders, setOrders] = useState(initialOrders);
  const [dateOrders, setDateOrders] = useState<OrderRecord[] | null>(null);
  const [isFetchingDateOrders, setIsFetchingDateOrders] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ mode: "all" });
  const [statusView, setStatusView] = useState<StatusViewFilter>("active");
  const [activeTab, setActiveTab] = useState<OrderStatus>("received");
  const [isPending, startTransition] = useTransition();
  const knownIdsRef = useRef(new Set(initialOrders.map((order) => order.id)));

  useEffect(() => {
    setOrders(initialOrders);
    knownIdsRef.current = new Set(initialOrders.map((order) => order.id));
  }, [initialOrders]);

  // Carga pedidos de Supabase cuando se aplica filtro de fecha específica o rango
  useEffect(() => {
    if (dateFilter.mode === "all") {
      setDateOrders(null);
      return;
    }

    let from: Date;
    let to: Date;

    if (dateFilter.mode === "single") {
      if (!dateFilter.date) {
        setDateOrders(null);
        return;
      }
      from = startOfDay(dateFilter.date);
      to = endOfDay(dateFilter.date);
    } else {
      if (!dateFilter.range?.from) {
        setDateOrders(null);
        return;
      }
      from = startOfDay(dateFilter.range.from);
      to = endOfDay(dateFilter.range.to || dateFilter.range.from);
    }

    let isCancelled = false;
    setIsFetchingDateOrders(true);

    const supabase = createSupabaseBrowserClient();
    loadOrdersByDateRange(supabase, organizationId, from.toISOString(), to.toISOString())
      .then((data) => {
        if (!isCancelled) {
          setDateOrders(data);
        }
      })
      .catch((err) => {
        console.error("Error al cargar pedidos por rango de fecha:", err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsFetchingDateOrders(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dateFilter, organizationId]);

  // Suscripción Realtime a cambios de órdenes
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`orders-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `organization_id=eq.${organizationId}` },
        () => {
          void supabase
            .from("orders")
            .select(ORDER_SELECT)
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .limit(80)
            .then(({ data, error }) => {
              if (error || !data) return;
              const next = data.map((row) => mapOrderRow(row as Parameters<typeof mapOrderRow>[0]));
              const known = knownIdsRef.current;
              if (next.some((order) => !known.has(order.id) && order.status === "received")) {
                playNewOrderTone();
              }
              knownIdsRef.current = new Set(next.map((order) => order.id));
              setOrders(next);
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Pedidos actuales según si hay filtro de fecha o no
  const currentOrders = dateOrders !== null ? dateOrders : orders;

  // Conteo de pedidos por grupo de estado
  const statusCounts = useMemo(() => {
    const active = currentOrders.filter(
      (order) => order.status !== "cancelled" && order.status !== "completed",
    ).length;
    const completed = currentOrders.filter((order) => order.status === "completed").length;
    const cancelled = currentOrders.filter((order) => order.status === "cancelled").length;
    return {
      active,
      completed,
      cancelled,
      total: currentOrders.length,
    };
  }, [currentOrders]);

  // Columnas activas según el selector de vista de estado
  const columns = useMemo(() => {
    let statuses: readonly OrderStatus[];
    if (statusView === "active") {
      statuses = ACTIVE_ORDER_STATUSES;
    } else if (statusView === "completed") {
      statuses = ["completed"];
    } else if (statusView === "cancelled") {
      statuses = ["cancelled"];
    } else {
      statuses = ORDER_STATUSES;
    }

    return statuses.map((status) => ({
      status,
      label: statusLabel(status, kitchenMode),
      orders: currentOrders.filter((order) => order.status === status),
    }));
  }, [currentOrders, statusView, kitchenMode]);

  // Sincronizar activeTab con las columnas disponibles
  useEffect(() => {
    if (!columns.some((c) => c.status === activeTab) && columns[0]) {
      setActiveTab(columns[0].status);
    }
  }, [columns, activeTab]);

  const activeColumn = columns.find((column) => column.status === activeTab) ?? columns[0];

  const handleAdvance = (order: OrderRecord) => {
    const next = NEXT_ORDER_STATUS[order.status];
    if (!next) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId: order.id, status: next });
      if (result.error) {
        toastActionError(result);
        return;
      }
      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: next } : item)));
      setDateOrders((current) =>
        current ? current.map((item) => (item.id === order.id ? { ...item, status: next } : item)) : null,
      );
      toast.success(result.success);
    });
  };

  const handlePay = (order: OrderRecord) => {
    const nextStatus = order.paymentStatus === "paid" ? "unpaid" : "paid";
    startTransition(async () => {
      const result = await updateOrderPaymentAction({
        orderId: order.id,
        paymentStatus: nextStatus,
        paymentMethod: nextStatus === "paid" ? "caja" : undefined,
      });
      if (result.error) {
        toastActionError(result);
        return;
      }
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, paymentStatus: nextStatus } : item)),
      );
      setDateOrders((current) =>
        current ? current.map((item) => (item.id === order.id ? { ...item, paymentStatus: nextStatus } : item)) : null,
      );
      toast.success(result.success);
    });
  };

  const handleCancel = (order: OrderRecord) => {
    startTransition(async () => {
      const result = await cancelOrderAction({ orderId: order.id, reason: "Cancelado desde el tablero" });
      if (result.error) {
        toastActionError(result);
        return;
      }
      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: "cancelled" } : item)));
      setDateOrders((current) =>
        current ? current.map((item) => (item.id === order.id ? { ...item, status: "cancelled" } : item)) : null,
      );
      toast.success(result.success);
    });
  };

  const handleClearDateFilter = () => {
    setDateFilter({ mode: "all" });
  };

  const renderOrderCard = (order: OrderRecord) => (
    <article key={order.id} className="rounded-xl border border-primary/10 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            #{order.id} - {order.contactName}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatTime(order.createdAt)}
            {isMetaChannel(order.channel) ? ` · ${CHANNEL_LABELS[order.channel]}` : ""}
            {` · ${FULFILLMENT_LABELS[order.fulfillment]}`}
          </p>
        </div>
        <p className="text-sm font-medium">{formatMoney(order.total)}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        {order.taxAmount ? ` · IVA ${formatMoney(order.taxAmount)}` : ""}
        {order.deliveryFee ? ` · envío ${formatMoney(order.deliveryFee)}` : ""}
      </p>
      {order.deliveryAddress ? (
        <p className="mt-1 text-xs text-muted-foreground">{order.deliveryAddress}</p>
      ) : null}
      <ul className="mt-2 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.name}
            {item.notes ? ` (${item.notes})` : ""}
          </li>
        ))}
      </ul>
      {order.customerNote ? (
        <p className="mt-2 text-xs text-muted-foreground">{order.customerNote}</p>
      ) : null}
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {NEXT_ORDER_STATUS[order.status] ? (
            <Button type="button" size="sm" disabled={isPending} onClick={() => handleAdvance(order)}>
              {isPending ? <Loader2 className="animate-spin" /> : <Check />}
              {statusLabel(NEXT_ORDER_STATUS[order.status] as OrderStatus, kitchenMode)}
            </Button>
          ) : null}
          {order.status !== "cancelled" ? (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleCancel(order)}>
              <Undo2 />
              Cancelar
            </Button>
          ) : null}
          {order.conversationId ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={`/inbox?conversation=${order.conversationId}`}>Chat</Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={`/print/orders/${order.id}`} target="_blank">
              <Printer />
              Ticket
            </Link>
          </Button>
          {canMarkPayment ? (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handlePay(order)}>
              <Wallet />
              {order.paymentStatus === "paid" ? "Marcar impago" : "Cobrar"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );

  const renderColumnBody = (column: (typeof columns)[number]) => {
    if (column.orders.length) {
      return <div className="space-y-3">{column.orders.map(renderOrderCard)}</div>;
    }

    const EmptyIcon = emptyColumnIcon(column.status);
    return (
      <div
        role="status"
        className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center"
      >
        <EmptyIcon className="size-12 text-primary/50" strokeWidth={1.25} aria-hidden />
        <p className="max-w-[14rem] text-sm text-primary/70">
          {dateFilter.mode !== "all"
            ? "No hay pedidos con este estado en la fecha seleccionada"
            : "Aún no hay pedidos en esta sección"}
        </p>
      </div>
    );
  };

  const desktopGridClass = useMemo(() => {
    if (columns.length === 1) return "grid grid-cols-1 max-w-3xl";
    if (columns.length === 2) return "grid grid-cols-2 gap-4";
    if (columns.length === 3) return "grid grid-cols-3 gap-4";
    if (columns.length === 4) return "grid grid-cols-2 lg:grid-cols-4 gap-4";
    return "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3";
  }, [columns.length]);

  return (
    <div className="space-y-5">
      {/* Barra de Filtros: Date Picker + Selector de estados */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrdersDateFilter
            value={dateFilter}
            onChange={setDateFilter}
            filteredCount={currentOrders.length}
            totalCount={orders.length}
          />
          {isFetchingDateOrders ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
              <span>Cargando comandas...</span>
            </div>
          ) : null}
        </div>

        {/* Pestañas de estado (Activas, Despachadas, Canceladas, Todas) */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/60 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setStatusView("active")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition",
              statusView === "active"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Activas</span>
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              {statusCounts.active}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setStatusView("completed")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition",
              statusView === "completed"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{kitchenMode ? "Despachadas" : "Entregadas"}</span>
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              {statusCounts.completed}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setStatusView("cancelled")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition",
              statusView === "cancelled"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Canceladas</span>
            {statusCounts.cancelled > 0 ? (
              <Badge variant="outline" className="px-1 py-0 text-[10px] text-rose-500 border-rose-500/30">
                {statusCounts.cancelled}
              </Badge>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setStatusView("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition",
              statusView === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>Todas</span>
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              {statusCounts.total}
            </Badge>
          </button>
        </div>
      </div>

      {/* Banner informativo cuando el filtro de fecha está activo */}
      {dateFilter.mode !== "all" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-foreground shadow-xs">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary shrink-0" aria-hidden />
            <span>
              Filtrando comandas por:{" "}
              <strong className="text-foreground font-semibold">{formatDateFilterLabel(dateFilter)}</strong>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {currentOrders.length} {currentOrders.length === 1 ? "comanda encontrada" : "comandas encontradas"}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleClearDateFilter}
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="size-3" />
            Mostrar todas las fechas
          </Button>
        </div>
      ) : null}

      {/* Vista Móvil con pestañas de etapa */}
      <div className="lg:hidden">
        {columns.length > 1 ? (
          <div
            role="tablist"
            aria-label="Etapas de comandas"
            className="sticky top-0 z-10 flex gap-1 overflow-x-auto rounded-2xl border border-primary/20 bg-card/95 p-1 shadow-sm backdrop-blur"
          >
            {columns.map((column) => {
              const isActive = column.status === activeTab;
              return (
                <button
                  key={column.status}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`flex min-h-12 flex-1 min-w-[5rem] flex-col items-center justify-center rounded-xl px-2 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(column.status)}
                >
                  <span className="flex items-center gap-1">
                    {kitchenMode && column.status === "preparing" ? <ChefHat className="size-3.5" aria-hidden /> : null}
                    {column.label}
                  </span>
                  <span className={isActive ? "text-[10px] text-primary-foreground/80" : "text-[10px] text-muted-foreground"}>
                    {column.orders.length}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {activeColumn ? (
          <Card className="relative mt-3 min-h-[22rem] overflow-hidden border-primary/15 bg-card/80">
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-1.5 ${STAGE_ACCENT[activeColumn.status]}`}
            />
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{activeColumn.label}</CardTitle>
              <CardDescription>{activeColumn.orders.length} pedidos</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">{renderColumnBody(activeColumn)}</CardContent>
          </Card>
        ) : null}
      </div>

      {/* Vista Escritorio en columnas */}
      <div className={cn("max-lg:hidden", desktopGridClass)}>
        {columns.map((column) => (
          <Card key={column.status} className="relative min-h-[22rem] overflow-hidden border-primary/15 bg-card/80">
            <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${STAGE_ACCENT[column.status]}`} />
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {kitchenMode && column.status === "preparing" ? <ChefHat className="size-4" aria-hidden /> : null}
                    {column.label}
                  </CardTitle>
                  <CardDescription>{column.orders.length} pedidos</CardDescription>
                </div>
                <Badge variant="outline">{column.orders.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">{renderColumnBody(column)}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
