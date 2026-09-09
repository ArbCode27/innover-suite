"use client";

import Image from "next/image";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QuantitySelector } from "@/components/pedido/quantity-selector";
import { useCartStore } from "@/store/cart-store";
import { formatPrecio, type ItemCarrito } from "@/types/pedido";

const describeCustomization = (item: ItemCarrito) => {
  const parts: string[] = [];
  if (item.ingredientesRemovidos.length) {
    parts.push(`Sin ${item.ingredientesRemovidos.join(", ")}`);
  }
  for (const grupo of item.modificadoresSeleccionados) {
    const meta = item.producto.gruposModificadores?.find((entry) => entry.id === grupo.grupoId);
    for (const opcion of grupo.opcionesSeleccionadas) {
      const extra =
        opcion.precioAdicional > 0 ? ` (+${formatPrecio(opcion.precioAdicional)})` : "";
      parts.push(`${meta?.titulo ?? "Opción"}: ${opcion.nombre}${extra}`);
    }
  }
  return parts.join(" · ");
};

export const CartSummary = () => {
  const items = useCartStore((state) => state.items);
  const actualizarCantidad = useCartStore((state) => state.actualizarCantidad);
  const eliminarItem = useCartStore((state) => state.eliminarItem);
  const getTotales = useCartStore((state) => state.getTotales);
  const totales = getTotales();

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Tu carrito está vacío. Explora el menú y agrega tu primer plato.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) => {
          const detail = describeCustomization(item);
          return (
            <li key={item.id} className="flex gap-3 rounded-2xl border border-border/70 p-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                <Image
                  src={item.producto.imagenUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.producto.nombre}</p>
                    {detail ? (
                      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Eliminar ${item.producto.nombre}`}
                    onClick={() => eliminarItem(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <QuantitySelector
                    size="sm"
                    value={item.cantidad}
                    onChange={(value) => actualizarCantidad(item.id, value)}
                  />
                  <p className="text-sm font-semibold tabular-nums">
                    {formatPrecio(item.subtotalLinea)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Separator />

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatPrecio(totales.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Impuestos</dt>
          <dd className="tabular-nums">{formatPrecio(totales.impuestos)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Cargo por servicio</dt>
          <dd className="tabular-nums">{formatPrecio(totales.cargoServicio)}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPrecio(totales.total)}</dd>
        </div>
      </dl>
    </div>
  );
};
