"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChefHat,
  ClipboardList,
  Eye,
  Kanban,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  MessageSquare,
  PackageCheck,
  Phone,
  Printer,
  RotateCcw,
  Search,
  Store,
  Table as TableIcon,
  Truck,
  Undo2,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import {
  cancelOrderAction,
  updateOrderPaymentAction,
  updateOrderStatusAction,
} from "@/lib/commerce/actions";
import { loadOrdersByDateRange, mapOrderRow, ORDER_SELECT } from "@/lib/commerce/orders";
import {
  ACTIVE_ORDER_STATUSES,
  formatMoney,
  FULFILLMENT_LABELS,
  KITCHEN_STATUS_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATUS_LABELS,
  type FulfillmentType,
  type OrderRecord,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/commerce/types";
import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateFilterLabel,
  OrdersDateFilter,
  type DateFilterValue,
} from "@/components/orders/orders-date-filter";
import { OrderDetailDialog } from "./order-detail-dialog";
import type { MetaChannel } from "@/types/domain";

type OrdersBoardProps = {
  organizationId: number;
  kitchenMode: boolean;
  initialOrders: OrderRecord[];
  canManage: boolean;
  canMarkPayment: boolean;
};

type StatusViewFilter = "active" | "completed" | "cancelled" | "all";
type LayoutMode = "kanban" | "table";

const isMetaChannel = (value: string | null): value is MetaChannel =>
  value === "whatsapp" || value === "instagram" || value === "messenger";

