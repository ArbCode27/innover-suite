"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, MessageCircle, MessagesSquare } from "lucide-react";
import { WhatsAppConnectButton } from "@/app/(suite)/settings/whatsapp-connect-button";
import { WhatsAppManualConnectForm } from "@/app/(suite)/settings/whatsapp-manual-connect-form";
import { oauthStartHref } from "@/lib/integrations/oauth-href";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const INSTAGRAM_STATUS_LABELS: Record<string, string> = {
  connected: "Instagram conectado correctamente.",
  cancelled: "Conexión de Instagram cancelada.",
  invalid_callback: "Instagram devolvió un callback incompleto.",
  invalid_state: "La sesión expiró. Inténtalo de nuevo.",
  token_exchange_failed: "No se pudo completar el intercambio de token.",
  long_token_failed: "No se pudo generar el token de larga duración.",
  persist_failed: "Se conectó, pero no se pudo guardar.",
  missing_env: "Faltan variables de entorno para Instagram.",
  state_error: "No se pudo iniciar el flujo de Instagram.",
  auth_required: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para conectar Instagram.",
};

const MESSENGER_STATUS_LABELS: Record<string, string> = {
  connected: "Messenger conectado correctamente.",
  cancelled: "Conexión de Messenger cancelada.",
  invalid_callback: "Facebook devolvió un callback incompleto.",
  invalid_state: "La sesión expiró. Inténtalo de nuevo.",
  token_exchange_failed: "No se pudo completar el intercambio de token.",
  long_token_failed: "No se pudo generar el token de larga duración.",
  pages_fetch_failed: "No se pudieron obtener las páginas de Facebook.",
  no_pages: "No hay páginas de Facebook autorizadas.",
  subscription_failed: "No se pudo suscribir el webhook de Messenger.",
  persist_failed: "Se conectó, pero no se pudo guardar.",
  missing_env: "Faltan variables de entorno para Messenger.",
  state_error: "No se pudo iniciar el flujo de Messenger.",
  auth_required: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para conectar Messenger.",
};

const WHATSAPP_STATUS_LABELS: Record<string, string> = {
  connected: "WhatsApp conectado correctamente.",
  cancelled: "Conexión de WhatsApp cancelada.",
  invalid_callback: "Facebook devolvió un callback incompleto.",
  invalid_state: "La sesión expiró. Inténtalo de nuevo.",
  token_exchange_failed: "No se pudo completar el intercambio de token.",
  no_numbers: "No hay números de WhatsApp autorizados.",
  subscription_failed: "No se pudo suscribir el webhook.",
  persist_failed: "Se autorizó, pero no se pudo guardar.",
  missing_env: "Faltan variables de entorno para WhatsApp.",
  state_error: "No se pudo iniciar el flujo de WhatsApp.",
  auth_required: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para conectar WhatsApp.",
  sdk_failed: "No se pudo cargar el SDK de Facebook.",
  login_failed: "Facebook no completó el inicio de sesión.",
  signup_failed: "El alta de WhatsApp terminó con un error en Meta.",
  invalid_token: "Meta rechazó el token de WhatsApp.",
  invalid_phone: "No se pudo leer ese Phone Number ID.",
  waba_mismatch: "Ese número no pertenece al WABA ID.",
  waba_required: "Pega el WABA ID para completar la vinculación.",
};

type ChannelPanelProps = {
  instagramConnected: boolean;
  instagramLabel: string | null;
  messengerConnected: boolean;
  whatsappConnected: boolean;
};

const ChannelCard = ({
  title,
  description,
  connected,
  statusMessage,
  isError,
  children,
}: {
  title: string;
  description: string;
  connected: boolean;
  statusMessage: string | null;
  isError: boolean;
  children: ReactNode;
}) => (
  <div className={`rounded-xl border border-primary/15 p-4 ${connected ? "ring-1 ring-emerald-400/30" : ""}`}>
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant={connected ? "default" : "outline"}>{connected ? "Conectado" : "Sin conectar"}</Badge>
    </div>
    {statusMessage ? (
      <p className={`mb-3 text-sm ${isError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
        {statusMessage}
      </p>
    ) : null}
    {children}
  </div>
);

export const ChannelPanel = ({
  instagramConnected,
  instagramLabel,
  messengerConnected,
  whatsappConnected,
}: ChannelPanelProps) => {
  const searchParams = useSearchParams();
  const igStatus = searchParams.get("ig");
  const messengerStatus = searchParams.get("ms");
  const whatsappStatus = searchParams.get("wa");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conecta al menos un canal para que lleguen chats. Si lo saltas, la IA no recibirá mensajes hasta que lo hagas en
        Ajustes.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelCard
          title="WhatsApp"
          description="Número de WhatsApp Business."
          connected={whatsappConnected}
          statusMessage={whatsappStatus ? WHATSAPP_STATUS_LABELS[whatsappStatus] : null}
          isError={Boolean(whatsappStatus && !["connected", "disconnected"].includes(whatsappStatus))}
        >
          {whatsappConnected ? (
            <p className="flex items-center gap-2 text-sm">
              <MessageCircle className="size-4 text-primary" aria-hidden />
              Cuenta conectada
            </p>
          ) : (
            <div className="space-y-3">
              <WhatsAppConnectButton returnPath="/onboarding/setup?step=channel" />
              <WhatsAppManualConnectForm />
            </div>
          )}
        </ChannelCard>

        <ChannelCard
          title="Instagram"
          description="Mensajes directos en el inbox."
          connected={instagramConnected}
          statusMessage={igStatus ? INSTAGRAM_STATUS_LABELS[igStatus] : null}
          isError={Boolean(igStatus && !["connected", "disconnected"].includes(igStatus))}
        >
          {instagramConnected ? (
            <p className="flex items-center gap-2 text-sm">
              <Camera className="size-4 text-primary" aria-hidden />
              {instagramLabel || "Cuenta conectada"}
            </p>
          ) : (
            <Button asChild className="w-full">
              <Link href={oauthStartHref("/api/auth/instagram/start", "channel")}>Conectar Instagram</Link>
            </Button>
          )}
        </ChannelCard>

        <ChannelCard
          title="Messenger"
          description="Páginas de Facebook."
          connected={messengerConnected}
          statusMessage={messengerStatus ? MESSENGER_STATUS_LABELS[messengerStatus] : null}
          isError={Boolean(messengerStatus && !["connected", "disconnected"].includes(messengerStatus))}
        >
          {messengerConnected ? (
            <p className="flex items-center gap-2 text-sm">
              <MessagesSquare className="size-4 text-primary" aria-hidden />
              Página conectada
            </p>
          ) : (
            <Button asChild className="w-full">
              <Link href={oauthStartHref("/api/auth/messenger/start", "channel")}>Conectar Messenger</Link>
            </Button>
          )}
        </ChannelCard>
      </div>
    </div>
  );
};
