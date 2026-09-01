import { Suspense } from "react";
import { TeamAndIntegrationsForm } from "./team-and-integrations-form";
import { AgentSettingsForm } from "./agent-settings-form";
import { LeadRecoveryForm } from "./lead-recovery-form";
import { OfficeHoursForm } from "./office-hours-form";
import { ModulesSettingsForm } from "./modules-settings-form";
import { CurrencySettingsForm } from "./currency-settings-form";
import { BrowserNotificationsCard } from "./browser-notifications-card";
import { SecuritySettingsForm } from "./security-settings-form";
import { loadCurrentMemberSession, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ModuleShell } from "@/components/suite/module-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { loadAgentSettings, loadKnowledgeArticles } from "@/lib/agent/settings";
import { env } from "@/lib/config/env";
import { loadCachedOrganizationModules } from "@/lib/modules/settings";
import { loadOrganizationCurrencies } from "@/lib/organizations/currencies";
import { loadOrganizationFunnelStages } from "@/lib/funnels/board";
import { DEFAULT_TAX_RATE } from "@/lib/commerce/types";
import { getWhatsAppOAuthRedirectUri } from "@/lib/integrations/whatsapp";

export default async function SettingsPage() {
  const { membership } = await loadCurrentMemberSession();
  const canManageOrganization = hasOrganizationRole(membership, ["owner", "admin"]);
  const supabase = await createSupabaseServerClient();

  if (!membership) {
    return (
      <ModuleShell title="Configuración del CRM" description="Crea una organización para conectar canales." eyebrow="Integraciones">
        <p className="text-sm text-muted-foreground">No hay organización activa.</p>
      </ModuleShell>
    );
  }

  const [
    instagramConnection,
    messengerConnections,
    whatsappConnections,
    googleCalendarConnection,
    agentSettings,
    modules,
    currencies,
    articles,
    funnelStages,
    orgBillingResult,
  ] = await Promise.all([
    supabase
      .from("instagram_connections")
      .select("instagram_user_id, instagram_username, token_expires_at")
      .eq("organization_id", membership.organizationId)
      .is("revoked_at", null)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("channel_accounts")
      .select("external_account_id, display_name, updated_at")
      .eq("organization_id", membership.organizationId)
      .eq("channel", "messenger")
      .order("updated_at", { ascending: false }),
    supabase
      .from("channel_accounts")
      .select("external_account_id, display_name, updated_at, metadata")
      .eq("organization_id", membership.organizationId)
      .eq("channel", "whatsapp")
      .order("updated_at", { ascending: false }),
    supabase
      .from("calendar_connections")
      .select("email, google_calendar_id, token_expires_at, connected_at")
      .eq("organization_id", membership.organizationId)
      .eq("provider", "google")
      .is("revoked_at", null)
      .maybeSingle(),
    loadAgentSettings(membership.organizationId),
    loadCachedOrganizationModules(membership.organizationId),
    loadOrganizationCurrencies(supabase, membership.organizationId),
    loadKnowledgeArticles(membership.organizationId, false),
    loadOrganizationFunnelStages(supabase, membership.organizationId),
    supabase
      .from("organizations")
      .select("plan, tax_rate")
      .eq("id", membership.organizationId)
      .maybeSingle(),
  ]);

  const orgBilling = orgBillingResult.data;

  const connectedCount = [
    Boolean(instagramConnection.data),
    Boolean(messengerConnections.data?.length),
    Boolean(whatsappConnections.data?.length),
    Boolean(googleCalendarConnection.data),
  ].filter(Boolean).length;

  return (
    <ModuleShell
      title="Configuración del CRM"
      description={`Conecta canales, define las funciones del negocio, calendario, agente IA y equipo para ${membership?.organizationName || "tu organización"}. ${connectedCount} de 4 integraciones activas.`}
      eyebrow="Integraciones"
    >
      <div className="space-y-8">
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          }
        >
          <TeamAndIntegrationsForm
            canManageOrganization={canManageOrganization}
            instagramConnection={instagramConnection.data}
            messengerConnections={messengerConnections.data ?? []}
            whatsappConnections={whatsappConnections.data ?? []}
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
            whatsappOAuthRedirectUri={getWhatsAppOAuthRedirectUri()}
          />
        </Suspense>
        <BrowserNotificationsCard />
        <ModulesSettingsForm canManageOrganization={canManageOrganization} modules={modules} />
        <CurrencySettingsForm canManageOrganization={canManageOrganization} currencies={currencies} />
        <AgentSettingsForm
          canManageOrganization={canManageOrganization}
          settings={agentSettings}
          modules={modules}
          geminiConfigured={Boolean(env.geminiApiKey)}
          articles={articles}
        />
        <LeadRecoveryForm
          canManageOrganization={canManageOrganization}
          settings={agentSettings}
          funnelEnabled={Boolean(modules.funnels)}
          stages={funnelStages}
        />
        <OfficeHoursForm
          canManageOrganization={canManageOrganization}
          businessHours={agentSettings.businessHours}
          closedMessage={agentSettings.closedMessage}
        />
        <SecuritySettingsForm />
        {orgBilling ? (
          <p className="text-sm text-muted-foreground">
            Plan {orgBilling.plan || "starter"} · IVA {Math.round(Number(orgBilling.tax_rate ?? DEFAULT_TAX_RATE) * 100)}%. El cobro de
            suscripción no está conectado; el IVA se aplica solo en el ticket.
          </p>
        ) : null}
      </div>
    </ModuleShell>
  );
}
