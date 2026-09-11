"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, Store, UtensilsCrossed } from "lucide-react";
import { updatePublicSurfaceSettingsAction } from "@/lib/menu/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PublicSurfacesSettingsCardProps = {
  menuEnabled: boolean;
  catalogEnabled: boolean;
  slug: string | null;
  canManage: boolean;
  canPublishMenu: boolean;
  canPublishCatalog: boolean;
  organizationName: string;
};

export const PublicSurfacesSettingsCard = ({
  menuEnabled: initialMenuEnabled,
  catalogEnabled: initialCatalogEnabled,
  slug: initialSlug,
  canManage,
  canPublishMenu,
  canPublishCatalog,
  organizationName,
}: PublicSurfacesSettingsCardProps) => {
  const [menuEnabled, setMenuEnabled] = useState(initialMenuEnabled);
  const [catalogEnabled, setCatalogEnabled] = useState(initialCatalogEnabled);
  const [slug, setSlug] = useState(initialSlug);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const menuPath = slug ? `/menu/${slug}` : null;
  const catalogPath = slug ? `/catalogo/${slug}` : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const handleToggle = (surface: "menu" | "catalog", next: boolean) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updatePublicSurfaceSettingsAction({ surface, enabled: next });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSlug(result.slug);
      if (surface === "menu") {
        setMenuEnabled(result.enabled);
        setMessage(next ? "Menú público activado." : "Menú público desactivado.");
      } else {
        setCatalogEnabled(result.enabled);
        setMessage(next ? "Catálogo público activado." : "Catálogo público desactivado.");
      }
    });
  };

  const handleCopy = async (path: string | null) => {
    if (!path) return;
    const absolute = origin ? `${origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(absolute);
      setMessage("Enlace copiado.");
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  };

  const anyActive = menuEnabled || catalogEnabled;

  return (
    <Card id="catalogo-publico" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Store className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Vitrinas públicas</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Separa el menú de platos del catálogo de productos e inmuebles de {organizationName}. Cada
                uno tiene su propio enlace.
              </CardDescription>
            </div>
          </div>
          <Badge variant={anyActive ? "default" : "outline"}>{anyActive ? "Activo" : "Inactivo"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canPublishMenu ? (
          <div className="space-y-3 rounded-xl border border-border/60 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <UtensilsCrossed className="mt-0.5 size-4 text-primary" aria-hidden />
                <div className="space-y-0.5">
                  <Label htmlFor="public-menu-enabled">Menú de platos</Label>
                  <p className="text-xs text-muted-foreground">
                    Solo comida · <code className="text-[11px]">/menu/…</code>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                <Switch
                  id="public-menu-enabled"
                  checked={menuEnabled}
                  disabled={!canManage || isPending}
                  onCheckedChange={(next) => handleToggle("menu", next)}
                />
              </div>
            </div>
            {menuEnabled && menuPath ? (
              <SurfaceLink
                path={menuPath}
                absolute={origin ? `${origin}${menuPath}` : menuPath}
                openLabel="Abrir menú"
                onCopy={() => void handleCopy(menuPath)}
              />
            ) : null}
          </div>
        ) : null}

        {canPublishCatalog ? (
          <div className="space-y-3 rounded-xl border border-border/60 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <Store className="mt-0.5 size-4 text-primary" aria-hidden />
                <div className="space-y-0.5">
                  <Label htmlFor="public-catalog-enabled">Catálogo de productos</Label>
                  <p className="text-xs text-muted-foreground">
                    Productos, servicios e inmuebles · <code className="text-[11px]">/catalogo/…</code>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isPending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
                <Switch
                  id="public-catalog-enabled"
                  checked={catalogEnabled}
                  disabled={!canManage || isPending}
                  onCheckedChange={(next) => handleToggle("catalog", next)}
                />
              </div>
            </div>
            {catalogEnabled && catalogPath ? (
              <SurfaceLink
                path={catalogPath}
                absolute={origin ? `${origin}${catalogPath}` : catalogPath}
                openLabel="Abrir catálogo"
                onCopy={() => void handleCopy(catalogPath)}
              />
            ) : null}
          </div>
        ) : null}

        {!canPublishMenu && !canPublishCatalog ? (
          <p className="text-sm text-muted-foreground">
            Activa Catálogo o Inmuebles en tu plan (vía administración) para publicar vitrinas.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      </CardContent>
    </Card>
  );
};

/** @deprecated Prefer PublicSurfacesSettingsCard */
export const PublicMenuSettingsCard = PublicSurfacesSettingsCard;

const SurfaceLink = ({
  absolute,
  openLabel,
  onCopy,
  path,
}: {
  absolute: string;
  openLabel: string;
  onCopy: () => void;
  path: string;
}) => (
  <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
    <p className="text-xs font-medium text-muted-foreground">Enlace para tus clientes</p>
    <p className="break-all font-mono text-sm font-medium">{absolute}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onCopy}>
        <Copy className="size-3.5" />
        Copiar enlace
      </Button>
      <Button asChild size="sm">
        <Link href={path} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3.5" />
          {openLabel}
        </Link>
      </Button>
    </div>
  </div>
);
