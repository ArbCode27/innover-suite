import { z } from "zod";

const graphNumericId = (emptyMessage: string, invalidMessage: string) =>
  z
    .string()
    .trim()
    .min(1, emptyMessage)
    .refine((value) => /^\d+$/.test(value), { message: invalidMessage });

export const connectWhatsAppWithTokenSchema = z.object({
  accessToken: z
    .string()
    .trim()
    .min(32, "Pega el token de acceso de Meta.")
    .max(4096, "El token es demasiado largo."),
  phoneNumberId: graphNumericId(
    "Ingresa el Phone Number ID.",
    "El Phone Number ID debe ser el identificador numérico de Graph, no el número +58…",
  ),
  wabaId: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), {
      message: "El WABA ID debe ser el identificador numérico de Graph.",
    }),
});

export type ConnectWhatsAppWithTokenValues = z.infer<typeof connectWhatsAppWithTokenSchema>;
