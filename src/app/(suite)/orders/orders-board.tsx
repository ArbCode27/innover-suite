"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChefHat, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cancelOrderAction, updateOrderStatusAction } from "@/lib/commerce/actions";
import { mapOrderRow, ORDER_SELECT } from "@/lib/commerce/orders";
import {
  ACTIVE_ORDER_STATUSES,
  FULFILLMENT_LABELS,
  formatMoney,
  KITCHEN_STATUS_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABELS,
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

export const OrdersBoard = ({ organizationId, kitchenMode, initialOrders, canManage }: OrdersBoardProps) => {
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setOrders(initialOrders);
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
              setOrders(data.map((row) => mapOrderRow(row as Parameters<typeof mapOrderRow>[0])));
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <Card key={column.status} className="border-primary/15 bg-card/80">
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
            <CardContent className="space-y-3">
              {column.orders.length ? (
                column.orders.map((order) => (
                  <article key={order.id} className="rounded-xl border border-primary/10 bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">#{order.id} · {order.contactName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(order.createdAt)}
                          {isMetaChannel(order.channel) ? ` · ${CHANNEL_LABELS[order.channel]}` : ""}
                          {` · ${FULFILLMENT_LABELS[order.fulfillment]}`}
                        </p>
                      </div>
                      <p className="text-sm font-medium">{formatMoney(order.total)}</p>
                    </div>
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleCancel(order)}
                        >
                          <Undo2 />
                          Cancelar
                        </Button>
                        {order.conversationId ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href="/inbox">Chat</Link>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin pedidos en esta columna.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
