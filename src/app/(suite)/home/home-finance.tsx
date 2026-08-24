"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";
import { CalendarDays, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { formatMoney } from "@/lib/commerce/types";
import type { DashboardFinance } from "@/lib/dashboard/board";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { channelLabel } from "./home-charts";

type FinanceRange = "7d" | "14d" | "30d";
type ComparisonPeriod = "weekly" | "monthly" | "annual";

type DailyPoint = DashboardFinance["daily"][number];

type HomeFinanceMetricsProps = {
  finance: DashboardFinance;
};

const RANGE_OPTIONS: Array<{ key: FinanceRange; label: string; days: number }> =
  [
    { key: "7d", label: "7D", days: 7 },
    { key: "14d", label: "14D", days: 14 },
    { key: "30d", label: "30D", days: 30 },
  ];

const COMPARISON_OPTIONS: Array<{
  key: ComparisonPeriod;
  label: string;
  description: string;
}> = [
  {
    key: "weekly",
    label: "Semanal",
    description: "Los últimos 7 días comparados con los 7 anteriores.",
  },
  {
    key: "monthly",
    label: "Mensual",
    description: "Los últimos 30 días comparados con los 30 anteriores.",
  },
  {
    key: "annual",
    label: "Anual",
    description: "Los últimos 12 meses comparados con los 12 anteriores.",
  },
];

const CHANNEL_TONES = [
  "bg-sky-500",
  "bg-primary",
  "bg-sky-300",
  "bg-slate-400",
];

const compactMoney = (value: number) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);

const formatChartDate = (isoDate: string) =>
  new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(new Date(`${isoDate}T12:00:00`));

const growthValue = (current: number, previous: number) => {
  if (!previous && !current) return null;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
};

const ComparisonBars = ({
  current,
  previous,
  formatValue,
}: {
  current: number;
  previous: number;
  formatValue: (value: number) => string;
}) => {
  const max = Math.max(current, previous, 1);

  return (
    <div className="grid grid-cols-2 items-end gap-5">
      <div className="space-y-2">
        <div
          className="rounded-xl bg-primary"
          style={{
            height: `${Math.max(12, Math.round((current / max) * 120))}px`,
          }}
        />
        <p className="text-xs text-muted-foreground">Actual</p>
        <p className="text-sm font-medium">{formatValue(current)}</p>
      </div>
      <div className="space-y-2">
        <div
          className="rounded-xl bg-sky-200"
          style={{
            height: `${Math.max(12, Math.round((previous / max) * 120))}px`,
          }}
        />
        <p className="text-xs text-muted-foreground">Anterior</p>
        <p className="text-sm font-medium">{formatValue(previous)}</p>
      </div>
    </div>
  );
};

const GrowthBadge = ({ value }: { value: number | null }) => {
  if (value === null) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Sin base
      </span>
    );
  }

  const positive = value >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        positive
          ? "bg-foreground text-background"
          : "bg-destructive/15 text-destructive",
      )}>
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
};

const sliceRange = (series: DailyPoint[], days: number) => series.slice(-days);

const previousRange = (finance: DashboardFinance, days: number) => {
  if (days >= 30) return finance.previousDaily ?? [];
  return finance.daily.slice(-days * 2, -days);
};

