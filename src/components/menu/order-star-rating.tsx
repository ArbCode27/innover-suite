"use client";

import { useId, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStarRatingProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

const LABELS: Record<number, string> = {
  1: "Malo",
  2: "Regular",
  3: "Bueno",
  4: "Muy bueno",
  5: "Excelente",
};

export const OrderStarRating = ({
  value,
  onChange,
  disabled = false,
  className,
}: OrderStarRatingProps) => {
  const groupId = useId();
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="radiogroup"
        aria-label="Calificación del pedido"
        className="flex items-center justify-center gap-1.5"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const selected = star <= active;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} de 5 estrellas${LABELS[star] ? `, ${LABELS[star]}` : ""}`}
              name={groupId}
              disabled={disabled}
              className={cn(
                "rounded-lg p-1.5 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                disabled ? "cursor-default opacity-80" : "hover:scale-110 active:scale-95",
              )}
              onMouseEnter={() => {
                if (!disabled) setHovered(star);
              }}
              onFocus={() => {
                if (!disabled) setHovered(star);
              }}
              onBlur={() => setHovered(0)}
              onClick={() => onChange(star)}
            >
              <Star
                className={cn(
                  "size-8 transition-colors sm:size-9",
                  selected
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-muted-foreground/40",
                )}
                strokeWidth={selected ? 0 : 1.6}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
      <p
        className={cn(
          "min-h-5 text-center text-xs transition-opacity",
          active
            ? "text-muted-foreground opacity-100 dark:text-foreground/70"
            : "opacity-0",
        )}
        aria-live="polite"
      >
        {active ? LABELS[active] : " "}
      </p>
    </div>
  );
};
