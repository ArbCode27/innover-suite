"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { HomeFinanceMetrics } from "@/app/(suite)/home/home-finance";
import { HomeBiAlerts } from "@/components/dashboard/home-bi-alerts";
import { HomeBiCustomers } from "@/components/dashboard/home-bi-customers";
import { HomeBiFood } from "@/components/dashboard/home-bi-food";
import { HomeBiKpis } from "@/components/dashboard/home-bi-kpis";
import { HomeBiRetail } from "@/components/dashboard/home-bi-retail";
import { HomeBiServices } from "@/components/dashboard/home-bi-services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/commerce/types";
import type { DashboardBoard } from "@/lib/dashboard/board";
import { buildBiKpis, type BiPeriod, type BiVertical } from "@/lib/dashboard/bi-metrics";
import { GLASS_CHIP, GLASS_PANEL } from "@/lib/dashboard/glass";
import { MODULE_CATALOG } from "@/lib/modules/constants";
import { cn } from "@/lib/utils";

type HomeAnalyticsProps = {
  organizationName: string;
  board: DashboardBoard;
  canUseInbox: boolean;
};

const PERIOD_OPTIONS: Array<{ id: BiPeriod; label: string }> = [
  { id: "weekly", label: "Semana" },
  { id: "monthly", label: "Mes" },
  { id: "annual", label: "Año" },
];

export const HomeAnalytics = ({ organizationName, board }: HomeAnalyticsProps) => {
  const [period, setPeriod] = useState<BiPeriod>("monthly");
  const [vertical, setVertical] = useState<BiVertical>("all");
  const [isPending, startTransition] = useTransition();

  const activeModules = MODULE_CATALOG.filter((item) => board.modules[item.key]).map(
    (item) => item.label,
  );

  const kpis = useMemo(
    () => buildBiKpis(board, period, formatMoney),
    [board, period],
  );

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: BiVertical; label: string; show: boolean }> = [
      { id: "all", label: "Global", show: true },
      { id: "food", label: "Comida", show: Boolean(board.restaurant) },
      { id: "retail", label: "Productos", show: Boolean(board.retail) },
      {
        id: "services",
        label: "Servicios",
        show: Boolean(board.services || board.stageFunnel),
      },
      { id: "finance", label: "Finanzas", show: Boolean(board.finance) },
      { id: "customers", label: "Clientes", show: true },
    ];
    return tabs.filter((tab) => tab.show);
  }, [board]);

  const handlePeriod = (next: BiPeriod) => {
    startTransition(() => setPeriod(next));
  };

  const handleExportCsv = () => {
    const lines = [
      ["KPI", "Valor", "Variación %"],
      ...kpis.map((kpi) => [
        kpi.label,
        kpi.value,
        kpi.deltaPercent == null ? "" : String(kpi.deltaPercent),
      ]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dashboard-${organizationName.toLowerCase().replace(/\s+/g, "-")}-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte CSV descargado");
  };

  const handleExportPdf = () => {
    toast.message("Exportación PDF", {
      description: "Próximamente: reporte semanal programable por correo.",
    });
  };

  return (
    <div className={cn("space-y-6 transition-opacity duration-300", isPending && "opacity-70")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {activeModules.length ? (
              activeModules.map((label) => (
                <Badge key={label} variant="outline" className={GLASS_CHIP}>
                  {label}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">Inbox e IA</Badge>
            )}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground dark:text-foreground/75">
            Vista ejecutiva de {organizationName}: ingresos, operación por vertical, caja y clientes
            en un solo panel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className={cn(GLASS_PANEL, "inline-flex items-center gap-1 p-1")} role="group" aria-label="Periodo">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handlePeriod(option.id)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition",
                  period === option.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-xl backdrop-blur-sm">
                <Download className="size-3.5" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="backdrop-blur-xl bg-popover/90">
              <DropdownMenuItem onClick={handleExportCsv}>
                <FileSpreadsheet className="size-4" />
                Excel / CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="size-4" />
                PDF (próximamente)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <HomeBiAlerts alerts={board.alerts} />
      <HomeBiKpis kpis={kpis} />

      <Tabs
        value={vertical}
        onValueChange={(value) => setVertical(value as BiVertical)}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border/40 bg-card/40 p-1 backdrop-blur-xl">
          {availableTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-xl px-3 py-2 data-active:bg-background/80"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-8 focus-visible:outline-none">
          {board.restaurant ? <HomeBiFood restaurant={board.restaurant} /> : null}
          {board.retail ? <HomeBiRetail retail={board.retail} /> : null}
          {board.services || board.stageFunnel ? (
            board.services ? (
              <HomeBiServices
                services={board.services}
                stageFunnel={board.stageFunnel}
                agents={board.agents}
              />
            ) : (
              <HomeBiServices
                services={{
                  scheduled: 0,
                  done: 0,
                  cancelled: 0,
                  showRate: null,
                  byPurpose: [],
                  topTitles: [],
                  avgCycleMs: null,
                  renewalRate: null,
                  comparisons: {
                    weekly: emptyServicesComparison(),
                    monthly: emptyServicesComparison(),
                    annual: emptyServicesComparison(),
                  },
                }}
                stageFunnel={board.stageFunnel}
                agents={board.agents}
              />
            )
          ) : null}
          {board.finance ? <HomeFinanceMetrics finance={board.finance} /> : null}
          <HomeBiCustomers board={board} period={period} />
        </TabsContent>

        <TabsContent value="food" className="focus-visible:outline-none">
          {board.restaurant ? <HomeBiFood restaurant={board.restaurant} /> : null}
        </TabsContent>

        <TabsContent value="retail" className="focus-visible:outline-none">
          {board.retail ? <HomeBiRetail retail={board.retail} /> : null}
        </TabsContent>

        <TabsContent value="services" className="focus-visible:outline-none">
          {board.services ? (
            <HomeBiServices
              services={board.services}
              stageFunnel={board.stageFunnel}
              agents={board.agents}
            />
          ) : board.stageFunnel ? (
            <HomeBiServices
              services={{
                scheduled: 0,
                done: 0,
                cancelled: 0,
                showRate: null,
                byPurpose: [],
                topTitles: [],
                avgCycleMs: null,
                renewalRate: null,
                comparisons: {
                  weekly: emptyServicesComparison(),
                  monthly: emptyServicesComparison(),
                  annual: emptyServicesComparison(),
                },
              }}
              stageFunnel={board.stageFunnel}
              agents={board.agents}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="finance" className="focus-visible:outline-none">
          {board.finance ? <HomeFinanceMetrics finance={board.finance} /> : null}
        </TabsContent>

        <TabsContent value="customers" className="focus-visible:outline-none">
          <HomeBiCustomers board={board} period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const emptyServicesComparison = () => ({
  scheduled: 0,
  previousScheduled: 0,
  done: 0,
  previousDone: 0,
  cancelled: 0,
  previousCancelled: 0,
  scheduledGrowthPercent: null,
  doneGrowthPercent: null,
});
