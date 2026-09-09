"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QuantitySelector } from "@/components/pedido/quantity-selector";
import { SelfOrderDecision } from "@/components/menu/self-order-decision";
import { formatMoney } from "@/lib/commerce/types";
import {
  buildModifierGroupsForItem,
  calcUnitPrice,
  displayPrice,
  drinkQtyHint,
  ingredientsInitialState,
  resolveDrinkSelections,
  sumDrinkQuantities,
  validateModifierGroups,
  type SelfOrderModifierGroup,
} from "@/lib/menu/self-order";
import type { CatalogItem } from "@/lib/menu/types";
import { usePublicMenuCartStore } from "@/store/public-menu-cart-store";

type SelfOrderDetailProps = {
  slug: string;
  item: CatalogItem;
  drinkItems: CatalogItem[];
  onOpenCart: () => void;
};

export const SelfOrderDetail = ({ slug, item, drinkItems, onOpenCart }: SelfOrderDetailProps) => {
  const ensureSlug = usePublicMenuCartStore((state) => state.ensureSlug);
  const agregarItem = usePublicMenuCartStore((state) => state.agregarItem);
  ensureSlug(slug);

  const groups = useMemo(() => buildModifierGroupsForItem(item, drinkItems), [item, drinkItems]);
  const drinkGroup = groups.find((group) => group.id === "addon-bebida") ?? null;

  const [cantidad, setCantidad] = useState(1);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [ingredientesActivos, setIngredientesActivos] = useState(() =>
    ingredientsInitialState(item.ingredients),
  );
  const [drinkQty, setDrinkQty] = useState<Record<string, number>>({});

  const modifiers = useMemo(
    () => (drinkGroup ? resolveDrinkSelections(drinkGroup, drinkQty) : []),
    [drinkGroup, drinkQty],
  );

  const basePrice = displayPrice(item);
  const unitPrice = calcUnitPrice(basePrice, modifiers);
  const total = Math.round(unitPrice * cantidad * 100) / 100;
  const validationError = validateModifierGroups(groups, modifiers);
  const totalDrinks = sumDrinkQuantities(drinkQty);

  const handleDrinkQty = (group: SelfOrderModifierGroup, optionId: string, nextQty: number) => {
    const safe = Math.max(0, nextQty);
    const without = { ...drinkQty, [optionId]: 0 };
    const others = sumDrinkQuantities(without);
    const capped = Math.min(safe, Math.max(0, group.maxSelect - others));
    setDrinkQty((current) => {
      if (capped <= 0) {
        const { [optionId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [optionId]: capped };
    });
  };

  const lineChargeLabel = (group: SelfOrderModifierGroup, optionId: string, listPrice: number) => {
    const selection = modifiers.find((entry) => entry.optionId === optionId);
    const qty = drinkQty[optionId] ?? 0;
    if (qty <= 0) {
      return group.includedFreeCount > 0
        ? `Carta ${formatMoney(listPrice, item.currency)}`
        : `+${formatMoney(listPrice, item.currency)} c/u`;
    }
    if (!selection) return formatMoney(listPrice, item.currency);

    const parts: string[] = [];
    if (selection.includedCount > 0) {
      parts.push(
        selection.includedCount === qty
          ? "Incluida"
          : `${selection.includedCount} incluida${selection.includedCount > 1 ? "s" : ""}`,
      );
    }
    if (selection.priceDelta > 0) {
      parts.push(`+${formatMoney(selection.priceDelta, item.currency)}`);
    }
    return parts.join(" · ") || "Incluida";
  };

  const handleAdd = () => {
    if (validationError || !item.available) return;
    const removed = item.ingredients.filter(
      (ingredient) => ingredient.removable && ingredientesActivos[ingredient.id] === false,
    );

    agregarItem({
      menuItemId: item.sourceId,
      name: item.title,
      basePrice,
      currency: item.currency,
      imageUrl: item.imageUrl,
      quantity: cantidad,
      removedIngredientIds: removed.map((ingredient) => ingredient.id),
      removedIngredientNames: removed.map((ingredient) => ingredient.name),
      modifiers,
    });
    toast.success("Agregado a la orden");
    setDecisionOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-background pb-28">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted sm:aspect-[21/9] sm:rounded-b-3xl">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
            unoptimized
          />
        ) : null}
        <Button
          asChild
          variant="secondary"
          size="icon"
          className="absolute top-4 left-4 rounded-full bg-background/90 backdrop-blur"
        >
          <Link href={`/menu/${slug}`} aria-label="Volver al menú">
            <ArrowLeft />
          </Link>
        </Button>
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-6">
        <header className="space-y-2">
          {item.metaLabel ? <Badge variant="secondary">{item.metaLabel}</Badge> : null}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{item.title}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            {item.description || "Sin descripción"}
          </p>
          <div>
            {item.promoPrice != null && item.price != null ? (
              <p className="text-sm text-destructive line-through">
                {formatMoney(item.price, item.currency)}
              </p>
            ) : null}
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(basePrice, item.currency)}
            </p>
          </div>
        </header>

        {item.ingredients.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-border/70 p-4">
            <div>
              <h2 className="text-sm font-semibold">Ingredientes</h2>
              <p className="text-xs text-muted-foreground">Desmarca lo que no quieras incluir.</p>
            </div>
            <div className="space-y-2">
              {item.ingredients.map((ingredient) => (
                <label
                  key={ingredient.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                >
                  <Checkbox
                    checked={ingredientesActivos[ingredient.id] !== false}
                    disabled={!ingredient.removable}
                    onCheckedChange={(checked) =>
                      setIngredientesActivos((current) => ({
                        ...current,
                        [ingredient.id]: checked === true,
                      }))
                    }
                  />
                  <span className="text-sm">{ingredient.name}</span>
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {drinkGroup ? (
          <section className="space-y-3 rounded-2xl border border-border/70 p-4">
            <div>
              <h2 className="text-sm font-semibold">
                {drinkGroup.title}
                {drinkGroup.required ? <span className="text-destructive"> *</span> : null}
              </h2>
              <p className="text-xs text-muted-foreground">{drinkQtyHint(drinkGroup)}</p>
              {totalDrinks > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {totalDrinks} bebida{totalDrinks === 1 ? "" : "s"} seleccionada
                  {totalDrinks === 1 ? "" : "s"}
                  {drinkGroup.includedFreeCount > 0
                    ? ` · ${Math.min(totalDrinks, drinkGroup.includedFreeCount)} incluida${Math.min(totalDrinks, drinkGroup.includedFreeCount) === 1 ? "" : "s"}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              {drinkGroup.options.map((option) => {
                const qty = drinkQty[option.id] ?? 0;
                const photo = option.imageUrl?.trim() || null;
                return (
                  <div
                    key={option.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60">
                        {photo ? (
                          <Image
                            src={photo}
                            alt={option.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{option.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lineChargeLabel(drinkGroup, option.id, option.unitListPrice)}
                        </p>
                      </div>
                    </div>
                    <QuantitySelector
                      size="sm"
                      min={0}
                      max={drinkGroup.maxSelect}
                      value={qty}
                      onChange={(value) => handleDrinkQty(drinkGroup, option.id, value)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 p-4">
          <div>
            <p className="text-sm font-medium">Cantidad</p>
            <p className="text-xs text-muted-foreground">Unidades de esta configuración</p>
          </div>
          <QuantitySelector value={cantidad} onChange={setCantidad} />
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {validationError ? (
            <p className="text-sm text-destructive" role="status">
              {validationError}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold tabular-nums">
                {formatMoney(total, item.currency)}
              </p>
            </div>
            <Button
              type="button"
              className="h-11 min-w-[10rem] rounded-2xl"
              disabled={Boolean(validationError) || !item.available}
              onClick={handleAdd}
            >
              Agregar a la orden
            </Button>
          </div>
        </div>
      </div>

      <SelfOrderDecision
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        slug={slug}
        productName={item.title}
        onOpenCart={onOpenCart}
      />
    </div>
  );
};
