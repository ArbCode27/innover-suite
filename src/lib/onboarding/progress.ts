import { cache } from "react";
import type { OrganizationModules } from "@/lib/modules/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const SETUP_STEP_IDS = [
  "modules",
  "calendar",
  "agent",
  "channel",
  "review",
] as const;

export type SetupStepId = (typeof SETUP_STEP_IDS)[number];

export type SetupStepDefinition = {
  id: SetupStepId;
  title: string;
  description: string;
  done: boolean;
  optional: boolean;
};

export type OnboardingProgress = {
  organizationName: string;
  templateLabel: string | null;
  modules: OrganizationModules;
  hasCalendar: boolean;
  hasChannel: boolean;
  agentReady: boolean;
};

export const isSetupStepId = (value: string | null | undefined): value is SetupStepId =>
  Boolean(value && SETUP_STEP_IDS.includes(value as SetupStepId));

export const loadOnboardingCompletedAt = cache(async (organizationId: number) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("onboarding_completed_at")
    .eq("id", organizationId)
    .maybeSingle();

  return typeof data?.onboarding_completed_at === "string" ? data.onboarding_completed_at : null;
});

export const buildSetupSteps = (progress: OnboardingProgress): SetupStepDefinition[] => {
  const steps: SetupStepDefinition[] = [
    {
      id: "modules",
      title: "Funciones del CRM",
      description: "Activa catálogo, calendario, embudos y el resto de módulos que usa el negocio.",
      done: true,
      optional: false,
    },
  ];

  if (progress.modules.calendar) {
    steps.push({
      id: "calendar",
      title: "Calendario",
      description: "Conecta Google Calendar para que la IA pueda agendar.",
      done: progress.hasCalendar,
      optional: true,
    });
  }

  steps.push({
    id: "agent",
    title: "Agente IA",
    description: "Revisa el prompt adaptado a tu negocio.",
    done: progress.agentReady,
    optional: true,
  });

  steps.push({
    id: "channel",
    title: "Canal de chat",
    description: "Conecta WhatsApp, Instagram o Messenger para recibir leads.",
    done: progress.hasChannel,
    optional: true,
  });

  steps.push({
    id: "review",
    title: "Listo",
    description: "Revisa lo configurado y entra al CRM.",
    done: false,
    optional: false,
  });

  return steps;
};

export const resolveSetupStep = (steps: SetupStepDefinition[], requested?: string | null): SetupStepId => {
  if (isSetupStepId(requested) && steps.some((step) => step.id === requested)) {
    return requested;
  }

  return steps[0]?.id ?? "review";
};
