import { Check, CircleAlert } from "lucide-react";
import type { SetupStepDefinition } from "@/lib/onboarding/progress";

type ReviewPanelProps = {
  organizationName: string;
  templateLabel: string | null;
  steps: SetupStepDefinition[];
  hasChannel: boolean;
};

export const ReviewPanel = ({ organizationName, templateLabel, steps, hasChannel }: ReviewPanelProps) => {
  const reviewable = steps.filter((step) => step.id !== "review");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {organizationName}
        {templateLabel ? ` · ${templateLabel}` : ""}. Puedes seguir afinando todo en Ajustes, Inventario e Inmuebles.
      </p>
      {!hasChannel ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          No hay un canal de chat conectado. La IA no recibirá mensajes hasta que conectes WhatsApp, Instagram o
          Messenger.
        </p>
      ) : null}
      <ul className="space-y-2">
        {reviewable.map((step) => (
          <li
            key={step.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 px-3 py-2 text-sm"
          >
            <span>{step.title}</span>
            <span className={step.done ? "flex items-center gap-1 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
              {step.done ? (
                <>
                  <Check className="size-3.5" aria-hidden />
                  Listo
                </>
              ) : (
                "Pendiente"
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
