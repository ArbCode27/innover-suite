"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2, LogOut } from "lucide-react";
import { CalendarPanel } from "./calendar-panel";
import { ModulesPanel } from "./modules-panel";
import { AgentPanel } from "./agent-panel";
import { ChannelPanel } from "./channel-panel";
import { ReviewPanel } from "./review-panel";
import { completeOnboardingAction } from "@/lib/organizations/actions";
import { signOut } from "@/lib/auth/actions";
import type { AgentSettings } from "@/lib/agent/types";
import type { OnboardingProgress, SetupStepDefinition, SetupStepId } from "@/lib/onboarding/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SetupWizardProps = {
  steps: SetupStepDefinition[];
  currentStep: SetupStepId;
  progress: OnboardingProgress;
  agentSettings: AgentSettings;
  geminiConfigured: boolean;
  calendarEmail: string | null;
  instagramLabel: string | null;
  instagramConnected: boolean;
  messengerConnected: boolean;
  whatsappConnected: boolean;
};

export const SetupWizard = ({
  steps,
  currentStep,
  progress,
  agentSettings,
  geminiConfigured,
  calendarEmail,
  instagramLabel,
  instagramConnected,
  messengerConnected,
  whatsappConnected,
}: SetupWizardProps) => {
  const router = useRouter();
  const [isFinishing, startFinish] = useTransition();
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const current = steps[currentIndex] ?? steps[0];
  const completedCount = steps.filter((step) => step.done && step.id !== "review").length;
  const totalCountable = steps.filter((step) => step.id !== "review").length;
  const isLast = current.id === "review";

  const handleGoToStep = (id: SetupStepId) => {
    router.replace(`/onboarding/setup?step=${id}`, { scroll: false });
  };

  const handleBack = () => {
    const previous = steps[currentIndex - 1];
    if (previous) handleGoToStep(previous.id);
  };

  const handleNext = () => {
    if (isLast) {
      startFinish(async () => {
        await completeOnboardingAction();
      });
      return;
    }
    const next = steps[currentIndex + 1];
    if (next) handleGoToStep(next.id);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-3 py-6 md:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(56,189,248,0.18),transparent_26rem),radial-gradient(circle_at_85%_25%,rgba(59,130,246,0.16),transparent_24rem)]" />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-primary/20 bg-card/80 shadow-2xl shadow-blue-950/10 backdrop-blur-xl">
        <div className="grid md:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="hidden border-r border-primary/10 bg-primary/6 p-5 md:flex md:flex-col">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Configuración inicial</p>
            <h1 className="mt-2 text-lg font-semibold tracking-tight">{progress.organizationName}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {completedCount}/{totalCountable} pasos listos
            </p>
            <ol className="mt-6 space-y-1" aria-label="Pasos">
              {steps.map((step, index) => {
                const isCurrent = step.id === current.id;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => handleGoToStep(step.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left text-sm transition",
                        isCurrent ? "bg-primary/12 text-foreground" : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                      )}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                          step.done
                            ? "border-primary bg-primary text-primary-foreground"
                            : isCurrent
                              ? "border-primary text-primary"
                              : "border-dashed border-muted-foreground/40",
                        )}
                      >
                        {step.done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                      </span>
                      <span>
                        <span className="block font-medium text-foreground">{step.title}</span>
                        {step.optional ? (
                          <span className="text-[11px] text-muted-foreground">Opcional</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          <div className="flex min-h-[32rem] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-primary/10 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground md:hidden">
                  Paso {currentIndex + 1} de {steps.length}
                </p>
                <h2 className="text-lg font-semibold tracking-tight">{current.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
                  <LogOut />
                </Button>
              </form>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {current.id === "modules" ? (
                <ModulesPanel modules={progress.modules} templateLabel={progress.templateLabel} />
              ) : null}
              {current.id === "calendar" ? (
                <CalendarPanel connected={progress.hasCalendar} email={calendarEmail} />
              ) : null}
              {current.id === "agent" ? (
                <AgentPanel settings={agentSettings} geminiConfigured={geminiConfigured} />
              ) : null}
              {current.id === "channel" ? (
                <ChannelPanel
                  instagramConnected={instagramConnected}
                  instagramLabel={instagramLabel}
                  messengerConnected={messengerConnected}
                  whatsappConnected={whatsappConnected}
                />
              ) : null}
              {current.id === "review" ? (
                <ReviewPanel
                  organizationName={progress.organizationName}
                  templateLabel={progress.templateLabel}
                  steps={steps}
                  hasChannel={progress.hasChannel}
                />
              ) : null}
            </div>

            <footer className="border-t border-primary/10 px-4 py-2.5 md:px-5 md:py-3">
              <nav
                aria-label="Navegación del asistente"
                className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-between"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-w-0 justify-self-start px-2"
                  onClick={handleBack}
                  disabled={currentIndex === 0 || isFinishing}
                >
                  <ChevronLeft />
                  Atrás
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="min-w-0 justify-self-end px-2"
                  onClick={handleNext}
                  disabled={isFinishing}
                >
                  {isFinishing ? <Loader2 className="animate-spin" /> : null}
                  {isLast ? "Entrar al CRM" : "Siguiente"}
                  {isLast ? null : <ChevronRight />}
                </Button>
              </nav>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};
