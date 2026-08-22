import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";

export type BusinessHoursDay = {
  open: string;
  close: string;
};

export type BusinessHours = {
  timezone?: string;
  days: Record<string, BusinessHoursDay | null>;
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: CALENDAR_TIME_ZONE,
  days: {
    "0": null,
    "1": { open: "08:00", close: "22:00" },
    "2": { open: "08:00", close: "22:00" },
    "3": { open: "08:00", close: "22:00" },
    "4": { open: "08:00", close: "22:00" },
    "5": { open: "08:00", close: "22:00" },
    "6": { open: "08:00", close: "22:00" },
  },
};

export const DEFAULT_CLOSED_MESSAGE =
  "Estamos fuera de horario. Te respondemos en cuanto abramos. Si es urgente, déjanos tu nombre y lo que necesitas.";

const WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

const parseMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const parseBusinessHours = (value: unknown): BusinessHours => {
  if (!value || typeof value !== "object") {
    return DEFAULT_BUSINESS_HOURS;
  }

  const raw = value as { timezone?: unknown; days?: unknown };
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
    days,
  };
};

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
