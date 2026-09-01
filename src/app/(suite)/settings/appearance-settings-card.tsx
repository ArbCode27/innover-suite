"use client";

import { Palette } from "lucide-react";
import { ThemeToggle } from "@/components/suite/theme-toggle";
import { PalettePicker } from "@/components/suite/palette-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const AppearanceSettingsCard = () => (
  <Card id="apariencia" className="border-primary/15 bg-card/80">
    <CardHeader>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Palette className="size-5" aria-hidden />
          </span>
          <div>
            <CardTitle>Apariencia</CardTitle>
            <CardDescription className="mt-1 leading-6">
              Elige modo claro u oscuro y una paleta de dos colores. Se guarda en este dispositivo.
            </CardDescription>
          </div>
        </div>
        <Badge variant="outline">Este dispositivo</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-xl border border-primary/15 px-3 py-3">
        <ThemeToggle row />
      </div>
      <PalettePicker />
    </CardContent>
  </Card>
);
