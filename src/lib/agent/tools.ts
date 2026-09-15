import { z } from "zod";
import { APPOINTMENT_PURPOSES, CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import type { AgentSettings } from "@/lib/agent/types";
import { FULFILLMENT_TYPES } from "@/lib/commerce/types";
import { LISTING_OPERATIONS, LISTING_STATUSES } from "@/lib/listings/types";
import type { OrganizationModules } from "@/lib/modules/constants";

export const createAppointmentArgsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  purpose: z.enum(APPOINTMENT_PURPOSES),
  notes: z.string().trim().max(500).optional(),
  createMeet: z.boolean().optional(),
  confirmedByCustomer: z.boolean(),
  listingId: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
});

export const searchListingsArgsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  operation: z.enum(LISTING_OPERATIONS).optional(),
  city: z.string().trim().max(120).optional(),
  bedrooms: z.coerce.number().int().nonnegative().max(20).optional(),
  maxPrice: z.coerce.number().nonnegative().max(1_000_000_000).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
});

export const sendListingArgsSchema = z.object({
  listingId: z.coerce.number().int().positive(),
  caption: z.string().trim().max(400).optional(),
});

export const moveContactToStageArgsSchema = z.object({
  stageId: z.number().int().positive(),
  reason: z.string().trim().min(8).max(240),
  valueAmount: z.number().nonnegative().max(1_000_000_000).optional(),
});

export const handoffToHumanArgsSchema = z.object({
  reason: z.string().trim().min(4).max(240),
});

export const createOrderArgsSchema = z.object({
  items: z
    .array(
      z.preprocess(
        (value) => {
          if (!value || typeof value !== "object") return value;
          const row = value as Record<string, unknown>;
          return {
            productId: row.productId ?? row.product_id,
            quantity: row.quantity,
            notes: row.notes,
          };
        },
        z.object({
          productId: z.coerce.number().int().positive(),
          quantity: z.coerce.number().positive().max(1000),
          notes: z.string().trim().max(240).optional(),
        }),
      ),
    )
    .min(1)
    .max(40),
  fulfillment: z.enum(FULFILLMENT_TYPES).optional(),
  customerNote: z.string().trim().max(400).optional(),
  deliveryAddress: z.string().trim().max(240).optional(),
  deliveryZone: z.string().trim().max(80).optional(),
  confirmedByCustomer: z.boolean(),
});

export const cancelOrderArgsSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(4).max(240),
});

export const sendImageArgsSchema = z
  .object({
    productId: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    assetId: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    caption: z.string().trim().max(400).optional(),
  })
  .superRefine((data, context) => {
    const hasProduct = data.productId != null;
    const hasAsset = data.assetId != null;
    if (hasProduct === hasAsset) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica productId o assetId, no ambos.",
      });
    }
  });

