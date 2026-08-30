export const MODULE_KEYS = ["funnels", "calendar", "catalog", "orders", "kitchen", "listings"] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type OrganizationModules = Record<ModuleKey, boolean>;

export const DEFAULT_MODULES: OrganizationModules = {
  funnels: true,
  calendar: true,
  catalog: false,
  orders: false,
  kitchen: false,
  listings: false,
};

export const MODULE_CATALOG: Array<{
  key: ModuleKey;
  label: string;
  description: string;
}> = [
  {
    key: "funnels",
    label: "Embudos",
    description: "Pipeline de ventas y movimiento de leads por etapas.",
  },
  {
    key: "calendar",
    label: "Calendario",
    description: "Citas en Google Calendar y agendado por la IA.",
  },
  {
    key: "catalog",
    label: "Catálogo e inventario",
    description: "Productos, precios y stock para cualquier tipo de vendedor.",
  },
  {
    key: "orders",
    label: "Pedidos",
    description: "La IA confirma ventas y genera pedidos que descuentan inventario.",
  },
  {
    key: "kitchen",
    label: "Comandas de cocina",
    description: "Tablero tipo restaurante (nuevos, en cocina, listos).",
  },
  {
    key: "listings",
    label: "Inmuebles",
    description: "Fichas de propiedades, galería, visitas y búsqueda por la IA.",
  },
];

export const BUSINESS_TEMPLATES = [
  {
    id: "restaurant",
    label: "Restaurante",
    description: "Menú, promociones, comandas e inventario. Sin citas.",
    modules: {
      funnels: true,
      calendar: false,
      catalog: true,
      orders: true,
      kitchen: true,
      listings: false,
    } satisfies OrganizationModules,
  },
  {
    id: "retail",
    label: "Tienda / vendedor",
    description: "Catálogo, stock y pedidos por chat.",
    modules: {
      funnels: true,
      calendar: false,
      catalog: true,
      orders: true,
      kitchen: false,
      listings: false,
    } satisfies OrganizationModules,
  },
  {
    id: "services",
    label: "Servicios",
    description: "Citas y embudo. Sin inventario ni pedidos.",
    modules: {
      funnels: true,
      calendar: true,
      catalog: false,
      orders: false,
      kitchen: false,
      listings: false,
    } satisfies OrganizationModules,
  },
  {
    id: "realestate",
    label: "Inmobiliaria",
    description: "Inmuebles, visitas y embudo. Sin catálogo ni pedidos.",
    modules: {
      funnels: true,
      calendar: true,
      catalog: false,
      orders: false,
      kitchen: false,
      listings: true,
    } satisfies OrganizationModules,
  },
] as const;

export const isModuleKey = (value: string): value is ModuleKey =>
  MODULE_KEYS.includes(value as ModuleKey);

export const normalizeModules = (partial?: Partial<OrganizationModules> | null): OrganizationModules => {
  const next: OrganizationModules = { ...DEFAULT_MODULES, ...partial };
  if (next.kitchen) {
    next.orders = true;
    next.catalog = true;
  }
  if (next.orders) {
    next.catalog = true;
  }
  if (!next.catalog) {
    next.orders = false;
    next.kitchen = false;
  }
  if (!next.orders) {
    next.kitchen = false;
  }
  return next;
};
