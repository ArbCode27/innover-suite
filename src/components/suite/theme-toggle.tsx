"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

type ThemeToggleProps = {
  labelClassName?: string;
};

export const ThemeToggle = ({ labelClassName }: ThemeToggleProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleThemeToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleThemeToggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {isDark ? <Sun /> : <Moon />}
      <span className={labelClassName ?? "whitespace-nowrap"}>
        {isDark ? "Modo claro" : "Modo oscuro"}
      </span>
    </Button>
  );
};
