export const THEME_STORAGE_KEYS = {
  /** Preferencia del CRM, login, onboarding y resto de la app. */
  crm: "innover-crm-theme",
  /** Preferencia del menú público / autopedido (independiente del CRM). */
  menu: "innover-menu-theme",
} as const;

export type ThemeZone = keyof typeof THEME_STORAGE_KEYS;

/** Clave por defecto de next-themes (versiones anteriores de la app). */
export const LEGACY_THEME_STORAGE_KEY = "theme";

export const isPublicMenuPath = (pathname: string | null | undefined) => {
  if (!pathname) return false;
  return pathname === "/menu" || pathname.startsWith("/menu/") || pathname === "/pedir" || pathname.startsWith("/pedir/");
};

export const resolveThemeZone = (pathname: string | null | undefined): ThemeZone =>
  isPublicMenuPath(pathname) ? "menu" : "crm";

export const resolveThemeStorageKey = (pathname: string | null | undefined) =>
  THEME_STORAGE_KEYS[resolveThemeZone(pathname)];

/**
 * Migra la clave legacy `theme` → `innover-crm-theme` una sola vez.
 * No toca la preferencia del menú público.
 */
let legacyCrmThemeMigrated = false;

export const migrateLegacyCrmTheme = () => {
  if (legacyCrmThemeMigrated || typeof window === "undefined") return;
  legacyCrmThemeMigrated = true;
  try {
    const legacy = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (!legacy) return;
    if (!window.localStorage.getItem(THEME_STORAGE_KEYS.crm)) {
      window.localStorage.setItem(THEME_STORAGE_KEYS.crm, legacy);
    }
  } catch {
    // localStorage puede estar bloqueado (modo privado / políticas).
  }
};
