"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Loader2 } from "lucide-react";

type ListingCreateOverlayProps = {
  open: boolean;
};

export const ListingCreateOverlay = ({ open }: ListingCreateOverlayProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-primary/20 bg-card px-6 py-8 text-center shadow-lg">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="size-6" aria-hidden />
        </span>
        <Loader2 className="mx-auto mt-4 size-6 animate-spin text-primary" aria-hidden />
        <p className="mt-4 text-base font-medium">Creando inmueble</p>
        <p className="mt-1 text-sm text-muted-foreground">Abriendo la ficha para que puedas agregar fotos.</p>
      </div>
    </div>,
    document.body,
  );
};
