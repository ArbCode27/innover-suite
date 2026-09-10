import type { CatalogItem, MenuIngredient } from "@/lib/menu/types";

export type SelfOrderModifierOption = {
  id: string;
  name: string;
  /** Precio de carta por unidad (siempre el precio real de la bebida). */
  unitListPrice: number;
  menuItemId?: number;
  imageUrl?: string | null;
};

export type SelfOrderModifierGroup = {
  id: string;
  title: string;
  required: boolean;
  minSelect: number;
  /** Unidades totales máximas del grupo. */
  maxSelect: number;
  /** Cuántas unidades van incluidas (gratis) en el precio del plato/combo. */
  includedFreeCount: number;
  options: SelfOrderModifierOption[];
};

export type SelfOrderModifierSelection = {
  groupId: string;
  groupTitle: string;
  optionId: string;
  optionName: string;
  quantity: number;
  unitListPrice: number;
  /** Unidades de esta línea cubiertas por el cupo gratis del combo. */
  includedCount: number;
  /** Cargo total de esta línea tras aplicar unidades gratis. */
  priceDelta: number;
  menuItemId?: number;
  imageUrl?: string | null;
};

export type SelfOrderCartLine = {
  key: string;
  menuItemId: number;
  name: string;
  basePrice: number;
  unitPrice: number;
  currency: string;
  quantity: number;
  imageUrl: string | null;
  removedIngredientIds: string[];
  removedIngredientNames: string[];
  modifiers: SelfOrderModifierSelection[];
  note: string;
};

export type SelfOrderSection = {
  id: string;
  title: string;
  items: CatalogItem[];
};

export const displayPrice = (item: CatalogItem) => item.promoPrice ?? item.price ?? 0;

export const buildCatalogSections = (items: CatalogItem[]): SelfOrderSection[] => {
  const featured = items.filter(
    (item) => item.isFeatured || item.menuType === "combo" || item.menuType === "promo",
  );
  const featuredIds = new Set(featured.map((item) => item.id));
  const rest = items.filter((item) => !featuredIds.has(item.id));

  const byCategory = new Map<string, CatalogItem[]>();
  for (const item of rest) {
    const key = item.category?.trim() || sectionFallback(item.menuType);
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }

  const sections: SelfOrderSection[] = [];
  if (featured.length) {
    sections.push({ id: "promociones", title: "Promociones destacadas", items: featured });
  }

  const preferredOrder = [
    "Platos principales",
    "Entradas",
    "Acompañantes",
    "Postres",
    "Bebidas",
  ];

  const categoryKeys = [...byCategory.keys()].sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, "es");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  for (const key of categoryKeys) {
    sections.push({ id: key, title: key, items: byCategory.get(key) ?? [] });
  }

  return sections;
};

const sectionFallback = (menuType: string | null | undefined) => {
  switch (menuType) {
    case "drink":
      return "Bebidas";
    case "dessert":
      return "Postres";
    case "side":
      return "Acompañantes";
    default:
      return "Platos principales";
  }
};

export const resolveDrinkFallbackImage = (name: string): string => {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("limonada") || normalized.includes("lemonade")) {
    return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80";
  }
  if (normalized.includes("coca") || normalized.includes("cola") || normalized.includes("pepsi")) {
    return "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80";
  }
  if (normalized.includes("agua") || normalized.includes("water") || normalized.includes("mineral")) {
    return "https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=400&q=80";
  }
  if (normalized.includes("cerveza") || normalized.includes("beer")) {
    return "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=400&q=80";
  }
  if (
    normalized.includes("jugo") ||
    normalized.includes("zumo") ||
    normalized.includes("naranja") ||
    normalized.includes("juice")
  ) {
    return "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=400&q=80";
  }
  if (
    normalized.includes("cafe") ||
    normalized.includes("coffee") ||
    normalized.includes("capuchino") ||
    normalized.includes("latte")
  ) {
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80";
  }
  if (normalized.includes("soda") || normalized.includes("gaseosa") || normalized.includes("refresco")) {
    return "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80";
  }
  return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80";
};

