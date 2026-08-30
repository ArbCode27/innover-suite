"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyableTextProps = {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
};

export const CopyableText = ({
  value,
  label = "Copiar",
  successMessage = "Copiado al portapapeles",
  className,
}: CopyableTextProps) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("No se pudo copiar. Selecciona el texto e inténtalo de nuevo.");
    }
  };

  return (
    <div className={cn("flex items-start gap-2 rounded-xl border border-primary/15 bg-muted/40 p-3", className)}>
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => {
          void handleCopy();
        }}
      >
        <Copy />
        {label}
      </Button>
    </div>
  );
};
