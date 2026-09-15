import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/billing/payment-methods";
import { BILLING_VERTICALS, PLAN_CATALOG } from "@/lib/billing/plans";

const planIds = PLAN_CATALOG.map((plan) => plan.id) as [string, ...string[]];

export const JOIN_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export type JoinRequestRecord = {
  id: number;
  user_id: string;
  user_email: string;
  organization_name: string;
  business_template: "restaurant" | "ventas" | "realestate";
  plan_id: string;
  payment_method: "pagomovil" | "transferencia" | "binance" | "zelle";
  payment_reference: string;
  receipt_url: string;
  receipt_storage_path: string;
  amount_usd: number;
  customer_notes: string | null;
  status: JoinRequestStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_organization_id: number | null;
  created_at: string;
  updated_at: string;
};

export const submitJoinRequestSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "El nombre de la empresa debe tener al menos 2 caracteres.")
    .max(100, "El nombre no puede exceder 100 caracteres."),
  businessTemplate: z.enum(BILLING_VERTICALS),
  planId: z.enum(planIds),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentReference: z
    .string()
    .trim()
    .min(3, "Indica el número o código de referencia de la transacción.")
    .max(80, "La referencia es demasiado larga."),
  customerNotes: z.string().trim().max(500).optional(),
});

export const resubmitJoinRequestSchema = z.object({
  requestId: z.number().int().positive(),
  paymentReference: z
    .string()
    .trim()
    .min(3, "Indica el número o código de referencia.")
    .max(80),
  customerNotes: z.string().trim().max(500).optional(),
});

export const adminRejectRequestSchema = z.object({
  requestId: z.number().int().positive(),
  reason: z
    .string()
    .trim()
    .min(3, "Escribe el motivo del rechazo para informar al cliente.")
    .max(1000),
});
