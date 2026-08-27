"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  compact?: boolean;
  labelClassName?: string;
};

export const ThemeToggle = ({ compact = false, labelClassName }: ThemeToggleProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === "dark";
  const ariaLabel = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (compact) {
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        onClick={handleThemeToggle}
        aria-label={ariaLabel}
        disabled={!mounted}
      >
        {mounted && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleThemeToggle}
      aria-label={ariaLabel}
      disabled={!mounted}
    >
      {mounted && isDark ? <Sun /> : <Moon />}
      <span className={cn("whitespace-nowrap", labelClassName)}>
        {mounted && isDark ? "Modo claro" : "Modo oscuro"}
      </span>
    </Button>
  );
};
