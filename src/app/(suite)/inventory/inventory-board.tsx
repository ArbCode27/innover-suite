"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, Loader2, PackagePlus, Pencil, Plus, Search, Tag, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createProductAction,
  createPromotionAction,
  importCatalogCsvAction,
  receiveStockAction,
  togglePromotionAction,
  updateProductAction,
} from "@/lib/commerce/actions";
import { catalogToCsv } from "@/lib/commerce/catalog";
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
import { InventoryMovementsButton, InventoryMovementsSheet } from "./inventory-movements-sheet";
import { AppSelect } from "@/components/ui/app-select";
import { PriceCurrencyField } from "@/components/ui/price-currency-field";
import type { OrganizationCurrencySettings } from "@/lib/organizations/currencies";

type InventoryBoardProps = {
  products: ProductRecord[];
  promotions: PromotionRecord[];
  movements: InventoryMovementRecord[];
  currencies: OrganizationCurrencySettings;
  canManage: boolean;
};

const PAGE_SIZE = 8;

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
  currency: "DOP",
};

const productInitials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

const isLowStock = (product: ProductRecord) =>
  Boolean(
    product.trackStock &&
      product.onHand != null &&
      product.reorderPoint != null &&
      product.onHand <= product.reorderPoint,
  );

export const InventoryBoard = ({ products, promotions, movements, currencies, canManage }: InventoryBoardProps) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyProductForm, currency: currencies.defaultCode });
  const [promoForm, setPromoForm] = useState({ name: "", description: "", discountPercent: "" });
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [isMovementsOpen, setIsMovementsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [isImporting, startImport] = useTransition();

  const categories = useMemo(() => {
    const unique = new Set(
      products.map((product) => product.category?.trim()).filter((value): value is string => Boolean(value)),
    );
    return [...unique].sort((a, b) => a.localeCompare(b, "es"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const haystack = `${product.name} ${product.sku ?? ""} ${product.category ?? ""}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
      if (statusFilter === "active" && !product.active) return false;
      if (statusFilter === "inactive" && product.active) return false;
      if (stockFilter === "low" && !isLowStock(product)) return false;
      return true;
    });
  }, [products, searchTerm, categoryFilter, statusFilter, stockFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredProducts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredProducts.length);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, categoryFilter, statusFilter, stockFilter]);

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
    setForm({ ...emptyProductForm, currency: currencies.defaultCode });
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
      currency: product.currency || currencies.defaultCode,
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
        currency: form.currency,
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

  const handleToggleActive = (product: ProductRecord) => {
    startTransition(async () => {
      const result = await updateProductAction({
        id: product.id,
        name: product.name,
        sku: product.sku || undefined,
        category: product.category || undefined,
        kind: product.kind,
        price: product.price,
        trackStock: product.trackStock,
        description: product.description || undefined,
        reorderPoint: product.reorderPoint ?? undefined,
        currency: product.currency,
        active: !product.active,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
    });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleToggleFilters = () => {
    setShowFilters((current) => !current);
  };

  const handleOpenMovements = () => {
    setIsMovementsOpen(true);
  };

  const handleExport = () => {
    const csv = catalogToCsv(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalogo.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File) => {
    startImport(async () => {
      const text = await file.text();
      const result = await importCatalogCsvAction(text);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
    });
  };

  const handlePreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    setPage((current) => Math.min(pageCount, current + 1));
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Catálogo e inventario</CardTitle>
            <CardDescription>La IA vende solo lo que está aquí, al precio y stock reales.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download />
              Exportar
            </Button>
            {canManage ? (
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  aria-label="Importar CSV"
                  disabled={isImporting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleImport(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  title="CSV con columnas name, sku, category, kind, price, stock."
                >
                  <span>
                    {isImporting ? <Loader2 className="animate-spin" /> : <Upload />}
                    Importar CSV
                  </span>
                </Button>
              </label>
            ) : null}
            {canManage ? (
              <Button type="button" onClick={handleOpenCreate}>
                <Plus />
                Agregar producto
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar producto"
                className="h-9 pl-9"
                placeholder="Buscar por nombre, SKU o categoría"
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={showFilters ? "default" : "outline"}
                aria-pressed={showFilters}
                onClick={handleToggleFilters}
              >
                <Filter />
                Filtrar
              </Button>
              <InventoryMovementsButton onClick={handleOpenMovements} />
            </div>
          </div>

          {showFilters ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <AppSelect
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                options={[
                  { value: "all", label: "Todas las categorías" },
                  ...categories.map((category) => ({ value: category, label: category })),
                ]}
              />
              <AppSelect
                aria-label="Filtrar por estado"
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as "all" | "active" | "inactive")}
                options={[
                  { value: "all", label: "Todos los estados" },
                  { value: "active", label: "Activos" },
                  { value: "inactive", label: "Inactivos" },
                ]}
              />
              <AppSelect
                aria-label="Filtrar por stock"
                value={stockFilter}
                onValueChange={(value) => setStockFilter(value as "all" | "low")}
                options={[
                  { value: "all", label: "Todo el stock" },
                  { value: "low", label: "Stock bajo" },
                ]}
              />
            </div>
          ) : null}

          {filteredProducts.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-primary/10 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">ID</th>
                      <th className="px-3 py-3 font-medium">Nombre</th>
                      <th className="px-3 py-3 font-medium">SKU</th>
                      <th className="px-3 py-3 font-medium">Categoría</th>
                      <th className="px-3 py-3 font-medium">Precio</th>
                      <th className="px-3 py-3 font-medium">Stock</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      {canManage ? <th className="px-3 py-3 font-medium">Acciones</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedProducts.map((product) => {
                      const low = isLowStock(product);
                      return (
                        <tr key={product.id} className="border-b border-primary/8 last:border-0">
                          <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{product.id}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                                {productInitials(product.name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{product.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {PRODUCT_KIND_LABELS[product.kind]}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{product.sku || "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{product.category || "—"}</td>
                          <td className="px-3 py-3 font-medium">{formatMoney(product.price, product.currency)}</td>
                          <td className="px-3 py-3">
                            {product.kind === "service" || !product.trackStock ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className={cn("font-medium", low && "text-destructive")}>
                                {product.onHand ?? 0}
                                {low ? <span className="ml-1 text-xs font-normal">bajo</span> : null}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              disabled={!canManage || isPending}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                                product.active
                                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                              )}
                              onClick={() => handleToggleActive(product)}
                              aria-label={product.active ? "Desactivar producto" : "Activar producto"}
                            >
                              <span className="size-1.5 rounded-full bg-current" />
                              {product.active ? "Activo" : "Inactivo"}
                            </button>
                          </td>
                          {canManage ? (
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {product.inventoryItemId && product.trackStock ? (
                                  <>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="1"
                                      className="h-8 w-20"
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
                                      size="icon-sm"
                                      variant="outline"
                                      disabled={isPending}
                                      aria-label={`Guardar reposición de ${product.name}`}
                                      onClick={() => handleReceive(product.inventoryItemId as number)}
                                    >
                                      <PackagePlus />
                                    </Button>
                                  </>
                                ) : null}
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`Editar ${product.name}`}
                                  onClick={() => handleOpenEdit(product)}
                                >
                                  <Pencil />
                                </Button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2 md:hidden">
                {pagedProducts.map((product) => {
                  const low = isLowStock(product);
                  return (
                    <div key={product.id} className="rounded-xl border border-primary/10 bg-background/70 p-3">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {productInitials(product.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium">{product.name}</p>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                product.active
                                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                              )}
                            >
                              <span className="size-1.5 rounded-full bg-current" />
                              {product.active ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatMoney(product.price, product.currency)}
                            {product.sku ? ` · ${product.sku}` : ""}
                            {product.category ? ` · ${product.category}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{PRODUCT_KIND_LABELS[product.kind]}</Badge>
                            {product.kind === "service" || !product.trackStock ? (
                              <Badge variant="outline">Sin stock</Badge>
                            ) : (
                              <Badge variant={low ? "destructive" : "secondary"}>{product.onHand ?? 0} en mano</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {canManage ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
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
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleReceive(product.inventoryItemId as number)}
                              >
                                <PackagePlus />
                                Reponer
                              </Button>
                            </>
                          ) : null}
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenEdit(product)}>
                            <Pencil />
                            Editar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t border-primary/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Mostrando {rangeStart} a {rangeEnd} de {filteredProducts.length} productos
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage <= 1}
                    onClick={handlePreviousPage}
                  >
                    <ChevronLeft />
                    Anterior
                  </Button>
                  <span className="flex size-8 items-center justify-center rounded-full border border-primary text-xs font-medium">
                    {currentPage}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= pageCount}
                    onClick={handleNextPage}
                  >
                    Siguiente
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {products.length
                ? "Ningún producto coincide con la búsqueda o los filtros."
                : "Aún no hay productos. Agrega el stock que la IA podrá vender por chat."}
            </p>
          )}
        </CardContent>
      </Card>

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

      <InventoryMovementsSheet
        open={isMovementsOpen}
        movements={movements}
        onOpenChange={setIsMovementsOpen}
      />

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
              <div className={currencies.codes.length > 1 ? "col-span-2" : undefined}>
                <PriceCurrencyField
                  id="product-price"
                  label="Precio"
                  amount={form.price}
                  currency={form.currency}
                  currencies={currencies}
                  onAmountChange={(value) => setForm((current) => ({ ...current, price: value }))}
                  onCurrencyChange={(value) => setForm((current) => ({ ...current, currency: value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-kind">Tipo</Label>
                <AppSelect
                  id="product-kind"
                  value={form.kind}
                  onValueChange={(value) => setForm((current) => ({ ...current, kind: value as ProductKind }))}
                  options={(Object.entries(PRODUCT_KIND_LABELS) as Array<[ProductKind, string]>).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
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
