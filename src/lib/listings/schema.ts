import { z } from "zod";
import {
  LISTING_OPERATIONS,
  LISTING_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/listings/types";
import "@/lib/validation/zod-es";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z
    .string()
    .trim()
    .max(4000, "El texto no puede tener más de 4000 caracteres.")
    .optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z
    .string()
    .trim()
    .url("Usa una URL completa con https://, por ejemplo https://www.youtube.com/watch?v=...")
    .max(500, "La URL no puede tener más de 500 caracteres.")
    .optional(),
);

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value == null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number("Este campo debe ser un número.").nonnegative("El número no puede ser negativo.").max(1_000_000_000, "El número es demasiado alto.").optional());

const optionalInt = z.preprocess((value) => {
  if (value === "" || value == null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number("Este campo debe ser un número.").int("Usa un número entero, sin decimales.").nonnegative("El número no puede ser negativo.").max(50, "El máximo permitido es 50.").optional());

export const listingSchema = z.object({
  id: z.number().int().positive().optional(),
  code: z.string().trim().max(40, "El código interno no puede tener más de 40 caracteres.").optional(),
  title: z
    .string()
    .trim()
    .min(3, "El título debe tener al menos 3 caracteres.")
    .max(160, "El título no puede tener más de 160 caracteres."),
  description: optionalText,
  propertyType: z.enum(PROPERTY_TYPES, { error: "Elige un tipo de inmueble válido." }),
  operation: z.enum(LISTING_OPERATIONS, { error: "Elige si es venta, alquiler o ambos." }),
  status: z.enum(LISTING_STATUSES, { error: "Elige un estado válido para el inmueble." }),
  zone: optionalText,
  neighborhood: optionalText,
  city: optionalText,
  areaM2: optionalNumber,
  bedrooms: optionalInt,
  bathrooms: optionalInt,
  parking: optionalInt,
  yearBuilt: z.preprocess((value) => {
    if (value === "" || value == null) return undefined;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }, z
    .number("El año de construcción debe ser un número.")
    .int("El año de construcción debe ser un número entero, sin decimales.")
    .optional()
    .superRefine((value, ctx) => {
      if (value == null) return;
      if (value < 1800) {
        ctx.addIssue({
          code: "custom",
          message: `El año de construcción no puede ser anterior a 1800. Escribiste ${value}.`,
        });
      }
      if (value > 2100) {
        ctx.addIssue({
          code: "custom",
          message: `El año de construcción no puede ser posterior a 2100. Escribiste ${value}.`,
        });
      }
    })),
  price: optionalNumber,
  currency: z.string().trim().length(3, "La moneda debe tener 3 letras, por ejemplo USD o VES.").optional(),
  amenities: z
    .array(z.string().trim().min(1).max(40, "Cada amenidad no puede tener más de 40 caracteres."))
    .max(24, "Puedes indicar como máximo 24 amenidades.")
    .optional(),
  ownerContactId: z.preprocess((value) => {
    if (value === "" || value == null || value === 0) return undefined;
    return value;
  }, z.number().int().positive("El propietario no es válido.").optional()),
  exclusive: z.boolean().optional(),
  videoUrl: optionalUrl,
  tourUrl: optionalUrl,
});

export type ListingInput = z.infer<typeof listingSchema>;
