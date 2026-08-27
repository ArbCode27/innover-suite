export const APP_LOCALE = "es-VE";
export const CALENDAR_TIME_ZONE = "America/Caracas";
export const CALENDAR_UTC_OFFSET = "-04:00";

export type CalendarViewMode = "day" | "threeDay" | "week";

export const APPOINTMENT_PURPOSES = ["consulta", "seguimiento", "demo", "cierre", "interno"] as const;

export type AppointmentPurpose = (typeof APPOINTMENT_PURPOSES)[number];

export const APPOINTMENT_PURPOSE_LABELS: Record<AppointmentPurpose, string> = {
  consulta: "Consulta",
  seguimiento: "Seguimiento",
  demo: "Comercial",
  cierre: "Cierre",
  interno: "Interno",
};

export const APPOINTMENT_PURPOSE_STYLES: Record<AppointmentPurpose, string> = {
  consulta: "border-sky-300/70 bg-sky-500/12",
  seguimiento: "border-amber-300/70 bg-amber-500/12",
  demo: "border-violet-300/70 bg-violet-500/12",
  cierre: "border-emerald-300/70 bg-emerald-500/12",
  interno: "border-slate-300/70 bg-slate-500/12",
};

export const inferAppointmentPurpose = (title: string): AppointmentPurpose => {
  const normalized = title.toLowerCase();
  if (normalized.includes("seguimiento")) return "seguimiento";
  if (normalized.includes("consulta")) return "consulta";
  if (normalized.includes("cierre")) return "cierre";
  if (normalized.includes("demo") || normalized.includes("comercial")) return "demo";
  return "interno";
};
