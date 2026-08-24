"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChefHat, ClipboardList, Loader2, PackageCheck, Printer, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cancelOrderAction, updateOrderPaymentAction, updateOrderStatusAction } from "@/lib/commerce/actions";
import { mapOrderRow, ORDER_SELECT } from "@/lib/commerce/orders";
import {
  ACTIVE_ORDER_STATUSES,
  FULFILLMENT_LABELS,
  formatMoney,
  KITCHEN_STATUS_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/commerce/types";
import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetaChannel } from "@/types/domain";

type OrdersBoardProps = {
  organizationId: number;
  kitchenMode: boolean;
  initialOrders: OrderRecord[];
  canManage: boolean;
  canMarkPayment: boolean;
};

const isMetaChannel = (value: string | null): value is MetaChannel =>
  value === "whatsapp" || value === "instagram" || value === "messenger";

const statusLabel = (status: OrderStatus, kitchenMode: boolean) =>
  kitchenMode ? KITCHEN_STATUS_LABELS[status] : ORDER_STATUS_LABELS[status];

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
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

const STAGE_ACCENT: Record<(typeof ACTIVE_ORDER_STATUSES)[number], string> = {
  received: "bg-sky-500",
  preparing: "bg-amber-500",
  ready: "bg-emerald-500",
};

const emptyColumnIcon = (status: OrderStatus) => {
  if (status === "preparing") return ChefHat;
  if (status === "ready") return PackageCheck;
  return ClipboardList;
};

export const OrdersBoard = ({ organizationId, kitchenMode, initialOrders, canManage, canMarkPayment }: OrdersBoardProps) => {
  const [orders, setOrders] = useState(initialOrders);
  const [activeTab, setActiveTab] = useState<OrderStatus>("received");
  const [isPending, startTransition] = useTransition();
  const knownIdsRef = useRef(new Set(initialOrders.map((order) => order.id)));

  useEffect(() => {
    setOrders(initialOrders);
    knownIdsRef.current = new Set(initialOrders.map((order) => order.id));
  }, [initialOrders]);

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

  const columns = useMemo(
    () =>
      ACTIVE_ORDER_STATUSES.map((status) => ({
        status,
        label: statusLabel(status, kitchenMode),
        orders: orders.filter((order) => order.status === status),
      })),
    [orders, kitchenMode],
  );
  const activeColumn = columns.find((column) => column.status === activeTab) ?? columns[0];

  const handleAdvance = (order: OrderRecord) => {
    const next = NEXT_ORDER_STATUS[order.status];
    if (!next) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction({ orderId: order.id, status: next });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: next } : item)));
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
        toast.error(result.error);
        return;
      }
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, paymentStatus: nextStatus } : item)),
      );
      toast.success(result.success);
    });
  };

  const handleCancel = (order: OrderRecord) => {
    startTransition(async () => {
      const result = await cancelOrderAction({ orderId: order.id, reason: "Cancelado desde el tablero" });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: "cancelled" } : item)));
      toast.success(result.success);
    });
  };

  const renderOrderCard = (order: OrderRecord) => (
    <article key={order.id} className="rounded-xl border border-primary/10 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            #{order.id} · {order.contactName}
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
        {order.taxAmount ? ` · ITBIS ${formatMoney(order.taxAmount)}` : ""}
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
          <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleCancel(order)}>
            <Undo2 />
            Cancelar
          </Button>
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
        <p className="max-w-[12rem] text-sm text-primary/70">Aún no hay pedidos en esta sección</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Etapas de comandas"
          className="sticky top-0 z-10 grid grid-cols-3 gap-1 rounded-2xl border border-primary/20 bg-card/95 p-1 shadow-sm backdrop-blur"
        >
          {columns.map((column) => {
            const isActive = column.status === activeTab;
            return (
              <button
                key={column.status}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 py-2 text-xs font-medium transition ${
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
      </div>

      <div className="max-lg:hidden grid grid-cols-3 gap-4">
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
