"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/commerce/types";
import type { DashboardRetail } from "@/lib/dashboard/board";
import { GLASS_CARD, GLASS_PANEL } from "@/lib/dashboard/glass";
import { CHART_AXIS_TICK } from "@/lib/dashboard/chart-axis";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type HomeBiRetailProps = {
  retail: DashboardRetail;
};

const chartConfig = {
  quantity: { label: "Unidades", color: "var(--primary)" },
} satisfies ChartConfig;

export const HomeBiRetail = ({ retail }: HomeBiRetailProps) => {
  const topData = retail.topProducts.slice(0, 10).map((row) => ({
    name: row.name.length > 20 ? `${row.name.slice(0, 18)}…` : row.name,
    quantity: row.quantity,
    revenue: row.revenue,
  }));

  return (
    <section className="space-y-4" aria-label="Analíticas de productos">
      <div>
        <h2 className="text-base font-semibold">Comercio de productos</h2>
        <p className="text-sm text-muted-foreground dark:text-foreground/75">
          Rotación, cobertura de stock y capital en anaquel.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardDescription>Ítems en alerta</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{retail.lowStockCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardDescription>Días de cobertura (prom.)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {retail.avgDaysOfCover == null ? "—" : retail.avgDaysOfCover.toFixed(1)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardDescription>SKUs monitoreados</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{retail.stockRows.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Mayor rotación</CardTitle>
            <CardDescription>Top productos por unidades vendidas (30d).</CardDescription>
          </CardHeader>
          <CardContent>
            {topData.length ? (
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <BarChart data={topData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={110}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className={cn(GLASS_PANEL, "flex h-48 items-center justify-center p-4 text-sm text-muted-foreground dark:text-foreground/75")}>
                Sin ventas de catálogo en el periodo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Stock crítico y días de cobertura</CardTitle>
            <CardDescription>Al ritmo de venta de los últimos 30 días.</CardDescription>
          </CardHeader>
          <CardContent>
            {retail.stockRows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ítem</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Días</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retail.stockRows.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="max-w-[10rem] truncate font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.onHand}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.daysOfCover == null ? "—" : row.daysOfCover}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            row.status === "out" && "border-destructive/40 text-destructive",
                            row.status === "low" && "border-amber-400/40 text-amber-600",
                          )}
                        >
                          {row.status === "out" ? "Agotado" : row.status === "low" ? "Bajo" : "OK"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
                Activa seguimiento de stock en catálogo para ver cobertura.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Valor del inventario</CardTitle>
            <CardDescription>Capital inmovilizado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
              Aún no hay costo unitario en inventario. Cuando registres costo de compra, aquí verás el
              valor total inmovilizado (hoy solo se monitorea cantidad en anaquel).
            </div>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Devoluciones / garantías</CardTitle>
            <CardDescription>% devuelto y costo asociado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
              No hay eventos de devolución en el CRM todavía. {formatMoney(0)} impactado este mes.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