const RevenuePerformanceChart = ({
  current,
  previous,
  hoveredIndex,
  onHover,
}: {
  current: DailyPoint[];
  previous: DailyPoint[];
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}) => {
  const gradientId = useId().replaceAll(":", "");
  const width = 720;
  const height = 260;
  const pad = { top: 20, right: 16, bottom: 32, left: 52 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const max = Math.max(
    1,
    ...current.map((row) => row.revenue),
    ...previous.map((row) => row.revenue),
  );
  const count = Math.max(current.length, 1);

  const pointAt = (series: DailyPoint[], index: number) => {
    const row = series[index];
    const x = pad.left + (index / Math.max(count - 1, 1)) * innerWidth;
    const y = pad.top + innerHeight - ((row?.revenue ?? 0) / max) * innerHeight;
    return { x, y, ...row };
  };

  const currentPoints = current.map((_, index) => pointAt(current, index));
  const previousPoints = previous.map((_, index) => pointAt(previous, index));
  const currentLine = currentPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const previousLine = previousPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const area = currentPoints.length
    ? `${pad.left},${pad.top + innerHeight} ${currentLine} ${pad.left + innerWidth},${pad.top + innerHeight}`
    : "";
  const ticks = current.filter((_, index) => {
    if (current.length <= 7) return true;
    if (index === 0 || index === current.length - 1) return true;
    return index % Math.ceil(current.length / 5) === 0;
  });
  const active = hoveredIndex == null ? null : currentPoints[hoveredIndex];

  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const index = Math.min(
      count - 1,
      Math.max(0, Math.round(ratio * (count - 1))),
    );
    onHover(index);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-56 w-full cursor-crosshair sm:h-64"
      role="img"
      aria-label="Comparación de ingresos del periodo actual contra el anterior"
      onPointerMove={handlePointer}
      onPointerLeave={() => onHover(null)}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((ratio) => {
        const y = pad.top + innerHeight * (1 - ratio);
        return (
          <g key={ratio}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              className="stroke-border"
            />
            <text
              x={8}
              y={y + 4}
              className="fill-muted-foreground"
              fontSize="11">
              {compactMoney(max * ratio)}
            </text>
          </g>
        );
      })}
      {previousLine ? (
        <polyline
          points={previousLine}
          className="fill-none stroke-primary/35"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="5 6"
        />
      ) : null}
      {area ? <polygon points={area} fill={`url(#${gradientId})`} /> : null}
      <polyline
        points={currentLine}
        className="fill-none stroke-primary"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {active ? (
        <>
          <line
            x1={active.x}
            x2={active.x}
            y1={pad.top}
            y2={pad.top + innerHeight}
            className="stroke-primary/40"
          />
          <circle cx={active.x} cy={active.y} r="5" className="fill-primary" />
          <g
            transform={`translate(${Math.min(Math.max(active.x - 64, pad.left), width - pad.right - 128)}, ${Math.max(pad.top, active.y - 42)})`}>
            <rect width="128" height="28" rx="14" className="fill-foreground" />
            <text
              x="64"
              y="19"
              textAnchor="middle"
              className="fill-background"
              fontSize="12"
              fontWeight="600">
              {formatMoney(active.revenue ?? 0)}
            </text>
          </g>
        </>
      ) : null}
      {ticks.map((row) => {
        const index = current.findIndex((item) => item.date === row.date);
        const point = currentPoints[index];
        if (!point) return null;
        return (
          <text
            key={row.date}
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10">
            {formatChartDate(row.date)}
          </text>
        );
      })}
    </svg>
  );
};

