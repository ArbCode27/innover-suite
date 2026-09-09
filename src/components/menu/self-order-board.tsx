"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, UtensilsCrossed } from "lucide-react";
import { SelfOrderCart } from "@/components/menu/self-order-cart";
import { SelfOrderProductCard } from "@/components/menu/self-order-product-card";
import { Input } from "@/components/ui/input";
import { buildCatalogSections } from "@/lib/menu/self-order";
import type { PublicCatalogPayload } from "@/lib/menu/types";
import { parsePaletteId, setDocumentPalette } from "@/lib/theme/palettes";
import { usePublicMenuCartStore } from "@/store/public-menu-cart-store";
import { cn } from "@/lib/utils";

type SelfOrderBoardProps = {
  catalog: PublicCatalogPayload;
};

export const SelfOrderBoard = ({ catalog }: SelfOrderBoardProps) => {
  const org = catalog.organization;
  const themePalette = parsePaletteId(org.themePalette);
  const ensureSlug = usePublicMenuCartStore((state) => state.ensureSlug);
  const [search, setSearch] = useState("");
  const [forceCartOpen, setForceCartOpen] = useState(false);

  useEffect(() => {
    setDocumentPalette(themePalette);
  }, [themePalette]);

  useEffect(() => {
    ensureSlug(org.slug);
  }, [ensureSlug, org.slug]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.items;
    return catalog.items.filter((item) =>
      `${item.title} ${item.description ?? ""} ${item.category ?? ""} ${item.metaLabel ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [catalog.items, search]);

  const sections = useMemo(() => buildCatalogSections(filteredItems), [filteredItems]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 pb-28 sm:px-6 lg:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm">
              {org.logoUrl ? (
                <Image
                  src={org.logoUrl}
                  alt={org.name}
                  width={48}
                  height={48}
                  className="size-12 object-cover"
                  unoptimized
                />
              ) : (
                <UtensilsCrossed className="size-5" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Autopedido
              </p>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{org.name}</h1>
              <p className="text-sm text-muted-foreground">
                Elige, personaliza y envía tu pedido a cocina.
              </p>
            </div>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar en el menú"
              className="h-10 rounded-xl pl-9"
              placeholder="Buscar plato o categoría"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </header>

        {sections.length ? (
          sections.map((section) => (
            <section key={section.id} className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                <p className="text-xs text-muted-foreground">{section.items.length} opciones</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <SelfOrderProductCard key={item.id} item={item} slug={org.slug} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <p
            className={cn(
              "rounded-2xl border border-dashed border-primary/20 p-10 text-center text-sm text-muted-foreground",
            )}
          >
            No hay platos que coincidan con tu búsqueda.
          </p>
        )}
      </main>

      <SelfOrderCart
        org={org}
        forceOpen={forceCartOpen}
        onForceOpenHandled={() => setForceCartOpen(false)}
      />
    </div>
  );
};
