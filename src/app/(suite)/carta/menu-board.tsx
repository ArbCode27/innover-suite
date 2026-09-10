"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import {
  deleteMenuItemAction,
  saveMenuItemAction,
  updateMenuItemAction,
} from "@/lib/menu/crm-actions";
import {
  MENU_TYPE_LABELS,
  MENU_TYPES,
  formatMoney,
  type MenuItemRecord,
  type MenuType,
  type StoredMenuIngredient,
} from "@/lib/menu/crm-types";
import { DEFAULT_CURRENCY, type OrganizationCurrencySettings } from "@/lib/organizations/currencies";
import { cn } from "@/lib/utils";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceCurrencyField } from "@/components/ui/price-currency-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

type MenuBoardProps = {
  dishes: MenuItemRecord[];
  currencies: OrganizationCurrencySettings;
  canManage: boolean;
};

type IngredientFormRow = {
  key: string;
  name: string;
  imageUrl: string | null;
  imageFile: File | null;
  imagePreview: string | null;
  removeImage: boolean;
};

const emptyForm = {
  name: "",
  category: "",
  itemType: "dish" as MenuType,
  price: "",
  description: "",
  isFeatured: false,
  active: true,
  currency: DEFAULT_CURRENCY,
  comboItemIds: [] as number[],
};

const toIngredientRows = (ingredients: StoredMenuIngredient[]): IngredientFormRow[] =>
  ingredients.map((ingredient, index) => ({
    key: `ing-${index}-${ingredient.name}`,
    name: ingredient.name,
    imageUrl: ingredient.imageUrl,
    imageFile: null,
    imagePreview: null,
    removeImage: false,
  }));

