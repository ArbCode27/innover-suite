import type { CalendarViewMode } from "@/lib/calendar/constants";
import { CALENDAR_UTC_OFFSET } from "@/lib/calendar/constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export const parseAnchorDate = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return toDateKey(new Date());
  }
  return value;
};

export const parseViewMode = (value: string | undefined): CalendarViewMode => {
  if (value === "day" || value === "threeDay" || value === "week") {
    return value;
  }
  return "week";
};

export const toDateKey = (date: Date) => {
  const shifted = new Date(date.getTime() - 4 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
};

export const dateKeyToUtc = (dateKey: string, time = "00:00:00") =>
  new Date(`${dateKey}T${time}${CALENDAR_UTC_OFFSET}`);

export const addDays = (dateKey: string, amount: number) => {
  const next = new Date(dateKeyToUtc(dateKey).getTime() + amount * DAY_MS);
  return toDateKey(next);
};

export const startOfWeek = (dateKey: string) => {
  const date = dateKeyToUtc(dateKey);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  return addDays(dateKey, -daysFromMonday);
};

export const getVisibleDays = (view: CalendarViewMode, anchorDate: string) => {
  if (view === "day") {
    return [anchorDate];
  }
  if (view === "threeDay") {
    return [anchorDate, addDays(anchorDate, 1), addDays(anchorDate, 2)];
  }
  const monday = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
};

export const getRangeIso = (days: string[]) => {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return {
    timeMin: dateKeyToUtc(first).toISOString(),
    timeMax: dateKeyToUtc(addDays(last, 1)).toISOString(),
  };
};

export const shiftAnchor = (view: CalendarViewMode, anchorDate: string, direction: -1 | 1) => {
  if (view === "day") {
    return addDays(anchorDate, direction);
  }
  if (view === "threeDay") {
    return addDays(anchorDate, direction * 3);
  }
  return addDays(anchorDate, direction * 7);
};

export const toZonedIso = (dateKey: string, time: string) => `${dateKey}T${time}:00${CALENDAR_UTC_OFFSET}`;

const padTime = (value: number) => String(value).padStart(2, "0");

export const snapMinutes = (minutes: number, step = 15) => Math.round(minutes / step) * step;

export const clampGridMinutes = (minutes: number, startHour = 8, endHour = 20) =>
  Math.min(Math.max(minutes, startHour * 60), endHour * 60 - 15);

export const minutesToTime = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${padTime(hours)}:${padTime(minutes)}`;
};

export const dateAndMinutesToIso = (dateKey: string, totalMinutes: number) =>
  toZonedIso(dateKey, minutesToTime(totalMinutes));

export const formatDayHeading = (dateKey: string) =>
  new Intl.DateTimeFormat("es-DO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Santo_Domingo",
  }).format(dateKeyToUtc(dateKey));

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santo_Domingo",
  }).format(new Date(iso));

export const formatRangeLabel = (days: string[]) => {
  const first = dateKeyToUtc(days[0]!);
  const last = dateKeyToUtc(days[days.length - 1]!);
  const formatter = new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Santo_Domingo",
  });
  if (days.length === 1) {
    return formatter.format(first);
  }
  return `${formatter.format(first)} – ${formatter.format(last)}`;
};

export const getZonedTimeParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
};
