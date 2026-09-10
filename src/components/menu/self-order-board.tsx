"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CupSoda,
  Filter,
  IceCreamCone,
  LayoutGrid,
  Salad,
  Search,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { SelfOrderCart } from "@/components/menu/self-order-cart";
import { SelfOrderProductCard } from "@/components/menu/self-order-product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { buildCatalogSections } from "@/lib/menu/self-order";
import type { CatalogItem, PublicCatalogPayload } from "@/lib/menu/types";
import { parsePaletteId, setDocumentPalette } from "@/lib/theme/palettes";
import { usePublicMenuCartStore } from "@/store/public-menu-cart-store";
import { cn } from "@/lib/utils";

type SelfOrderBoardProps = {
  catalog: PublicCatalogPayload;
};

type MenuTypeFilter = "all" | "dish" | "drink" | "dessert" | "side" | "combo" | "promo";

const MENU_TYPE_OPTIONS: Array<{
  id: MenuTypeFilter;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { id: "all", label: "Todo", icon: LayoutGrid },
  { id: "dish", label: "Platos", icon: UtensilsCrossed },
  { id: "combo", label: "Combos", icon: Sparkles },
  { id: "drink", label: "Bebidas", icon: CupSoda },
  { id: "dessert", label: "Postres", icon: IceCreamCone },
  { id: "side", label: "Acompañantes", icon: Salad },
];

