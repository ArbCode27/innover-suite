"use client";

import { useState } from "react";
import { Clock, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/commerce/types";
import type { DashboardRestaurant } from "@/lib/dashboard/board";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HomeRestaurantMetricsProps = {
  restaurant: DashboardRestaurant;
};

const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const HourlyOrdersChart = ({
  hourlyOrders,
  peakHour,
}: {
  hourlyOrders: DashboardRestaurant["hourlyOrders"];
  peakHour: DashboardRestaurant["peakHour"];
}) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const max = Math.max(1, ...hourlyOrders.map((row) => row.orders));
  const activeHour = hoveredHour ?? peakHour?.hour ?? null;
  const active = hourlyOrders.find((row) => row.hour === activeHour) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex h-28 items-end gap-1" role="img" aria-label="Pedidos por hora del día">
        {hourlyOrders.map((row) => {
          const isPeak = peakHour?.hour === row.hour;
          const isActive = activeHour === row.hour;
          return (
            <button
              key={row.hour}
              type="button"
              aria-label={`${formatHour(row.hour)} · ${row.orders} pedidos`}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              onMouseEnter={() => setHoveredHour(row.hour)}
              onMouseLeave={() => setHoveredHour(null)}
              onFocus={() => setHoveredHour(row.hour)}
              onBlur={() => setHoveredHour(null)}
            >
              <span
                className={cn(
                  "w-full rounded-t-sm transition",
                  isPeak || isActive ? "bg-primary" : "bg-primary/25 hover:bg-primary/50",
                )}
                style={{ height: `${Math.max(row.orders ? 8 : 3, Math.round((row.orders / max) * 100))}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {active
          ? `${formatHour(active.hour)} · ${active.orders} pedido${active.orders === 1 ? "" : "s"}`
          : "Sin pedidos en los últimos 30 días."}
      </p>
    </div>
  );
};

export const HomeRestaurantMetrics = ({ restaurant }: HomeRestaurantMetricsProps) => {
  const maxQuantity = Math.max(1, ...restaurant.topProducts.map((item) => item.quantity));
  const peakShare =
    restaurant.peakHour && restaurant.ordersCount
      ? Math.round((restaurant.peakHour.orders / restaurant.ordersCount) * 100)
      : null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Restaurante</h2>
        <p className="text-sm text-muted-foreground">
          Horas pico y platos más pedidos en los últimos 30 días.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock className="size-4" aria-hidden />
              </span>
              Hora pico de pedidos
            </CardDescription>
            <CardTitle className="mt-3 text-3xl">
              {restaurant.peakHour ? formatHour(restaurant.peakHour.hour) : "—"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {restaurant.peakHour
                ? `${restaurant.peakHour.orders} pedidos en esa hora${peakShare === null ? "" : ` · ${peakShare}% del día`}`
                : "Sin pedidos aún"}
            </p>
          </CardHeader>
          <CardContent>
            <HourlyOrdersChart hourlyOrders={restaurant.hourlyOrders} peakHour={restaurant.peakHour} />
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShoppingBag className="size-4" aria-hidden />
              </span>
              Más pedidos
            </CardDescription>
            <CardTitle className="mt-3 text-3xl">{restaurant.topProducts[0]?.name ?? "—"}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {restaurant.topProducts[0]
                ? `${restaurant.topProducts[0].quantity} uds · ${formatMoney(restaurant.topProducts[0].revenue)}`
                : "Todavía no hay productos vendidos."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {restaurant.topProducts.length ? (
              restaurant.topProducts.map((item) => (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.quantity} · {formatMoney(item.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(8, Math.round((item.quantity / maxQuantity) * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay productos vendidos.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
