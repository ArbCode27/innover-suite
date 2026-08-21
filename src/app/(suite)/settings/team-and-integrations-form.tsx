"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Loader2, MessageCircle, Unplug, UserPlus } from "lucide-react";
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
  messengerConnections: Array<{
    external_account_id: string;
    display_name: string | null;
    updated_at: string;
  }>;
  googleCalendarConnection: {
    email: string | null;
    google_calendar_id: string;
    token_expires_at: string | null;
    connected_at: string;
  } | null;
};

const INSTAGRAM_STATUS_LABELS: Record<string, string> = {
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

const GOOGLE_STATUS_LABELS: Record<string, string> = {
  connected: "Google Calendar conectado correctamente.",
  cancelled: "Conexión de Google Calendar cancelada por el usuario.",
  invalid_callback: "Google devolvió un callback incompleto. Inténtalo de nuevo.",
  invalid_state: "La sesión de conexión de Google expiró o no es válida. Reintenta desde el panel.",
  token_exchange_failed: "No se pudo completar el intercambio de token con Google.",
  profile_failed: "Se autorizó Google, pero no se pudo leer la cuenta vinculada.",
  missing_refresh_token: "Google no devolvió un token de renovación. Vuelve a conectar y acepta los permisos.",
  persist_failed: "Se conectó Google Calendar, pero no se pudo guardar la conexión en el CRM.",
  disconnect_failed: "No se pudo desconectar Google Calendar en este intento.",
  disconnected: "Google Calendar desconectado correctamente.",
  missing_env: "Faltan variables de entorno para OAuth de Google Calendar.",
  state_error: "No se pudo iniciar el flujo OAuth de Google Calendar.",
  auth_required: "Tu sesión expiró. Inicia sesión nuevamente para conectar Google Calendar.",
  forbidden: "No tienes permisos para gestionar Google Calendar.",
};

const MESSENGER_STATUS_LABELS: Record<string, string> = {
  connected: "Messenger conectado correctamente.",
  cancelled: "Conexión de Messenger cancelada por el usuario.",
  invalid_callback: "Facebook devolvió un callback incompleto. Inténtalo de nuevo.",
  invalid_state: "La sesión de conexión de Messenger expiró o no es válida. Reintenta desde el panel.",
  token_exchange_failed: "No se pudo completar el intercambio de token con Facebook.",
  long_token_failed: "No se pudo generar el token de larga duración de Facebook.",
  pages_fetch_failed: "No se pudieron obtener las páginas de Facebook autorizadas.",
  no_pages: "No se encontró ninguna página de Facebook autorizada para conectar.",
  subscription_failed: "No se pudo suscribir la página al webhook de Messenger.",
  persist_failed: "Se conectó Messenger, pero no se pudo guardar la conexión en el CRM.",
  disconnect_failed: "No se pudo desconectar Messenger en este intento.",
  disconnected: "Messenger desconectado correctamente.",
  missing_env: "Faltan variables de entorno para OAuth de Messenger.",
  state_error: "No se pudo iniciar el flujo OAuth de Messenger.",
  auth_required: "Tu sesión expiró. Inicia sesión nuevamente para conectar Messenger.",
  forbidden: "No tienes permisos para gestionar integraciones de Messenger.",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
  }).format(new Date(value));

export const TeamAndIntegrationsForm = ({
  instagramConnection,
  messengerConnections,
  googleCalendarConnection,
  organizationName,
}: TeamAndIntegrationsFormProps) => {
  const searchParams = useSearchParams();
  const igStatus = searchParams.get("ig");
  const messengerStatus = searchParams.get("ms");
  const googleStatus = searchParams.get("gc");
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
  const instagramStatusMessage = igStatus ? INSTAGRAM_STATUS_LABELS[igStatus] : null;
  const instagramStatusIsError = Boolean(
    igStatus &&
      !["connected", "disconnected"].includes(igStatus),
  );
  const messengerStatusMessage = messengerStatus ? MESSENGER_STATUS_LABELS[messengerStatus] : null;
  const messengerStatusIsError = Boolean(
    messengerStatus &&
      !["connected", "disconnected"].includes(messengerStatus),
  );
  const googleStatusMessage = googleStatus ? GOOGLE_STATUS_LABELS[googleStatus] : null;
  const googleStatusIsError = Boolean(
    googleStatus && !["connected", "disconnected"].includes(googleStatus),
  );
  const hasMessengerConnections = messengerConnections.length > 0;

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

        {instagramStatusMessage ? (
          <p className={`text-sm ${instagramStatusIsError ? "text-destructive" : "text-emerald-600"}`}>
            {instagramStatusMessage}
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

      <section className="space-y-4 rounded-xl border border-primary/15 bg-background/70 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="size-4 text-primary" />
          Integración de Messenger
        </div>
        <p className="text-sm text-muted-foreground">
          Conecta una o más páginas de Facebook para que <strong>{organizationName}</strong>{" "}
          reciba mensajes de Messenger en el CRM.
        </p>

        {messengerStatusMessage ? (
          <p className={`text-sm ${messengerStatusIsError ? "text-destructive" : "text-emerald-600"}`}>
            {messengerStatusMessage}
          </p>
        ) : null}

        {hasMessengerConnections ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
            <div className="space-y-2">
              {messengerConnections.map((connection) => (
                <div
                  key={connection.external_account_id}
                  className="rounded-lg border border-emerald-400/20 bg-background/60 p-3"
                >
                  <p className="text-sm font-medium">
                    Página conectada:{" "}
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {connection.display_name || connection.external_account_id}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Page ID: {connection.external_account_id} · Actualizada:{" "}
                    {formatDate(connection.updated_at)}
                  </p>
                </div>
              ))}
            </div>
            <form action="/api/auth/messenger/disconnect" method="post">
              <Button type="submit" variant="outline">
                <Unplug />
                Desconectar Messenger
              </Button>
            </form>
          </div>
        ) : (
          <Button asChild>
            <Link href="/api/auth/messenger/start">Conectar Messenger</Link>
          </Button>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-primary/15 bg-background/70 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary" />
          Integración de Google Calendar
        </div>
        <p className="text-sm text-muted-foreground">
          Conecta el calendario de <strong>{organizationName}</strong> para crear citas desde el CRM
          e invitar a los contactos.
        </p>

        {googleStatusMessage ? (
          <p className={`text-sm ${googleStatusIsError ? "text-destructive" : "text-emerald-600"}`}>
            {googleStatusMessage}
          </p>
        ) : null}

        {googleCalendarConnection ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3">
            <p className="text-sm font-medium">
              Conectado:{" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                {googleCalendarConnection.email || "Google Calendar"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Calendario: {googleCalendarConnection.google_calendar_id} · Vinculado:{" "}
              {formatDate(googleCalendarConnection.connected_at)}
            </p>
            {googleCalendarConnection.token_expires_at ? (
              <p className="text-xs text-muted-foreground">
                Token válido hasta: {formatDate(googleCalendarConnection.token_expires_at)}
              </p>
            ) : null}
            <form action="/api/auth/google/disconnect" method="post">
              <Button type="submit" variant="outline">
                <Unplug />
                Desconectar
              </Button>
            </form>
          </div>
        ) : (
          <Button asChild>
            <Link href="/api/auth/google/start">Conectar Google Calendar</Link>
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
