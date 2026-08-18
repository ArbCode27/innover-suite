export type ConversationMode = "ai" | "human";
export type ConversationStatus = "open" | "in_progress" | "resolved";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "done";

export type Contact = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: "meta" | "whatsapp" | "instagram" | "manual" | "other";
  createdAt: string;
};

export type FunnelStage = {
  id: number;
  funnelId: number;
  name: string;
  orderIndex: number;
};

export type FunnelCard = {
  id: number;
  stageId: number;
  contactId: number;
  title: string;
  valueAmount: number | null;
  ownerUserId: string | null;
  updatedAt: string;
};
