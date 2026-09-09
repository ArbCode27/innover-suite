"use client";

import { useEffect, useState } from "react";
import {
  endOfDay,
  format,
  isSameDay,
  isToday,
  isYesterday,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, CalendarRange, Check, ChevronDown, RotateCcw, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DateFilterMode = "all" | "single" | "range";

export type DateFilterValue = {
  mode: DateFilterMode;
  date?: Date;
  range?: {
    from?: Date;
    to?: Date;
  };
};

type OrdersDateFilterProps = {
  value: DateFilterValue;
  onChange: (nextValue: DateFilterValue) => void;
  filteredCount?: number;
  totalCount?: number;
  className?: string;
};

export const formatDateFilterLabel = (value: DateFilterValue): string => {
  if (value.mode === "single" && value.date) {
    if (isToday(value.date)) {
      return `Hoy (${format(value.date, "d MMM", { locale: es })})`;
    }
    if (isYesterday(value.date)) {
      return `Ayer (${format(value.date, "d MMM", { locale: es })})`;
    }
    return format(value.date, "d 'de' MMMM, yyyy", { locale: es });
  }

  if (value.mode === "range" && value.range?.from) {
    const { from, to } = value.range;
    if (to && isSameDay(from, to)) {
      return format(from, "d 'de' MMMM, yyyy", { locale: es });
    }
    if (to) {
      return `${format(from, "d MMM", { locale: es })} – ${format(to, "d MMM yyyy", { locale: es })}`;
    }
    return `Desde ${format(from, "d MMM yyyy", { locale: es })}`;
  }

  return "Todas las fechas";
};

export const OrdersDateFilter = ({
  value,
  onChange,
  filteredCount,
  totalCount,
  className,
}: OrdersDateFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"single" | "range">(
    value.mode === "range" ? "range" : "single",
  );

  // Estados locales temporales mientras el popover está abierto
  const [selectedSingle, setSelectedSingle] = useState<Date | undefined>(value.date);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(
    value.range ? { from: value.range.from, to: value.range.to } : undefined,
  );

  // Sincronizar estado local al cambiar el prop externo o abrir popover
  useEffect(() => {
    setSelectedSingle(value.date);
    setSelectedRange(value.range ? { from: value.range.from, to: value.range.to } : undefined);
    if (value.mode === "range") {
      setPickerMode("range");
    } else {
      setPickerMode("single");
    }
  }, [value, isOpen]);

  const isFiltered = value.mode !== "all";

  const handleClear = () => {
    setSelectedSingle(undefined);
    setSelectedRange(undefined);
    onChange({ mode: "all" });
    setIsOpen(false);
  };

  const handleApplySingle = (date: Date | undefined) => {
    if (!date) return;
    setSelectedSingle(date);
    onChange({
      mode: "single",
      date,
    });
    setIsOpen(false);
  };

  const handleApplyRange = (range: DateRange | undefined) => {
    setSelectedRange(range);
    if (range?.from) {
      onChange({
        mode: "range",
        range: {
          from: range.from,
          to: range.to || range.from,
        },
      });
      // Si ya seleccionó ambos límites, podemos cerrar el popover
      if (range.to) {
        setIsOpen(false);
      }
    }
  };

  const handlePresetToday = () => {
    const today = new Date();
    setPickerMode("single");
    setSelectedSingle(today);
    onChange({
      mode: "single",
      date: today,
    });
    setIsOpen(false);
  };

  const handlePresetYesterday = () => {
    const yesterday = subDays(new Date(), 1);
    setPickerMode("single");
    setSelectedSingle(yesterday);
    onChange({
      mode: "single",
      date: yesterday,
    });
    setIsOpen(false);
  };

  const handlePresetLast7Days = () => {
    const from = subDays(new Date(), 6);
    const to = new Date();
    setPickerMode("range");
    setSelectedRange({ from, to });
    onChange({
      mode: "range",
      range: { from, to },
    });
    setIsOpen(false);
  };

  const handlePresetThisMonth = () => {
    const from = startOfMonth(new Date());
    const to = new Date();
    setPickerMode("range");
    setSelectedRange({ from, to });
    onChange({
      mode: "range",
      range: { from, to },
    });
    setIsOpen(false);
  };

  const handleModeChange = (mode: "single" | "range") => {
    setPickerMode(mode);
    if (mode === "single" && !selectedSingle && selectedRange?.from) {
      setSelectedSingle(selectedRange.from);
    } else if (mode === "range" && !selectedRange?.from && selectedSingle) {
      setSelectedRange({ from: selectedSingle, to: selectedSingle });
    }
  };

  const currentLabel = formatDateFilterLabel(value);

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={isFiltered ? "secondary" : "outline"}
            size="sm"
            aria-label="Filtrar pedidos por fecha o rango"
            aria-expanded={isOpen}
            className={cn(
              "h-9 gap-2 rounded-xl border px-3 text-xs font-medium transition-colors",
              isFiltered
                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border/60 hover:border-primary/30",
            )}
          >
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate max-w-[200px] sm:max-w-none">{currentLabel}</span>
            {isFiltered && typeof filteredCount === "number" ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/15 px-1.5 text-[11px] text-primary">
                {filteredCount}
              </Badge>
            ) : null}
            <ChevronDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-auto max-w-[calc(100vw-2rem)] p-3 shadow-xl rounded-2xl border-primary/20 bg-card/95 backdrop-blur sm:p-4"
        >
          <div className="flex flex-col gap-3">
            {/* Selector de modo: Día único o Rango */}
            <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Filtro de fecha
              </span>
              <div className="flex items-center rounded-lg bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  aria-pressed={pickerMode === "single"}
                  onClick={() => handleModeChange("single")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition",
                    pickerMode === "single"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden />
                  Día específico
                </button>
                <button
                  type="button"
                  aria-pressed={pickerMode === "range"}
                  onClick={() => handleModeChange("range")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition",
                    pickerMode === "range"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarRange className="size-3.5" aria-hidden />
                  Rango de fechas
                </button>
              </div>
            </div>

            {/* Accesos rápidos (Presets) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="rounded-lg text-xs hover:border-primary/40 hover:text-primary"
                onClick={handlePresetToday}
              >
                Hoy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="rounded-lg text-xs hover:border-primary/40 hover:text-primary"
                onClick={handlePresetYesterday}
              >
                Ayer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="rounded-lg text-xs hover:border-primary/40 hover:text-primary"
                onClick={handlePresetLast7Days}
              >
                Últimos 7 días
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="rounded-lg text-xs hover:border-primary/40 hover:text-primary"
                onClick={handlePresetThisMonth}
              >
                Este mes
              </Button>
              {isFiltered ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="rounded-lg text-xs text-muted-foreground hover:text-destructive"
                  onClick={handleClear}
                >
                  <RotateCcw className="mr-1 size-3" />
                  Todas
                </Button>
              ) : null}
            </div>

            {/* Calendario shadcn / react-day-picker */}
            <div className="rounded-xl border border-border/50 bg-background/50 p-1 flex justify-center">
              {pickerMode === "single" ? (
                <Calendar
                  mode="single"
                  selected={selectedSingle}
                  onSelect={handleApplySingle}
                  locale={es}
                  autoFocus
                />
              ) : (
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={handleApplyRange}
                  numberOfMonths={1}
                  locale={es}
                  autoFocus
                />
              )}
            </div>

            {/* Resumen del filtro seleccionado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs">
              <div className="text-muted-foreground truncate">
                {pickerMode === "single" && selectedSingle ? (
                  <span>
                    Seleccionado: <strong className="text-foreground">{format(selectedSingle, "d 'de' MMMM, yyyy", { locale: es })}</strong>
                  </span>
                ) : pickerMode === "range" && selectedRange?.from ? (
                  <span>
                    Rango: <strong className="text-foreground">{format(selectedRange.from, "d MMM", { locale: es })}</strong>
                    {selectedRange.to ? (
                      <> al <strong className="text-foreground">{format(selectedRange.to, "d MMM yyyy", { locale: es })}</strong></>
                    ) : (
                      " (elige fecha final)"
                    )}
                  </span>
                ) : (
                  <span>Selecciona en el calendario</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                {isFiltered ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Restablecer
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="xs"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg text-xs gap-1"
                >
                  <Check className="size-3" />
                  Listo
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Botón rápido de reset cuando está activo */}
      {isFiltered ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quitar filtro de fecha"
          title="Ver todas las fechas"
          onClick={handleClear}
          className="size-7 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
};
