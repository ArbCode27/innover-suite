"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Palette, Trash2 } from "lucide-react";
import {
  updateOrganizationLogoAction,
  updateOrganizationPaletteAction,
} from "@/lib/organizations/actions";
import { APP_PALETTES, applyPalette, type PaletteId, parsePaletteId } from "@/lib/theme/palettes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OrganizationBrandSettingsCardProps = {
  canManage: boolean;
  organizationName: string;
  logoUrl: string | null;
  themePalette: string | null;
};

export const OrganizationBrandSettingsCard = ({
  canManage,
  organizationName,
  logoUrl: initialLogoUrl,
  themePalette,
}: OrganizationBrandSettingsCardProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [paletteId, setPaletteId] = useState<PaletteId>(parsePaletteId(themePalette));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpload = (file: File | null) => {
    if (!file || !canManage) return;
    const formData = new FormData();
    formData.set("image", file);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationLogoAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLogoUrl(result.logoUrl ?? null);
      setMessage(result.success ?? "Logo actualizado.");
    });
  };

  const handleRemove = () => {
    if (!canManage) return;
    const formData = new FormData();
    formData.set("remove", "1");
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationLogoAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLogoUrl(null);
      setMessage(result.success ?? "Logo eliminado.");
    });
  };

  const handlePaletteSelect = (next: PaletteId) => {
    setPaletteId(next);
    applyPalette(next);
    if (!canManage) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationPaletteAction({ paletteId: next });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Paleta guardada.");
    });
  };

  return (
    <Card id="marca" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={organizationName}
                  width={44}
                  height={44}
                  className="size-11 object-cover"
                  unoptimized
                />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
            </span>
            <div>
              <CardTitle>Marca de la organización</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Sube el logo y elige la paleta que verán tus clientes en el catálogo público. También se usa en el CRM.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">Organización</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-muted/40">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`Logo de ${organizationName}`}
                width={80}
                height={80}
                className="size-20 object-cover"
                unoptimized
              />
            ) : (
              <ImagePlus className="size-7 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Foto / logo</p>
            <p className="text-xs text-muted-foreground">JPG, PNG o WebP · máximo 5 MB</p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={!canManage || isPending}
                aria-label="Subir logo de la organización"
                onChange={(event) => {
                  handleUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canManage || isPending}
                onClick={() => inputRef.current?.click()}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {logoUrl ? "Cambiar foto" : "Subir foto"}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canManage || isPending}
                  onClick={handleRemove}
                >
                  <Trash2 />
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" aria-hidden />
            <p className="text-sm font-medium">Paleta del catálogo</p>
          </div>
          <div role="radiogroup" aria-label="Paleta de marca" className="grid gap-2 sm:grid-cols-2">
            {APP_PALETTES.map((item) => {
              const selected = paletteId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!canManage || isPending}
                  onClick={() => handlePaletteSelect(item.id)}
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

        {!canManage ? (
          <p className="text-xs text-muted-foreground">Solo owner o admin pueden editar la marca.</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
};