/** Bebidas, acompañantes y postres como grupos de cantidad. */
export const buildModifierGroupsForItem = (
  item: CatalogItem,
  drinkItems: CatalogItem[],
  sideItems: CatalogItem[] = [],
  dessertItems: CatalogItem[] = [],
): SelfOrderModifierGroup[] => {
  const groups: SelfOrderModifierGroup[] = [];
  const standalone =
    item.menuType === "drink" || item.menuType === "side" || item.menuType === "dessert";
  if (standalone) return groups;

  const drinks = drinkItems.filter(
    (drink) => drink.available && drink.sourceId !== item.sourceId && drink.price != null,
  );
  if (drinks.length) {
    const isComboLike = item.menuType === "combo" || item.menuType === "promo";
    groups.push({
      id: "addon-bebida",
      title: isComboLike ? "Elige tu bebida" : "Agregar bebida (opcional)",
      required: isComboLike,
      minSelect: isComboLike ? 1 : 0,
      maxSelect: 12,
      includedFreeCount: isComboLike ? 1 : 0,
      options: drinks.map((drink) => ({
        id: `drink-${drink.sourceId}`,
        name: drink.title,
        unitListPrice: displayPrice(drink),
        menuItemId: drink.sourceId,
        imageUrl: drink.imageUrl?.trim() || resolveDrinkFallbackImage(drink.title),
      })),
    });
  }

  const sides = sideItems.filter(
    (side) => side.available && side.sourceId !== item.sourceId && side.price != null,
  );
  if (sides.length) {
    groups.push({
      id: "addon-extra",
      title: "Adicionales y acompañantes",
      required: false,
      minSelect: 0,
      maxSelect: 20,
      includedFreeCount: 0,
      options: sides.map((side) => ({
        id: `side-${side.sourceId}`,
        name: side.title,
        unitListPrice: displayPrice(side),
        menuItemId: side.sourceId,
        imageUrl: side.imageUrl,
      })),
    });
  }

  const desserts = dessertItems.filter(
    (dessert) =>
      dessert.available && dessert.sourceId !== item.sourceId && dessert.price != null,
  );
  if (desserts.length) {
    groups.push({
      id: "addon-postre",
      title: "Postres",
      required: false,
      minSelect: 0,
      maxSelect: 12,
      includedFreeCount: 0,
      options: desserts.map((dessert) => ({
        id: `dessert-${dessert.sourceId}`,
        name: dessert.title,
        unitListPrice: displayPrice(dessert),
        menuItemId: dessert.sourceId,
        imageUrl: dessert.imageUrl,
      })),
    });
  }

  return groups;
};

type OptionQtyMap = Record<string, number>;

export const sumOptionQuantities = (qtyByOption: OptionQtyMap) =>
  Object.values(qtyByOption).reduce((sum, qty) => sum + Math.max(0, qty), 0);

/** @deprecated Prefer sumOptionQuantities */
export const sumDrinkQuantities = sumOptionQuantities;

/**
 * Aplica unidades gratis a las opciones más caras primero.
 * Devuelve selecciones con quantity y priceDelta (cargo neto de esa línea).
 */
export const resolveQtySelections = (
  group: SelfOrderModifierGroup,
  qtyByOption: OptionQtyMap,
): SelfOrderModifierSelection[] => {
  const rows = group.options
    .map((option) => ({
      option,
      quantity: Math.max(0, Math.floor(qtyByOption[option.id] ?? 0)),
    }))
    .filter((row) => row.quantity > 0);

  if (!rows.length) return [];

  type Unit = { optionId: string; unitListPrice: number };
  const units: Unit[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.quantity; i += 1) {
      units.push({
        optionId: row.option.id,
        unitListPrice: row.option.unitListPrice,
      });
    }
  }
  units.sort((a, b) => b.unitListPrice - a.unitListPrice);

  let freeLeft = Math.max(0, group.includedFreeCount);
  const chargedByOption = new Map<string, { free: number; paid: number; paidTotal: number }>();

  for (const unit of units) {
    const current = chargedByOption.get(unit.optionId) ?? { free: 0, paid: 0, paidTotal: 0 };
    if (freeLeft > 0) {
      current.free += 1;
      freeLeft -= 1;
    } else {
      current.paid += 1;
      current.paidTotal += unit.unitListPrice;
    }
    chargedByOption.set(unit.optionId, current);
  }

  return rows.map(({ option, quantity }) => {
    const charge = chargedByOption.get(option.id) ?? { free: 0, paid: 0, paidTotal: 0 };
    return {
      groupId: group.id,
      groupTitle: group.title,
      optionId: option.id,
      optionName: option.name,
      quantity,
      unitListPrice: option.unitListPrice,
      includedCount: charge.free,
      priceDelta: Math.round(charge.paidTotal * 100) / 100,
      menuItemId: option.menuItemId,
      imageUrl: option.imageUrl,
    };
  });
};

