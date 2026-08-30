"use client";

import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { Switch } from "@/components/ui/switch";
import { useBrowserNotifications } from "@/lib/notifications/use-browser-notifications";
import { cn } from "@/lib/utils";

type BrowserNotificationsControlsProps = {
  compact?: boolean;
};

const STATUS_COPY: Record<
  Exclude<ReturnType<typeof useBrowserNotifications>["status"], "loading">,
  { title: string; description: string }
> = {
  unsupported: {
    title: "Avisos del navegador no disponibles",
    description: "Usa Chrome o Edge en HTTPS. En iPhone solo funcionan si instalas el CRM como app.",
  },
  prompt: {
    title: "Avisos del navegador",
    description: "Recibe un aviso de Windows o Chrome cuando entre un chat y no estés en esta pestaña.",
  },
  denied: {
    title: "Avisos bloqueados",
    description: "Abre el candado junto a la URL → Configuración del sitio → Notificaciones → Permitir.",
  },
  muted: {
    title: "Avisos del navegador",
    description: "El permiso está concedido. Actívalos de nuevo en este dispositivo.",
  },
  active: {
    title: "Avisos del navegador activos",
    description: "Te avisamos solo si el CRM está en segundo plano. La campana sigue igual.",
  },
};

export const BrowserNotificationsControls = ({ compact = false }: BrowserNotificationsControlsProps) => {
  const { status, handleEnable, handleMute } = useBrowserNotifications();

  const handleCheckedChange = async (checked: boolean) => {
    if (!checked) {
      handleMute();
      toast.success("Avisos del navegador desactivados en este dispositivo");
      return;
    }

    const result = await handleEnable();
    if (!result.ok) {
      toastActionError(result);
      return;
    }
    toast.success("Avisos del navegador activados");
  };

  if (status === "loading") {
    return <p className="text-xs text-muted-foreground">Comprobando avisos…</p>;
  }

  const copy = STATUS_COPY[status];
  const canToggle = status === "prompt" || status === "muted" || status === "active";

  return (
    <div className={cn("flex items-start gap-3", compact ? "px-1.5 py-1" : "")}>
      {compact ? null : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BellRing className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{copy.title}</p>
        <p className={cn("text-muted-foreground", compact ? "mt-0.5 text-[11px] leading-4" : "mt-1 text-xs leading-5")}>
          {copy.description}
        </p>
      </div>
      {canToggle ? (
        <Switch
          size={compact ? "sm" : "default"}
          checked={status === "active"}
          onCheckedChange={(checked) => {
            void handleCheckedChange(checked);
          }}
          aria-label="Activar avisos del navegador"
        />
      ) : null}
    </div>
  );
};
