/** Paleta semántica para series de gráficos (pies, donuts, stacks). */
export const CHART_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const chartSeriesColor = (index: number) =>
  CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
