"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageCircle, Unplug, UserPlus } from "lucide-react";
import { inviteAdvisorAction } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const inviteSchema = z.object({
  email: z.email("Ingresa un correo válido"),
});

type InviteValues = z.infer<typeof inviteSchema>;

type TeamAndIntegrationsFormProps = {
  organizationName: string;
  instagramConnection: {
    instagram_user_id: string;
    instagram_username: string | null;
    token_expires_at: string;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  connected: "Cuenta de Instagram conectada correctamente.",
  cancelled: "Conexión cancelada por el usuario.",
  invalid_callback: "Instagram devolvió un callback incompleto. Inténtalo de nuevo.",
  invalid_state: "La sesión de conexión expiró o no es válida. Reintenta desde el panel.",
  token_exchange_failed: "No se pudo completar el intercambio de token con Instagram.",
  long_token_failed: "No se pudo generar el token de larga duración.",
  persist_failed: "Se conectó Instagram, pero no se pudo guardar la conexión en el CRM.",
  disconnect_failed: "No se pudo desconectar la cuenta en este intento.",
  disconnected: "Cuenta de Instagram desconectada correctamente.",
  missing_env: "Faltan variables de entorno para OAuth de Instagram.",
  state_error: "No se pudo iniciar el flujo OAuth en este momento.",
  auth_required: "Tu sesión expiró. Inicia sesión nuevamente para conectar Instagram.",
  forbidden: "No tienes permisos para gestionar integraciones de Instagram.",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
  }).format(new Date(value));

export const TeamAndIntegrationsForm = ({
  instagramConnection,
  organizationName,
}: TeamAndIntegrationsFormProps) => {
  const searchParams = useSearchParams();
  const igStatus = searchParams.get("ig");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  const handleInvite = inviteForm.handleSubmit(async (values) => {
    setInviteMessage(null);
    const result = await inviteAdvisorAction({ ...values, role: "agent" });
    setInviteMessage(result?.success || result?.error || null);
  });

  const inviteError = inviteMessage && !inviteMessage.toLowerCase().includes("registrada");
  const statusMessage = igStatus ? STATUS_LABELS[igStatus] : null;
  const statusIsError = Boolean(
    igStatus &&
      !["connected", "disconnected"].includes(igStatus),
  );

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-primary/15 bg-background/70 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4 text-primary" />
          Integración de Instagram
        </div>
        <p className="text-sm text-muted-foreground">
          Conecta una cuenta profesional de Instagram para que <strong>{organizationName}</strong>{" "}
          reciba mensajes entrantes en el CRM.
        </p>

        {statusMessage ? (
          <p className={`text-sm ${statusIsError ? "text-destructive" : "text-emerald-600"}`}>
            {statusMessage}
          </p>
        ) : null}

        {instagramConnection ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
            <p className="text-sm font-medium">
              Conectada:{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                {instagramConnection.instagram_username
                  ? `@${instagramConnection.instagram_username}`
                  : instagramConnection.instagram_user_id}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Token válido hasta: {formatDate(instagramConnection.token_expires_at)}
            </p>
            <form action="/api/auth/instagram/disconnect" method="post">
              <Button type="submit" variant="outline">
                <Unplug />
                Desconectar
              </Button>
            </form>
          </div>
        ) : (
          <Button asChild>
            <Link href="/api/auth/instagram/start">Conectar con Instagram</Link>
          </Button>
        )}
      </section>

      <form className="space-y-4" onSubmit={handleInvite} noValidate>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="size-4 text-primary" />
          Invitar asesor
        </div>
        <FieldGroup>
          <Field data-invalid={Boolean(inviteForm.formState.errors.email) || undefined}>
            <FieldLabel htmlFor="advisor-email">Correo del asesor</FieldLabel>
            <Input
              id="advisor-email"
              type="email"
              placeholder="asesor@empresa.com"
              aria-invalid={Boolean(inviteForm.formState.errors.email)}
              {...inviteForm.register("email")}
            />
            <FieldError>{inviteForm.formState.errors.email?.message}</FieldError>
          </Field>
        </FieldGroup>
        {inviteMessage ? (
          <p className={`text-sm ${inviteError ? "text-destructive" : "text-emerald-600"}`}>
            {inviteMessage}
          </p>
        ) : null}
        <Button disabled={inviteForm.formState.isSubmitting} type="submit" variant="outline">
          {inviteForm.formState.isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Guardando...
            </>
          ) : (
            "Invitar asesor"
          )}
        </Button>
      </form>
    </div>
  );
};
