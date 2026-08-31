"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { oauthStartHref } from "@/lib/integrations/oauth-href";
import { Button } from "@/components/ui/button";

const GOOGLE_STATUS_LABELS: Record<string, string> = {
  connected: "Google Calendar conectado correctamente.",
  cancelled: "Conexión cancelada.",
  invalid_callback: "Google devolvió un callback incompleto.",
  invalid_state: "La sesión expiró. Inténtalo de nuevo.",
  token_exchange_failed: "No se pudo completar el intercambio de token.",
  profile_failed: "No se pudo leer la cuenta de Google.",
  missing_refresh_token: "Google no devolvió un token de renovación. Vuelve a conectar y acepta los permisos.",
  persist_failed: "Se autorizó, pero no se pudo guardar la conexión.",
  missing_env: "Faltan variables de entorno para Google Calendar.",
  state_error: "No se pudo iniciar el flujo de Google.",
  auth_required: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para conectar el calendario.",
};

type CalendarPanelProps = {
  connected: boolean;
  email: string | null;
};

export const CalendarPanel = ({ connected, email }: CalendarPanelProps) => {
  const searchParams = useSearchParams();
  const status = searchParams.get("gc");
  const message = status ? GOOGLE_STATUS_LABELS[status] : null;
  const isError = Boolean(status && !["connected", "disconnected"].includes(status));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Sin calendario la IA no podrá agendar visitas ni citas. Puedes saltar este paso y conectarlo en Ajustes.
      </p>
      {message ? (
        <p className={`text-sm ${isError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>{message}</p>
      ) : null}
      {connected ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/8 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            {email || "Google Calendar"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Listo para agendar desde el chat.</p>
        </div>
      ) : (
        <Button asChild>
          <Link href={oauthStartHref("/api/auth/google/start", "calendar")}>Conectar Google Calendar</Link>
        </Button>
      )}
    </div>
  );
};
