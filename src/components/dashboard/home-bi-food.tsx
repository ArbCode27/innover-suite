"use client";

import { formatMoney, FULFILLMENT_LABELS, type FulfillmentType } from "@/lib/commerce/types";
import type { DashboardRestaurant } from "@/lib/dashboard/board";
import { chartSeriesColor } from "@/lib/dashboard/chart-colors";
import { CHART_AXIS_TICK, CHART_AXIS_TICK_SM } from "@/lib/dashboard/chart-axis";
import { GLASS_CARD, GLASS_PANEL } from "@/lib/dashboard/glass";
import { WEEKDAY_LABELS } from "@/lib/dashboard/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

type HomeBiFoodProps = {
  restaurant: DashboardRestaurant;
};

const fulfillmentLabel = (value: string) =>
  FULFILLMENT_LABELS[value as FulfillmentType] ?? (value === "unspecified" ? "Sin especificar" : value);

const pieConfig = {
  orders: { label: "Pedidos" },
} satisfies ChartConfig;

const barsConfig = {
  quantity: { label: "Unidades", color: "var(--primary)" },
  revenue: { label: "Ingresos", color: "var(--chart-2)" },
} satisfies ChartConfig;

const aovConfig = {
  aov: { label: "Ticket", color: "var(--primary)" },
} satisfies ChartConfig;

export const HomeBiFood = ({ restaurant }: HomeBiFoodProps) => {
  const fulfillmentData = restaurant.byFulfillment.map((row) => ({
    name: fulfillmentLabel(row.fulfillment),
    orders: row.orders,
    revenue: row.revenue,
  }));
  const topData = restaurant.topProducts.slice(0, 10).map((row) => ({
    name: row.name.length > 22 ? `${row.name.slice(0, 20)}…` : row.name,
    quantity: row.quantity,
    revenue: row.revenue,
  }));
  const aovData = restaurant.aovByChannel.map((row) => ({
    channel: row.channel || "otro",
    aov: Math.round(row.aov * 100) / 100,
    orders: row.orders,
  }));
  const maxHeat = Math.max(1, ...restaurant.weekdayHourHeatmap.flat());

  return (
    <section className="space-y-4" aria-label="Analíticas de comida">
      <div>
        <h2 className="text-base font-semibold">Sector gastronómico</h2>
        <p className="text-sm text-muted-foreground dark:text-foreground/75">
          Qué se vende, a qué hora y por qué canal — últimos 30 días.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Ventas por tipo de pedido</CardTitle>
            <CardDescription>Delivery, pickup, salón y sin clasificar.</CardDescription>
          </CardHeader>
          <CardContent>
            {fulfillmentData.length ? (
              <ChartContainer config={pieConfig} className="mx-auto aspect-square max-h-64">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={fulfillmentData}
                    dataKey="orders"
                    nameKey="name"
                    innerRadius={48}
                    stroke="var(--card)"
                    strokeWidth={3}
                    paddingAngle={2}
                  >
                    {fulfillmentData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartSeriesColor(index)} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <EmptyChart message="Aún no hay pedidos con tipo de cumplimiento." />
            )}
            <ul className="mt-3 space-y-1.5 text-xs text-foreground/80">
              {fulfillmentData.map((row, index) => (
                <li key={row.name} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-foreground">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: chartSeriesColor(index) }}
                      aria-hidden
                    />
                    {row.name}
                  </span>
                  <span className="tabular-nums text-foreground/80">
                    {row.orders} · {formatMoney(row.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Ticket promedio por canal</CardTitle>
            <CardDescription>Compara rentabilidad real por origen del pedido.</CardDescription>
          </CardHeader>
          <CardContent>
            {aovData.length ? (
              <ChartContainer config={aovConfig} className="h-64 w-full">
                <BarChart data={aovData} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="channel"
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK_SM}
                  />
                  <YAxis tickLine={false} axisLine={false} width={48} tick={CHART_AXIS_TICK_SM} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="aov" fill="var(--color-aov)" radius={6} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyChart message="Sin canales con ventas en el periodo." />
            )}
          </CardContent>
        </Card>

        <Card className={cn(GLASS_CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Platos más vendidos</CardTitle>
            <CardDescription>Top por rotación (unidades) en el periodo.</CardDescription>
          </CardHeader>
          <CardContent>
            {topData.length ? (
              <ChartContainer config={barsConfig} className="h-80 w-full">
                <BarChart data={topData} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyChart message="Cuando entren pedidos verás el ranking de platos." />
            )}
          </CardContent>
        </Card>

        <Card className={cn(GLASS_CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Horas pico (heatmap)</CardTitle>
            <CardDescription>
              Intensidad de pedidos por día y hora
              {restaurant.peakHour
                ? ` · pico ${String(restaurant.peakHour.hour).padStart(2, "0")}:00 (${restaurant.peakHour.orders})`
                : ""}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
              <div className="min-w-[640px] space-y-1" role="img" aria-label="Heatmap de pedidos por hora y día">
              <div className="grid grid-cols-[3.5rem_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-foreground/70">
                <span />
                {Array.from({ length: 24 }, (_, hour) => (
                  <span key={hour} className="text-center">
                    {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
                  </span>
                ))}
              </div>
              {restaurant.weekdayHourHeatmap.map((hours, weekday) => (
                <div
                  key={weekday}
                  className="grid grid-cols-[3.5rem_repeat(24,minmax(0,1fr))] gap-1"
                >
                  <span className="truncate text-[11px] text-foreground/80">
                    {WEEKDAY_LABELS[weekday]?.slice(0, 3) ?? weekday}
                  </span>
                  {hours.map((count, hour) => {
                    const intensity = count / maxHeat;
                    return (
                      <div
                        key={`${weekday}-${hour}`}
                        title={`${WEEKDAY_LABELS[weekday]} ${String(hour).padStart(2, "0")}:00 · ${count}`}
                        className={cn(
                          "h-4 rounded-sm",
                          count === 0 ? "bg-muted/40" : "bg-primary",
                        )}
                        style={count ? { opacity: 0.15 + intensity * 0.85 } : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Tiempos promedio</CardTitle>
            <CardDescription>Preparación y entrega.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
              Aún no se registran timestamps de cocina/entrega en el CRM. Cuando el módulo de
              comandas guarde esos eventos, aquí verás preparación y entrega promedio.
            </div>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Desperdicio / merma</CardTitle>
            <CardDescription>% de insumos perdidos vs. comprados.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
              Requiere movimientos de inventario tipo merma. Usa Inventario para registrar ajustes;
              el % aparecerá automáticamente.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

const EmptyChart = ({ message }: { message: string }) => (
  <div className={cn(GLASS_PANEL, "flex h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground")}>
    {message}
  </div>
);
