"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ModifierGroupSelector } from "@/components/pedido/modifier-group-selector";
import { PostAddDecisionModal } from "@/components/pedido/post-add-decision-modal";
import { QuantitySelector } from "@/components/pedido/quantity-selector";
import { useCartStore } from "@/store/cart-store";
import {
  calcularPrecioUnitario,
  formatPrecio,
  validarGruposObligatorios,
  type OpcionModificador,
  type Producto,
  type SeleccionModificador,
} from "@/types/pedido";

type ProductDetailViewProps = {
  producto: Producto;
};

export const ProductDetailView = ({ producto }: ProductDetailViewProps) => {
  const agregarItem = useCartStore((state) => state.agregarItem);
  const [cantidad, setCantidad] = useState(1);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [ingredientesActivos, setIngredientesActivos] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const ingrediente of producto.ingredientesBase ?? []) {
      initial[ingrediente.id] = ingrediente.incluidoPorDefecto;
    }
    return initial;
  });
  const [modificadores, setModificadores] = useState<SeleccionModificador[]>(() =>
    (producto.gruposModificadores ?? []).map((grupo) => ({
      grupoId: grupo.id,
      opcionesSeleccionadas: [],
    })),
  );

  const selectedMap = useMemo(() => {
    const map = new Map<string, OpcionModificador[]>();
    for (const entry of modificadores) {
      map.set(entry.grupoId, entry.opcionesSeleccionadas);
    }
    return map;
  }, [modificadores]);

  const precioUnitario = calcularPrecioUnitario(producto, modificadores);
  const total = Math.round(precioUnitario * cantidad * 100) / 100;
  const validationError = validarGruposObligatorios(producto, modificadores);

  const handleModifierChange = (grupoId: string, opciones: OpcionModificador[]) => {
    setModificadores((current) =>
      current.map((entry) =>
        entry.grupoId === grupoId ? { ...entry, opcionesSeleccionadas: opciones } : entry,
      ),
    );
  };

  const handleAdd = () => {
    if (validationError) return;
    const removidos = (producto.ingredientesBase ?? [])
      .filter((ingrediente) => ingrediente.removible && ingredientesActivos[ingrediente.id] === false)
      .map((ingrediente) => ingrediente.nombre);

    agregarItem({
      producto,
      cantidad,
      ingredientesRemovidos: removidos,
      modificadoresSeleccionados: modificadores.filter(
        (entry) => entry.opcionesSeleccionadas.length > 0,
      ),
    });
    toast.success("Agregado a la orden");
    setDecisionOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-background pb-28">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted sm:aspect-[21/9] sm:rounded-b-3xl">
        <Image
          src={producto.imagenUrl}
          alt={producto.nombre}
          fill
          priority
          className="object-cover"
          sizes="100vw"
          unoptimized
        />
        <Button
          asChild
          variant="secondary"
          size="icon"
          className="absolute top-4 left-4 rounded-full bg-background/90 backdrop-blur"
        >
          <Link href="/pedir" aria-label="Volver al menú">
            <ArrowLeft />
          </Link>
        </Button>
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-6">
        <header className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {producto.etiquetas.map((etiqueta) => (
              <Badge key={etiqueta} variant="secondary">
                {etiqueta}
              </Badge>
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{producto.nombre}</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">{producto.descripcion}</p>
          <p className="text-lg font-semibold tabular-nums">{formatPrecio(producto.precio)}</p>
        </header>

        {(producto.ingredientesBase?.length ?? 0) > 0 ? (
          <section className="space-y-3 rounded-2xl border border-border/70 p-4">
            <div>
              <h2 className="text-sm font-semibold">Ingredientes</h2>
              <p className="text-xs text-muted-foreground">Desmarca lo que no quieras incluir.</p>
            </div>
            <div className="space-y-2">
              {producto.ingredientesBase?.map((ingrediente) => (
                <label
                  key={ingrediente.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5"
                >
                  <span className="flex items-center gap-3">
                    <Checkbox
                      checked={ingredientesActivos[ingrediente.id] !== false}
                      disabled={!ingrediente.removible}
                      onCheckedChange={(checked) =>
                        setIngredientesActivos((current) => ({
                          ...current,
                          [ingrediente.id]: checked === true,
                        }))
                      }
                    />
                    <span className="text-sm">{ingrediente.nombre}</span>
                  </span>
                  {ingrediente.esAlergeno ? (
                    <Badge variant="outline" className="text-[10px]">
                      Alérgeno
                    </Badge>
                  ) : null}
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {(producto.gruposModificadores?.length ?? 0) > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold">Personaliza tu pedido</h2>
            {producto.gruposModificadores?.map((grupo) => (
              <ModifierGroupSelector
                key={grupo.id}
                grupo={grupo}
                selected={selectedMap.get(grupo.id) ?? []}
                onChange={(next) => handleModifierChange(grupo.id, next)}
              />
            ))}
          </div>
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
              <p className="text-lg font-bold tabular-nums">{formatPrecio(total)}</p>
            </div>
            <Button
              type="button"
              className="h-11 min-w-[10rem] rounded-2xl"
              disabled={Boolean(validationError)}
              onClick={handleAdd}
            >
              Agregar a la orden
            </Button>
          </div>
        </div>
      </div>

      <PostAddDecisionModal
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        productName={producto.nombre}
      />
    </div>
  );
};
