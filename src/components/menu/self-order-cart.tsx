"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShoppingBag, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QuantitySelector } from "@/components/pedido/quantity-selector";
import { useMediaQuery } from "@/hooks/use-media-query";
import { placePublicMenuOrderAction } from "@/lib/menu/actions";
import { formatMoney } from "@/lib/commerce/types";
import { describeCustomization } from "@/lib/menu/self-order";
import type { PublicCatalogOrg } from "@/lib/menu/types";
import { usePublicMenuCartStore } from "@/store/public-menu-cart-store";
import { cn } from "@/lib/utils";

type SelfOrderCartProps = {
  org: PublicCatalogOrg;
  hideFab?: boolean;
  fabClassName?: string;
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
};

export const SelfOrderCart = ({
  org,
  hideFab = false,
  fabClassName,
  forceOpen = false,
  onForceOpenHandled,
}: SelfOrderCartProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const ensureSlug = usePublicMenuCartStore((state) => state.ensureSlug);
  const items = usePublicMenuCartStore((state) => state.items);
  const customerName = usePublicMenuCartStore((state) => state.customerName);
  const setCustomerName = usePublicMenuCartStore((state) => state.setCustomerName);
  const actualizarCantidad = usePublicMenuCartStore((state) => state.actualizarCantidad);
  const eliminarItem = usePublicMenuCartStore((state) => state.eliminarItem);
  const limpiarCarrito = usePublicMenuCartStore((state) => state.limpiarCarrito);
  const getCantidadItems = usePublicMenuCartStore((state) => state.getCantidadItems);
  const getTotales = usePublicMenuCartStore((state) => state.getTotales);
  const isSubmitting = usePublicMenuCartStore((state) => state.isSubmitting);
  const setSubmitting = usePublicMenuCartStore((state) => state.setSubmitting);
  const setLastOrderId = usePublicMenuCartStore((state) => state.setLastOrderId);

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  ensureSlug(org.slug);
  const cantidad = getCantidadItems();
  const totales = getTotales(org.promoPercent, org.taxRate);

  useEffect(() => {
    if (searchParams.get("cart") === "1" || forceOpen) {
      setOpen(true);
      onForceOpenHandled?.();
    }
  }, [searchParams, forceOpen, onForceOpenHandled]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && searchParams.get("cart") === "1") {
      router.replace(pathname);
    }
  };

  const handleCheckout = () => {
    setError(null);
    if (customerName.trim().length < 2) {
      setError("Indica el nombre del cliente.");
      return;
    }
    if (!items.length) {
      setError("Tu carrito está vacío.");
      return;
    }
    if (!org.canOrder) {
      setError("Este menú no acepta pedidos en este momento.");
      return;
    }

    startTransition(async () => {
      setSubmitting(true);
      try {
        const result = await placePublicMenuOrderAction({
          slug: org.slug,
          customerName: customerName.trim(),
          partySize: 1,
          fulfillment: "dine_in",
          items: items.map((line) => ({
            productId: line.menuItemId,
            quantity: line.quantity,
            notes: line.note || undefined,
          })),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const orderId = result.orderId ?? 0;
        setLastOrderId(orderId);
        limpiarCarrito();
        handleOpenChange(false);
        toast.success(`Pedido #${orderId} enviado a cocina`);
        router.push(
          `/menu/${org.slug}/confirmacion?orden=${encodeURIComponent(String(orderId))}&total=${encodeURIComponent(String(result.total ?? totales.total))}`,
        );
      } finally {
        setSubmitting(false);
      }
    });
  };

  const panel = (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="self-order-customer">Nombre del cliente</Label>
          <Input
            id="self-order-customer"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Ej. María Pérez / Mesa 4"
            className="rounded-xl"
          />
        </div>

        {!items.length ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Tu carrito está vacío. Explora el menú y agrega tu primer plato.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((line) => {
              const detail = describeCustomization(line);
              return (
                <li key={line.key} className="flex gap-3 rounded-2xl border border-border/70 p-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <UtensilsCrossed className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{line.name}</p>
                        {detail ? (
                          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Eliminar ${line.name}`}
                        onClick={() => eliminarItem(line.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <QuantitySelector
                        size="sm"
                        value={line.quantity}
                        onChange={(value) => actualizarCantidad(line.key, value)}
                      />
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(line.unitPrice * line.quantity, line.currency)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {items.length > 0 ? (
          <>
            <Separator />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(totales.subtotal, org.currency)}</dd>
              </div>
              {totales.discount > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Descuento</dt>
                  <dd className="tabular-nums">-{formatMoney(totales.discount, org.currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-muted-foreground">
                <dt>Impuestos</dt>
                <dd className="tabular-nums">{formatMoney(totales.tax, org.currency)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(totales.total, org.currency)}</dd>
              </div>
            </dl>
          </>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo confirmar</AlertTitle>
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={handleCheckout}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-border px-4 py-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            handleOpenChange(false);
            router.push(`/menu/${org.slug}`);
          }}
        >
          Seguir explorando
        </Button>
        <Button
          type="button"
          className="h-12 w-full rounded-2xl"
          disabled={!items.length || isSubmitting || !org.canOrder}
          onClick={handleCheckout}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Enviando…
            </>
          ) : (
            "Confirmar y enviar pedido"
          )}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {!hideFab ? (
        <Button
          type="button"
          size="icon"
          className={cn(
            "fixed right-4 bottom-4 z-40 size-14 rounded-full shadow-lg md:right-6 md:bottom-6",
            fabClassName,
          )}
          aria-label={`Abrir carrito, ${cantidad} ítems`}
          onClick={() => setOpen(true)}
        >
          <ShoppingBag className="size-5" />
          {cantidad > 0 ? (
            <Badge className="absolute -top-1 -right-1 size-5 justify-center rounded-full p-0 text-[10px]">
              {cantidad}
            </Badge>
          ) : null}
        </Button>
      ) : null}

      {isDesktop ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border">
              <SheetTitle>Tu carrito</SheetTitle>
              <SheetDescription>Revisa personalizaciones y confirma el pedido.</SheetDescription>
            </SheetHeader>
            {panel}
            <SheetFooter className="sr-only">Carrito</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Tu carrito</DrawerTitle>
              <DrawerDescription>Revisa personalizaciones y confirma el pedido.</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panel}</div>
            <DrawerFooter className="sr-only">Carrito</DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};

export const openSelfOrderCart = (setOpen: (value: boolean) => void) => setOpen(true);
