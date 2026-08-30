"use client";

import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Camera, Loader2, MessageCircle, MessagesSquare, Unplug, UserPlus } from "lucide-react";
import { WhatsAppConnectButton } from "./whatsapp-connect-button";
import { inviteAdvisorAction } from "@/lib/organizations/actions";
import { CopyableText } from "@/components/auth/copyable-text";
import { redirectIfSessionExpired } from "@/lib/auth/session-client";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const inviteSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  role: z.enum(["admin", "agent", "viewer", "kitchen", "cashier"]),
});

type InviteValues = z.infer<typeof inviteSchema>;

type TeamAndIntegrationsFormProps = {
  organizationName: string;
  canManageOrganization: boolean;
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
  whatsappConnections: Array<{
    external_account_id: string;
    display_name: string | null;
    updated_at: string;
    metadata: unknown;
  }>;
  googleCalendarConnection: {
    email: string | null;
    google_calendar_id: string;
    token_expires_at: string | null;
    connected_at: string;
  } | null;
  whatsappOAuthRedirectUri: string;
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

const WHATSAPP_STATUS_LABELS: Record<string, string> = {
  connected: "WhatsApp conectado correctamente.",
  cancelled: "Conexión de WhatsApp cancelada por el usuario.",
  invalid_callback: "Facebook devolvió un callback incompleto. Inténtalo de nuevo.",
  invalid_state: "La sesión de conexión de WhatsApp expiró o no es válida. Reintenta desde el panel.",
  token_exchange_failed: "No se pudo completar el intercambio de token de WhatsApp.",
  no_numbers: "No se encontró ningún número de WhatsApp autorizado para conectar.",
  subscription_failed: "Se guardó el número, pero no se pudo suscribir el webhook de WhatsApp.",
  persist_failed: "Se autorizó WhatsApp, pero no se pudo guardar la conexión en el CRM.",
  disconnect_failed: "No se pudo desconectar WhatsApp en este intento.",
  disconnected: "WhatsApp desconectado correctamente.",
  missing_env: "Faltan variables de entorno para WhatsApp Embedded Signup.",
  state_error: "No se pudo iniciar el flujo de WhatsApp en este momento.",
  auth_required: "Tu sesión expiró. Inicia sesión nuevamente para conectar WhatsApp.",
  forbidden: "No tienes permisos para gestionar integraciones de WhatsApp.",
  sdk_failed: "No se pudo cargar el SDK de Facebook. Revisa el bloqueo de scripts e inténtalo de nuevo.",
  login_failed: "Facebook no completó el inicio de sesión de WhatsApp.",
  signup_failed: "El alta de WhatsApp terminó con un error en Meta.",
};

const readWhatsAppMetadata = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return { displayPhoneNumber: null as string | null, qualityRating: null as string | null };
  }

  const record = value as Record<string, unknown>;
  return {
    displayPhoneNumber: typeof record.displayPhoneNumber === "string" ? record.displayPhoneNumber : null,
    qualityRating: typeof record.qualityRating === "string" ? record.qualityRating : null,
  };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
  }).format(new Date(value));

