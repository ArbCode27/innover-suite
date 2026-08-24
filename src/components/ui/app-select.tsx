"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type AppSelectOption = {
  value: string;
  label: string;
};

type AppSelectProps = {
  id?: string;
  value: string;
  options: AppSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
};

export const AppSelect = ({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Selecciona",
  "aria-label": ariaLabel,
  className,
  disabled,
}: AppSelectProps) => {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "h-8 w-full justify-between gap-2 border-input bg-transparent px-2.5 font-normal shadow-none hover:bg-muted/70 hover:text-foreground dark:bg-input/30",
            "data-[state=open]:border-ring data-[state=open]:bg-background data-[state=open]:ring-3 data-[state=open]:ring-ring/50",
            className,
          )}
        >
          <span className="min-w-0 truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/button:rotate-180" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-[70] max-h-72 min-w-[var(--radix-dropdown-menu-trigger-width)]"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              className={cn("justify-between gap-3 py-1.5", isSelected && "bg-primary/10 text-foreground")}
              onSelect={() => onValueChange(option.value)}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {isSelected ? <Check className="size-4 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
