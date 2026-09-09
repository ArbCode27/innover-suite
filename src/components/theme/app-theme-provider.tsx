"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import {
  migrateLegacyCrmTheme,
  resolveThemeStorageKey,
  resolveThemeZone,
} from "@/lib/theme/theme-storage";

type AppThemeProviderProps = {
  children: ReactNode;
};

/**
 * Un solo ThemeProvider con storageKey distinto según la zona (CRM vs menú público).
 * `key={storageKey}` fuerza remount al cambiar de zona para leer/aplicar la preferencia correcta.
 */
export const AppThemeProvider = ({ children }: AppThemeProviderProps) => {
  const pathname = usePathname();
  const zone = resolveThemeZone(pathname);
  const storageKey = resolveThemeStorageKey(pathname);

  // Antes del mount de next-themes: conserva el tema del CRM guardado como "theme".
  migrateLegacyCrmTheme();

  return (
    <ThemeProvider
      key={storageKey}
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={storageKey}
      disableTransitionOnChange
    >
      <div data-theme-zone={zone} className="contents">
        {children}
      </div>
    </ThemeProvider>
  );
};
