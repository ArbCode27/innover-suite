"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, PackagePlus, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  createProductAction,
  createPromotionAction,
  receiveStockAction,
  togglePromotionAction,
  updateProductAction,
} from "@/lib/commerce/actions";
import {
  formatMoney,
  PRODUCT_KIND_LABELS,
  type InventoryMovementRecord,
  type ProductKind,
  type ProductRecord,
  type PromotionRecord,
} from "@/lib/commerce/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type InventoryBoardProps = {
  products: ProductRecord[];
  promotions: PromotionRecord[];
  movements: InventoryMovementRecord[];
  canManage: boolean;
};

const emptyProductForm = {
  name: "",
  sku: "",
  category: "",
  kind: "physical" as ProductKind,
  price: "",
  initialStock: "",
  reorderPoint: "",
  description: "",
  trackStock: true,
};

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const InventoryBoard = ({ products, promotions, movements, canManage }: InventoryBoardProps) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyProductForm);
  const [promoForm, setPromoForm] = useState({ name: "", description: "", discountPercent: "" });
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});
  const [isPending, startTransition] = useTransition();

  const lowStockCount = useMemo(
    () =>
      products.filter(
        (product) =>
          product.trackStock &&
          product.onHand != null &&
          product.reorderPoint != null &&
          product.onHand <= product.reorderPoint,
      ).length,
    [products],
  );

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(emptyProductForm);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (product: ProductRecord) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku ?? "",
      category: product.category ?? "",
      kind: product.kind,
      price: String(product.price),
      initialStock: "",
      reorderPoint: product.reorderPoint == null ? "" : String(product.reorderPoint),
      description: product.description ?? "",
      trackStock: product.trackStock,
    });
    setIsSheetOpen(true);
  };

  const handleSaveProduct = () => {
    const price = Number(form.price);
    if (!form.name.trim() || Number.isNaN(price) || price < 0) {
      toast.error("Nombre y precio son obligatorios.");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        category: form.category || undefined,
        kind: form.kind,
        price,
        trackStock: form.kind === "service" ? false : form.trackStock,
        description: form.description || undefined,
        reorderPoint: form.reorderPoint ? Number(form.reorderPoint) : undefined,
        initialStock: form.initialStock ? Number(form.initialStock) : undefined,
        ...(editingId ? { id: editingId, active: true } : {}),
      };

      const result = editingId ? await updateProductAction(payload) : await createProductAction(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setIsSheetOpen(false);
    });
  };

  const handleReceive = (inventoryItemId: number) => {
    const quantity = Number(receiveQty[inventoryItemId]);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Indica cuántas unidades recibiste.");
      return;
    }

    startTransition(async () => {
      const result = await receiveStockAction({ inventoryItemId, quantity });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setReceiveQty((current) => ({ ...current, [inventoryItemId]: "" }));
    });
  };

  const handleCreatePromotion = () => {
    if (!promoForm.name.trim()) {
      toast.error("Ponle un nombre a la promoción.");
      return;
    }
    startTransition(async () => {
      const result = await createPromotionAction({
        name: promoForm.name,
        description: promoForm.description || undefined,
        discountPercent: promoForm.discountPercent ? Number(promoForm.discountPercent) : undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setPromoForm({ name: "", description: "", discountPercent: "" });
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/15 bg-card/70">
          <CardHeader className="p-4">
            <CardDescription>Productos</CardDescription>
            <CardTitle className="mt-1 text-3xl">{products.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/15 bg-card/70">
          <CardHeader className="p-4">
            <CardDescription>Alertas de stock</CardDescription>
            <CardTitle className="mt-1 text-3xl">{lowStockCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/15 bg-card/70">
          <CardHeader className="p-4">
            <CardDescription>Promociones activas</CardDescription>
            <CardTitle className="mt-1 text-3xl">{promotions.filter((item) => item.active).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-primary/15 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Catálogo e inventario</CardTitle>
            <CardDescription>La IA vende solo lo que está aquí, al precio y stock reales.</CardDescription>
          </div>
          {canManage ? (
            <Button type="button" onClick={handleOpenCreate}>
              <Plus />
              Agregar producto
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {products.length ? (
            products.map((product) => {
              const isLow =
                product.trackStock &&
                product.onHand != null &&
                product.reorderPoint != null &&
                product.onHand <= product.reorderPoint;
              return (
                <div
                  key={product.id}
                  className="flex flex-col gap-3 rounded-xl border border-primary/10 bg-background/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{product.name}</p>
                      <Badge variant="outline">{PRODUCT_KIND_LABELS[product.kind]}</Badge>
                      {product.active ? null : <Badge variant="destructive">Inactivo</Badge>}
                      {isLow ? <Badge variant="destructive">Stock bajo</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoney(product.price, product.currency)}
                      {product.sku ? ` · SKU ${product.sku}` : ""}
                      {product.category ? ` · ${product.category}` : ""}
                      {product.kind === "service" || !product.trackStock
                        ? " · sin control de stock"
                        : ` · ${product.onHand ?? 0} en mano`}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {product.inventoryItemId && product.trackStock ? (
                        <>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            className="w-24"
                            placeholder="+ stock"
                            value={receiveQty[product.inventoryItemId] ?? ""}
                            onChange={(event) =>
                              setReceiveQty((current) => ({
                                ...current,
                                [product.inventoryItemId as number]: event.target.value,
                              }))
                            }
                            aria-label={`Reponer ${product.name}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleReceive(product.inventoryItemId as number)}
                          >
                            <PackagePlus />
                            Reponer
                          </Button>
                        </>
                      ) : null}
                      <Button type="button" variant="ghost" onClick={() => handleOpenEdit(product)}>
                        Editar
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              Aún no hay productos. Agrega el stock que la IA podrá vender por chat.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Promociones</CardTitle>
            <CardDescription>La IA las lee en cada conversación mientras estén activas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage ? (
              <div className="grid gap-2">
                <Input
                  placeholder="Nombre de la promo"
                  value={promoForm.name}
                  onChange={(event) => setPromoForm((current) => ({ ...current, name: event.target.value }))}
                  aria-label="Nombre de la promoción"
                />
                <Input
                  placeholder="Detalle para el cliente"
                  value={promoForm.description}
                  onChange={(event) => setPromoForm((current) => ({ ...current, description: event.target.value }))}
                  aria-label="Descripción de la promoción"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="% opcional"
                    value={promoForm.discountPercent}
                    onChange={(event) =>
                      setPromoForm((current) => ({ ...current, discountPercent: event.target.value }))
                    }
                    aria-label="Porcentaje de descuento"
                  />
                  <Button type="button" onClick={handleCreatePromotion} disabled={isPending}>
                    <Tag />
                    Publicar
                  </Button>
                </div>
              </div>
            ) : null}
            <ul className="space-y-2">
              {promotions.map((promo) => (
                <li key={promo.id} className="flex items-center justify-between gap-3 rounded-lg border border-primary/10 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{promo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {promo.description || "Sin detalle"}
                      {promo.discountPercent ? ` · ${promo.discountPercent}%` : ""}
                    </p>
                  </div>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await togglePromotionAction(promo.id, !promo.active);
                          if (result.error) toast.error(result.error);
                          else toast.success(result.success);
                        });
                      }}
                    >
                      {promo.active ? "Pausar" : "Activar"}
                    </Button>
                  ) : (
                    <Badge variant={promo.active ? "default" : "outline"}>{promo.active ? "Activa" : "Pausada"}</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
            <CardDescription>Ventas de la IA, cancelaciones y reposiciones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {movements.length ? (
              movements.map((movement) => (
                <p key={movement.id} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{movement.inventoryItemName}</span>
                  {": "}
                  {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity} · queda {movement.balanceAfter}
                  {movement.orderId ? ` · pedido #${movement.orderId}` : ""}
                </p>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay movimientos de inventario.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar producto" : "Nuevo producto"}</SheetTitle>
            <SheetDescription>El precio y el stock que pongas aquí son los que usa la IA.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="product-name">Nombre</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-price">Precio (DOP)</Label>
                <Input
                  id="product-price"
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-kind">Tipo</Label>
                <select
                  id="product-kind"
                  className={selectClassName}
                  value={form.kind}
                  onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as ProductKind }))}
                >
                  <option value="physical">Producto</option>
                  <option value="food">Comida / plato</option>
                  <option value="service">Servicio</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-sku">SKU</Label>
                <Input
                  id="product-sku"
                  value={form.sku}
                  onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-category">Categoría</Label>
                <Input
                  id="product-category"
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                />
              </div>
            </div>
            {editingId ? null : (
              <div className="space-y-1.5">
                <Label htmlFor="product-stock">Stock inicial</Label>
                <Input
                  id="product-stock"
                  type="number"
                  min={0}
                  value={form.initialStock}
                  onChange={(event) => setForm((current) => ({ ...current, initialStock: event.target.value }))}
                  disabled={form.kind === "service"}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="product-description">Descripción</Label>
              <textarea
                id="product-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="button" onClick={handleSaveProduct} disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
