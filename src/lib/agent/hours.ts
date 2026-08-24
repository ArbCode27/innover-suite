import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";

export type BusinessHoursDay = {
  open: string;
  close: string;
};

export type BusinessHours = {
  timezone?: string;
  enabled?: boolean;
  afterHoursAiCoverage?: boolean;
  days: Record<string, BusinessHoursDay | null>;
};

export const WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

export const WEEKDAY_ORDER = ["1", "2", "3", "4", "5", "6", "0"] as const;

export const WEEKDAY_LABELS: Record<(typeof WEEKDAY_KEYS)[number], string> = {
  "0": "Domingo",
  "1": "Lunes",
  "2": "Martes",
  "3": "Miércoles",
  "4": "Jueves",
  "5": "Viernes",
  "6": "Sábado",
};

export const DEFAULT_DAY_HOURS: BusinessHoursDay = { open: "08:00", close: "22:00" };

export const OFFICE_TIMEZONES = [
  { value: "America/Santo_Domingo", label: "Santo Domingo (AST)" },
  { value: "America/Caracas", label: "Caracas" },
  { value: "America/Puerto_Rico", label: "Puerto Rico (AST)" },
  { value: "America/New_York", label: "Nueva York (ET)" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Lima", label: "Lima" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "UTC", label: "UTC" },
] as const;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: CALENDAR_TIME_ZONE,
  enabled: true,
  afterHoursAiCoverage: true,
  days: {
    "0": null,
    "1": { ...DEFAULT_DAY_HOURS },
    "2": { ...DEFAULT_DAY_HOURS },
    "3": { ...DEFAULT_DAY_HOURS },
    "4": { ...DEFAULT_DAY_HOURS },
    "5": { ...DEFAULT_DAY_HOURS },
    "6": { ...DEFAULT_DAY_HOURS },
  },
};

export const DEFAULT_CLOSED_MESSAGE =
  "El equipo de asesores está fuera de horario. Yo te sigo atendiendo ahora. Si prefieres un humano, déjanos tu nombre y lo que necesitas; te escriben al abrir.";

const parseMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const asBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  return fallback;
};

export const parseBusinessHours = (value: unknown): BusinessHours => {
  if (!value || typeof value !== "object") {
    return DEFAULT_BUSINESS_HOURS;
  }

  const raw = value as {
    timezone?: unknown;
    enabled?: unknown;
    afterHoursAiCoverage?: unknown;
    days?: unknown;
  };
  const days: BusinessHours["days"] = { ...DEFAULT_BUSINESS_HOURS.days };

  if (raw.days && typeof raw.days === "object") {
    for (const key of WEEKDAY_KEYS) {
      const day = (raw.days as Record<string, unknown>)[key];
      if (day === null) {
        days[key] = null;
        continue;
      }
      if (day && typeof day === "object") {
        const open = typeof (day as { open?: unknown }).open === "string" ? (day as { open: string }).open : "";
        const close = typeof (day as { close?: unknown }).close === "string" ? (day as { close: string }).close : "";
        days[key] = parseMinutes(open) != null && parseMinutes(close) != null ? { open, close } : null;
      }
    }
  }

  return {
    timezone: typeof raw.timezone === "string" && raw.timezone.trim() ? raw.timezone.trim() : CALENDAR_TIME_ZONE,
    enabled: asBoolean(raw.enabled, true),
    afterHoursAiCoverage: asBoolean(raw.afterHoursAiCoverage, true),
    days,
  };
};

export const isScheduleEnabled = (hours: BusinessHours) => hours.enabled !== false;

export const isAfterHoursAiCoverage = (hours: BusinessHours) => hours.afterHoursAiCoverage !== false;

export const countOpenDays = (hours: BusinessHours) =>
  WEEKDAY_KEYS.filter((key) => Boolean(hours.days[key])).length;

export const isWithinBusinessHours = (hours: BusinessHours, at = new Date()) => {
  const timezone = hours.timezone || CALENDAR_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const day = hours.days[String(weekdayIndex < 0 ? 0 : weekdayIndex)];
  if (!day) return false;

  const open = parseMinutes(day.open);
  const close = parseMinutes(day.close);
  if (open == null || close == null) return false;

  const now = hour * 60 + minute;
  if (close <= open) {
    return now >= open || now < close;
  }
  return now >= open && now < close;
};

export const areAdvisorsAvailable = (hours: BusinessHours, at = new Date()) => {
  if (!isScheduleEnabled(hours)) return true;
  return isWithinBusinessHours(hours, at);
};
