"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Store } from "lucide-react";
import { updatePublicMenuSettingsAction } from "@/lib/menu/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PublicMenuSettingsCardProps = {
  enabled: boolean;
  slug: string | null;
  canManage: boolean;
  organizationName: string;
};

export const PublicMenuSettingsCard = ({
  enabled: initialEnabled,
  slug: initialSlug,
  canManage,
  organizationName,
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
      setMessage(next ? "Catálogo público activado." : "Catálogo público desactivado.");
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
    <Card id="catalogo-publico" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Store className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Catálogo público</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Publica platos, productos e inmuebles cargados en {organizationName}. Tus clientes ven todo
                en un solo enlace.
              </CardDescription>
            </div>
          </div>
          <Badge variant={enabled ? "default" : "outline"}>{enabled ? "Activo" : "Inactivo"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="public-menu-enabled">Catálogo público activo</Label>
            <p className="text-xs text-muted-foreground">
              Visible sin login en <code className="text-[11px]">/menu/…</code>
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

        {enabled && (absoluteUrl || menuPath) ? (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs font-medium text-muted-foreground">Enlace para tus clientes</p>
            <p className="break-all font-mono text-sm font-medium">{absoluteUrl || menuPath}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
                <Copy className="size-3.5" />
                Copiar enlace
              </Button>
              {menuPath ? (
                <Button asChild size="sm">
                  <Link href={menuPath} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" />
                    Abrir catálogo
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Activa el catálogo para generar el enlace público (productos, platos e inmuebles según tus
            funciones).
          </p>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      </CardContent>
    </Card>
  );
};