/** @deprecated Prefer resolveQtySelections */
export const resolveDrinkSelections = resolveQtySelections;

export const calcUnitPrice = (
  basePrice: number,
  modifiers: SelfOrderModifierSelection[],
) => {
  const extras = modifiers.reduce((sum, entry) => sum + entry.priceDelta, 0);
  return Math.round((basePrice + extras) * 100) / 100;
};

export const validateModifierGroups = (
  groups: SelfOrderModifierGroup[],
  selected: SelfOrderModifierSelection[],
) => {
  for (const group of groups) {
    const count = selected
      .filter((entry) => entry.groupId === group.id)
      .reduce((sum, entry) => sum + entry.quantity, 0);
    if (group.required && count < group.minSelect) {
      const unit = group.id === "addon-bebida" ? "bebida" : "opción";
      const plural = group.minSelect > 1 ? (unit === "bebida" ? "s" : "es") : "";
      return `Selecciona al menos ${group.minSelect} ${unit}${plural} en “${group.title}”`;
    }
    if (count > group.maxSelect) {
      return `Máximo ${group.maxSelect} en “${group.title}”`;
    }
  }
  return null;
};

export const validateGroupsSubset = (
  groups: SelfOrderModifierGroup[],
  selected: SelfOrderModifierSelection[],
) => validateModifierGroups(groups, selected);

export const buildLineNote = (params: {
  removedNames: string[];
  modifiers: SelfOrderModifierSelection[];
}) => {
  const parts: string[] = [];
  if (params.removedNames.length) {
    parts.push(`Sin: ${params.removedNames.join(", ")}`);
  }
  for (const modifier of params.modifiers) {
    if (modifier.quantity <= 0) continue;
    const qtyLabel = modifier.quantity > 1 ? `${modifier.quantity}× ` : "";
    const extra =
      modifier.priceDelta > 0
        ? ` (+${modifier.priceDelta.toFixed(2)})`
        : " (incluida)";
    parts.push(`${modifier.groupTitle}: ${qtyLabel}${modifier.optionName}${extra}`);
  }
  return parts.join(" · ");
};

export const describeCustomization = (line: SelfOrderCartLine) => {
  return buildLineNote({
    removedNames: line.removedIngredientNames,
    modifiers: line.modifiers,
  });
};

export const buildLineKey = (
  menuItemId: number,
  removedIds: string[],
  modifiers: SelfOrderModifierSelection[],
) => {
  const removed = [...removedIds].sort().join(",");
  const mods = modifiers
    .map((entry) => `${entry.groupId}:${entry.optionId}x${entry.quantity}`)
    .sort()
    .join(",");
  return `${menuItemId}::${removed}::${mods}`;
};

export const ingredientsInitialState = (ingredients: MenuIngredient[]) => {
  const initial: Record<string, boolean> = {};
  for (const ingredient of ingredients) {
    initial[ingredient.id] = true;
  }
  return initial;
};

export const groupQtyHint = (group: SelfOrderModifierGroup) => {
  if (group.includedFreeCount > 0) {
    return `${group.includedFreeCount} incluida${group.includedFreeCount > 1 ? "s" : ""} · adicionales al precio de carta`;
  }
  return "Opcional · cada unidad al precio de carta";
};

/** @deprecated Prefer groupQtyHint */
export const drinkQtyHint = groupQtyHint;

export type SelfOrderFlowStep = "customize" | "drinks" | "extras";

export const buildSelfOrderSteps = (
  item: CatalogItem,
  groups: SelfOrderModifierGroup[],
): SelfOrderFlowStep[] => {
  const standalone =
    item.menuType === "drink" || item.menuType === "side" || item.menuType === "dessert";
  if (standalone) return ["customize"];

  const steps: SelfOrderFlowStep[] = ["customize"];
  if (groups.some((group) => group.id === "addon-bebida")) {
    steps.push("drinks");
  }
  if (groups.some((group) => group.id === "addon-extra" || group.id === "addon-postre")) {
    steps.push("extras");
  }
  return steps;
};

export const stepLabel = (step: SelfOrderFlowStep) => {
  switch (step) {
    case "customize":
      return "Plato";
    case "drinks":
      return "Bebidas";
    case "extras":
      return "Extras";
  }
};
