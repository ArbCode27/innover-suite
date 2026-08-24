"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import type { InventoryMovementRecord } from "@/lib/commerce/types";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ConsumptionRange = "daily" | "weekly" | "monthly";

type InventoryMovementsSheetProps = {
  open: boolean;
  movements: InventoryMovementRecord[];
  onOpenChange: (open: boolean) => void;
};

const MOVEMENT_KIND_LABELS: Record<InventoryMovementRecord["kind"], string> = {
  sale: "Venta",
  cancel_restore: "Cancelación",
  receive: "Reposición",
  adjust: "Ajuste",
};

const RANGE_OPTIONS: Array<{ key: ConsumptionRange; label: string }> = [
  { key: "daily", label: "Diario" },
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensual" },
];

const localDateKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

const formatDisplayDate = (iso: string) =>
  new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: CALENDAR_TIME_ZONE,
  }).format(new Date(iso));

const startOfMonthIsoDate = () => {
  const now = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${now.slice(0, 8)}01`;
};

const todayIsoDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const mondayOf = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00`);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const weekLabel = (mondayKey: string) => {
  const monday = new Date(`${mondayKey}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (value: Date) =>
    new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "short" }).format(value);
  return `${format(monday)} – ${format(sunday)}`;
};

const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" }).format(
    new Date(year, (month ?? 1) - 1, 1),
  );
};

const isOutbound = (movement: InventoryMovementRecord) =>
  movement.kind === "sale" || (movement.kind === "adjust" && movement.quantity < 0);

export const InventoryMovementsSheet = ({ open, movements, onOpenChange }: InventoryMovementsSheetProps) => {
  const [fromDate, setFromDate] = useState(startOfMonthIsoDate);
  const [toDate, setToDate] = useState(todayIsoDate);
  const [productFilter, setProductFilter] = useState("all");
  const [range, setRange] = useState<ConsumptionRange>("daily");

  const productNames = useMemo(() => {
    const unique = new Set(movements.map((movement) => movement.inventoryItemName));
    return [...unique].sort((a, b) => a.localeCompare(b, "es"));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const dateKey = localDateKey(movement.createdAt);
      if (fromDate && dateKey < fromDate) return false;
      if (toDate && dateKey > toDate) return false;
      if (productFilter !== "all" && movement.inventoryItemName !== productFilter) return false;
      return true;
    });
  }, [movements, fromDate, toDate, productFilter]);

  const consumptionRows = useMemo(() => {
    const totals = new Map<string, { label: string; quantity: number }>();
    filteredMovements.filter(isOutbound).forEach((movement) => {
      const dateKey = localDateKey(movement.createdAt);
      const key =
        range === "daily" ? dateKey : range === "weekly" ? mondayOf(dateKey) : dateKey.slice(0, 7);
      const label =
        range === "daily"
          ? new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeZone: CALENDAR_TIME_ZONE }).format(
              new Date(movement.createdAt),
            )
          : range === "weekly"
            ? `Semana ${weekLabel(key)}`
            : monthLabel(key);
      const current = totals.get(key) ?? { label, quantity: 0 };
      current.quantity += Math.abs(movement.quantity);
      totals.set(key, current);
    });
    return [...totals.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredMovements, range]);

  const totalConsumption = consumptionRows.reduce((sum, row) => sum + row.quantity, 0);

  const handleResetFilters = () => {
    setFromDate(startOfMonthIsoDate());
    setToDate(todayIsoDate());
    setProductFilter("all");
    setRange("daily");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Resumen de movimientos</SheetTitle>
          <SheetDescription>Filtra por fecha y producto, y mira el consumo diario, semanal o mensual.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="movement-from">Desde</Label>
              <Input
                id="movement-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="movement-to">Hasta</Label>
              <Input id="movement-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="movement-product">Producto</Label>
              <AppSelect
                id="movement-product"
                aria-label="Producto"
                value={productFilter}
                onValueChange={setProductFilter}
                options={[
                  { value: "all", label: "Todos los productos" },
                  ...productNames.map((name) => ({ value: name, label: name })),
                ]}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={handleResetFilters}>
            Restablecer filtros
          </Button>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Consumo</p>
              <Badge variant="secondary">{totalConsumption} uds</Badge>
            </div>
            <div role="tablist" aria-label="Periodo de consumo" className="grid grid-cols-3 gap-1 rounded-2xl border border-primary/20 bg-background/70 p-1">
              {RANGE_OPTIONS.map((option) => {
                const isActive = range === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`rounded-xl px-2 py-2 text-xs font-medium transition ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
                    }`}
                    onClick={() => setRange(option.key)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <ul className="mt-3 space-y-2">
              {consumptionRows.length ? (
                consumptionRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between rounded-lg border border-primary/10 px-3 py-2 text-sm">
                    <span className="capitalize">{row.label}</span>
                    <span className="font-medium">{row.quantity} uds</span>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No hay consumo en este rango.</p>
              )}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Detalle ({filteredMovements.length})</p>
            <ul className="space-y-2">
              {filteredMovements.length ? (
                filteredMovements.map((movement) => (
                  <li key={movement.id} className="rounded-lg border border-primary/10 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{movement.inventoryItemName}</p>
                      <span className={movement.quantity < 0 ? "text-sm font-medium text-destructive" : "text-sm font-medium text-emerald-600"}>
                        {movement.quantity > 0 ? "+" : ""}
                        {movement.quantity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {MOVEMENT_KIND_LABELS[movement.kind]} · queda {movement.balanceAfter}
                      {movement.orderId ? ` · pedido #${movement.orderId}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDisplayDate(movement.createdAt)}</p>
                  </li>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
              )}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

type InventoryMovementsButtonProps = {
  onClick: () => void;
};

export const InventoryMovementsButton = ({ onClick }: InventoryMovementsButtonProps) => (
  <Button type="button" variant="outline" onClick={onClick}>
    <History />
    Movimientos
  </Button>
);
