import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_CURRENCY = "DOP";

export const CURRENCY_CATALOG = [
  { code: "DOP", label: "Peso dominicano", hint: "RD$" },
  { code: "USD", label: "Dólar estadounidense", hint: "US$" },
  { code: "EUR", label: "Euro", hint: "€" },
  { code: "VES", label: "Bolívar venezolano", hint: "Bs." },
  { code: "CAD", label: "Dólar canadiense", hint: "CA$" },
  { code: "MXN", label: "Peso mexicano", hint: "MX$" },
  { code: "COP", label: "Peso colombiano", hint: "COL$" },
  { code: "GBP", label: "Libra esterlina", hint: "£" },
] as const;

export type CurrencyCode = (typeof CURRENCY_CATALOG)[number]["code"];

export type OrganizationCurrencySettings = {
  codes: string[];
  defaultCode: string;
};

const KNOWN_CODES = new Set<string>(CURRENCY_CATALOG.map((item) => item.code));

export const DEFAULT_CURRENCY_SETTINGS: OrganizationCurrencySettings = {
  codes: [DEFAULT_CURRENCY],
  defaultCode: DEFAULT_CURRENCY,
};

export const isKnownCurrency = (value: string): value is CurrencyCode => KNOWN_CODES.has(value);

export const currencyLabel = (code: string) =>
  CURRENCY_CATALOG.find((item) => item.code === code)?.label ?? code;

export const currencyHint = (code: string) =>
  CURRENCY_CATALOG.find((item) => item.code === code)?.hint ?? code;

export const currencyOptionLabel = (code: string) => {
  const item = CURRENCY_CATALOG.find((entry) => entry.code === code);
  return item ? `${item.code} · ${item.hint}` : code;
};

export const normalizeCurrencySettings = (
  codes: unknown,
  defaultCode: unknown,
): OrganizationCurrencySettings => {
  const unique = [...new Set((Array.isArray(codes) ? codes : []).filter((code): code is string => typeof code === "string"))]
    .map((code) => code.trim().toUpperCase())
    .filter(isKnownCurrency);

  const resolvedCodes = unique.length ? unique : [DEFAULT_CURRENCY];
  const requestedDefault = typeof defaultCode === "string" ? defaultCode.trim().toUpperCase() : DEFAULT_CURRENCY;
  const resolvedDefault = resolvedCodes.includes(requestedDefault) ? requestedDefault : resolvedCodes[0];

  return {
    codes: resolvedCodes,
    defaultCode: resolvedDefault,
  };
};

export const resolveOrganizationCurrency = (code: string | null | undefined, settings: OrganizationCurrencySettings) => {
  const normalized = (code ?? "").trim().toUpperCase();
  if (settings.codes.includes(normalized)) return normalized;
  return settings.defaultCode;
};

export const loadOrganizationCurrencies = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<OrganizationCurrencySettings> => {
  const { data, error } = await supabase
    .from("organizations")
    .select("currencies, default_currency")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_CURRENCY_SETTINGS;
  }

  return normalizeCurrencySettings(data.currencies, data.default_currency);
};