export type AgentToolDeclaration = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const buildAgentToolDeclarations = (
  settings: AgentSettings,
  modules?: OrganizationModules,
): AgentToolDeclaration[] => {
  const tools: AgentToolDeclaration[] = [];

  if (settings.toolsCalendar && modules?.calendar !== false) {
    tools.push({
      type: "function",
      function: {
        name: "create_appointment",
        description:
          "Crea una cita en Google Calendar y en el CRM para este contacto. Solo úsala cuando tengas fecha, hora y, si aplica, confirmación explícita del cliente.",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: `Fecha local YYYY-MM-DD en ${CALENDAR_TIME_ZONE}.` },
            startTime: { type: "string", description: "Hora de inicio HH:mm (24h)." },
            endTime: { type: "string", description: "Hora de fin HH:mm. Si omites, se usa +30 minutos." },
            purpose: {
              type: "string",
              enum: [...APPOINTMENT_PURPOSES],
              description: "Motivo de la cita.",
            },
            notes: { type: "string", description: "Notas internas opcionales." },
            createMeet: { type: "boolean", description: "Si true, crea enlace de Google Meet. Default true." },
            confirmedByCustomer: {
              type: "boolean",
              description: "true solo si el cliente confirmó explícitamente ese horario.",
            },
            listingId: {
              type: "integer",
              description: "ID del inmueble si la cita es una visita, tasación o firma. Sale de search_listings o del contexto.",
            },
          },
          required: ["date", "startTime", "purpose", "confirmedByCustomer"],
        },
      },
    });
  }

  if (settings.toolsFunnel && modules?.funnels !== false) {
    tools.push({
      type: "function",
      function: {
        name: "move_contact_to_stage",
        description:
          "Crea o mueve la oportunidad del contacto a una etapa del embudo. stageId debe ser uno de los IDs del contexto. Si etapa actual es sin etapa, regístralo en la primera etapa en este turno. Cada chat nuevo es un ciclo nuevo. No saltes etapas por un saludo o un ok vacío.",
        parameters: {
          type: "object",
          properties: {
            stageId: { type: "integer", description: "ID de la etapa destino." },
            reason: { type: "string", description: "Evidencia breve tomada de la conversación." },
            valueAmount: { type: "number", description: "Valor estimado opcional." },
          },
          required: ["stageId", "reason"],
        },
      },
    });
  }

  if (settings.toolsHandoff) {
    tools.push({
      type: "function",
      function: {
        name: "handoff_to_human",
        description:
          "Cede la conversación a un asesor humano y detiene al agente. Úsala solo si hay asesores disponibles (horario de oficina). Si la oficina está cerrada, no la uses: sigue tú atendiendo.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Por qué escalas." },
          },
          required: ["reason"],
        },
      },
    });
  }

  if (modules?.orders) {
    tools.push({
      type: "function",
      function: {
        name: "create_order",
        description:
          "Crea un pedido con productos del catálogo y descuenta inventario. Solo úsala cuando el cliente haya seleccionado los productos y confirmado explícitamente la compra. Para entregas a domicilio (delivery), solicita o confirma la dirección de entrega antes de ejecutarla.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description: "Líneas del pedido. productId debe ser un ID válido del catálogo del contexto.",
              items: {
                type: "object",
                properties: {
                  productId: { type: "integer", description: "ID del producto del catálogo." },
                  quantity: { type: "number", description: "Cantidad pedida." },
                  notes: { type: "string", description: "Notas o especificaciones del producto (talla, color, etc.)." },
                },
                required: ["productId", "quantity"],
              },
            },
            fulfillment: {
              type: "string",
              enum: [...FULFILLMENT_TYPES],
              description: "delivery (entrega a domicilio), pickup (retiro en tienda), dine_in o unspecified.",
            },
            customerNote: { type: "string", description: "Nota general o instrucciones de entrega del cliente." },
            deliveryAddress: { type: "string", description: "Dirección completa de entrega si es delivery." },
            deliveryZone: { type: "string", description: "Nombre de zona de delivery del contexto para calcular tarifa de envío." },
            confirmedByCustomer: {
              type: "boolean",
              description: "true si el cliente confirmó explícitamente el pedido (dijo Sí, Confirmo, Lo quiero, etc.).",
            },
          },
          required: ["items", "confirmedByCustomer"],
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "cancel_order",
        description: "Cancela un pedido de este negocio y restaura el inventario descontado.",
        parameters: {
          type: "object",
          properties: {
            orderId: { type: "integer", description: "ID del pedido a cancelar." },
            reason: { type: "string", description: "Por qué se cancela." },
          },
          required: ["orderId", "reason"],
        },
      },
    });
  }

  if (modules?.listings) {
    tools.push({
      type: "function",
      function: {
        name: "search_listings",
        description:
          "Busca inmuebles del inventario interno. Úsala si el cliente pide zona, precio, habitaciones o un código. No inventes fichas que no salgan aquí.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Texto libre: estado, ciudad, zona, código o título." },
            operation: {
              type: "string",
              enum: [...LISTING_OPERATIONS],
              description: "sale, rent o both.",
            },
            city: { type: "string", description: "Ciudad o municipio." },
            bedrooms: { type: "integer", description: "Habitaciones mínimas." },
            maxPrice: { type: "number", description: "Precio máximo en la moneda del inmueble." },
            status: {
              type: "string",
              enum: [...LISTING_STATUSES],
              description: "Si omites, se buscan disponibles y reservados.",
            },
          },
        },
      },
    });
    tools.push({
      type: "function",
      function: {
        name: "send_listing",
        description:
          "Envía la ficha de un inmueble y, si hay foto, una imagen. Máximo un inmueble y una foto por respuesta. Escribe también el mensaje en texto. No digas que está disponible si status no es available.",
        parameters: {
          type: "object",
          properties: {
            listingId: { type: "integer", description: "ID del inmueble." },
            caption: { type: "string", description: "Pie de foto corto opcional." },
          },
          required: ["listingId"],
        },
      },
    });
  }

  tools.push({
    type: "function",
    function: {
      name: "send_image",
      description:
        "Envía una foto al cliente. Escribe también el mensaje completo en texto en el mismo turno; la foto no reemplaza la frase. Para un producto del catálogo usa productId. Para FAQ/menú de la base de conocimiento usa assetId. Máximo una imagen por respuesta. No inventes URLs.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "integer",
            description: "ID del producto con [foto:siempre] o [foto:si_pide] en el catálogo.",
          },
          assetId: {
            type: "integer",
            description: "ID de una imagen de la base de conocimiento (no es un productId).",
          },
          caption: { type: "string", description: "Pie de foto corto opcional." },
        },
      },
    },
  });

  return tools;
};
