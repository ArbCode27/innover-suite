import { z } from "zod";
import { APPOINTMENT_PURPOSES } from "@/lib/calendar/constants";
import type { AgentSettings } from "@/lib/agent/types";

export const createAppointmentArgsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  purpose: z.enum(APPOINTMENT_PURPOSES),
  notes: z.string().trim().max(500).optional(),
  createMeet: z.boolean().optional(),
  confirmedByCustomer: z.boolean(),
});

export const moveContactToStageArgsSchema = z.object({
  stageId: z.number().int().positive(),
  reason: z.string().trim().min(8).max(240),
  valueAmount: z.number().nonnegative().max(1_000_000_000).optional(),
});

export const handoffToHumanArgsSchema = z.object({
  reason: z.string().trim().min(4).max(240),
});

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const buildAgentToolDeclarations = (settings: AgentSettings): GeminiFunctionDeclaration[] => {
  const tools: GeminiFunctionDeclaration[] = [];

  if (settings.toolsCalendar) {
    tools.push({
      name: "create_appointment",
      description:
        "Crea una cita en Google Calendar y en el CRM para este contacto. Solo úsala cuando tengas fecha, hora y, si aplica, confirmación explícita del cliente.",
      parameters: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "Fecha local YYYY-MM-DD en America/Santo_Domingo." },
          startTime: { type: "STRING", description: "Hora de inicio HH:mm (24h)." },
          endTime: { type: "STRING", description: "Hora de fin HH:mm. Si omites, se usa +30 minutos." },
          purpose: {
            type: "STRING",
            format: "enum",
            enum: [...APPOINTMENT_PURPOSES],
            description: "Motivo de la cita.",
          },
          notes: { type: "STRING", description: "Notas internas opcionales." },
          createMeet: { type: "BOOLEAN", description: "Si true, crea enlace de Google Meet. Default true." },
          confirmedByCustomer: {
            type: "BOOLEAN",
            description: "true solo si el cliente confirmó explícitamente ese horario.",
          },
        },
        required: ["date", "startTime", "purpose", "confirmedByCustomer"],
      },
    });
  }

  if (settings.toolsFunnel) {
    tools.push({
      name: "move_contact_to_stage",
      description:
        "Crea o mueve la oportunidad del contacto a una etapa del embudo. stageId debe ser uno de los IDs del contexto. No lo uses por un saludo o un ok vacío.",
      parameters: {
        type: "OBJECT",
        properties: {
          stageId: { type: "INTEGER", description: "ID de la etapa destino." },
          reason: { type: "STRING", description: "Evidencia breve tomada de la conversación." },
          valueAmount: { type: "NUMBER", description: "Valor estimado opcional." },
        },
        required: ["stageId", "reason"],
      },
    });
  }

  if (settings.toolsHandoff) {
    tools.push({
      name: "handoff_to_human",
      description:
        "Cede la conversación a un asesor humano y detiene al agente. Úsala si el cliente lo pide, hay enojo, o no puedes resolver.",
      parameters: {
        type: "OBJECT",
        properties: {
          reason: { type: "STRING", description: "Por qué escalas." },
        },
        required: ["reason"],
      },
    });
  }

  return tools;
};
