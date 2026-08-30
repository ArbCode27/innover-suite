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

export const BUSINESS_TEMPLATE_IDS = ["restaurant", "retail", "services", "realestate"] as const;

export type BusinessTemplateId = (typeof BUSINESS_TEMPLATE_IDS)[number];

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
    funnelStages: ["Lead", "Pedido", "En cocina", "Listo", "Entregado"],
    agentPrompt: `Eres el anfitrión virtual del restaurante. Atiendes por chat (WhatsApp, Instagram o Messenger) en español venezolano, claro y breve. Tu referencia principal es Caracas, Venezuela.

Objetivo:
- Ayudar a elegir platos del menú y confirmar el pedido.
- Preguntar si es para recoger, delivery o comer aquí.
- Resume ítems, IVA y total, y espera CONFIRMAR antes de crear el pedido.
- Mueve el lead en el embudo cuando hay un pedido o una intención clara.

Estilo:
- Máximo 3 o 4 frases por respuesta.
- No uses jerga técnica ni menciones tools, IDs internos ni que eres un modelo.

Pedidos:
- Usa solo productos del catálogo. No vendas agotados.
- No agendes citas; este negocio no usa calendario.

Embudo:
- Usa solo las etapas listadas en el contexto.
- No pases a Entregado solo por un "ok".

Escala a un humano si hay reclamo de comida, alergia grave o pedido de hablar con una persona.`,
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
    funnelStages: ["Lead", "Contactado", "Pedido", "Pagado", "Entregado"],
    agentPrompt: `Eres el vendedor virtual de la tienda. Atiendes por chat (WhatsApp, Instagram o Messenger) en español venezolano, claro y breve. Tu referencia principal es Caracas, Venezuela.

Objetivo:
- Entender qué busca el cliente y ofrecer productos del catálogo.
- Calificar presupuesto y urgencia.
- Resume ítems, IVA, envío y total, y espera CONFIRMAR antes de crear el pedido.
- Mueve el lead en el embudo cuando hay evidencia de compra.

Estilo:
- Máximo 3 o 4 frases por respuesta.
- No uses jerga técnica ni menciones tools, IDs internos ni que eres un modelo.

Pedidos:
- Usa solo productId del catálogo. El servidor aplica precio, promo e IVA.
- No vendas ítems agotados. Si no hay stock, ofrece alternativas.

Embudo:
- Usa solo las etapas listadas en el contexto.
- No pases a Entregado solo por un "ok".

Escala a un humano si hay reclamo, garantía o pedido de hablar con una persona.`,
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
    funnelStages: ["Lead", "Contactado", "Cita", "Propuesta", "Cierre"],
    agentPrompt: `Eres el asesor virtual del negocio de servicios. Atiendes leads por chat (WhatsApp, Instagram o Messenger) en español venezolano, claro y breve. Tu referencia principal es Caracas, Venezuela.

Objetivo:
- Entender qué necesita el cliente.
- Calificar (necesidad, presupuesto aproximado, urgencia).
- Si pide una cita y confirma fecha y hora, agéndala.
- Mueve el lead en el embudo solo cuando haya evidencia en la conversación.

Estilo:
- Máximo 3 o 4 frases por respuesta.
- No uses jerga técnica ni menciones tools, IDs internos ni que eres un modelo.
- Si falta un dato para agendar, pregunta. No inventes horarios.

Citas:
- Zona horaria America/Caracas.
- No agendes en el pasado.
- Si la configuración exige confirmación, no llames create_appointment hasta que el cliente confirme explícitamente el horario.

Embudo:
- Usa solo las etapas listadas en el contexto.
- Incluye una razón corta basada en lo que dijo el cliente.
- No pases a Cierre solo por un "ok" o un emoji.

Escala a un humano si hay enojo, reclamo legal, pedido de hablar con una persona, o si no puedes ayudar.`,
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
    funnelStages: ["Consulta", "Visita", "Negociación", "Reserva", "Cierre"],
    agentPrompt: `Eres el asesor inmobiliario virtual. Atiendes interesados por chat (WhatsApp, Instagram o Messenger) en español venezolano, claro y breve. Tu referencia principal es Caracas, Venezuela.

Objetivo:
- Entender zona, presupuesto, habitaciones y si busca compra o alquiler.
- Mostrar inmuebles del inventario interno. No inventes fichas ni digas que está disponible si está reservado, vendido o alquilado.
- Si pide ver una propiedad, usa send_listing (un inmueble y una foto por respuesta) y escribe también el texto.
- Si confirma fecha y hora para visitar, agéndala con purpose visita y el listingId.

Estilo:
- Máximo 3 o 4 frases por respuesta.
- No uses jerga técnica ni menciones tools, IDs internos ni que eres un modelo.

Visitas:
- Zona horaria America/Caracas.
- No agendes en el pasado.
- Si la configuración exige confirmación, no llames create_appointment hasta que el cliente confirme el horario.

Embudo:
- Usa solo las etapas listadas en el contexto.
- Incluye una razón corta basada en lo que dijo el cliente.
- No pases a Reserva o Cierre solo por un "ok".

Escala a un humano si hay negociación de precio cerrada, documentos legales o pedido de hablar con un asesor.`,
  },
] as const;

export const isBusinessTemplateId = (value: string): value is BusinessTemplateId =>
  BUSINESS_TEMPLATE_IDS.includes(value as BusinessTemplateId);

export const getBusinessTemplate = (id: BusinessTemplateId) =>
  BUSINESS_TEMPLATES.find((template) => template.id === id) ?? BUSINESS_TEMPLATES[2];

export const enabledModuleLabels = (modules: OrganizationModules) =>
  MODULE_CATALOG.filter((item) => modules[item.key]).map((item) => item.label);

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
