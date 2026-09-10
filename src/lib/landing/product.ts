import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Columns3,
  Contact,
  Inbox,
  Package,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

export type LandingIndustry = {
  id: string;
  label: string;
  promise: string;
  modules: string[];
  href: string;
  icon: LucideIcon;
};

export type LandingLayer = {
  id: string;
  title: string;
  summary: string;
  items: string[];
};

export type LandingCapability = {
  id: string;
  title: string;
  benefit: string;
  bullets: string[];
  forWhom: string;
  icon: LucideIcon;
};

export type LandingFlowStep = {
  title: string;
  detail: string;
};

export const LANDING_INDUSTRIES: LandingIndustry[] = [
  {
    id: "restaurant",
    label: "Restaurante",
    promise: "Menú público, pedidos y comandas de cocina en un solo flujo.",
    modules: ["Menú / carta", "Pedidos", "Cocina", "Inventario"],
    href: "#flujo",
    icon: UtensilsCrossed,
  },
  {
    id: "retail",
    label: "Tienda",
    promise: "Vende por WhatsApp con stock real y seguimiento en embudo.",
    modules: ["Catálogo", "Pedidos", "Embudos", "Inventario"],
    href: "#capacidades",
    icon: Store,
  },
  {
    id: "services",
    label: "Servicios",
    promise: "Atiende leads, agenda citas y cierra con embudo comercial.",
    modules: ["Inbox + IA", "Calendario", "Embudos", "Contactos"],
    href: "#capacidades",
    icon: Wrench,
  },
  {
    id: "realestate",
    label: "Inmobiliaria",
    promise: "Captación, fichas de inmuebles y visitas coordinadas por IA.",
    modules: ["Inmuebles", "Calendario", "Embudos", "Inbox + IA"],
    href: "#capacidades",
    icon: Building2,
  },
];

export const LANDING_LAYERS: LandingLayer[] = [
  {
    id: "atencion",
    title: "Atención",
    summary: "Conversaciones de Meta en una sola bandeja, con IA y handoff humano.",
    items: ["Inbox omnicanal", "Agente IA 24/7", "Traspaso a asesor", "Contactos"],
  },
  {
    id: "ventas",
    title: "Ventas",
    summary: "De la consulta al cierre con pipeline, citas y seguimiento.",
    items: ["Embudos Kanban", "Google Calendar", "Calificación de leads", "Historial unificado"],
  },
  {
    id: "operacion",
    title: "Operación",
    summary: "Lo que ocurre después del mensaje: catálogo, pedidos, cocina o inmuebles.",
    items: ["Menú / catálogo", "Inventario", "Pedidos y cocina", "Inmuebles", "Dashboard BI"],
  },
];

export const LANDING_CAPABILITIES: LandingCapability[] = [
  {
    id: "inbox",
    title: "Bandeja omnicanal",
    benefit: "WhatsApp, Instagram y Messenger en un solo hilo, sin perder contexto.",
    bullets: [
      "Conversaciones unificadas por contacto",
      "Etiquetas de canal y estado en tiempo real",
      "Historial completo para tu equipo",
    ],
    forWhom: "Todos los rubros",
    icon: Inbox,
  },
  {
    id: "agent",
    title: "Agente IA + handoff",
    benefit: "Atiende 24/7 con las reglas de tu negocio y escala a humano cuando hace falta.",
    bullets: [
      "Respuestas con catálogo, precios y políticas",
      "Confirmación de pedidos o citas",
      "Traspaso al asesor en un clic",
    ],
    forWhom: "Ventas y soporte",
    icon: Bot,
  },
  {
    id: "funnels",
    title: "Embudos de ventas",
    benefit: "Visualiza cada lead desde el primer mensaje hasta el cierre.",
    bullets: [
      "Pipeline Kanban por etapas",
      "Movimiento con evidencia de compra",
      "Métricas de conversión por etapa",
    ],
    forWhom: "Tienda, servicios e inmobiliaria",
    icon: Columns3,
  },
  {
    id: "calendar",
    title: "Calendario y citas",
    benefit: "Agenda visitas o reuniones desde el chat, sincronizado con Google Calendar.",
    bullets: [
      "Agendado asistido por la IA",
      "Sincronización con Google Calendar",
      "Recordatorios y contexto del contacto",
    ],
    forWhom: "Servicios e inmobiliaria",
    icon: CalendarDays,
  },
  {
    id: "menu",
    title: "Menú y autopedido",
    benefit: "Carta pública con personalización, bebidas, extras y ticket claro.",
    bullets: [
      "Flujo guiado de personalización",
      "Combos con bebida incluida",
      "Confirmación con número de comanda",
    ],
    forWhom: "Restaurantes",
    icon: UtensilsCrossed,
  },
  {
    id: "orders",
    title: "Pedidos y cocina",
    benefit: "Del chat o menú a la comanda: nuevos, en cocina y listos.",
    bullets: [
      "Pedidos que descuentan inventario",
      "Tablero de comandas en tiempo real",
      "Filtros por día y estado",
    ],
    forWhom: "Restaurante y retail",
    icon: ClipboardList,
  },
  {
    id: "inventory",
    title: "Catálogo e inventario",
    benefit: "Productos, insumos y stock alineados con lo que vende la IA.",
    bullets: [
      "Catálogo con precios y disponibilidad",
      "Control de stock al confirmar venta",
      "Menú de platos separado del inventario",
    ],
    forWhom: "Restaurante y tienda",
    icon: Package,
  },
  {
    id: "listings",
    title: "Inmuebles",
    benefit: "Fichas con galería, visitas y búsqueda asistida por IA.",
    bullets: [
      "Publicación de propiedades",
      "Coordinación de visitas",
      "Consulta inteligente desde el chat",
    ],
    forWhom: "Inmobiliarias",
    icon: Building2,
  },
  {
    id: "contacts",
    title: "Contactos CRM",
    benefit: "Cada conversación queda vinculada a un contacto con historial útil.",
    bullets: [
      "Ficha unificada por cliente",
      "Contexto para asesores humanos",
      "Seguimiento entre canales",
    ],
    forWhom: "Todos los rubros",
    icon: Contact,
  },
  {
    id: "dashboard",
    title: "Dashboard BI",
    benefit: "Métricas por vertical: comida, productos, servicios, finanzas y clientes.",
    bullets: [
      "KPIs operativos del día",
      "Vistas por módulo activo",
      "Lectura rápida para dueños y gerentes",
    ],
    forWhom: "Dirección y operaciones",
    icon: ChartColumn,
  },
];

