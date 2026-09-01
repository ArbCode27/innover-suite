"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyPalette,
  DEFAULT_PALETTE_ID,
  PALETTE_STORAGE_KEY,
  parsePaletteId,
  readStoredPalette,
  setDocumentPalette,
  type PaletteId,
} from "@/lib/theme/palettes";

type PaletteContextValue = {
  palette: PaletteId;
  setPalette: (next: PaletteId) => void;
  mounted: boolean;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

type PaletteProviderProps = {
  children: ReactNode;
};

export const PaletteProvider = ({ children }: PaletteProviderProps) => {
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredPalette();
    setPaletteState(stored);
    setDocumentPalette(stored);
    setMounted(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PALETTE_STORAGE_KEY) return;
      const next = parsePaletteId(event.newValue);
      setPaletteState(next);
      setDocumentPalette(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setPalette = useCallback((next: PaletteId) => {
    setPaletteState(next);
    applyPalette(next);
  }, []);

  const value = useMemo(
    () => ({ palette, setPalette, mounted }),
    [palette, setPalette, mounted],
  );

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
};

export const usePalette = () => {
  const context = useContext(PaletteContext);
  if (!context) {
    throw new Error("usePalette must be used within PaletteProvider");
  }
  return context;
};