const StatusMessage = ({ message, isError }: { message: string | null; isError: boolean }) => {
  if (!message) return null;

  return (
    <p className={`text-sm ${isError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
      {message}
    </p>
  );
};

const IntegrationCard = ({
  id,
  icon: Icon,
  title,
  description,
  connected,
  statusMessage,
  statusIsError,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  connected: boolean;
  statusMessage: string | null;
  statusIsError: boolean;
  children: ReactNode;
}) => (
  <Card
    id={id}
    className={`border-primary/15 bg-card/80 ${connected ? "ring-1 ring-emerald-400/30" : ""}`}
  >
    <CardHeader className="gap-3">
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <Badge variant={connected ? "default" : "outline"}>{connected ? "Conectado" : "Sin conectar"}</Badge>
      </div>
      <div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-1 leading-6">{description}</CardDescription>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <StatusMessage message={statusMessage} isError={statusIsError} />
      {children}
    </CardContent>
  </Card>
);

export const TeamAndIntegrationsForm = ({
  instagramConnection,
  messengerConnections,
  whatsappConnections,
  googleCalendarConnection,
  organizationName,
  canManageOrganization,
  whatsappOAuthRedirectUri,
}: TeamAndIntegrationsFormProps) => {
  const searchParams = useSearchParams();
  const igStatus = searchParams.get("ig");
  const messengerStatus = searchParams.get("ms");
  const whatsappStatus = searchParams.get("wa");
  const googleStatus = searchParams.get("gc");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "agent" },
  });
  const selectedRole = inviteForm.watch("role");

  const handleInvite = inviteForm.handleSubmit(async (values) => {
    setInviteMessage(null);
    setInviteUrl(null);
    const result = await inviteAdvisorAction(values);
    if (redirectIfSessionExpired(result)) return;
    const message =
      (result && "success" in result && result.success) || (result && "error" in result && result.error) || null;
    setInviteMessage(message);
    if (result && "inviteUrl" in result && result.inviteUrl) {
      setInviteUrl(result.inviteUrl);
    }
  });

  const inviteError = inviteMessage && !inviteMessage.toLowerCase().includes("lista");
  const instagramStatusMessage = igStatus ? INSTAGRAM_STATUS_LABELS[igStatus] : null;
  const instagramStatusIsError = Boolean(igStatus && !["connected", "disconnected"].includes(igStatus));
  const messengerStatusMessage = messengerStatus ? MESSENGER_STATUS_LABELS[messengerStatus] : null;
  const messengerStatusIsError = Boolean(
    messengerStatus && !["connected", "disconnected"].includes(messengerStatus),
  );
  const whatsappStatusMessage = whatsappStatus ? WHATSAPP_STATUS_LABELS[whatsappStatus] : null;
  const whatsappStatusIsError = Boolean(
    whatsappStatus && !["connected", "disconnected"].includes(whatsappStatus),
  );
  const googleStatusMessage = googleStatus ? GOOGLE_STATUS_LABELS[googleStatus] : null;
  const googleStatusIsError = Boolean(googleStatus && !["connected", "disconnected"].includes(googleStatus));
  const hasMessengerConnections = messengerConnections.length > 0;
  const hasWhatsAppConnections = whatsappConnections.length > 0;

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="integrations-heading">
        <div>
          <h2 id="integrations-heading" className="text-base font-semibold">
            Cuentas conectadas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vincula los canales de {organizationName} para recibir chats y agendar citas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <IntegrationCard
            id="instagram"
            icon={Camera}
            title="Instagram"
            description="Recibe y responde mensajes directos en el inbox."
            connected={Boolean(instagramConnection)}
            statusMessage={instagramStatusMessage}
            statusIsError={instagramStatusIsError}
          >
            {instagramConnection ? (
              <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {instagramConnection.instagram_username
                      ? `@${instagramConnection.instagram_username}`
                      : instagramConnection.instagram_user_id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Token válido hasta {formatDate(instagramConnection.token_expires_at)}
                  </p>
                </div>
                {canManageOrganization ? (
                  <form action="/api/auth/instagram/disconnect" method="post">
                    <Button type="submit" variant="outline" className="w-full">
                      <Unplug />
                      Desconectar
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : canManageOrganization ? (
              <Button asChild className="w-full">
                <Link href="/api/auth/instagram/start">Conectar Instagram</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Pide a un admin que conecte esta cuenta.</p>
            )}
          </IntegrationCard>

          <IntegrationCard
            id="messenger"
            icon={MessagesSquare}
            title="Messenger"
            description="Conecta páginas de Facebook para chats de Messenger."
            connected={hasMessengerConnections}
            statusMessage={messengerStatusMessage}
            statusIsError={messengerStatusIsError}
          >
            {hasMessengerConnections ? (
              <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                <div className="space-y-2">
                  {messengerConnections.map((connection) => (
                    <div key={connection.external_account_id}>
                      <p className="text-sm font-medium">
                        {connection.display_name || connection.external_account_id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Page ID {connection.external_account_id} · {formatDate(connection.updated_at)}
                      </p>
                    </div>
                  ))}
                </div>
                {canManageOrganization ? (
                  <form action="/api/auth/messenger/disconnect" method="post">
                    <Button type="submit" variant="outline" className="w-full">
                      <Unplug />
                      Desconectar
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : canManageOrganization ? (
              <Button asChild className="w-full">
                <Link href="/api/auth/messenger/start">Conectar Messenger</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Pide a un admin que conecte esta cuenta.</p>
            )}
          </IntegrationCard>

          <IntegrationCard
            id="whatsapp"
            icon={MessageCircle}
            title="WhatsApp"
            description="Conecta el número de WhatsApp Business para chats en el inbox."
            connected={hasWhatsAppConnections}
            statusMessage={whatsappStatusMessage}
            statusIsError={whatsappStatusIsError}
          >
            {hasWhatsAppConnections ? (
              <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                <div className="space-y-2">
                  {whatsappConnections.map((connection) => {
                    const metadata = readWhatsAppMetadata(connection.metadata);
                    return (
                      <div key={connection.external_account_id}>
                        <p className="text-sm font-medium">
                          {connection.display_name || metadata.displayPhoneNumber || "WhatsApp"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {metadata.displayPhoneNumber || `ID ${connection.external_account_id}`}
                          {metadata.qualityRating ? ` · calidad ${metadata.qualityRating}` : ""} ·{" "}
                          {formatDate(connection.updated_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {canManageOrganization ? (
                  <form action="/api/auth/whatsapp/disconnect" method="post">
                    <Button type="submit" variant="outline" className="w-full">
                      <Unplug />
                      Desconectar
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : canManageOrganization ? (
              <WhatsAppConnectButton />
            ) : (
              <p className="text-sm text-muted-foreground">Pide a un admin que conecte WhatsApp.</p>
            )}
          </IntegrationCard>

          <IntegrationCard
            id="google-calendar"
            icon={CalendarDays}
            title="Google Calendar"
            description="Crea citas del CRM en el calendario de la organización."
            connected={Boolean(googleCalendarConnection)}
            statusMessage={googleStatusMessage}
            statusIsError={googleStatusIsError}
          >
            {googleCalendarConnection ? (
              <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
                <div>
                  <p className="text-sm font-medium">{googleCalendarConnection.email || "Google Calendar"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {googleCalendarConnection.google_calendar_id} · vinculado{" "}
                    {formatDate(googleCalendarConnection.connected_at)}
                  </p>
                </div>
                {canManageOrganization ? (
                  <form action="/api/auth/google/disconnect" method="post">
                    <Button type="submit" variant="outline" className="w-full">
                      <Unplug />
                      Desconectar
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : canManageOrganization ? (
              <Button asChild className="w-full">
                <Link href="/api/auth/google/start">Conectar Google Calendar</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Pide a un admin que conecte el calendario.</p>
            )}
          </IntegrationCard>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" aria-labelledby="team-heading">
        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="size-4" aria-hidden />
              </span>
              <div>
                <CardTitle id="team-heading">Equipo</CardTitle>
                <CardDescription>Invita asesores para atender conversaciones y oportunidades.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {canManageOrganization ? (
              <form className="space-y-4" onSubmit={handleInvite} noValidate>
                <FieldGroup>
                  <Field data-invalid={Boolean(inviteForm.formState.errors.email) || undefined}>
                    <FieldLabel htmlFor="advisor-email">Correo del asesor</FieldLabel>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="advisor-email"
                        type="email"
                        placeholder="asesor@empresa.com"
                        aria-invalid={Boolean(inviteForm.formState.errors.email)}
                        className="sm:flex-1"
                        {...inviteForm.register("email")}
                      />
                      <AppSelect
                        aria-label="Rol"
                        className="sm:w-36 sm:shrink-0"
                        value={selectedRole}
                        onValueChange={(value) => inviteForm.setValue("role", value as InviteValues["role"])}
                        options={[
                          { value: "agent", label: "Asesor" },
                          { value: "admin", label: "Admin" },
                          { value: "viewer", label: "Viewer" },
                          { value: "kitchen", label: "Cocina" },
                          { value: "cashier", label: "Caja" },
                        ]}
                      />
                      <Button disabled={inviteForm.formState.isSubmitting} type="submit">
                        {inviteForm.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
                        Invitar
                      </Button>
                    </div>
                    <FieldError>{inviteForm.formState.errors.email?.message}</FieldError>
                  </Field>
                </FieldGroup>
                {inviteMessage ? (
                  <p className={`text-sm ${inviteError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {inviteMessage}
                  </p>
                ) : null}
                {inviteUrl ? (
                  <CopyableText value={inviteUrl} label="Copiar" successMessage="Enlace de invitación copiado" />
                ) : null}
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Solo owner o admin pueden invitar asesores y gestionar integraciones.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/80">
          <CardHeader>
            <CardTitle>Webhooks de Meta</CardTitle>
            <CardDescription>
              Úsalos en Meta Developers para recibir mensajes y, en el registro insertado de WhatsApp, como URI de
              redirección.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Messenger e Instagram</p>
              <CopyableText
                className="mt-1"
                value="/api/webhooks/meta/social"
                label="Copiar"
                successMessage="Ruta de webhook copiada"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">WhatsApp Cloud API</p>
              <CopyableText
                className="mt-1"
                value="/api/webhooks/meta/whatsapp"
                label="Copiar"
                successMessage="Ruta de webhook copiada"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Registro insertado de WhatsApp (URI de redirección)</p>
              <CopyableText
                className="mt-1"
                value={whatsappOAuthRedirectUri}
                label="Copiar"
                successMessage="URI de redirección copiada"
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
