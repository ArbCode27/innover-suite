"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QuantitySelectorProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
  size?: "sm" | "default";
};

export const QuantitySelector = ({
  value,
  min = 1,
  max = 99,
  onChange,
  className,
  size = "default",
}: QuantitySelectorProps) => {
  const buttonSize = size === "sm" ? "icon-sm" : "icon";

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 p-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size={buttonSize}
        aria-label="Disminuir cantidad"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={buttonSize}
        aria-label="Aumentar cantidad"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
};
