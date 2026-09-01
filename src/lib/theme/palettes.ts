export const PALETTE_STORAGE_KEY = "innover-palette";
export const PALETTE_ATTRIBUTE = "data-palette";

export const APP_PALETTES = [
  {
    id: "default",
    label: "Azul",
    swatchClass: "bg-[oklch(0.58_0.16_240)]",
  },
  {
    id: "violet",
    label: "Violeta",
    swatchClass: "bg-[oklch(0.54_0.18_304)]",
  },
  {
    id: "emerald",
    label: "Esmeralda",
    swatchClass: "bg-[oklch(0.52_0.14_162)]",
  },
  {
    id: "rose",
    label: "Rosa",
    swatchClass: "bg-[oklch(0.58_0.18_12)]",
  },
] as const;

export type PaletteId = (typeof APP_PALETTES)[number]["id"];

export const DEFAULT_PALETTE_ID: PaletteId = "default";

const PALETTE_IDS = new Set<string>(APP_PALETTES.map((palette) => palette.id));

export const isPaletteId = (value: unknown): value is PaletteId =>
  typeof value === "string" && PALETTE_IDS.has(value);

export const parsePaletteId = (value: unknown): PaletteId =>
  isPaletteId(value) ? value : DEFAULT_PALETTE_ID;

export const setDocumentPalette = (paletteId: PaletteId) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(PALETTE_ATTRIBUTE, paletteId);
};

export const persistPalette = (paletteId: PaletteId) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, paletteId);
  } catch {
    /* private mode */
  }
};

export const applyPalette = (paletteId: PaletteId) => {
  setDocumentPalette(paletteId);
  persistPalette(paletteId);
};

export const readStoredPalette = (): PaletteId => {
  if (typeof window === "undefined") return DEFAULT_PALETTE_ID;
  try {
    return parsePaletteId(window.localStorage.getItem(PALETTE_STORAGE_KEY));
  } catch {
    return DEFAULT_PALETTE_ID;
  }
};

export const getPaletteBootstrapScript = () =>
  `(function(){try{var k=${JSON.stringify(PALETTE_STORAGE_KEY)};var a=${JSON.stringify(APP_PALETTES.map((palette) => palette.id))};var v=localStorage.getItem(k);if(v&&a.indexOf(v)!==-1)document.documentElement.setAttribute(${JSON.stringify(PALETTE_ATTRIBUTE)},v);}catch(e){}})();`;
