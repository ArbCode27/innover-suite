"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/pedido/quantity-selector";
import { SelfOrderDecision } from "@/components/menu/self-order-decision";
import { formatMoney } from "@/lib/commerce/types";
import {
  buildModifierGroupsForItem,
  buildSelfOrderSteps,
  calcUnitPrice,
  displayPrice,
  groupQtyHint,
  ingredientsInitialState,
  resolveQtySelections,
  stepLabel,
  sumOptionQuantities,
  validateGroupsSubset,
  type SelfOrderModifierGroup,
} from "@/lib/menu/self-order";
import type { CatalogItem } from "@/lib/menu/types";
import { cn } from "@/lib/utils";
import { usePublicMenuCartStore } from "@/store/public-menu-cart-store";

type SelfOrderDetailProps = {
  slug: string;
  item: CatalogItem;
  drinkItems: CatalogItem[];
  sideItems: CatalogItem[];
  dessertItems: CatalogItem[];
  onOpenCart: () => void;
};

export const SelfOrderDetail = ({
  slug,
  item,
  drinkItems,
  sideItems,
  dessertItems,
  onOpenCart,
}: SelfOrderDetailProps) => {
  const ensureSlug = usePublicMenuCartStore((state) => state.ensureSlug);
  const agregarItem = usePublicMenuCartStore((state) => state.agregarItem);
  ensureSlug(slug);

  const groups = useMemo(
    () => buildModifierGroupsForItem(item, drinkItems, sideItems, dessertItems),
    [item, drinkItems, sideItems, dessertItems],
  );
  const drinkGroup = groups.find((group) => group.id === "addon-bebida") ?? null;
  const sideGroup = groups.find((group) => group.id === "addon-extra") ?? null;
  const dessertGroup = groups.find((group) => group.id === "addon-postre") ?? null;
  const steps = useMemo(() => buildSelfOrderSteps(item, groups), [item, groups]);

  const [stepIndex, setStepIndex] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [ingredientesActivos, setIngredientesActivos] = useState(() =>
    ingredientsInitialState(item.ingredients),
  );
  const [optionQty, setOptionQty] = useState<Record<string, number>>({});

  const currentStep = steps[stepIndex] ?? "customize";
  const isLastStep = stepIndex >= steps.length - 1;

  const drinkModifiers = useMemo(
    () => (drinkGroup ? resolveQtySelections(drinkGroup, optionQty) : []),
    [drinkGroup, optionQty],
  );
  const sideModifiers = useMemo(
    () => (sideGroup ? resolveQtySelections(sideGroup, optionQty) : []),
    [sideGroup, optionQty],
  );
  const dessertModifiers = useMemo(
    () => (dessertGroup ? resolveQtySelections(dessertGroup, optionQty) : []),
    [dessertGroup, optionQty],
  );
  const modifiers = useMemo(
    () => [...drinkModifiers, ...sideModifiers, ...dessertModifiers],
    [drinkModifiers, sideModifiers, dessertModifiers],
  );

  const basePrice = displayPrice(item);
  const unitPrice = calcUnitPrice(basePrice, modifiers);
  const total = Math.round(unitPrice * cantidad * 100) / 100;
  const totalDrinks = sumOptionQuantities(
    Object.fromEntries(
      (drinkGroup?.options ?? []).map((option) => [option.id, optionQty[option.id] ?? 0]),
    ),
  );

  const groupsForCurrentStep = (): SelfOrderModifierGroup[] => {
    if (currentStep === "drinks") return drinkGroup ? [drinkGroup] : [];
    if (currentStep === "extras") {
      return [sideGroup, dessertGroup].filter(Boolean) as SelfOrderModifierGroup[];
    }
    return [];
  };

  const stepValidationError = validateGroupsSubset(groupsForCurrentStep(), modifiers);
  const finalValidationError = validateGroupsSubset(
    groups.filter((group) => group.required),
    modifiers,
  );

  const handleOptionQty = (group: SelfOrderModifierGroup, optionId: string, nextQty: number) => {
    const safe = Math.max(0, nextQty);
    const without = { ...optionQty, [optionId]: 0 };
    const othersInGroup = group.options.reduce(
      (sum, option) => sum + Math.max(0, without[option.id] ?? 0),
      0,
    );
    const capped = Math.min(safe, Math.max(0, group.maxSelect - othersInGroup));
    setOptionQty((current) => {
      if (capped <= 0) {
        const { [optionId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [optionId]: capped };
    });
  };

  const lineChargeLabel = (group: SelfOrderModifierGroup, optionId: string, listPrice: number) => {
    const selection = modifiers.find((entry) => entry.optionId === optionId);
    const qty = optionQty[optionId] ?? 0;
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
    if (finalValidationError || !item.available) return;
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

  const handlePrimaryAction = () => {
    if (stepValidationError) return;
    if (isLastStep) {
      handleAdd();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((current) => current - 1);
      return;
    }
  };

  const primaryLabel = (() => {
    if (isLastStep) return "Añadir todo al carrito";
    const next = steps[stepIndex + 1];
    if (currentStep === "customize" && next === "drinks") {
      return drinkGroup?.required ? "Continuar · elegir bebida" : "Añadir y elegir bebida";
    }
    if (currentStep === "drinks" && next === "extras") {
      return "Siguiente: Adicionales y postres";
    }
    return "Continuar";
  })();

  const extrasGroups = [sideGroup, dessertGroup].filter(Boolean) as SelfOrderModifierGroup[];

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
        {stepIndex === 0 ? (
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
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-4 left-4 rounded-full bg-background/90 backdrop-blur"
            aria-label="Paso anterior"
            onClick={handleBack}
          >
            <ArrowLeft />
          </Button>
        )}
      </div>

      {steps.length > 1 ? (
        <nav
          aria-label="Pasos del pedido"
          className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6"
        >
          <ol className="mx-auto flex w-full max-w-md items-center justify-center gap-1.5 sm:gap-2">
            {steps.map((step, index) => {
              const done = index < stepIndex;
              const active = index === stepIndex;
              return (
                <li key={step} className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition",
                        done && "bg-primary text-primary-foreground",
                        active && "bg-primary/15 text-primary ring-2 ring-primary/30",
                        !done && !active && "bg-muted text-muted-foreground",
                      )}
                      aria-current={active ? "step" : undefined}
                    >
                      {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium whitespace-nowrap",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {stepLabel(step)}
                    </span>
                  </div>
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden
                      className={cn(
                        "mx-1 h-px w-5 shrink-0 sm:mx-2 sm:w-8",
                        done ? "bg-primary/50" : "bg-border",
                      )}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="space-y-6 px-4 py-5 sm:px-6">
        {currentStep === "customize" ? (
          <>
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
              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">Personaliza tus ingredientes</h2>
                  <p className="text-xs text-muted-foreground">
                    Toca para incluir o quitar. Lo apagado se envía sin ese ingrediente.
                  </p>
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {item.ingredients.map((ingredient) => {
                    const active = ingredientesActivos[ingredient.id] !== false;
                    const photo = ingredient.imageUrl?.trim() || null;
                    return (
                      <button
                        key={ingredient.id}
                        type="button"
                        disabled={!ingredient.removable}
                        aria-pressed={active}
                        aria-label={`${ingredient.name}: ${active ? "incluido" : "sin incluir"}`}
                        className={cn(
                          "flex aspect-square flex-col overflow-hidden rounded-2xl border text-left transition",
                          active
                            ? "border-primary/45 bg-primary/10 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_25%,transparent)]"
                            : "border-border/50 bg-muted/20 opacity-55 grayscale",
                          !ingredient.removable && "cursor-not-allowed",
                        )}
                        onClick={() => {
                          if (!ingredient.removable) return;
                          setIngredientesActivos((current) => ({
                            ...current,
                            [ingredient.id]: !active,
                          }));
                        }}
                      >
                        {photo ? (
                          <div className="relative min-h-0 flex-1 w-full bg-muted">
                            <Image
                              src={photo}
                              alt=""
                              fill
                              sizes="(max-width: 768px) 20vw, 100px"
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-1.5 pb-1.5 pt-6">
                              <p className="line-clamp-2 text-center text-[10px] font-medium leading-snug sm:text-[11px]">
                                {ingredient.name}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-center px-2">
                            <p className="line-clamp-3 text-center text-[11px] font-medium leading-snug sm:text-xs">
                              {ingredient.name}
                            </p>
                          </div>
                        )}
                        <span
                          className={cn(
                            "border-t px-1.5 py-1 text-center text-[10px] font-medium",
                            active
                              ? "border-primary/20 text-primary"
                              : "border-border/40 text-muted-foreground",
                          )}
                        >
                          {active ? "Incluido" : "Sin este"}
                        </span>
                      </button>
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
          </>
        ) : null}

        {currentStep === "drinks" && drinkGroup ? (
          <section className="space-y-4">
            <header className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {drinkGroup.title}
                {drinkGroup.required ? <span className="text-destructive"> *</span> : null}
              </h1>
              <p className="text-sm text-muted-foreground">{groupQtyHint(drinkGroup)}</p>
              {totalDrinks > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {totalDrinks} bebida{totalDrinks === 1 ? "" : "s"} seleccionada
                  {totalDrinks === 1 ? "" : "s"}
                  {drinkGroup.includedFreeCount > 0
                    ? ` · ${Math.min(totalDrinks, drinkGroup.includedFreeCount)} incluida${Math.min(totalDrinks, drinkGroup.includedFreeCount) === 1 ? "" : "s"}`
                    : ""}
                </p>
              ) : null}
            </header>
            <OptionQtyGrid
              groups={[drinkGroup]}
              optionQty={optionQty}
              lineChargeLabel={lineChargeLabel}
              onChangeQty={handleOptionQty}
            />
          </section>
        ) : null}

        {currentStep === "extras" ? (
          <section className="space-y-4">
            <header className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Adicionales y postres
              </h1>
              <p className="text-sm text-muted-foreground">
                Completa tu pedido con extras, acompañantes o un postre.
              </p>
              <p className="text-xs text-muted-foreground">
                Opcional · cada unidad al precio de carta
              </p>
            </header>

            {extrasGroups.length > 0 ? (
              <OptionQtyGrid
                groups={extrasGroups}
                optionQty={optionQty}
                lineChargeLabel={lineChargeLabel}
                onChangeQty={handleOptionQty}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                No hay adicionales ni postres disponibles por ahora.
              </p>
            )}
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          {stepValidationError ? (
            <p className="text-sm text-destructive" role="status">
              {stepValidationError}
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
              className="h-11 min-w-[10rem] rounded-2xl px-4"
              disabled={Boolean(stepValidationError) || !item.available}
              onClick={handlePrimaryAction}
            >
              {primaryLabel}
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

type OptionQtyGridProps = {
  groups: SelfOrderModifierGroup[];
  optionQty: Record<string, number>;
  lineChargeLabel: (group: SelfOrderModifierGroup, optionId: string, listPrice: number) => string;
  onChangeQty: (group: SelfOrderModifierGroup, optionId: string, nextQty: number) => void;
};

const OptionQtyGrid = ({
  groups,
  optionQty,
  lineChargeLabel,
  onChangeQty,
}: OptionQtyGridProps) => (
  <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
    {groups.flatMap((group) =>
      group.options.map((option) => {
        const qty = optionQty[option.id] ?? 0;
        const photo = option.imageUrl?.trim() || null;
        return (
          <div
            key={option.id}
            className={cn(
              "flex flex-col overflow-hidden rounded-2xl border transition",
              qty > 0 ? "border-primary/35 bg-primary/5" : "border-border/60 bg-card/40",
            )}
          >
            <div className="relative aspect-square w-full bg-muted">
              {photo ? (
                <Image
                  src={photo}
                  alt={option.name}
                  fill
                  sizes="(max-width: 768px) 33vw, 160px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">
                  Sin foto
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2 sm:p-2.5">
              <div className="min-w-0 space-y-0.5">
                <p className="line-clamp-2 text-xs font-medium leading-snug sm:text-sm">
                  {option.name}
                </p>
                <p className="text-[10px] text-muted-foreground sm:text-xs">
                  {lineChargeLabel(group, option.id, option.unitListPrice)}
                </p>
              </div>
              <div className="mt-auto w-full">
                <QuantitySelector
                  size="sm"
                  min={0}
                  max={group.maxSelect}
                  value={qty}
                  className="w-full justify-between"
                  onChange={(value) => onChangeQty(group, option.id, value)}
                />
              </div>
            </div>
          </div>
        );
      }),
    )}
  </div>
);
