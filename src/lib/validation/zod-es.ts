import { z } from "zod";

const FIELD_LABELS: Record<string, string> = {
  yearBuilt: "Año de construcción",
  areaM2: "Metros cuadrados",
  bedrooms: "Habitaciones",
  bathrooms: "Baños",
  parking: "Puestos de estacionamiento",
  price: "Precio",
  title: "Título",
  code: "Código interno",
  description: "Descripción",
  zone: "Zona",
  neighborhood: "Estado",
  city: "Ciudad",
  videoUrl: "Video",
  tourUrl: "Tour virtual",
  amenities: "Amenidades",
  ownerContactId: "Propietario",
  currency: "Moneda",
  name: "Nombre",
  fullName: "Nombre",
  email: "Correo",
  phone: "Teléfono",
  password: "Contraseña",
  confirmPassword: "Confirmación de contraseña",
  currentPassword: "Contraseña actual",
  taxPercent: "IVA",
  taxRate: "IVA",
  date: "Fecha",
  startTime: "Hora de inicio",
  endTime: "Hora de fin",
  notes: "Notas",
  body: "Nota",
};

const quoteValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "sí" : "no";
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    return trimmed.length > 80 ? `"${trimmed.slice(0, 77)}..."` : `"${trimmed}"`;
  }
  return null;
};

let configured = false;

export const configureZodSpanish = () => {
  if (configured) return;
  configured = true;

  z.config({
    localeError: (issue) => {
      const received = quoteValue("input" in issue ? issue.input : undefined);

      switch (issue.code) {
        case "too_big": {
          const maximum = "maximum" in issue ? String(issue.maximum) : "";
          if (issue.origin === "number") {
            return received
              ? `El valor ${received} es demasiado alto. El máximo permitido es ${maximum}.`
              : `El número no puede ser mayor a ${maximum}.`;
          }
          if (issue.origin === "string") {
            return `El texto es demasiado largo. El máximo es ${maximum} caracteres.`;
          }
          if (issue.origin === "array") {
            return `Hay demasiados elementos. El máximo es ${maximum}.`;
          }
          return `El valor es demasiado grande. El máximo permitido es ${maximum}.`;
        }
        case "too_small": {
          const minimum = "minimum" in issue ? String(issue.minimum) : "";
          if (issue.origin === "number") {
            return received
              ? `El valor ${received} es demasiado bajo. El mínimo permitido es ${minimum}.`
              : `El número no puede ser menor a ${minimum}.`;
          }
          if (issue.origin === "string") {
            return `El texto es demasiado corto. Debe tener al menos ${minimum} caracteres.`;
          }
          if (issue.origin === "array") {
            return `Faltan elementos. El mínimo es ${minimum}.`;
          }
          return `El valor es demasiado pequeño. El mínimo permitido es ${minimum}.`;
        }
        case "invalid_type": {
          if (issue.expected === "number") {
            return received
              ? `${received} no es un número. Escribe solo dígitos.`
              : "Este campo debe ser un número.";
          }
          if (issue.expected === "string") {
            return "Este campo debe ser texto.";
          }
          return "El valor no tiene el formato esperado.";
        }
        case "invalid_format": {
          if ("format" in issue && issue.format === "url") {
            return received
              ? `${received} no es una URL válida. Usa una dirección completa con https://.`
              : "La URL no es válida. Usa una dirección completa con https://.";
          }
          if ("format" in issue && issue.format === "email") {
            return received
              ? `${received} no es un correo válido. Revisa el @ y el dominio.`
              : "El correo no es válido. Revisa que tenga un @ y un dominio.";
          }
          if ("format" in issue && issue.format === "uuid") {
            return "El identificador no es válido.";
          }
          return "El formato del valor no es válido.";
        }
        case "invalid_value":
          return "El valor elegido no está permitido. Elige una de las opciones de la lista.";
        default:
          return "El valor no es válido. Revisa este campo e inténtalo de nuevo.";
      }
    },
  });
};

configureZodSpanish();

export const zodErrorMessage = (error: z.ZodError, fallback = "Revisa los datos del formulario.") => {
  const issue = error.issues[0];
  if (!issue) return fallback;

  const path = issue.path.find((part) => typeof part === "string");
  const label = typeof path === "string" ? FIELD_LABELS[path] : undefined;
  const message = issue.message || fallback;

  if (label && !message.toLowerCase().includes(label.toLowerCase())) {
    return `${label}: ${message}`;
  }

  return message;
};

export const zodFieldErrors = (error: z.ZodError) => {
  const next: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.find((part) => typeof part === "string");
    if (typeof path === "string" && path && !next[path]) {
      next[path] = issue.message;
    }
  }
  return next;
};
