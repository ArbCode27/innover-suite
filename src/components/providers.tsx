"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppThemeProvider } from "@/components/theme/app-theme-provider";
import { PaletteProvider } from "@/lib/theme/palette-provider";
import { configureZodSpanish } from "@/lib/validation/zod-es";

configureZodSpanish();

type AppProvidersProps = {
  children: ReactNode;
};

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <AppThemeProvider>
      <PaletteProvider>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
        </TooltipProvider>
      </PaletteProvider>
    </AppThemeProvider>
  );
};
