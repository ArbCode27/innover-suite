import type { BusinessHours } from "@/lib/agent/hours";

export type AgentSettings = {
  organizationId: number;
  enabled: boolean;
  systemPrompt: string;
  model: string;
  toolsCalendar: boolean;
  toolsFunnel: boolean;
  toolsHandoff: boolean;
  requireBookingConfirmation: boolean;
  language: string;
  businessHours: BusinessHours;
  closedMessage: string;
};

export type AgentJob = {
  organizationId: number;
  conversationId: number;
  inboundMessageId: number;
};

export type AgentFunnelStage = {
  id: number;
  name: string;
  orderIndex: number;
};

export type AgentToolName =
  | "create_appointment"
  | "move_contact_to_stage"
  | "handoff_to_human"
  | "create_order"
  | "cancel_order"
  | "send_image";
