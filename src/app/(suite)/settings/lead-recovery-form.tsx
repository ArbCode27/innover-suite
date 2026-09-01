"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageCircleMore, Save } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { saveLeadRecoverySettingsAction } from "@/lib/agent/actions";
import {
  LEAD_RECOVERY_COOLDOWN_HOURS_MAX,
  LEAD_RECOVERY_COOLDOWN_HOURS_MIN,
  LEAD_RECOVERY_DEFAULT_PROMPT,
  LEAD_RECOVERY_IDLE_HOURS_MAX,
  LEAD_RECOVERY_IDLE_HOURS_MIN,
  LEAD_RECOVERY_PROMPT_MAX_CHARS,
} from "@/lib/agent/constants";
import type { AgentSettings } from "@/lib/agent/types";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type FunnelStageOption = {
  id: number;
  name: string;
};

type LeadRecoveryFormProps = {
  canManageOrganization: boolean;
  settings: AgentSettings;
  funnelEnabled: boolean;
  stages: FunnelStageOption[];
};

export const LeadRecoveryForm = ({
  canManageOrganization,
  settings,
  funnelEnabled,
  stages,
}: LeadRecoveryFormProps) => {
  const [enabled, setEnabled] = useState(settings.leadRecoveryEnabled);
  const [idleHours, setIdleHours] = useState(String(settings.leadRecoveryIdleHours));
  const [stageId, setStageId] = useState(() => {
    const savedId = settings.leadRecoveryStageId;
    if (!savedId) return "";
    return stages.some((stage) => stage.id === savedId) ? String(savedId) : "";
  });
  const [respectHours, setRespectHours] = useState(settings.leadRecoveryRespectHours);
  const [cooldownHours, setCooldownHours] = useState(String(settings.leadRecoveryCooldownHours));
  const [prompt, setPrompt] = useState(settings.leadRecoveryPrompt);
  const [isPending, startTransition] = useTransition();
  const disabled = !canManageOrganization || !funnelEnabled;
  const promptOverLimit = prompt.length > LEAD_RECOVERY_PROMPT_MAX_CHARS;

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await saveLeadRecoverySettingsAction({
        leadRecoveryEnabled: enabled,
        leadRecoveryIdleHours: Number(idleHours),
        leadRecoveryStageId: stageId ? Number(stageId) : null,
        leadRecoveryRespectHours: respectHours,
        leadRecoveryCooldownHours: Number(cooldownHours),
        leadRecoveryPrompt: prompt,
      });
      if (result.error) {
        toastActionError(result);
        return;
      }
      toast.success(result.success);
    });
  };

  return (
    <Card id="lead-recovery" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircleMore className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Recuperar chats olvidados</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Si un lead lleva horas sin respuesta, la IA retoma el chat con un follow-up breve.
              </CardDescription>
            </div>
          </div>
          <Badge variant={enabled && funnelEnabled && settings.enabled ? "default" : "outline"}>
            {enabled && funnelEnabled && settings.enabled ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!funnelEnabled ? (
          <p className="text-sm text-muted-foreground">Activa Embudos para usar esta función.</p>
        ) : null}
        {funnelEnabled && !settings.enabled ? (
          <p className="text-sm text-muted-foreground">
            Activa las respuestas automáticas del agente para que la recuperación pueda enviar el follow-up.
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 px-3 py-3">
          <Label htmlFor="lead-recovery-enabled" className="text-sm">
            Activar recuperación
          </Label>
          <Switch
            id="lead-recovery-enabled"
            checked={enabled}
            disabled={disabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lead-recovery-idle">Horas sin responder</Label>
            <Input
              id="lead-recovery-idle"
              type="number"
              min={LEAD_RECOVERY_IDLE_HOURS_MIN}
              max={LEAD_RECOVERY_IDLE_HOURS_MAX}
              value={idleHours}
              disabled={disabled}
              onChange={(event) => setIdleHours(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Entre {LEAD_RECOVERY_IDLE_HOURS_MIN} y {LEAD_RECOVERY_IDLE_HOURS_MAX}. El último mensaje debe ser del
              cliente.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-recovery-cooldown">Esperar entre reintentos (horas)</Label>
            <Input
              id="lead-recovery-cooldown"
              type="number"
              min={LEAD_RECOVERY_COOLDOWN_HOURS_MIN}
              max={LEAD_RECOVERY_COOLDOWN_HOURS_MAX}
              value={cooldownHours}
              disabled={disabled}
              onChange={(event) => setCooldownHours(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              No insistir al mismo chat antes de {LEAD_RECOVERY_COOLDOWN_HOURS_MIN}–{LEAD_RECOVERY_COOLDOWN_HOURS_MAX}{" "}
              horas.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead-recovery-stage">Etapa del embudo</Label>
          <AppSelect
            id="lead-recovery-stage"
            value={stageId}
            disabled={disabled}
            onValueChange={setStageId}
            placeholder="Primera etapa (Lead)"
            options={[
              { value: "", label: "Primera etapa (Lead)" },
              ...stages.map((stage) => ({ value: String(stage.id), label: stage.name })),
            ]}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 px-3 py-3">
          <Label htmlFor="lead-recovery-hours" className="text-sm">
            Respetar horario de oficina
          </Label>
          <Switch
            id="lead-recovery-hours"
            checked={respectHours}
            disabled={disabled}
            onCheckedChange={setRespectHours}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lead-recovery-prompt">Prompt de recuperación (opcional)</Label>
          <textarea
            id="lead-recovery-prompt"
            value={prompt}
            disabled={disabled}
            rows={4}
            maxLength={LEAD_RECOVERY_PROMPT_MAX_CHARS}
            placeholder={LEAD_RECOVERY_DEFAULT_PROMPT}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6"
            aria-label="Prompt de recuperación"
          />
          <p className="text-xs text-muted-foreground">
            Si lo dejas vacío, se usa un follow-up corto.{" "}
            <span className={promptOverLimit ? "text-destructive" : undefined}>
              {prompt.length.toLocaleString("es-VE")} / {LEAD_RECOVERY_PROMPT_MAX_CHARS.toLocaleString("es-VE")}
            </span>
          </p>
        </div>

        {canManageOrganization ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || isPending || promptOverLimit}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar recuperación
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo owner o admin pueden editar esta configuración.</p>
        )}
      </CardContent>
    </Card>
  );
};
