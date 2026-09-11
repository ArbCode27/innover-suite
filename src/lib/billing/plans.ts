import type { ModuleKey, OrganizationModules } from "@/lib/modules/constants";
import { DEFAULT_MODULES, MODULE_KEYS } from "@/lib/modules/constants";

export const BILLING_VERTICALS = ["restaurant", "ventas", "realestate"] as const;
export type BillingVertical = (typeof BILLING_VERTICALS)[number];

export const BILLING_TIERS = ["basic", "pro", "plus"] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type PlanRecord = {
  id: string;
  vertical: BillingVertical;
  tier: BillingTier;
  name: string;
  priceUsd: number;
  usersLimit: number;
  aiResponsesLimit: number;
  channelsLimit: number;
  leadRecovery: boolean;
};

export type SuiteAccess = "full" | "grace" | "blocked";

export type OrgEntitlements = {
  organizationId: number;
  plan: PlanRecord;
  subscriptionStatus: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  allowedModules: OrganizationModules;
  effectiveModules: OrganizationModules;
  usersLimit: number;
  aiResponsesLimit: number;
  aiResponsesUsed: number;
  aiRemaining: number;
  aiExhausted: boolean;
  aiUsagePercent: number;
  suiteAccess: SuiteAccess;
  adminNotes: string | null;
};

export const PLAN_MODULE_MAP: Record<BillingVertical, ModuleKey[]> = {
  restaurant: ["catalog", "orders", "kitchen"],
  ventas: ["funnels", "calendar", "catalog", "orders"],
  realestate: ["funnels", "calendar", "listings"],
};

export const PLAN_CATALOG: PlanRecord[] = [
  {
    id: "restaurant_basic",
    vertical: "restaurant",
    tier: "basic",
    name: "Restaurante Básico",
    priceUsd: 99,
    usersLimit: 4,
    aiResponsesLimit: 4000,
    channelsLimit: 1,
    leadRecovery: false,
  },
  {
    id: "restaurant_pro",
    vertical: "restaurant",
    tier: "pro",
    name: "Restaurante Pro",
    priceUsd: 139,
    usersLimit: 8,
    aiResponsesLimit: 7000,
    channelsLimit: 2,
    leadRecovery: true,
  },
  {
    id: "restaurant_plus",
    vertical: "restaurant",
    tier: "plus",
    name: "Restaurante Plus",
    priceUsd: 179,
    usersLimit: 12,
    aiResponsesLimit: 12000,
    channelsLimit: 3,
    leadRecovery: true,
  },
  {
    id: "ventas_basic",
    vertical: "ventas",
    tier: "basic",
    name: "Ventas Básico",
    priceUsd: 119,
    usersLimit: 5,
    aiResponsesLimit: 5000,
    channelsLimit: 1,
    leadRecovery: false,
  },
  {
    id: "ventas_pro",
    vertical: "ventas",
    tier: "pro",
    name: "Ventas Pro",
    priceUsd: 159,
    usersLimit: 8,
    aiResponsesLimit: 8000,
    channelsLimit: 2,
    leadRecovery: true,
  },
  {
    id: "ventas_plus",
    vertical: "ventas",
    tier: "plus",
    name: "Ventas Plus",
    priceUsd: 199,
    usersLimit: 12,
    aiResponsesLimit: 12000,
    channelsLimit: 3,
    leadRecovery: true,
  },
  {
    id: "realestate_basic",
    vertical: "realestate",
    tier: "basic",
    name: "Inmobiliaria Básico",
    priceUsd: 119,
    usersLimit: 5,
    aiResponsesLimit: 5000,
    channelsLimit: 1,
    leadRecovery: false,
  },
  {
    id: "realestate_pro",
    vertical: "realestate",
    tier: "pro",
    name: "Inmobiliaria Pro",
    priceUsd: 159,
    usersLimit: 8,
    aiResponsesLimit: 8000,
    channelsLimit: 2,
    leadRecovery: true,
  },
  {
    id: "realestate_plus",
    vertical: "realestate",
    tier: "plus",
    name: "Inmobiliaria Plus",
    priceUsd: 199,
    usersLimit: 12,
    aiResponsesLimit: 12000,
    channelsLimit: 3,
    leadRecovery: true,
  },
];

export const getPlanById = (planId: string): PlanRecord | null =>
  PLAN_CATALOG.find((plan) => plan.id === planId) ?? null;

export const defaultPlanIdForTemplate = (templateId: string | null | undefined): string => {
  if (templateId === "restaurant") return "restaurant_basic";
  if (templateId === "realestate") return "realestate_basic";
  return "ventas_basic";
};

export const modulesAllowedByVertical = (vertical: BillingVertical): OrganizationModules => {
  const allowed = new Set(PLAN_MODULE_MAP[vertical]);
  const next = { ...DEFAULT_MODULES };
  for (const key of MODULE_KEYS) {
    next[key] = allowed.has(key);
  }
  return next;
};

export const intersectModules = (
  allowed: OrganizationModules,
  enabled: OrganizationModules,
): OrganizationModules => {
  const next = { ...DEFAULT_MODULES };
  for (const key of MODULE_KEYS) {
    next[key] = Boolean(allowed[key] && enabled[key]);
  }
  return next;
};

export const resolveSuiteAccess = (status: SubscriptionStatus, periodEndIso: string): SuiteAccess => {
  if (status === "suspended" || status === "canceled") return "blocked";
  if (status === "past_due") return "grace";
  const periodEnded = Date.parse(periodEndIso) < Date.now();
  if (periodEnded) return "blocked";
  return "full";
};

export const TRIAL_DAYS = 14;
