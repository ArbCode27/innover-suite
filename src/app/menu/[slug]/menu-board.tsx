"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import {
  Filter,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { placePublicMenuOrderAction } from "@/lib/menu/actions";
import { formatRemovedIngredientsNote } from "@/lib/menu/public-menu";
import type { CartLine, MenuProduct, PublicMenuPayload } from "@/lib/menu/types";
import { formatMoney } from "@/lib/commerce/types";
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
import { cn } from "@/lib/utils";

type MenuBoardProps = {
  menu: PublicMenuPayload;
};

const lineKey = (productId: number, removedIds: string[]) =>
  `${productId}::${[...removedIds].sort().join(",")}`;

export const MenuBoard = ({ menu }: MenuBoardProps) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [customizeProduct, setCustomizeProduct] = useState<MenuProduct | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<Record<string, boolean>>({});
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => ["all", ...menu.categories], [menu.categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (!q) return true;
      return `${product.name} ${product.description ?? ""} ${product.category ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [menu.products, search, category]);

  const featured = useMemo(
    () => filtered.filter((product) => product.promoPrice != null).slice(0, 8),
    [filtered],
  );
  const regular = useMemo(
    () => filtered.filter((product) => product.promoPrice == null || !featured.includes(product)),
    [filtered, featured],
  );

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discount = menu.restaurant.promoPercent
    ? Math.round(subtotal * (menu.restaurant.promoPercent / 100) * 100) / 100
    : 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * menu.restaurant.taxRate * 100) / 100;
  const total = taxable + tax;

  const openCustomize = (product: MenuProduct) => {
    if (!product.available) return;
    if (!product.ingredients.length) {
      addToCart(product, []);
      return;
    }
    const initial: Record<string, boolean> = {};
    product.ingredients.forEach((ingredient) => {
      initial[ingredient.id] = true;
    });
    setSelectedIngredients(initial);
    setCustomizeProduct(product);
  };

  const addToCart = (product: MenuProduct, keptIngredientIds: string[]) => {
    const removed = product.ingredients.filter((ingredient) => !keptIngredientIds.includes(ingredient.id));
    const removedIds = removed.map((ingredient) => ingredient.id);
    const key = lineKey(product.id, removedIds);
    const unitPrice = product.promoPrice ?? product.price;

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
          productId: product.id,
          name: product.name,
          unitPrice,
          currency: product.currency,
          quantity: 1,
          imageUrl: product.imageUrl,
          removedIngredientIds: removedIds,
          removedIngredientNames: removed.map((ingredient) => ingredient.name),
          note: formatRemovedIngredientsNote(removed.map((ingredient) => ingredient.name)),
        },
      ];
    });
    setCustomizeProduct(null);
  };

  const updateQty = (key: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  const handleConfirmCustomize = () => {
    if (!customizeProduct) return;
    const kept = customizeProduct.ingredients
      .filter((ingredient) => selectedIngredients[ingredient.id] !== false)
      .map((ingredient) => ingredient.id);
    addToCart(customizeProduct, kept);
  };

  const handlePlaceOrder = () => {
    setOrderError(null);
    setOrderMessage(null);
    startTransition(async () => {
      const result = await placePublicMenuOrderAction({
        slug: menu.restaurant.slug,
        customerName,
        partySize,
        fulfillment: "dine_in",
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
      setOrderMessage(
        `Pedido #${result.orderId} enviado. Total ${formatMoney(result.total ?? total, menu.restaurant.currency)}.`,
      );
    });
  };

  return (
    <div className="min-h-dvh bg-[#f4f5f7] text-zinc-900">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        <section className="min-w-0 flex-1 space-y-5">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                <UtensilsCrossed className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Auto-pedido
                </p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{menu.restaurant.name}</h1>
              </div>
            </div>
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar comida o bebidas"
                className="h-11 rounded-full border-zinc-200 bg-white pl-10 shadow-sm"
                aria-label="Buscar en el menú"
              />
            </div>
          </header>

          {featured.length ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Descuentos especiales</h2>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {featured.map((product) => (
                  <ProductCard
                    key={`feat-${product.id}`}
                    product={product}
                    compact
                    onOrder={() => openCustomize(product)}
                    quantityInCart={cart
                      .filter((line) => line.productId === product.id)
                      .reduce((sum, line) => sum + line.quantity, 0)}
                    onInc={() => {
                      const line = cart.find((entry) => entry.productId === product.id);
                      if (line) updateQty(line.key, 1);
                      else openCustomize(product);
                    }}
                    onDec={() => {
                      const line = cart.find((entry) => entry.productId === product.id);
                      if (line) updateQty(line.key, -1);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  category === value
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 shadow-sm hover:bg-zinc-100",
                )}
              >
                {value === "all" ? "Todos" : value}
              </button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-medium text-zinc-500 shadow-sm">
              <Filter className="size-3.5" aria-hidden />
              {filtered.length} platos
            </span>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Explora el menú</h2>
            {regular.length || featured.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {(regular.length ? regular : filtered).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onOrder={() => openCustomize(product)}
                    quantityInCart={cart
                      .filter((line) => line.productId === product.id)
                      .reduce((sum, line) => sum + line.quantity, 0)}
                    onInc={() => {
                      const line = cart.find((entry) => entry.productId === product.id);
                      if (line) updateQty(line.key, 1);
                      else openCustomize(product);
                    }}
                    onDec={() => {
                      const line = cart.find((entry) => entry.productId === product.id);
                      if (line) updateQty(line.key, -1);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">
                No hay platos en esta categoría.
              </p>
            )}
          </div>
        </section>

        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)] lg:w-[360px]">
          <div className="flex h-full flex-col rounded-3xl bg-white p-5 shadow-sm">
            <div className="space-y-3 border-b border-zinc-100 pb-4">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name">Nombre del cliente</Label>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Ej. María Pérez"
                  className="rounded-xl"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label>Personas / mesa</Label>
                <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2 py-1">
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-full bg-white shadow-sm"
                    aria-label="Menos personas"
                    onClick={() => setPartySize((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-6 text-center text-sm font-semibold">{partySize}</span>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-full bg-white shadow-sm"
                    aria-label="Más personas"
                    onClick={() => setPartySize((value) => Math.min(50, value + 1))}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h2 className="font-semibold">Pedido actual</h2>
              <Badge variant="secondary">{cart.length}</Badge>
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-zinc-50 text-center text-sm text-zinc-500">
                  <ShoppingBag className="size-5" aria-hidden />
                  Agrega platos del menú
                </div>
              ) : (
                cart.map((line) => (
                  <div key={line.key} className="flex gap-3 rounded-2xl border border-zinc-100 p-2.5">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {line.imageUrl ? (
                        <Image src={line.imageUrl} alt="" fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-400">
                          <UtensilsCrossed className="size-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{line.name}</p>
                          <p className="text-xs text-zinc-500">
                            {formatMoney(line.unitPrice, line.currency)} × {line.quantity}
                          </p>
                          {line.note ? (
                            <p className="mt-1 text-[11px] leading-4 text-amber-700">{line.note}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="text-zinc-400 hover:text-red-500"
                          aria-label={`Quitar ${line.name}`}
                          onClick={() => setCart((current) => current.filter((entry) => entry.key !== line.key))}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-1.5 py-1">
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-full bg-white"
                          aria-label="Menos"
                          onClick={() => updateQty(line.key, -1)}
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="min-w-4 text-center text-xs font-semibold">{line.quantity}</span>
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-full bg-white"
                          aria-label="Más"
                          onClick={() => updateQty(line.key, 1)}
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal, menu.restaurant.currency)}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-zinc-500">
                  <span>Descuento</span>
                  <span>-{formatMoney(discount, menu.restaurant.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-zinc-500">
                <span>IVA</span>
                <span>{formatMoney(tax, menu.restaurant.currency)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-emerald-600">
                <span>Total</span>
                <span>{formatMoney(total, menu.restaurant.currency)}</span>
              </div>
            </div>

            {orderError ? <p className="mt-3 text-sm text-red-600">{orderError}</p> : null}
            {orderMessage ? <p className="mt-3 text-sm text-emerald-600">{orderMessage}</p> : null}

            <Button
              className="mt-4 h-12 w-full rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800"
              disabled={isPending || cart.length === 0 || customerName.trim().length < 2}
              onClick={handlePlaceOrder}
            >
              {isPending ? "Enviando…" : "Ordenar ahora"}
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(customizeProduct)} onOpenChange={(open) => !open && setCustomizeProduct(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{customizeProduct?.name}</DialogTitle>
            <DialogDescription>
              Marca los ingredientes que deseas conservar. Desmarca para eliminarlos de la preparación.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto py-2">
            {customizeProduct?.ingredients.map((ingredient) => (
              <label
                key={ingredient.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5"
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
            <Button variant="outline" onClick={() => setCustomizeProduct(null)}>
              Cancelar
            </Button>
            <Button className="bg-zinc-900 text-white hover:bg-zinc-800" onClick={handleConfirmCustomize}>
              Agregar al pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProductCard = ({
  product,
  onOrder,
  quantityInCart,
  onInc,
  onDec,
  compact = false,
}: {
  product: MenuProduct;
  onOrder: () => void;
  quantityInCart: number;
  onInc: () => void;
  onDec: () => void;
  compact?: boolean;
}) => {
  const price = product.promoPrice ?? product.price;
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm",
        compact ? "w-[240px] shrink-0" : "",
        !product.available && "opacity-60",
      )}
    >
      <div className={cn("relative bg-zinc-100", compact ? "h-36" : "h-44")}>
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <UtensilsCrossed className="size-8" />
          </div>
        )}
        {product.availableQty != null ? (
          <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
            Disponible: {Math.max(0, Math.floor(product.availableQty))}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold tracking-tight">{product.name}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {product.ingredients.length
              ? `${product.ingredients.length} ingredientes`
              : product.category || "Precio por porción"}
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            {product.promoPrice != null ? (
              <p className="text-xs text-red-500 line-through">
                {formatMoney(product.price, product.currency)}
              </p>
            ) : null}
            <p className="text-sm font-bold">{formatMoney(price, product.currency)}</p>
          </div>
          {!product.available ? (
            <Badge variant="outline">Agotado</Badge>
          ) : quantityInCart > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-2 py-1 text-white">
              <button type="button" className="flex size-7 items-center justify-center" onClick={onDec} aria-label="Menos">
                <Minus className="size-3.5" />
              </button>
              <span className="min-w-4 text-center text-sm font-semibold">{quantityInCart}</span>
              <button type="button" className="flex size-7 items-center justify-center" onClick={onInc} aria-label="Más">
                <Plus className="size-3.5" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              className="rounded-full bg-zinc-900 px-4 text-white hover:bg-zinc-800"
              onClick={onOrder}
            >
              Ordenar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
};
