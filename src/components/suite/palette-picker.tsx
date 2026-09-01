"use client";

import { useId, type KeyboardEvent } from "react";
import { APP_PALETTES } from "@/lib/theme/palettes";
import { usePalette } from "@/lib/theme/use-palette";
import { cn } from "@/lib/utils";

type PalettePickerProps = {
  compact?: boolean;
};

export const PalettePicker = ({ compact = false }: PalettePickerProps) => {
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
    <div className={cn(compact ? "flex justify-center group-hover/sidebar:justify-start" : "space-y-2")}>
      {compact ? null : (
        <p id={labelId} className="text-sm">
          Color de acento
        </p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={compact ? undefined : labelId}
        aria-label={compact ? "Color de acento" : undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          compact
            ? "grid w-fit grid-cols-2 gap-1.5 group-hover/sidebar:flex group-hover/sidebar:flex-wrap"
            : "flex flex-wrap items-center gap-2",
        )}
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
                "shrink-0 rounded-full border border-black/10 shadow-sm transition outline-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                compact ? "size-6" : "size-8",
                selected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "hover:scale-105",
                item.swatchClass,
              )}
            />
          );
        })}
      </div>
    </div>
  );
};