const statusLabel = (status: OrderStatus, kitchenMode: boolean) =>
  kitchenMode ? KITCHEN_STATUS_LABELS[status] : ORDER_STATUS_LABELS[status];

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatDateShort = (value: string) =>
  new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const cleanPhoneForWa = (phone: string | null) => {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
};

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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<"all" | "delivery" | "pickup">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [activeTab, setActiveTab] = useState<OrderStatus>("received");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [isPending, startTransition] = useTransition();
  const knownIdsRef = useRef(new Set(initialOrders.map((order) => order.id)));

  useEffect(() => {
    setOrders(initialOrders);
    knownIdsRef.current = new Set(initialOrders.map((order) => order.id));
  }, [initialOrders]);

  // Carga pedidos de Supabase cuando se aplica filtro de fecha
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

  // Base de pedidos según filtro de fecha
  const baseOrders = dateOrders !== null ? dateOrders : orders;

  // Filtrado de pedidos por búsqueda, tipo de entrega y estado de pago
  const currentOrders = useMemo(() => {
    return baseOrders.filter((order) => {
      // 1. Filtro de búsqueda
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const idMatch = String(order.id).includes(query.replace("#", ""));
        const nameMatch = (order.contactName ?? "").toLowerCase().includes(query);
        const phoneMatch = (order.contactPhone ?? "").toLowerCase().includes(query);
        const addressMatch = (order.deliveryAddress ?? "").toLowerCase().includes(query);
        const noteMatch = (order.customerNote ?? "").toLowerCase().includes(query);
        const itemMatch = order.items.some((i) => i.name.toLowerCase().includes(query));

        if (!idMatch && !nameMatch && !phoneMatch && !addressMatch && !noteMatch && !itemMatch) {
          return false;
        }
      }

      // 2. Filtro de modalidad de entrega
      if (fulfillmentFilter !== "all") {
        if (fulfillmentFilter === "delivery" && order.fulfillment !== "delivery") {
          return false;
        }
        if (fulfillmentFilter === "pickup" && order.fulfillment !== "pickup") {
          return false;
        }
      }

      // 3. Filtro de estado de pago
      if (paymentFilter !== "all") {
        if (paymentFilter === "paid" && order.paymentStatus !== "paid") {
          return false;
        }
        if (paymentFilter === "unpaid" && order.paymentStatus === "paid") {
          return false;
        }
      }

      return true;
    });
  }, [baseOrders, searchQuery, fulfillmentFilter, paymentFilter]);

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

  // Columnas Kanban según el selector de vista de estado
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
      const updater = (current: OrderRecord[]) =>
        current.map((item) => (item.id === order.id ? { ...item, status: next } : item));
      setOrders(updater);
      setDateOrders((current) => (current ? updater(current) : null));
      setSelectedOrder((current) => (current?.id === order.id ? { ...current, status: next } : current));
      toast.success(result.success);
    });
  };

  const handlePay = (order: OrderRecord) => {
    const nextPaymentStatus: PaymentStatus = order.paymentStatus === "paid" ? "unpaid" : "paid";
    startTransition(async () => {
      const result = await updateOrderPaymentAction({
        orderId: order.id,
        paymentStatus: nextPaymentStatus,
        paymentMethod: nextPaymentStatus === "paid" ? "caja" : undefined,
      });
      if (result.error) {
        toastActionError(result);
        return;
      }
      const updater = (current: OrderRecord[]) =>
        current.map((item) => (item.id === order.id ? { ...item, paymentStatus: nextPaymentStatus } : item));
      setOrders(updater);
      setDateOrders((current) => (current ? updater(current) : null));
      setSelectedOrder((current) =>
        current?.id === order.id ? { ...current, paymentStatus: nextPaymentStatus } : current,
      );
      toast.success(result.success);
    });
  };

  const handleCancel = (order: OrderRecord) => {
    const cancelledStatus: OrderStatus = "cancelled";
    startTransition(async () => {
      const result = await cancelOrderAction({
        orderId: order.id,
        reason: "Cancelado desde el panel de pedidos",
      });
      if (result.error) {
        toastActionError(result);
        return;
      }
      const updater = (current: OrderRecord[]) =>
        current.map((item) => (item.id === order.id ? { ...item, status: cancelledStatus } : item));
      setOrders(updater);
      setDateOrders((current) => (current ? updater(current) : null));
      setSelectedOrder((current) =>
        current?.id === order.id ? { ...current, status: cancelledStatus } : current,
      );
      toast.success(result.success);
    });
  };

  const handleClearDateFilter = () => {
    setDateFilter({ mode: "all" });
  };

  const handleOrderUpdated = (updated: OrderRecord) => {
    const updater = (current: OrderRecord[]) =>
      current.map((item) => (item.id === updated.id ? updated : item));
    setOrders(updater);
    setDateOrders((current) => (current ? updater(current) : null));
    setSelectedOrder(updated);
  };

  // Renderizado de tarjeta individual de pedido (Kanban)
  const renderOrderCard = (order: OrderRecord) => {
    const cleanPhone = cleanPhoneForWa(order.contactPhone);
    const isPaid = order.paymentStatus === "paid";
    const nextStatus = NEXT_ORDER_STATUS[order.status];

    return (
      <article
        key={order.id}
        className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition hover:border-primary/40 hover:shadow-sm"
      >
        <div>
          {/* Header de la tarjeta */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-foreground">#{order.id}</span>
              {order.channel ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                  {CHANNEL_LABELS[order.channel as keyof typeof CHANNEL_LABELS] ?? order.channel}
                </Badge>
              ) : null}
              <span className="text-[11px] text-muted-foreground">{formatTime(order.createdAt)}</span>
            </div>

            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0 font-semibold",
                isPaid
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}
            >
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </Badge>
          </div>

          {/* Cliente y Teléfono */}
          <div className="mt-2 flex items-center justify-between">
            <span className="font-semibold text-sm text-foreground truncate max-w-[170px]">
              {order.contactName}
            </span>
            {cleanPhone ? (
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                title="Abrir WhatsApp"
              >
                <Phone className="size-2.5" />
                <span>WA</span>
              </a>
            ) : null}
          </div>

          {/* Logística & Entrega */}
          <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                {order.fulfillment === "delivery" ? (
                  <>
                    <Truck className="size-3 text-sky-600 dark:text-sky-400" />
                    <span>Delivery</span>
                    {order.deliveryZone ? (
                      <span className="text-muted-foreground font-normal">({order.deliveryZone})</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Store className="size-3 text-muted-foreground" />
                    <span>Retiro en sede</span>
                  </>
                )}
              </div>
              {order.deliveryFee ? (
                <span className="text-[10px] text-muted-foreground">
                  +{formatMoney(order.deliveryFee)}
                </span>
              ) : null}
            </div>

            {order.deliveryAddress ? (
              <p className="line-clamp-2 text-[11px] text-muted-foreground">
                <MapPin className="inline size-3 mr-0.5 text-primary/70" />
                {order.deliveryAddress}
              </p>
            ) : null}
          </div>

          {/* Lista de Ítems */}
          <div className="mt-2 space-y-1 text-xs">
            {order.items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex justify-between text-[11px]">
                <span className="truncate max-w-[190px] text-foreground">
                  <strong className="font-semibold">{item.quantity}×</strong> {item.name}
                  {item.notes ? ` (${item.notes})` : ""}
                </span>
                <span className="tabular-nums text-muted-foreground shrink-0 ml-1">
                  {formatMoney(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
            {order.items.length > 3 ? (
              <p className="text-[10px] text-muted-foreground italic">
                +{order.items.length - 3} producto(s) más
              </p>
            ) : null}
          </div>

          {order.customerNote ? (
            <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground italic">
              Nota: {order.customerNote}
            </p>
          ) : null}
        </div>

        {/* Footer y Acciones de la tarjeta */}
        <div className="mt-3 border-t border-border/40 pt-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Total:</span>
            <span className="font-bold text-sm text-foreground tabular-nums">
              {formatMoney(order.total)}
            </span>
          </div>

          {canManage ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {nextStatus && order.status !== "cancelled" ? (
                <Button
                  type="button"
                  size="xs"
                  disabled={isPending}
                  className="h-7 text-xs flex-1 gap-1 font-semibold"
                  onClick={() => handleAdvance(order)}
                >
                  {isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  {statusLabel(nextStatus, kitchenMode)}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="xs"
                className="h-7 text-xs"
                onClick={() => setSelectedOrder(order)}
                title="Ver detalle completo"
              >
                <Eye className="size-3 mr-1" />
                Detalle
              </Button>

              {order.conversationId ? (
                <Button asChild size="xs" variant="ghost" className="h-7 text-xs px-2" title="Ir al chat">
                  <Link href={`/inbox?conversation=${order.conversationId}`}>
                    <MessageSquare className="size-3" />
                  </Link>
                </Button>
              ) : null}

              <Button asChild size="xs" variant="ghost" className="h-7 text-xs px-2" title="Imprimir ticket">
                <Link href={`/print/orders/${order.id}`} target="_blank">
                  <Printer className="size-3" />
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="h-7 text-xs w-full"
              onClick={() => setSelectedOrder(order)}
            >
              Ver detalle
            </Button>
          )}
        </div>
      </article>
    );
  };

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
        <EmptyIcon className="size-10 text-primary/40" strokeWidth={1.25} aria-hidden />
        <p className="max-w-[14rem] text-xs text-muted-foreground">
          {searchQuery || fulfillmentFilter !== "all" || paymentFilter !== "all"
            ? "No hay pedidos con los filtros aplicados"
            : dateFilter.mode !== "all"
              ? "No hay pedidos en la fecha seleccionada"
              : "No hay pedidos en esta etapa"}
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
      {/* 1. Barra de Controles Superiores */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
        {/* Fila 1: Búsqueda, Filtro de Fecha y Selector de Vista */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, #pedido, teléfono, dirección..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OrdersDateFilter
              value={dateFilter}
              onChange={setDateFilter}
              filteredCount={currentOrders.length}
              totalCount={orders.length}
            />

            {/* Switcher Kanban vs Tabla */}
            <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setLayoutMode("kanban")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  layoutMode === "kanban"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Vista Tablero Kanban"
              >
                <Kanban className="size-3.5" />
                <span className="hidden sm:inline">Tablero</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  layoutMode === "table"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Vista Lista Logística"
              >
                <TableIcon className="size-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Filtros de Estado, Entrega y Pago */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-xs">
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
              <span>Activos</span>
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
              <span>{kitchenMode ? "Despachadas" : "Entregados"}</span>
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
              <span>Cancelados</span>
              {statusCounts.cancelled > 0 ? (
                <Badge
                  variant="outline"
                  className="px-1 py-0 text-[10px] text-rose-500 border-rose-500/30"
                >
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
              <span>Todos</span>
              <Badge variant="outline" className="px-1 py-0 text-[10px]">
                {statusCounts.total}
              </Badge>
            </button>
          </div>

          {/* Filtros Rápidos: Modalidad y Pago */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/60 p-0.5">
              <button
                type="button"
                onClick={() => setFulfillmentFilter("all")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  fulfillmentFilter === "all"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todas las entregas
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentFilter("delivery")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] flex items-center gap-1",
                  fulfillmentFilter === "delivery"
                    ? "bg-sky-500/15 font-semibold text-sky-700 dark:text-sky-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Truck className="size-3" />
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentFilter("pickup")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] flex items-center gap-1",
                  fulfillmentFilter === "pickup"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Store className="size-3" />
                Retiro
              </button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/60 p-0.5">
              <button
                type="button"
                onClick={() => setPaymentFilter("all")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  paymentFilter === "all"
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todos los pagos
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter("paid")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  paymentFilter === "paid"
                    ? "bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Pagados
              </button>
              <button
                type="button"
                onClick={() => setPaymentFilter("unpaid")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  paymentFilter === "unpaid"
                    ? "bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sin pagar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de filtro de fecha */}
      {dateFilter.mode !== "all" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-foreground shadow-xs">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary shrink-0" aria-hidden />
            <span>
              Filtrando pedidos por:{" "}
              <strong className="text-foreground font-semibold">
                {formatDateFilterLabel(dateFilter)}
              </strong>
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              {currentOrders.length} {currentOrders.length === 1 ? "pedido" : "pedidos"} encontrados
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

      {/* 2. Vista de Tablero Kanban */}
      {layoutMode === "kanban" ? (
        <>
          {/* Vista Móvil (pestañas por columna) */}
          <div className="lg:hidden">
            {columns.length > 1 ? (
              <div
                role="tablist"
                aria-label="Etapas de pedidos"
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
                        {kitchenMode && column.status === "preparing" ? (
                          <ChefHat className="size-3.5" aria-hidden />
                        ) : null}
                        {column.label}
                      </span>
                      <span
                        className={
                          isActive
                            ? "text-[10px] text-primary-foreground/80"
                            : "text-[10px] text-muted-foreground"
                        }
                      >
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

          {/* Vista Escritorio en Columnas */}
          <div className={cn("max-lg:hidden", desktopGridClass)}>
            {columns.map((column) => (
              <Card
                key={column.status}
                className="relative min-h-[22rem] overflow-hidden border-primary/15 bg-card/80 flex flex-col"
              >
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-1.5 ${STAGE_ACCENT[column.status]}`}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {kitchenMode && column.status === "preparing" ? (
                          <ChefHat className="size-4" aria-hidden />
                        ) : null}
                        {column.label}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {column.orders.length} pedidos
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {column.orders.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">{renderColumnBody(column)}</CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        /* 3. Vista de Lista / Tabla Logística */
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Pedido</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Modalidad & Destino</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Pago & Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                      No se encontraron pedidos con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentOrders.map((order) => {
                    const cleanPhone = cleanPhoneForWa(order.contactPhone);
                    const isPaid = order.paymentStatus === "paid";
                    const nextStatus = NEXT_ORDER_STATUS[order.status];

                    return (
                      <TableRow key={order.id} className="text-xs">
                        {/* ID y Canal */}
                        <TableCell className="font-mono font-bold whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>#{order.id}</span>
                            {order.channel ? (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">
                                {order.channel.slice(0, 2)}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Fecha */}
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDateShort(order.createdAt)}
                        </TableCell>

                        {/* Cliente */}
                        <TableCell>
                          <div>
                            <p className="font-semibold text-foreground">{order.contactName}</p>
                            {order.contactPhone ? (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <span>{order.contactPhone}</span>
                                {cleanPhone ? (
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 hover:underline"
                                  >
                                    (WA)
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Modalidad y Destino */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              {order.fulfillment === "delivery" ? (
                                <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[10px]">
                                  <Truck className="size-2.5 mr-1" />
                                  Delivery
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  <Store className="size-2.5 mr-1" />
                                  Retiro
                                </Badge>
                              )}
                              {order.deliveryZone ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {order.deliveryZone}
                                </span>
                              ) : null}
                            </div>
                            {order.deliveryAddress ? (
                              <p className="line-clamp-1 text-[11px] text-muted-foreground max-w-xs">
                                {order.deliveryAddress}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Productos */}
                        <TableCell>
                          <div className="space-y-0.5 max-w-xs">
                            {order.items.slice(0, 2).map((item) => (
                              <p key={item.id} className="truncate text-[11px]">
                                <span className="font-semibold">{item.quantity}×</span> {item.name}
                              </p>
                            ))}
                            {order.items.length > 2 ? (
                              <span className="text-[10px] text-muted-foreground italic">
                                +{order.items.length - 2} más...
                              </span>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Pago y Total */}
                        <TableCell className="whitespace-nowrap">
                          <div>
                            <span className="font-bold text-foreground">
                              {formatMoney(order.total)}
                            </span>
                            <div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1 py-0",
                                  isPaid
                                    ? "text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-300"
                                    : "text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-300",
                                )}
                              >
                                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>

                        {/* Estado */}
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">
                            {statusLabel(order.status, kitchenMode)}
                          </Badge>
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && nextStatus && order.status !== "cancelled" ? (
                              <Button
                                size="xs"
                                disabled={isPending}
                                className="h-7 text-xs font-semibold"
                                onClick={() => handleAdvance(order)}
                              >
                                {statusLabel(nextStatus, kitchenMode)}
                              </Button>
                            ) : null}

                            <Button
                              variant="outline"
                              size="xs"
                              className="h-7 text-xs"
                              onClick={() => setSelectedOrder(order)}
                            >
                              Detalle
                            </Button>

                            {order.conversationId ? (
                              <Button asChild size="xs" variant="ghost" className="h-7 text-xs px-2">
                                <Link href={`/inbox?conversation=${order.conversationId}`}>
                                  <MessageSquare className="size-3" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal de Detalle Completo de Pedido */}
      <OrderDetailDialog
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        kitchenMode={kitchenMode}
        canManage={canManage}
        canMarkPayment={canMarkPayment}
        isPending={isPending}
        onAdvance={handleAdvance}
        onPay={handlePay}
        onCancel={handleCancel}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
};