export const LANDING_RESTAURANT_FLOW: LandingFlowStep[] = [
  {
    title: "Descubre",
    detail: "El cliente abre el menú o escribe por WhatsApp / Instagram.",
  },
  {
    title: "Personaliza",
    detail: "Elige plato, quita ingredientes, bebida y extras.",
  },
  {
    title: "Confirma",
    detail: "Se genera el pedido con total, impuestos y nombre del cliente.",
  },
  {
    title: "Cocina",
    detail: "La comanda aparece en el tablero: nuevo → en cocina → listo.",
  },
  {
    title: "Mide",
    detail: "El dashboard resume ventas, platos y desempeño del día.",
  },
];

export const LANDING_FAQS = [
  {
    question: "¿Qué es Innover Suite y a quién está dirigido?",
    answer:
      "Es un CRM omnicanal B2B con IA para empresas que atienden por WhatsApp, Instagram y Messenger. Sirve a restaurantes, tiendas, servicios e inmobiliarias: centraliza chats, automatiza atención y opera pedidos, citas, inventario o inmuebles según los módulos que actives.",
  },
  {
    question: "¿Puedo usar solo restaurante sin embudos ni citas?",
    answer:
      "Sí. Al crear la organización eliges una plantilla (por ejemplo Restaurante) que activa menú, pedidos y cocina, y deja desactivados embudos o calendario si no los necesitas. También puedes ajustar módulos después en Ajustes.",
  },
  {
    question: "¿El menú público está incluido?",
    answer:
      "Sí, cuando tienes catálogo/menú activo. Publicas tu carta en un enlace /menu/… para que el cliente personalice el plato, elija bebidas y extras, y envíe el pedido a cocina.",
  },
  {
    question: "¿La IA crea pedidos o citas reales?",
    answer:
      "Sí, dentro de las reglas de tu negocio. La IA usa el catálogo, precios e inventario; resume el total y espera confirmación antes de crear el pedido o agendar. Si el caso es complejo, transfiere a un asesor humano.",
  },
  {
    question: "¿Cómo se conectan los canales de Meta?",
    answer:
      "Mediante las APIs oficiales de Meta (OAuth / Embedded Signup). Autorizas páginas y líneas de WhatsApp Business de la empresa, sin exponer credenciales personales.",
  },
  {
    question: "¿Sirve para inmobiliaria y tienda en la misma plataforma?",
    answer:
      "Sí. Es la misma Suite: cambian los módulos activos. Una inmobiliaria usa inmuebles, calendario y embudos; una tienda, catálogo, pedidos y embudos. Inbox, contactos y dashboard están siempre disponibles.",
  },
  {
    question: "¿Cómo se protegen los datos?",
    answer:
      "Cada organización está aislada (Row-Level Security). Los datos viajan cifrados y no se venden a terceros. Puedes solicitar acceso o eliminación según la Política de Privacidad.",
  },
  {
    question: "¿Cómo solicito la eliminación de mis datos?",
    answer:
      "Organizaciones y usuarios finales pueden pedir la eliminación a través de la Política de Privacidad o escribiendo a privacidad@innover-suite.app.",
  },
];