const sectionDomId = (sectionId: string) =>
  `menu-section-${sectionId
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

const categoryToSectionId = (categoryLabel: string) =>
  categoryLabel === "Promociones destacadas" ? "promociones" : categoryLabel;

const sectionFallback = (menuType: string | null | undefined) => {
  switch (menuType) {
    case "drink":
      return "Bebidas";
    case "dessert":
      return "Postres";
    case "side":
      return "Acompañantes";
    case "combo":
    case "promo":
      return "Promociones destacadas";
    default:
      return "Platos principales";
  }
};

const itemMatchesMenuType = (item: CatalogItem, menuType: MenuTypeFilter) => {
  if (menuType === "all") return true;
  if (menuType === "combo") {
    return item.menuType === "combo" || item.menuType === "promo" || Boolean(item.isFeatured);
  }
  if (menuType === "dish") {
    return !item.menuType || item.menuType === "dish";
  }
  return item.menuType === menuType;
};

const itemCategory = (item: CatalogItem) =>
  item.category?.trim() || sectionFallback(item.menuType);

export const SelfOrderBoard = ({ catalog }: SelfOrderBoardProps) => {
  const org = catalog.organization;
  const themePalette = parsePaletteId(org.themePalette);
  const ensureSlug = usePublicMenuCartStore((state) => state.ensureSlug);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [menuType, setMenuType] = useState<MenuTypeFilter>("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [forceCartOpen, setForceCartOpen] = useState(false);

  useEffect(() => {
    setDocumentPalette(themePalette);
  }, [themePalette]);

  useEffect(() => {
    ensureSlug(org.slug);
  }, [ensureSlug, org.slug]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of catalog.items) {
      const key = itemCategory(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const preferred = [
      "Promociones destacadas",
      "Platos principales",
      "Entradas",
      "Acompañantes",
      "Postres",
      "Bebidas",
    ];
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => {
        const ai = preferred.indexOf(a.id);
        const bi = preferred.indexOf(b.id);
        if (ai === -1 && bi === -1) return a.label.localeCompare(b.label, "es");
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
  }, [catalog.items]);

  const availableMenuTypes = useMemo(() => {
    const present = new Set(
      catalog.items.map((item) => {
        if (item.isFeatured || item.menuType === "promo") return "combo";
        return item.menuType || "dish";
      }),
    );
    return MENU_TYPE_OPTIONS.filter(
      (option) => option.id === "all" || present.has(option.id) || (option.id === "combo" && present.has("promo")),
    );
  }, [catalog.items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.items.filter((item) => {
      if (onlyAvailable && !item.available) return false;
      if (!itemMatchesMenuType(item, menuType)) return false;
      if (category !== "all" && itemCategory(item) !== category) {
        // Featured items live in "Promociones destacadas" section visually
        if (category === "Promociones destacadas") {
          const isPromo =
            item.isFeatured || item.menuType === "combo" || item.menuType === "promo";
          if (!isPromo) return false;
        } else {
          return false;
        }
      }
      if (!q) return true;
      return `${item.title} ${item.description ?? ""} ${item.category ?? ""} ${item.metaLabel ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [catalog.items, search, category, menuType, onlyAvailable]);

  const sections = useMemo(() => buildCatalogSections(filteredItems), [filteredItems]);

  const activeFilters =
    (category !== "all" ? 1 : 0) +
    (menuType !== "all" ? 1 : 0) +
    (onlyAvailable ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const handleClearFilters = () => {
    setSearch("");
    setCategory("all");
    setMenuType("all");
    setOnlyAvailable(false);
  };

  const handleSelectCategory = (next: string) => {
    setCategory(next);
    if (next === "all") return;
    requestAnimationFrame(() => {
      const el = document.getElementById(sectionDomId(categoryToSectionId(next)));
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const filterPanel = (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-foreground/65">
            Buscar
          </p>
          {activeFilters > 0 ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <X className="size-3" aria-hidden />
              Limpiar
            </button>
          ) : null}
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar en el menú"
            className="h-10 rounded-xl pl-9"
            placeholder="Plato, bebida, categoría…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-foreground/65">
          Tipo
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {availableMenuTypes.map((option) => {
            const Icon = option.icon;
            const selected = menuType === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setMenuType(option.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition",
                  selected
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-border/60 bg-background/40 text-foreground/80 hover:border-primary/25 hover:bg-primary/5",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground dark:text-foreground/65">
          Categorías
        </p>
        <ScrollArea className="max-h-[min(22rem,45vh)] pr-2">
          <nav aria-label="Categorías del menú" className="space-y-1">
            <CategoryButton
              label="Todas"
              count={catalog.items.length}
              selected={category === "all"}
              onClick={() => handleSelectCategory("all")}
            />
            {categoryOptions.map((option) => (
              <CategoryButton
                key={option.id}
                label={option.label}
                count={option.count}
                selected={category === option.id}
                onClick={() => handleSelectCategory(option.id)}
              />
            ))}
          </nav>
        </ScrollArea>
      </div>

      <Separator className="bg-border/50" />

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
        <span>Solo disponibles</span>
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          checked={onlyAvailable}
          onChange={(event) => setOnlyAvailable(event.target.checked)}
        />
      </label>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:py-10">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
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
              <p className="text-sm text-muted-foreground dark:text-foreground/75">
                Elige, personaliza y envía tu pedido a cocina.
              </p>
            </div>
          </div>
          {activeFilters > 0 ? (
            <Badge variant="outline" className="w-fit rounded-full">
              <Filter className="size-3" aria-hidden />
              {activeFilters} filtro{activeFilters === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </header>

        {/* Mobile: search + horizontal category chips */}
        <div className="mb-5 space-y-3 lg:hidden">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar en el menú"
              className="h-11 rounded-xl pl-9"
              placeholder="Buscar plato o categoría"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip
              label="Todas"
              selected={category === "all"}
              onClick={() => handleSelectCategory("all")}
            />
            {categoryOptions.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={category === option.id}
                onClick={() => handleSelectCategory(option.id)}
              />
            ))}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {availableMenuTypes.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={menuType === option.id}
                onClick={() => setMenuType(option.id)}
              />
            ))}
            <Chip
              label="Disponibles"
              selected={onlyAvailable}
              onClick={() => setOnlyAvailable((current) => !current)}
            />
            {activeFilters > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 rounded-full"
                onClick={handleClearFilters}
              >
                Limpiar
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start">
          <aside className="max-lg:hidden sticky top-6 self-start rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <Filter className="size-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold">Filtros</h2>
            </div>
            {filterPanel}
          </aside>

          <div className="min-w-0 space-y-8">
            {sections.length ? (
              sections.map((section) => (
                <section
                  key={section.id}
                  id={sectionDomId(section.id)}
                  className="scroll-mt-24 space-y-4"
                >
                  <div className="flex items-end justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                    <p className="text-xs text-muted-foreground dark:text-foreground/65">
                      {section.items.length} opciones
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                    {section.items.map((item) => (
                      <SelfOrderProductCard key={item.id} item={item} slug={org.slug} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-primary/20 p-10 text-center text-sm text-muted-foreground dark:text-foreground/70">
                No hay platos que coincidan con tu búsqueda o filtros.
                {activeFilters > 0 ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={handleClearFilters}
                    >
                      Quitar filtros
                    </button>
                  </>
                ) : null}
              </p>
            )}
          </div>
        </div>
      </main>

      <SelfOrderCart
        org={org}
        forceOpen={forceCartOpen}
        onForceOpenHandled={() => setForceCartOpen(false)}
      />
    </div>
  );
};

const CategoryButton = ({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
      selected
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-foreground/85 hover:bg-primary/8",
    )}
  >
    <span className="truncate font-medium">{label}</span>
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
        selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
      )}
    >
      {count}
    </span>
  </button>
);

const Chip = ({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      "h-8 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border/70 bg-card/80 text-foreground/80",
    )}
  >
    {label}
  </button>
);
