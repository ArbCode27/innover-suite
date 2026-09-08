"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import {
  Building2,
  Filter,
  Heart,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { placePublicMenuOrderAction, submitPublicCatalogInquiryAction } from "@/lib/menu/actions";
import { formatRemovedIngredientsNote } from "@/lib/menu/format";
import type {
  CartLine,
  CatalogItem,
  InterestLine,
  PublicCatalogPayload,
} from "@/lib/menu/types";
import { formatMoney } from "@/lib/commerce/types";
import { parsePaletteId, setDocumentPalette } from "@/lib/theme/palettes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type CatalogBoardProps = {
  catalog: PublicCatalogPayload;
};

const lineKey = (productId: number, removedIds: string[]) =>
  `${productId}::${[...removedIds].sort().join(",")}`;

export const CatalogBoard = ({ catalog }: CatalogBoardProps) => {
  const org = catalog.organization;
  const themePalette = parsePaletteId(org.themePalette);

  useEffect(() => {
    setDocumentPalette(themePalette);
  }, [themePalette]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [interests, setInterests] = useState<InterestLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [customizeItem, setCustomizeItem] = useState<CatalogItem | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<Record<string, boolean>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const typeOptions = useMemo(
    () => catalog.filters.filter((entry) => entry.id !== "all"),
    [catalog.filters],
  );
  const showTypeFilters = typeOptions.length > 1;

  const categoryOptions = useMemo(() => {
    const scoped = catalog.items.filter((item) => filter === "all" || item.kind === filter);
    return [
      ...new Set(scoped.map((item) => item.category).filter((value): value is string => Boolean(value))),
    ].sort((a, b) => a.localeCompare(b, "es"));
  }, [catalog.items, filter]);
  const showCategoryFilters = categoryOptions.length > 1;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.items.filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return `${item.title} ${item.description ?? ""} ${item.category ?? ""} ${item.metaLabel ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [catalog.items, search, filter, category]);

  const handleTypeFilter = (next: string) => {
    setFilter(next);
    setCategory("all");
  };

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0) + interests.length;
  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = org.promoPercent
    ? Math.round(subtotal * (org.promoPercent / 100) * 100) / 100
    : 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = org.canOrder ? Math.round(taxable * org.taxRate * 100) / 100 : 0;
  const total = taxable + tax;

  const openCustomize = (item: CatalogItem) => {
    if (!item.available) return;
    if (item.actionable === "inquire") {
      setInterests((current) => {
        if (current.some((entry) => entry.listingId === item.sourceId)) return current;
        return [
          ...current,
          {
            key: item.id,
            listingId: item.sourceId,
            title: item.title,
            price: item.price,
            currency: item.currency,
            imageUrl: item.imageUrl,
            metaLabel: item.metaLabel,
          },
        ];
      });
      setCartOpen(true);
      return;
    }
    if (!item.ingredients.length) {
      addProductToCart(item, []);
      return;
    }
    const initial: Record<string, boolean> = {};
    item.ingredients.forEach((ingredient) => {
      initial[ingredient.id] = true;
    });
    setSelectedIngredients(initial);
    setCustomizeItem(item);
  };

  const addProductToCart = (item: CatalogItem, keptIngredientIds: string[]) => {
    const removed = item.ingredients.filter((ingredient) => !keptIngredientIds.includes(ingredient.id));
    const removedIds = removed.map((ingredient) => ingredient.id);
    const key = lineKey(item.sourceId, removedIds);
    const unitPrice = item.promoPrice ?? item.price ?? 0;

    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          key,
          productId: item.sourceId,
          name: item.title,
          unitPrice,
          currency: item.currency,
          quantity: 1,
          imageUrl: item.imageUrl,
          removedIngredientIds: removedIds,
          removedIngredientNames: removed.map((ingredient) => ingredient.name),
          note: formatRemovedIngredientsNote(removed.map((ingredient) => ingredient.name)),
        },
      ];
    });
    setCustomizeItem(null);
    setCartOpen(true);
  };

  const updateQty = (key: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const handleConfirmCustomize = () => {
    if (!customizeItem) return;
    const kept = customizeItem.ingredients
      .filter((ingredient) => selectedIngredients[ingredient.id] !== false)
      .map((ingredient) => ingredient.id);
    addProductToCart(customizeItem, kept);
  };

  const handleSubmit = () => {
    setOrderError(null);
    setOrderMessage(null);
    startTransition(async () => {
      if (cart.length > 0 && org.canOrder) {
        const result = await placePublicMenuOrderAction({
          slug: org.slug,
          customerName,
          partySize,
          fulfillment: "dine_in",
          customerNote: interests.length
            ? `También interesa: ${interests.map((item) => item.title).join(", ")}`
            : undefined,
          items: cart.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            notes: line.note || undefined,
          })),
        });
        if (!result.ok) {
          setOrderError(result.error);
          return;
        }
        setCart([]);
        setInterests([]);
        setOrderMessage(
          `Pedido #${result.orderId} enviado. Total ${formatMoney(result.total ?? total, org.currency)}.`,
        );
        return;
      }

      if (interests.length > 0) {
        const result = await submitPublicCatalogInquiryAction({
          slug: org.slug,
          customerName,
          customerPhone,
          listingIds: interests.map((item) => item.listingId),
        });
        if (!result.ok) {
          setOrderError(result.error);
          return;
        }
        setInterests([]);
        setOrderMessage("Consulta enviada. El equipo te contactará pronto.");
        return;
      }

      setOrderError("Agrega ítems al carrito o a tu lista de interés.");
    });
  };

  const sidebar = (
    <CartPanel
      orgName={org.name}
      canOrder={org.canOrder}
      customerName={customerName}
      customerPhone={customerPhone}
      partySize={partySize}
      cart={cart}
      interests={interests}
      subtotal={subtotal}
      discount={discount}
      tax={tax}
      total={total}
      currency={org.currency}
      orderError={orderError}
      orderMessage={orderMessage}
      isPending={isPending}
      onCustomerNameChange={setCustomerName}
      onCustomerPhoneChange={setCustomerPhone}
      onPartySizeChange={setPartySize}
      onUpdateQty={updateQty}
      onRemoveCart={(key) => setCart((current) => current.filter((line) => line.key !== key))}
      onRemoveInterest={(key) => setInterests((current) => current.filter((line) => line.key !== key))}
      onSubmit={handleSubmit}
    />
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <section className="min-w-0 flex-1 space-y-5">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  {org.logoUrl ? (
                    <Image
                      src={org.logoUrl}
                      alt={org.name}
                      width={44}
                      height={44}
                      className="size-11 object-cover"
                      unoptimized
                    />
                  ) : (
                    <UtensilsCrossed className="size-5" aria-hidden />
                  )}
                </span>
                <div>
                  <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{org.name}</h1>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                className="relative shrink-0 rounded-full lg:hidden"
                aria-label="Abrir carrito"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBag className="size-4" />
                {cartCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                    {cartCount}
                  </span>
                ) : null}
              </Button>
            </div>
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar platos, productos o inmuebles"
                className="h-11 rounded-full bg-card pl-10 shadow-sm"
                aria-label="Buscar en el catálogo"
              />
            </div>
          </header>

          {(showTypeFilters || showCategoryFilters) ? (
            <div className="space-y-2">
              {showTypeFilters ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {catalog.filters.map((entry) => (
                    <FilterChip
                      key={entry.id}
                      label={entry.label}
                      active={filter === entry.id}
                      onClick={() => handleTypeFilter(entry.id)}
                    />
                  ))}
                </div>
              ) : null}
              {showCategoryFilters ? (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <FilterChip
                    label="Todas"
                    active={category === "all"}
                    onClick={() => setCategory("all")}
                  />
                  {categoryOptions.map((entry) => (
                    <FilterChip
                      key={entry}
                      label={entry}
                      active={category === entry}
                      onClick={() => setCategory(entry)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="size-3.5" aria-hidden />
              {filtered.length} ítems
            </span>
          </div>

          {filtered.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <CatalogCard key={item.id} item={item} onAction={() => openCustomize(item)} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              No hay resultados en este filtro.
            </p>
          )}
        </section>

        <aside className="hidden w-full shrink-0 lg:sticky lg:top-6 lg:block lg:h-[calc(100dvh-3rem)] lg:w-[360px]">
          {sidebar}
        </aside>
      </div>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full max-w-md border-l bg-card p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Tu selección</SheetTitle>
            <SheetDescription>
              {org.canOrder ? "Revisa el pedido o tus intereses." : "Revisa los inmuebles de interés."}
            </SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100dvh-5rem)] overflow-y-auto p-4">{sidebar}</div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(customizeItem)} onOpenChange={(open) => !open && setCustomizeItem(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{customizeItem?.title}</DialogTitle>
            <DialogDescription>
              Marca los ingredientes que deseas conservar. Desmarca para eliminarlos de la preparación.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto py-2">
            {customizeItem?.ingredients.map((ingredient) => (
              <label
                key={ingredient.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <Checkbox
                  checked={selectedIngredients[ingredient.id] !== false}
                  onCheckedChange={(checked) =>
                    setSelectedIngredients((current) => ({
                      ...current,
                      [ingredient.id]: checked === true,
                    }))
                  }
                />
                <span className="text-sm font-medium">{ingredient.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCustomizeItem(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmCustomize}>Agregar al pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** Back-compat export used by older imports */
export const MenuBoard = ({ menu }: { menu: PublicCatalogPayload }) => (
  <CatalogBoard catalog={menu} />
);

const FilterChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-muted",
    )}
  >
    {label}
  </button>
);

const CatalogCard = ({ item, onAction }: { item: CatalogItem; onAction: () => void }) => {
  const price = item.promoPrice ?? item.price;
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl bg-card shadow-sm",
        !item.available && "opacity-60",
      )}
    >
      <div className="relative h-44 bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {item.kind === "property" ? <Building2 className="size-8" /> : <UtensilsCrossed className="size-8" />}
          </div>
        )}
        <span className="absolute top-3 left-3 rounded-full bg-foreground/55 px-2.5 py-1 text-[11px] font-medium text-background">
          {item.metaLabel || item.category || "Ítem"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold tracking-tight">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {item.description ||
              (item.ingredients.length
                ? `${item.ingredients.length} ingredientes`
                : item.metaLabel || "Sin descripción")}
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            {item.promoPrice != null && item.price != null ? (
              <p className="text-xs text-destructive line-through">{formatMoney(item.price, item.currency)}</p>
            ) : null}
            <p className="text-sm font-bold">
              {price == null ? "Consultar" : formatMoney(price, item.currency)}
            </p>
          </div>
          {!item.available ? (
            <Badge variant="outline">No disponible</Badge>
          ) : (
            <Button size="sm" className="rounded-full px-4" onClick={onAction}>
              {item.actionable === "inquire" ? (
                <>
                  <Heart className="size-3.5" /> Me interesa
                </>
              ) : (
                "Ordenar"
              )}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};

type CartPanelProps = {
  orgName: string;
  canOrder: boolean;
  customerName: string;
  customerPhone: string;
  partySize: number;
  cart: CartLine[];
  interests: InterestLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  orderError: string | null;
  orderMessage: string | null;
  isPending: boolean;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onPartySizeChange: (value: number) => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveCart: (key: string) => void;
  onRemoveInterest: (key: string) => void;
  onSubmit: () => void;
};

const CartPanel = ({
  canOrder,
  customerName,
  customerPhone,
  partySize,
  cart,
  interests,
  subtotal,
  discount,
  tax,
  total,
  currency,
  orderError,
  orderMessage,
  isPending,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onPartySizeChange,
  onUpdateQty,
  onRemoveCart,
  onRemoveInterest,
  onSubmit,
}: CartPanelProps) => {
  const empty = cart.length === 0 && interests.length === 0;
  const canSubmit =
    customerName.trim().length >= 2 &&
    !empty &&
    (cart.length === 0 || canOrder) &&
    (interests.length === 0 || customerPhone.trim().length >= 7 || cart.length > 0);

  return (
    <div className="flex h-full flex-col rounded-3xl bg-card lg:p-5 lg:shadow-sm">
      <div className="space-y-3 border-b border-border pb-4">
        <div className="space-y-1.5">
          <Label htmlFor="customer-name">Nombre del cliente</Label>
          <Input
            id="customer-name"
            value={customerName}
            onChange={(event) => onCustomerNameChange(event.target.value)}
            placeholder="Ej. María Pérez"
            className="rounded-xl"
          />
        </div>
        {interests.length > 0 || !canOrder ? (
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone">Teléfono / WhatsApp</Label>
            <Input
              id="customer-phone"
              value={customerPhone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              placeholder="+58 412..."
              className="rounded-xl"
            />
          </div>
        ) : null}
        {canOrder ? (
          <div className="flex items-center justify-between gap-3">
            <Label>Personas / mesa</Label>
            <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2 py-1">
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full bg-card shadow-sm"
                aria-label="Menos personas"
                onClick={() => onPartySizeChange(Math.max(1, partySize - 1))}
              >
                <Minus className="size-3.5" />
              </button>
              <span className="min-w-6 text-center text-sm font-semibold">{partySize}</span>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full bg-card shadow-sm"
                aria-label="Más personas"
                onClick={() => onPartySizeChange(Math.min(50, partySize + 1))}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="font-semibold">{canOrder ? "Pedido / intereses" : "Intereses"}</h2>
        <Badge variant="secondary">{cart.length + interests.length}</Badge>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {empty ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-muted/50 text-center text-sm text-muted-foreground">
            <ShoppingBag className="size-5" aria-hidden />
            Agrega ítems del catálogo
          </div>
        ) : (
          <>
            {cart.map((line) => (
              <div key={line.key} className="flex gap-3 rounded-2xl border border-border p-2.5">
                <Thumb url={line.imageUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(line.unitPrice, line.currency)} × {line.quantity}
                      </p>
                      {line.note ? (
                        <p className="mt-1 text-[11px] leading-4 text-primary">{line.note}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Quitar ${line.name}`}
                      onClick={() => onRemoveCart(line.key)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-1.5 py-1">
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-full bg-card"
                      aria-label="Menos"
                      onClick={() => onUpdateQty(line.key, -1)}
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="min-w-4 text-center text-xs font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded-full bg-card"
                      aria-label="Más"
                      onClick={() => onUpdateQty(line.key, 1)}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {interests.map((line) => (
              <div key={line.key} className="flex gap-3 rounded-2xl border border-border p-2.5">
                <Thumb url={line.imageUrl} property />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{line.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.price == null ? "Consultar" : formatMoney(line.price, line.currency)}
                      </p>
                      {line.metaLabel ? (
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{line.metaLabel}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Quitar ${line.title}`}
                      onClick={() => onRemoveInterest(line.key)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {canOrder && cart.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Descuento</span>
              <span>-{formatMoney(discount, currency)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-muted-foreground">
            <span>IVA</span>
            <span>{formatMoney(tax, currency)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-primary">
            <span>Total</span>
            <span>{formatMoney(total, currency)}</span>
          </div>
        </div>
      ) : null}

      {orderError ? <p className="mt-3 text-sm text-destructive">{orderError}</p> : null}
      {orderMessage ? <p className="mt-3 text-sm text-primary">{orderMessage}</p> : null}

      <Button className="mt-4 h-12 w-full rounded-2xl" disabled={isPending || !canSubmit} onClick={onSubmit}>
        {isPending ? "Enviando…" : cart.length > 0 ? "Ordenar ahora" : "Enviar consulta"}
      </Button>
    </div>
  );
};

const Thumb = ({ url, property = false }: { url: string | null; property?: boolean }) => (
  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
    {url ? (
      <Image src={url} alt="" fill className="object-cover" unoptimized />
    ) : (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {property ? <Building2 className="size-4" /> : <UtensilsCrossed className="size-4" />}
      </div>
    )}
  </div>
);
