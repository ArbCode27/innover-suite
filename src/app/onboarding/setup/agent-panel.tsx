"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { saveAgentSettingsAction } from "@/lib/agent/actions";
import { AGENT_PROMPT_MAX_CHARS } from "@/lib/agent/constants";
import type { AgentSettings } from "@/lib/agent/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type AgentPanelProps = {
  settings: AgentSettings;
  geminiConfigured: boolean;
};

export const AgentPanel = ({ settings, geminiConfigured }: AgentPanelProps) => {
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveAgentSettingsAction({
        enabled: settings.enabled,
        systemPrompt,
        toolsCalendar: settings.toolsCalendar,
        toolsFunnel: settings.toolsFunnel,
        toolsHandoff: settings.toolsHandoff,
        requireBookingConfirmation: settings.requireBookingConfirmation,
      });
      if (result.error) {
        setFormError(result.error);
        toastActionError(result);
        return;
      }
      toast.success(result.success ?? "Prompt guardado");
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        El prompt ya se adaptó a tu tipo de negocio. Ajústalo si quieres otro tono; el agente atiende 24/7.
      </p>
      {geminiConfigured ? null : (
        <p className="text-sm text-destructive">Falta configurar Gemini en el servidor. El agente no responderá aún.</p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="onboarding-agent-prompt">Prompt del agente</Label>
        <textarea
          id="onboarding-agent-prompt"
          value={systemPrompt}
          maxLength={AGENT_PROMPT_MAX_CHARS}
          rows={12}
          onChange={(event) => setSystemPrompt(event.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      <Button type="button" onClick={handleSave} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <Save />}
        Guardar prompt
      </Button>
    </div>
  );
};
