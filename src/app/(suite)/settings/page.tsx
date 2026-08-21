import { Bot, CalendarDays, KeyRound, MessageCircle, Settings2, ShieldCheck } from "lucide-react";
import { TeamAndIntegrationsForm } from "./team-and-integrations-form";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ModuleShell } from "@/components/suite/module-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settingsGroups = [
  {
    title: "Meta y WhatsApp",
    description: "Webhook, token de acceso y número conectado para recibir conversaciones.",
    status: "Pendiente",
    icon: MessageCircle,
  },
  {
    title: "IA y handoff",
    description: "Reglas de respuesta automática, escalamiento humano y horarios de atención.",
    status: "Base",
    icon: Bot,
  },
  {
    title: "Google Calendar",
    description: "Sincronización de citas, disponibilidad y confirmaciones desde chat.",
    status: "Pendiente",
    icon: CalendarDays,
  },
  {
    title: "Seguridad",
    description: "Roles, sesiones, trazabilidad y permisos por organización.",
    status: "Activo",
    icon: ShieldCheck,
  },
];

export default async function SettingsPage() {
  const membership = await getCurrentMembership();
  const canManageOrganization = hasOrganizationRole(membership, ["owner", "admin"]);
  const supabase = await createSupabaseServerClient();
  const instagramConnection = membership
    ? await supabase
        .from("instagram_connections")
        .select("instagram_user_id, instagram_username, token_expires_at")
        .eq("organization_id", membership.organizationId)
        .is("revoked_at", null)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  const messengerConnections = membership
    ? await supabase
        .from("channel_accounts")
        .select("external_account_id, display_name, updated_at")
        .eq("organization_id", membership.organizationId)
        .eq("channel", "messenger")
        .order("updated_at", { ascending: false })
    : { data: null, error: null };
  const googleCalendarConnection = membership
    ? await supabase
        .from("calendar_connections")
        .select("email, google_calendar_id, token_expires_at, connected_at")
        .eq("organization_id", membership.organizationId)
        .eq("provider", "google")
        .is("revoked_at", null)
        .maybeSingle()
    : { data: null, error: null };

  const googleCalendarStatus = googleCalendarConnection.data ? "Activo" : "Pendiente";

  return (
    <ModuleShell
      title="Configuración del CRM"
      description="Gestiona integraciones, reglas de IA, seguridad y datos de operación para activar el CRM."
      eyebrow="Centro de control"
      actions={
        <Button type="button">
          <KeyRound />
          Revisar credenciales
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-4 md:grid-cols-2">
          {settingsGroups.map((group) => (
            <Card key={group.title} className="border-primary/15 bg-card/70">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <group.icon className="size-5" />
                </span>
                <Badge variant="outline">
                  {group.title === "Google Calendar" ? googleCalendarStatus : group.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <CardTitle>{group.title}</CardTitle>
                <CardDescription className="mt-2 leading-6">
                  {group.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/15 bg-card/70">
          <CardHeader>
            <Badge className="w-fit" variant="outline">
              Paso principal
            </Badge>
            <CardTitle>Vincular Meta Business</CardTitle>
            <CardDescription>
              Esta conexión desbloquea chats, contactos, embudos y reservas
              nacidas desde conversaciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {["Validar webhook", "Configurar token", "Seleccionar número"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/8 p-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
            <div className="rounded-xl border border-primary/15 bg-muted/40 p-4">
              {canManageOrganization ? (
                <TeamAndIntegrationsForm
                  instagramConnection={instagramConnection.data}
                  messengerConnections={messengerConnections.data ?? []}
                  googleCalendarConnection={
                    googleCalendarConnection.data
                      ? {
                          email: googleCalendarConnection.data.email,
                          google_calendar_id: googleCalendarConnection.data.google_calendar_id || "primary",
                          token_expires_at: googleCalendarConnection.data.token_expires_at,
                          connected_at: googleCalendarConnection.data.connected_at,
                        }
                      : null
                  }
                  organizationName={membership?.organizationName || "Organización"}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Solo owner/admin pueden invitar asesores y vincular Instagram, Messenger o Google Calendar.
                </p>
              )}
            </div>
            <div className="space-y-3 rounded-xl border border-dashed border-primary/30 p-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Messenger e Instagram</p>
                <code className="mt-1 block break-all text-xs">/api/webhooks/meta/social</code>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">WhatsApp Cloud API</p>
                <code className="mt-1 block break-all text-xs">/api/webhooks/meta/whatsapp</code>
              </div>
            </div>
            <Button className="w-full" type="button" variant="outline">
              <Settings2 />
              Configurar integración
            </Button>
          </CardContent>
        </Card>
      </div>
    </ModuleShell>
  );
}