export const MenuBoard = ({ dishes, currencies, canManage }: MenuBoardProps) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm, currency: currencies.defaultCode });
  const [ingredientRows, setIngredientRows] = useState<IngredientFormRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MenuType>("all");
  const [isPending, startTransition] = useTransition();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const comboCandidates = useMemo(
    () =>
      dishes.filter(
        (dish) => dish.itemType !== "combo" && dish.itemType !== "promo" && dish.id !== editingId,
      ),
    [dishes, editingId],
  );

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (typeFilter !== "all" && dish.itemType !== typeFilter) return false;
      const haystack = `${dish.name} ${dish.category ?? ""} ${dish.itemType}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [dishes, searchTerm, typeFilter]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, currency: currencies.defaultCode });
    setIngredientRows([]);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setRemoveExistingImage(false);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (dish: MenuItemRecord) => {
    setEditingId(dish.id);
    setForm({
      name: dish.name,
      category: dish.category ?? "",
      itemType: dish.itemType,
      price: String(dish.price),
      description: dish.description ?? "",
      isFeatured: dish.isFeatured,
      active: dish.active,
      currency: dish.currency || currencies.defaultCode,
      comboItemIds: dish.comboItemIds,
    });
    setIngredientRows(toIngredientRows(dish.ingredients));
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(dish.imageUrl);
    setRemoveExistingImage(false);
    setIsSheetOpen(true);
  };

  const handleSave = () => {
    if (!canManage) return;
    const payload = new FormData();
    if (editingId) payload.set("id", String(editingId));
    payload.set("name", form.name);
    payload.set("description", form.description);
    payload.set("category", form.category);
    payload.set("itemType", form.itemType);
    payload.set("isFeatured", form.isFeatured ? "true" : "false");
    payload.set("sortOrder", "0");
    payload.set("comboItemIds", form.comboItemIds.join(","));
    payload.set("price", form.price);
    payload.set("currency", form.currency);
    payload.set(
      "ingredientsJson",
      JSON.stringify(
        ingredientRows
          .map((row) => ({
            name: row.name.trim(),
            imageUrl: row.removeImage ? null : row.imageUrl,
          }))
          .filter((row) => row.name),
      ),
    );
    ingredientRows.forEach((row, index) => {
      if (row.imageFile) payload.set(`ingredientImage_${index}`, row.imageFile);
      if (row.removeImage) payload.set(`removeIngredientImage_${index}`, "true");
    });
    if (imageFile) payload.set("image", imageFile);
    if (removeExistingImage) payload.set("removeImage", "true");

    startTransition(async () => {
      const result = await saveMenuItemAction(payload);
      if (toastActionError(result)) return;
      toast.success(result.success || "Plato guardado.");
      setIsSheetOpen(false);
    });
  };

  const handleDelete = (dish: MenuItemRecord) => {
    if (!canManage) return;
    startTransition(async () => {
      if (dish.active) {
        const deactivated = await updateMenuItemAction({
          id: dish.id,
          name: dish.name,
          description: dish.description ?? undefined,
          category: dish.category ?? undefined,
          itemType: dish.itemType,
          isFeatured: dish.isFeatured,
          comboItemIds: dish.comboItemIds,
          price: dish.price,
          currency: dish.currency,
          ingredients: dish.ingredients,
          active: false,
        });
        if (toastActionError(deactivated)) return;
      }
      const result = await deleteMenuItemAction(dish.id);
      if (toastActionError(result)) return;
      toast.success(result.success || "Plato eliminado.");
    });
  };

  const handleToggleComboItem = (itemId: number, checked: boolean) => {
    setForm((current) => ({
      ...current,
      comboItemIds: checked
        ? [...new Set([...current.comboItemIds, itemId])]
        : current.comboItemIds.filter((id) => id !== itemId),
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-card/80">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Carta del menú</CardTitle>
            <CardDescription>
              Los ítems viven en menu_items · Se publican en /menu/… · Inventario es aparte.
            </CardDescription>
          </div>
          {canManage ? (
            <Button type="button" onClick={handleOpenCreate}>
              <Plus />
              Agregar plato
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar en el menú"
                className="h-9 pl-9"
                placeholder="Buscar plato, bebida o categoría"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <FilterChip
                label="Todos"
                active={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
              />
              {MENU_TYPES.map((type) => (
                <FilterChip
                  key={type}
                  label={MENU_TYPE_LABELS[type]}
                  active={typeFilter === type}
                  onClick={() => setTypeFilter(type)}
                />
              ))}
            </div>
          </div>

          {filtered.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((dish) => (
                <article
                  key={dish.id}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-2xl border border-primary/10 bg-background/70",
                    !dish.active && "opacity-60",
                  )}
                >
                  <div className="relative h-36 bg-muted">
                    {dish.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={dish.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <UtensilsCrossed className="size-8" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      <Badge variant="secondary">{MENU_TYPE_LABELS[dish.itemType]}</Badge>
                      {dish.isFeatured ? <Badge>Destacado</Badge> : null}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div>
                      <h3 className="font-semibold tracking-tight">{dish.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {dish.description || dish.category || "Sin descripción"}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">{formatMoney(dish.price, dish.currency)}</p>
                      {canManage ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`Editar ${dish.name}`}
                            onClick={() => handleOpenEdit(dish)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Eliminar ${dish.name}`}
                            disabled={isPending}
                            onClick={() => handleDelete(dish)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">
              No hay platos en este filtro. Agrega el primero a la carta.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingId ? "Editar plato" : "Nuevo plato"}</SheetTitle>
            <SheetDescription>
              Define tipo, precio e ingredientes removibles para el menú público.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-name">Nombre</Label>
              <Input
                id="menu-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <AppSelect
                  value={form.itemType}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, itemType: value as MenuType }))
                  }
                  options={MENU_TYPES.map((type) => ({
                    value: type,
                    label: MENU_TYPE_LABELS[type],
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="menu-category">Sección / categoría</Label>
                <Input
                  id="menu-category"
                  placeholder="Ej. Entradas, Pizzas"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </div>
            </div>
            <PriceCurrencyField
              id="menu-price"
              label="Precio"
              amount={form.price}
              currency={form.currency}
              currencies={currencies}
              onAmountChange={(value) => setForm((current) => ({ ...current, price: value }))}
              onCurrencyChange={(value) => setForm((current) => ({ ...current, currency: value }))}
            />
            <div className="space-y-1.5">
              <Label htmlFor="menu-description">Descripción</Label>
              <Input
                id="menu-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Ingredientes removibles</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setIngredientRows((current) => [
                      ...current,
                      {
                        key: `ing-new-${Date.now()}`,
                        name: "",
                        imageUrl: null,
                        imageFile: null,
                        imagePreview: null,
                        removeImage: false,
                      },
                    ])
                  }
                >
                  <Plus />
                  Agregar
                </Button>
              </div>
              {ingredientRows.length ? (
                <div className="space-y-2">
                  {ingredientRows.map((row, index) => {
                    const preview =
                      row.imagePreview || (!row.removeImage && row.imageUrl ? row.imageUrl : null);
                    return (
                      <div
                        key={row.key}
                        className="flex items-start gap-2 rounded-xl border border-border/70 p-2.5"
                      >
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="size-full object-cover" />
                          ) : (
                            <ImagePlus className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input
                            value={row.name}
                            placeholder="Ej. Cebolla"
                            onChange={(event) =>
                              setIngredientRows((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, name: event.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <div className="flex flex-wrap gap-1.5">
                            <label className="inline-flex">
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  setIngredientRows((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            imageFile: file,
                                            imagePreview: file
                                              ? URL.createObjectURL(file)
                                              : null,
                                            removeImage: false,
                                          }
                                        : item,
                                    ),
                                  );
                                  event.target.value = "";
                                }}
                              />
                              <Button type="button" size="sm" variant="outline" asChild>
                                <span>
                                  <ImagePlus />
                                  Foto
                                </span>
                              </Button>
                            </label>
                            {preview ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setIngredientRows((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            imageFile: null,
                                            imagePreview: null,
                                            removeImage: true,
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                <X />
                                Quitar foto
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                setIngredientRows((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index),
                                )
                              }
                            >
                              <Trash2 />
                              Quitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                  Agrega ingredientes que el cliente pueda quitar al pedir. La foto es opcional.
                </p>
              )}
            </div>

            {form.itemType === "combo" || form.itemType === "promo" ? (
              <div className="space-y-2 rounded-xl border border-border p-3">
                <p className="text-sm font-medium">Ítems del combo</p>
                {comboCandidates.length ? (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {comboCandidates.map((item) => {
                      const checked = form.comboItemIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => handleToggleComboItem(item.id, value === true)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {MENU_TYPE_LABELS[item.itemType]}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Primero crea platos o bebidas para armar el combo.
                  </p>
                )}
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <Label htmlFor="menu-featured">Destacado en carta</Label>
              <Switch
                id="menu-featured"
                checked={form.isFeatured}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isFeatured: checked }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Foto</Label>
              <div className="flex items-center gap-3">
                <div className="flex size-16 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {imagePreview || (existingImageUrl && !removeExistingImage) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview || existingImageUrl || ""}
                      alt=""
                      className="size-16 object-cover"
                    />
                  ) : (
                    <ImagePlus className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setImageFile(file);
                        setImagePreview(file ? URL.createObjectURL(file) : null);
                        setRemoveExistingImage(false);
                        event.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" asChild>
                      <span>
                        <ImagePlus />
                        Subir
                      </span>
                    </Button>
                  </label>
                  {(imagePreview || existingImageUrl) && !removeExistingImage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setRemoveExistingImage(true);
                      }}
                    >
                      <X />
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isPending || !canManage} onClick={handleSave}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

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
      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-muted",
    )}
  >
    {label}
  </button>
);
