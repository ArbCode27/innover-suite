"use client";

import { useLayoutEffect } from "react";
import { parsePaletteId, setDocumentPalette, type PaletteId } from "@/lib/theme/palettes";

type PublicPaletteSyncProps = {
  palette: PaletteId | string | null | undefined;
};

/** Aplica la paleta de la organización pública sin usar <script> en el árbol React. */
export const PublicPaletteSync = ({ palette }: PublicPaletteSyncProps) => {
  const paletteId = parsePaletteId(palette);

  useLayoutEffect(() => {
    setDocumentPalette(paletteId);
  }, [paletteId]);

  return null;
};
