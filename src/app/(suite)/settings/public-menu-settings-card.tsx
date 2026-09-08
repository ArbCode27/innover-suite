"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { updatePublicMenuSettingsAction } from "@/lib/menu/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PublicMenuSettingsCardProps = {
  enabled: boolean;
  slug: string | null;
  canManage: boolean;
};

export const PublicMenuSettingsCard = ({
  enabled: initialEnabled,
  slug: initialSlug,
  canManage,
}: PublicMenuSettingsCardProps) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slug, setSlug] = useState(initialSlug);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const menuPath = slug ? `/menu/${slug}` : null;
  const absoluteUrl =
    typeof window !== "undefined" && menuPath ? `${window.location.origin}${menuPath}` : menuPath;

  const handleToggle = (next: boolean) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updatePublicMenuSettingsAction({ enabled: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEnabled(result.enabled);
      setSlug(result.slug);
      setMessage(next ? "Menú público activado." : "Menú público desactivado.");
    });
  };

  const handleCopy = async () => {
    if (!absoluteUrl) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setMessage("Enlace copiado.");
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle>Auto-pedido (menú público)</CardTitle>
        <CardDescription>
          Activa una UI tipo menú para que tus clientes ordenen solos. Solo disponible en organizaciones
          restaurante. Define ingredientes en cada plato del catálogo para permitir “sin cebolla”, etc.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="public-menu-enabled">Menú público activo</Label>
            <p className="text-xs text-muted-foreground">
              Visible en <code className="text-[11px]">/menu/&#123;slug&#125;</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            <Switch
              id="public-menu-enabled"
              checked={enabled}
              disabled={!canManage || isPending}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>

        {slug ? (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Enlace del menú</p>
            <p className="break-all font-mono text-sm">{menuPath}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="size-3.5" />
                Copiar
              </Button>
              {menuPath ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={menuPath} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Abrir
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Activa el menú para generar el enlace público automáticamente.
          </p>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      </CardContent>
    </Card>
  );
};
