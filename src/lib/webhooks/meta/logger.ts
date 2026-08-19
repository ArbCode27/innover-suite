type LogLevel = "info" | "warn" | "error";

type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

type LogPayload = Record<string, Serializable>;

const normalizePayload = (payload: LogPayload) =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

export const maskIdentifier = (value: string, visibleChars = 6) => {
  if (!value) {
    return value;
  }

  if (value.length <= visibleChars) {
    return "*".repeat(value.length);
  }

  const suffix = value.slice(-visibleChars);
  return `${"*".repeat(Math.max(4, value.length - visibleChars))}${suffix}`;
};

export const logMetaWebhook = (
  level: LogLevel,
  event: string,
  payload: LogPayload,
) => {
  const normalizedPayload = normalizePayload(payload);
  const logEntry = {
    namespace: "meta_webhook",
    event,
    ...normalizedPayload,
    timestamp: new Date().toISOString(),
  };

  if (level === "error") {
    console.error(JSON.stringify(logEntry));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(logEntry));
    return;
  }

  console.info(JSON.stringify(logEntry));
};