export const HomeFinanceMetrics = ({ finance }: HomeFinanceMetricsProps) => {
  const [range, setRange] = useState<FinanceRange>("14d");
  const [comparisonPeriod, setComparisonPeriod] =
    useState<ComparisonPeriod>("monthly");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const days = RANGE_OPTIONS.find((option) => option.key === range)?.days ?? 14;
  const comparisonOption =
    COMPARISON_OPTIONS.find((option) => option.key === comparisonPeriod) ??
    COMPARISON_OPTIONS[1];
  const comparison = finance.comparisons[comparisonPeriod];

  const currentSeries = useMemo(
    () => sliceRange(finance.daily, days),
    [finance.daily, days],
  );
  const previousSeries = useMemo(
    () => previousRange(finance, days),
    [finance, days],
  );
  const rangeRevenue = currentSeries.reduce((sum, row) => sum + row.revenue, 0);
  const previousRevenue = previousSeries.reduce(
    (sum, row) => sum + row.revenue,
    0,
  );
  const rangeOrders = currentSeries.reduce((sum, row) => sum + row.orders, 0);
  const rangeGrowth = growthValue(rangeRevenue, previousRevenue);
  const hovered = hoveredIndex == null ? null : currentSeries[hoveredIndex];
  const channelTotal = Math.max(
    1,
    finance.byChannel.reduce((sum, row) => sum + row.revenue, 0),
  );

  const handleRangeChange = (nextRange: FinanceRange) => {
    setRange(nextRange);
    setHoveredIndex(null);
  };

  const handleComparisonPeriodChange = (nextPeriod: ComparisonPeriod) => {
    setComparisonPeriod(nextPeriod);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Métricas financieras</h2>
        <p className="text-sm text-muted-foreground">
          Compara el crecimiento de ingresos y pedidos del negocio frente al
          periodo anterior.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="size-4" aria-hidden />
              </span>
              Ingresos 30 días
            </CardDescription>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <CardTitle className="text-3xl">
                {formatMoney(finance.revenue30d)}
              </CardTitle>
              <GrowthBadge value={finance.revenueGrowthPercent} />
            </div>
            <p className="text-xs text-muted-foreground">
              Antes: {formatMoney(finance.revenuePrev30d)}
            </p>
          </CardHeader>
        </Card>
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TrendingUp className="size-4" aria-hidden />
              </span>
              Pedidos 30 días
            </CardDescription>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <CardTitle className="text-3xl">{finance.orders30d}</CardTitle>
              <GrowthBadge value={finance.ordersGrowthPercent} />
            </div>
            <p className="text-xs text-muted-foreground">
              Antes: {finance.ordersPrev30d} pedidos
            </p>
          </CardHeader>
        </Card>
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShoppingBag className="size-4" aria-hidden />
              </span>
              Ticket promedio
            </CardDescription>
            <CardTitle className="mt-3 text-3xl">
              {formatMoney(finance.aov)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Valor medio por pedido en los últimos 30 días.
            </p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardDescription className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CalendarDays className="size-4" aria-hidden />
                </span>
                Rendimiento de ingresos
              </CardDescription>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <CardTitle className="text-3xl">
                  {formatMoney(hovered?.revenue ?? rangeRevenue)}
                </CardTitle>
                <GrowthBadge value={rangeGrowth} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {hovered
                  ? `${formatChartDate(hovered.date)} · ${hovered.orders} pedidos`
                  : `${rangeOrders} pedidos en el rango · línea punteada = periodo anterior`}
              </p>
            </div>
            <div
              role="tablist"
              aria-label="Rango del gráfico"
              className="grid h-9 w-[12rem] shrink-0 grid-cols-3 gap-1 rounded-2xl border border-primary/20 bg-background/80 p-1">
              {RANGE_OPTIONS.map((option) => {
                const isActive = range === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      "min-w-0 rounded-xl text-xs font-medium transition",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                    )}
                    onClick={() => handleRangeChange(option.key)}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            {currentSeries.some((row) => row.revenue > 0) ? (
              <RevenuePerformanceChart
                current={currentSeries}
                previous={previousSeries}
                hoveredIndex={hoveredIndex}
                onHover={setHoveredIndex}
              />
            ) : (
              <p className="py-16 text-sm text-muted-foreground">
                Aún no hay ingresos en este rango para graficar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardDescription>Mix por canal</CardDescription>
            <CardTitle className="text-3xl">
              {formatMoney(finance.revenue30d)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Distribución de ventas de los últimos 30 días.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {finance.byChannel.length ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {finance.byChannel.map((row, index) => (
                    <span
                      key={row.channel}
                      className={cn(
                        "h-full",
                        CHANNEL_TONES[index % CHANNEL_TONES.length],
                      )}
                      style={{
                        width: `${Math.max(4, Math.round((row.revenue / channelTotal) * 100))}%`,
                      }}
                      title={`${channelLabel(row.channel)} · ${formatMoney(row.revenue)}`}
                    />
                  ))}
                </div>
                <ul className="space-y-3">
                  {finance.byChannel.map((row, index) => (
                    <li
                      key={row.channel}
                      className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2.5 shrink-0 rounded-full",
                            CHANNEL_TONES[index % CHANNEL_TONES.length],
                          )}
                        />
                        <span className="truncate">
                          {channelLabel(row.channel)}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {Math.round((row.revenue / channelTotal) * 100)}% ·{" "}
                        {formatMoney(row.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay ventas en el período.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Actual vs anterior</h3>
            <p className="text-sm text-muted-foreground">
              {comparisonOption.description}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Periodo de comparación"
            className="grid grid-cols-3 gap-1 rounded-2xl border border-primary/20 bg-background/80 p-1 sm:w-[22rem]">
            {COMPARISON_OPTIONS.map((option) => {
              const isActive = comparisonPeriod === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                  )}
                  onClick={() => handleComparisonPeriodChange(option.key)}>
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          <Card className="border-primary/20 bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Ingresos</CardTitle>
                <GrowthBadge value={comparison.revenueGrowthPercent} />
              </div>
              <CardDescription>
                Ventas del periodo seleccionado frente al anterior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ComparisonBars
                current={comparison.revenue}
                previous={comparison.previousRevenue}
                formatValue={formatMoney}
              />
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Pedidos</CardTitle>
                <GrowthBadge value={comparison.ordersGrowthPercent} />
              </div>
              <CardDescription>
                Cantidad de pedidos del periodo seleccionado frente al anterior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ComparisonBars
                current={comparison.orders}
                previous={comparison.previousOrders}
                formatValue={(value) => String(value)}
              />
              <p className="text-xs text-muted-foreground">
                {comparison.orders} vs {comparison.previousOrders} pedidos
                {comparison.ordersGrowthPercent === null
                  ? ""
                  : ` (${comparison.ordersGrowthPercent >= 0 ? "+" : ""}${comparison.ordersGrowthPercent.toFixed(1)}%)`}
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {finance.byAgent.length ? (
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Ingresos por asesor</CardTitle>
            <CardDescription>
              Pedidos en chats asignados a cada vendedor.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {finance.byAgent.map((row) => (
              <div
                key={row.userId}
                className="rounded-2xl border border-primary/10 bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatMoney(row.revenue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.orders} pedidos
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(8, Math.round((row.revenue / Math.max(finance.revenue30d, 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
};
