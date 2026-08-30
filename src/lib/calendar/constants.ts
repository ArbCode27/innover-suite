export const APP_LOCALE = "es-VE";
export const CALENDAR_TIME_ZONE = "America/Caracas";
export const CALENDAR_UTC_OFFSET = "-04:00";

export type CalendarViewMode = "day" | "threeDay" | "week";

export const APPOINTMENT_PURPOSES = [
  "consulta",
  "seguimiento",
  "demo",
  "cierre",
  "interno",
  "visita",
  "segunda_visita",
  "tasacion",
  "firma",
] as const;

export type AppointmentPurpose = (typeof APPOINTMENT_PURPOSES)[number];

export const APPOINTMENT_PURPOSE_LABELS: Record<AppointmentPurpose, string> = {
  consulta: "Consulta",
  seguimiento: "Seguimiento",
  demo: "Comercial",
  cierre: "Cierre",
  interno: "Interno",
  visita: "Visita",
  segunda_visita: "Segunda visita",
  tasacion: "Tasación",
  firma: "Firma",
};

export const APPOINTMENT_PURPOSE_STYLES: Record<AppointmentPurpose, string> = {
  consulta: "border-sky-300/70 bg-sky-500/12",
  seguimiento: "border-amber-300/70 bg-amber-500/12",
  demo: "border-violet-300/70 bg-violet-500/12",
  cierre: "border-emerald-300/70 bg-emerald-500/12",
  interno: "border-slate-300/70 bg-slate-500/12",
  visita: "border-cyan-300/70 bg-cyan-500/12",
  segunda_visita: "border-indigo-300/70 bg-indigo-500/12",
  tasacion: "border-orange-300/70 bg-orange-500/12",
  firma: "border-teal-300/70 bg-teal-500/12",
};

export const VISIT_STATUSES = ["pending", "attended", "no_show", "rescheduled"] as const;

export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  pending: "Pendiente",
  attended: "Asistió",
  no_show: "No asistió",
  rescheduled: "Reagendada",
};

export const isVisitStatus = (value: unknown): value is VisitStatus =>
  typeof value === "string" && VISIT_STATUSES.includes(value as VisitStatus);

export const isVisitPurpose = (purpose: AppointmentPurpose) =>
  purpose === "visita" || purpose === "segunda_visita" || purpose === "tasacion" || purpose === "firma";

export const inferAppointmentPurpose = (title: string): AppointmentPurpose => {
  const normalized = title.toLowerCase();
  if (normalized.includes("segunda")) return "segunda_visita";
  if (normalized.includes("visita")) return "visita";
  if (normalized.includes("tasac")) return "tasacion";
  if (normalized.includes("firma")) return "firma";
  if (normalized.includes("seguimiento")) return "seguimiento";
  if (normalized.includes("consulta")) return "consulta";
  if (normalized.includes("cierre")) return "cierre";
  if (normalized.includes("demo") || normalized.includes("comercial")) return "demo";
  return "interno";
};
