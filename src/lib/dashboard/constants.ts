export const SLA_FIRST_RESPONSE_MS = 5 * 60 * 1000;
export const UNANSWERED_STALE_MS = 15 * 60 * 1000;
export const HUMAN_QUEUE_STALE_MS = 10 * 60 * 1000;
export const TOKEN_EXPIRING_MS = 3 * 24 * 60 * 60 * 1000;
export const CHURN_INACTIVE_DAYS = 45;
export const AI_MINUTES_PER_OUTBOUND = 3;
export const AGENT_HOURLY_COST = 400;
export const DASHBOARD_MESSAGE_LIMIT = 1200;
export const DASHBOARD_CONVERSATION_LIMIT = 500;
export const DASHBOARD_ORDER_LIMIT = 1200;

export const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

export const LOST_REASON_PATTERN =
  /perdid|lost|no interesa|sin presupuesto|caro|competencia|ghost|no califica|precio|no responde|sin respuesta/i;
