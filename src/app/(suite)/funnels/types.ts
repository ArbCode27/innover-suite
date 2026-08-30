import type { MetaChannel } from "@/types/domain";

export const DEFAULT_FUNNEL_NAME = "Embudo principal";

export const DEFAULT_FUNNEL_STAGES = [
  "Lead",
  "Contactado",
  "Calificado",
  "Cotización enviada",
  "Cierre",
] as const;

export type FunnelContactOption = {
  id: number;
  fullName: string;
};

export type FunnelCardView = {
  id: number;
  stageId: number;
  contactId: number;
  conversationId: number | null;
  title: string;
  valueAmount: number | null;
  currency: string | null;
  ownerUserId: string | null;
  position: number;
  updatedAt: string;
  contactName: string;
  contactPhone: string | null;
  channel: MetaChannel | null;
  listingId: number | null;
  listingTitle: string | null;
};

export type FunnelStageView = {
  id: number;
  funnelId: number;
  name: string;
  orderIndex: number;
  cards: FunnelCardView[];
};

export type FunnelBoardView = {
  id: number;
  name: string;
  stages: FunnelStageView[];
};

export type FunnelMetrics = {
  opportunityCount: number;
  estimatedValue: number;
  contactCount: number;
  stageCount: number;
};
