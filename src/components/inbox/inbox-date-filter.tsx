"use client";

import { CalendarDays, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type InboxDateFilterKey = "all" | "today" | "yesterday" | "week" | "month";

type InboxDateFilterOption = {
  key: InboxDateFilterKey;
  label: string;
};

const DATE_OPTIONS: InboxDateFilterOption[] = [
  { key: "all", label: "Todas las fechas" },
  { key: "today", label: "Hoy" },
  { key: "yesterday", label: "Ayer" },
  { key: "week", label: "Últimos 7 días" },
  { key: "month", label: "Este mes" },
];

type InboxDateFilterProps = {
  value: InboxDateFilterKey;
  onChange: (nextValue: InboxDateFilterKey) => void;
  className?: string;
};

export const InboxDateFilter = ({
  value,
  onChange,
  className,
}: InboxDateFilterProps) => {
  const currentOption = DATE_OPTIONS.find((opt) => opt.key === value) || DATE_OPTIONS[0];
  const isFiltered = value !== "all";

  const handleSelect = (nextKey: InboxDateFilterKey) => {
    onChange(nextKey);
  };

  const handleReset = (event: React.MouseEvent) => {
    event.stopPropagation();
    onChange("all");
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant={isFiltered ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-normal transition-colors",
              isFiltered && "border-primary/40 bg-primary/10 text-primary font-medium",
            )}
            aria-label={`Filtrar por fecha: actualmente ${currentOption.label}`}
          >
            <CalendarDays className="size-3.5" />
            <span>{currentOption.label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs">Filtrar por fecha</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DATE_OPTIONS.map((option) => {
            const isSelected = option.key === value;
            return (
              <DropdownMenuItem
                key={option.key}
                onClick={() => handleSelect(option.key)}
                className="flex items-center justify-between text-xs"
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {isFiltered ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleReset}
          className="size-7 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Restablecer filtro de fecha"
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
};
