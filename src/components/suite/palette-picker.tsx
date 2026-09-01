"use client";

import { useId, type KeyboardEvent } from "react";
import { APP_PALETTES } from "@/lib/theme/palettes";
import { usePalette } from "@/lib/theme/use-palette";
import { cn } from "@/lib/utils";

export const PalettePicker = () => {
  const { palette, setPalette, mounted } = usePalette();
  const labelId = useId();
  const selectedId = mounted ? palette : "default";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!mounted) return;
    const lastIndex = APP_PALETTES.length - 1;
    const currentIndex = APP_PALETTES.findIndex((item) => item.id === selectedId);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;

    let nextIndex = safeIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = safeIndex === lastIndex ? 0 : safeIndex + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = safeIndex === 0 ? lastIndex : safeIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    event.preventDefault();
    const next = APP_PALETTES[nextIndex];
    if (!next) return;
    setPalette(next.id);
    const target = event.currentTarget.querySelector<HTMLButtonElement>(
      `[data-palette-id="${next.id}"]`,
    );
    target?.focus();
  };

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm">
        Paleta
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={handleKeyDown}
        className="grid gap-2 sm:grid-cols-2"
      >
        {APP_PALETTES.map((item) => {
          const selected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              data-palette-id={item.id}
              aria-checked={selected}
              aria-label={item.label}
              tabIndex={selected ? 0 : -1}
              disabled={!mounted}
              title={item.label}
              onClick={() => setPalette(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "border-primary bg-primary/8 ring-2 ring-ring/40"
                  : "border-primary/15 hover:border-primary/35 hover:bg-muted/50",
              )}
            >
              <span
                className="relative size-9 shrink-0 overflow-hidden rounded-full border border-black/10 shadow-sm"
                aria-hidden
              >
                <span className={cn("absolute inset-y-0 left-0 w-1/2", item.swatchPrimaryClass)} />
                <span className={cn("absolute inset-y-0 right-0 w-1/2", item.swatchSecondaryClass)} />
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
