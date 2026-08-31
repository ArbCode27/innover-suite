import { z } from "zod";
import { BUSINESS_TEMPLATE_IDS } from "@/lib/modules/constants";
import { isKnownCurrency } from "@/lib/organizations/currencies";
import "@/lib/validation/zod-es";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(3, "El nombre de la organización debe tener al menos 3 caracteres"),
  templateId: z.enum(BUSINESS_TEMPLATE_IDS, {
    error: "Elige el tipo de negocio para adaptar el CRM.",
  }),
  currency: z
    .string()
    .trim()
    .length(3)
    .refine((value) => isKnownCurrency(value.toUpperCase()), "Elige una moneda válida."),
  taxRate: z
    .number({ error: "El IVA debe ser un número." })
    .min(0, "El IVA no puede ser negativo.")
    .max(1, "El IVA no puede ser mayor a 100% (usa 0.16 para 16%)."),
});

export const createOrganizationWizardSchema = z.object({
  name: z.string().trim().min(3, "El nombre de la organización debe tener al menos 3 caracteres"),
  currency: z
    .string()
    .trim()
    .length(3)
    .refine((value) => isKnownCurrency(value.toUpperCase()), "Elige una moneda válida."),
  taxPercent: z
    .string()
    .trim()
    .refine((value) => {
      const parsed = Number(value.replace(",", "."));
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
    }, "El IVA debe estar entre 0 y 100."),
  templateId: z.enum(BUSINESS_TEMPLATE_IDS, {
    error: "Elige el tipo de negocio para adaptar el CRM.",
  }),
});

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;
export type CreateOrganizationWizardValues = z.infer<typeof createOrganizationWizardSchema>;

export const toCreateOrganizationPayload = (
  values: CreateOrganizationWizardValues,
): CreateOrganizationValues => ({
  name: values.name.trim(),
  templateId: values.templateId,
  currency: values.currency.toUpperCase(),
  taxRate: Number(values.taxPercent.replace(",", ".")) / 100,
});
