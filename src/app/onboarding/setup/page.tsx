import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SetupWizard } from "./setup-wizard";
import { loadAgentSettings } from "@/lib/agent/settings";
import { env } from "@/lib/config/env";
import { getBusinessTemplate, isBusinessTemplateId } from "@/lib/modules/constants";
import { loadOrganizationModules } from "@/lib/modules/settings";
import {
  buildSetupSteps,
  loadOnboardingCompletedAt,
  resolveSetupStep,
  type OnboardingProgress,
} from "@/lib/onboarding/progress";
import { canManageOrganization, getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Configura tu CRM | Innover Suite",
  description: "Completa la configuración inicial de tu organización.",
};

type OnboardingSetupPageProps = {
  searchParams: Promise<{ step?: string }>;
};

const SetupWizardFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <p className="text-sm text-muted-foreground">Cargando configuración…</p>
  </div>
);

export default async function OnboardingSetupPage({ searchParams }: OnboardingSetupPageProps) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");
  if (!canManageOrganization(membership)) redirect("/home");

  const completedAt = await loadOnboardingCompletedAt(membership.organizationId);
  if (completedAt) redirect("/home");

  const { step: requestedStep } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const modules = await loadOrganizationModules(supabase, membership.organizationId);

  const [
    orgResult,
    instagramResult,
    messengerResult,
    whatsappResult,
    googleResult,
    agentSettings,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("business_template")
      .eq("id", membership.organizationId)
      .maybeSingle(),
    supabase
      .from("instagram_connections")
      .select("instagram_username, instagram_user_id")
      .eq("organization_id", membership.organizationId)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("channel_accounts")
      .select("id")
      .eq("organization_id", membership.organizationId)
      .eq("channel", "messenger")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("channel_accounts")
      .select("id")
      .eq("organization_id", membership.organizationId)
      .eq("channel", "whatsapp")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("calendar_connections")
      .select("email")
      .eq("organization_id", membership.organizationId)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle(),
    loadAgentSettings(membership.organizationId),
  ]);

  const templateId =
    typeof orgResult.data?.business_template === "string" && isBusinessTemplateId(orgResult.data.business_template)
      ? orgResult.data.business_template
      : null;
  const template = templateId ? getBusinessTemplate(templateId) : null;

  const instagramConnected = Boolean(instagramResult.data);
  const messengerConnected = Boolean(messengerResult.data);
  const whatsappConnected = Boolean(whatsappResult.data);
  const hasChannel = instagramConnected || messengerConnected || whatsappConnected;

  const progress: OnboardingProgress = {
    organizationName: membership.organizationName,
    templateLabel: template?.label ?? null,
    modules,
    hasCalendar: Boolean(googleResult.data),
    hasChannel,
    agentReady: agentSettings.systemPrompt.trim().length >= 40,
  };

  const steps = buildSetupSteps(progress);
  const currentStep = resolveSetupStep(steps, requestedStep);

  return (
    <Suspense fallback={<SetupWizardFallback />}>
      <SetupWizard
        steps={steps}
        currentStep={currentStep}
        progress={progress}
        agentSettings={agentSettings}
        geminiConfigured={Boolean(env.geminiApiKey)}
        calendarEmail={googleResult.data?.email ?? null}
        instagramLabel={
          instagramResult.data?.instagram_username
            ? `@${instagramResult.data.instagram_username}`
            : instagramResult.data?.instagram_user_id ?? null
        }
        instagramConnected={instagramConnected}
        messengerConnected={messengerConnected}
        whatsappConnected={whatsappConnected}
      />
    </Suspense>
  );
}
