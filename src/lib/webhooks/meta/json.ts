export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const parseMetaTimestamp = (value: unknown): string | null => {
  const numeric = asNumber(value);
  if (numeric === null) {
    return null;
  }

  const milliseconds = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const time = date.getTime();
  const now = Date.now();
  if (time < Date.parse("2015-01-01T00:00:00.000Z") || time > now + 60 * 60 * 1000) {
    return null;
  }

  return date.toISOString();
};

export const firstMetaTimestamp = (...values: unknown[]): string => {
  for (const value of values) {
    const parsed = parseMetaTimestamp(value);
    if (parsed) return parsed;
  }
  return new Date().toISOString();
};

export const toIsoTimestamp = (value: unknown): string => firstMetaTimestamp(value);
