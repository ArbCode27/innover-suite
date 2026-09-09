import type { DashboardBoard } from "@/lib/dashboard/board";

export type BiPeriod = "weekly" | "monthly" | "annual";

export type BiVertical = "all" | "food" | "retail" | "services" | "finance" | "customers";

export type BiKpiCard = {
  id: string;
  label: string;
  value: string;
  hint: string;
  deltaPercent: number | null;
  progress?: number | null;
};

const formatPct = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
};

/** Meta sugerida = periodo anterior × 1.15 (hasta que el negocio defina su objetivo en Ajustes). */
export const suggestedSalesGoal = (previousRevenue: number) =>
  previousRevenue > 0 ? Math.round(previousRevenue * 1.15 * 100) / 100 : 0;

export const buildBiKpis = (
  board: DashboardBoard,
  period: BiPeriod,
  formatMoney: (value: number) => string,
): BiKpiCard[] => {
  const finance = board.finance;
  const comparison = finance?.comparisons[period];
  const revenue = comparison?.revenue ?? finance?.revenue30d ?? board.report.revenue30d;
  const previousRevenue = comparison?.previousRevenue ?? finance?.revenuePrev30d ?? 0;
  const orders = comparison?.orders ?? finance?.orders30d ?? board.report.orders30d;
  const previousOrders = comparison?.previousOrders ?? finance?.ordersPrev30d ?? 0;
  const aov = orders > 0 ? revenue / orders : finance?.aov ?? 0;
  const aovPrev = previousOrders > 0 ? previousRevenue / previousOrders : 0;
  const goal = suggestedSalesGoal(previousRevenue);
  const goalProgress = goal > 0 ? Math.min(100, Math.round((revenue / goal) * 1000) / 10) : null;

  const paidRevenue =
    board.finance && board.today
      ? Math.max(0, revenue - (board.today.unpaidOrders > 0 ? 0 : 0))
      : revenue;
  // Cobrado aproximado: ingresos del periodo menos proporción de impagos actuales
  const unpaidShare =
    board.today.unpaidOrders && orders
      ? Math.min(1, board.today.unpaidOrders / Math.max(orders, 1))
      : 0;
  const collectedApprox = Math.round(revenue * (1 - unpaidShare) * 100) / 100;
  const conversion = board.funnel
    ? formatPct(
        board.funnel.leads > 0 ? (board.funnel.buyers / board.funnel.leads) * 100 : null,
      )
    : board.stageFunnel?.stages.length
      ? formatPct(
          (() => {
            const stages = board.stageFunnel!.stages;
            const first = stages[0]?.count ?? 0;
            const last = stages[stages.length - 1]?.count ?? 0;
            return first > 0 ? (last / first) * 100 : null;
          })(),
        )
      : null;

  const aovDelta =
    aovPrev > 0 ? formatPct(((aov - aovPrev) / aovPrev) * 100) : aov > 0 ? 100 : null;

  return [
    {
      id: "gmv",
      label: "Ingresos totales (GMV)",
      value: formatMoney(revenue),
      hint: "Vs periodo anterior",
      deltaPercent: formatPct(comparison?.revenueGrowthPercent ?? finance?.revenueGrowthPercent ?? null),
    },
    {
      id: "aov",
      label: "Ticket promedio",
      value: formatMoney(aov),
      hint: "Por orden / factura",
      deltaPercent: aovDelta,
    },
    {
      id: "collected",
      label: "Cobrado estimado",
      value: formatMoney(collectedApprox),
      hint: board.today.unpaidOrders
        ? `${board.today.unpaidOrders} órdenes con pago pendiente`
        : "Sin impagos abiertos",
      deltaPercent: null,
    },
    {
      id: "conversion",
      label: "Tasa de conversión",
      value: conversion === null ? "—" : `${conversion}%`,
      hint: board.funnel
        ? `${board.funnel.buyers} compras / ${board.funnel.leads} leads`
        : "Embudo o leads → venta",
      deltaPercent: null,
    },
    {
      id: "goal",
      label: "Cumplimiento de meta",
      value: goalProgress === null ? "—" : `${goalProgress}%`,
      hint: goal > 0 ? `Meta sugerida ${formatMoney(goal)}` : "Sin base del periodo anterior",
      deltaPercent: null,
      progress: goalProgress,
    },
    {
      id: "breakeven",
      label: "Punto de equilibrio",
      value: "—",
      hint: "Define costos fijos del periodo para activarlo",
      deltaPercent: null,
    },
    {
      id: "orders",
      label: "Órdenes / transacciones",
      value: String(orders),
      hint: "Volumen del periodo",
      deltaPercent: formatPct(comparison?.ordersGrowthPercent ?? finance?.ordersGrowthPercent ?? null),
    },
    {
      id: "paid-proxy",
      label: "Ingresos del negocio",
      value: formatMoney(paidRevenue || revenue),
      hint: `Hoy: ${formatMoney(board.today.revenueToday)} · ${board.today.ordersToday} pedidos`,
      deltaPercent: null,
    },
  ];
};

export const buildVerticalContribution = (board: DashboardBoard) => {
  const rows: Array<{ key: string; label: string; revenue: number }> = [];
  if (board.restaurant) {
    rows.push({
      key: "food",
      label: "Comida",
      revenue: board.finance?.revenue30d ?? board.report.revenue30d,
    });
  } else if (board.retail) {
    rows.push({
      key: "retail",
      label: "Productos",
      revenue: board.finance?.revenue30d ?? board.report.revenue30d,
    });
  }
  if (board.services) {
    const serviceValue =
      board.stageFunnel?.stages.reduce((sum, stage) => sum + stage.estimatedValue, 0) ?? 0;
    rows.push({
      key: "services",
      label: "Servicios",
      revenue: serviceValue || board.services.scheduled * (board.finance?.aov ?? 0),
    });
  }
  if (!rows.length && board.finance) {
    rows.push({ key: "other", label: "Operación", revenue: board.finance.revenue30d });
  }
  const total = rows.reduce((sum, row) => sum + row.revenue, 0) || 1;
  return rows.map((row) => ({
    ...row,
    sharePercent: Math.round((row.revenue / total) * 1000) / 10,
  }));
};
