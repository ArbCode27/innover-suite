"use client";

import { formatMoney } from "@/lib/commerce/types";
import type { DashboardBoard } from "@/lib/dashboard/board";
import { buildVerticalContribution, type BiPeriod } from "@/lib/dashboard/bi-metrics";
import { chartSeriesColor } from "@/lib/dashboard/chart-colors";
import { GLASS_CARD, GLASS_PANEL } from "@/lib/dashboard/glass";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type HomeBiCustomersProps = {
  board: DashboardBoard;
  period: BiPeriod;
};

const contribConfig = {
  revenue: { label: "Ingresos" },
} satisfies ChartConfig;

export const HomeBiCustomers = ({ board }: HomeBiCustomersProps) => {
  const retention = board.retention;
  const funnel = board.funnel;
  const contribution = buildVerticalContribution(board);
  const topAgents = board.finance?.byAgent.slice(0, 8) ?? [];

  return (
    <section className="space-y-4" aria-label="Clientes y contribución">
      <div>
        <h2 className="text-base font-semibold">Clientes y verticales</h2>
        <p className="text-sm text-muted-foreground dark:text-foreground/75">
          Quién compra, de dónde vienen y qué línea sostiene la caja.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="Clientes nuevos"
          value={String(retention?.newCustomers ?? 0)}
          hint="Primera compra en 30d"
        />
        <Metric
          title="Recurrentes"
          value={String(retention?.returningCustomers ?? 0)}
          hint="Más de una compra"
        />
        <Metric
          title="LTV estimado"
          value={retention?.ltv == null ? "—" : formatMoney(retention.ltv)}
          hint="Ingreso medio por comprador"
        />
        <Metric
          title="En riesgo de churn"
          value={String(retention?.inactiveCustomers ?? 0)}
          hint={`Inactivos +${retention?.churnRiskDays ?? 45} días`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Contribución por vertical</CardTitle>
            <CardDescription>% de ingresos Comida / Productos / Servicios.</CardDescription>
          </CardHeader>
          <CardContent>
            {contribution.length ? (
              <>
                <ChartContainer config={contribConfig} className="mx-auto aspect-square max-h-56">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                    <Pie
                      data={contribution}
                      dataKey="revenue"
                      nameKey="label"
                      innerRadius={50}
                      stroke="var(--card)"
                      strokeWidth={3}
                      paddingAngle={2}
                    >
                      {contribution.map((row, index) => (
                        <Cell key={row.key} fill={chartSeriesColor(index)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {contribution.map((row, index) => (
                    <li key={row.key} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: chartSeriesColor(index) }}
                          aria-hidden
                        />
                        {row.label}
                      </span>
                      <span className="tabular-nums text-foreground/80">
                        {row.sharePercent}% · {formatMoney(row.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
                Activa pedidos, catálogo o calendario para ver la contribución.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>Canal de adquisición</CardTitle>
            <CardDescription>Leads y compradores por canal de chat.</CardDescription>
          </CardHeader>
          <CardContent>
            {funnel?.byChannel.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnel.byChannel.map((row) => {
                    const conv =
                      row.leads > 0 ? Math.round((row.buyers / row.leads) * 1000) / 10 : null;
                    return (
                      <TableRow key={row.channel}>
                        <TableCell className="capitalize font-medium">{row.channel}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.buyers}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {conv == null ? "—" : `${conv}%`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
                Conecta canales y genera conversaciones para medir adquisición.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(GLASS_CARD, "lg:col-span-2")}>
          <CardHeader>
            <CardTitle>Top por ingresos (asesores)</CardTitle>
            <CardDescription>
              Proxy de “top clientes/cuentas” mientras no haya ranking nominativo de contactos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topAgents.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAgents.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.orders}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
                Sin ventas atribuidas a asesores en el periodo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>CAC y LTV/CAC</CardTitle>
            <CardDescription>Costo de adquisición.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(GLASS_PANEL, "space-y-2 p-4 text-sm text-muted-foreground")}>
              <p>
                LTV:{" "}
                <Badge variant="outline">
                  {retention?.ltv == null ? "—" : formatMoney(retention.ltv)}
                </Badge>
              </p>
              <p>
                Registra inversión en ads/marketing para calcular CAC y el ratio LTV/CAC automáticamente.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader>
            <CardTitle>NPS / promociones</CardTitle>
            <CardDescription>Satisfacción y efectividad de descuentos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn(GLASS_PANEL, "p-4 text-sm text-muted-foreground")}>
              Sin encuestas post-venta ni campañas etiquetadas aún. Actívalas para medir NPS y margen
              por promo.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

const Metric = ({ title, value, hint }: { title: string; value: string; hint: string }) => (
  <Card className={GLASS_CARD}>
    <CardHeader>
      <CardDescription>{title}</CardDescription>
      <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </CardHeader>
  </Card>
);
