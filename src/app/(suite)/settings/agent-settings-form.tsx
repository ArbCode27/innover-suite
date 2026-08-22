"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveAgentSettingsAction, createKnowledgeArticleAction, toggleKnowledgeArticleAction } from "@/lib/agent/actions";
import type { AgentSettings } from "@/lib/agent/types";
import type { KnowledgeArticle } from "@/lib/agent/settings";
import type { OrganizationModules } from "@/lib/modules/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type AgentSettingsFormProps = {
  canManageOrganization: boolean;
  settings: AgentSettings;
  modules: OrganizationModules;
  geminiConfigured: boolean;
  articles: KnowledgeArticle[];
};

export const AgentSettingsForm = ({
  canManageOrganization,
  settings,
  modules,
  geminiConfigured,
  articles,
}: AgentSettingsFormProps) => {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [toolsCalendar, setToolsCalendar] = useState(settings.toolsCalendar);
  const [toolsFunnel, setToolsFunnel] = useState(settings.toolsFunnel);
  const [toolsHandoff, setToolsHandoff] = useState(settings.toolsHandoff);
  const [requireBookingConfirmation, setRequireBookingConfirmation] = useState(
    settings.requireBookingConfirmation,
  );
  const [closedMessage, setClosedMessage] = useState(settings.closedMessage);
  const [weekdayHours, setWeekdayHours] = useState(settings.businessHours.days);
  const [articleForm, setArticleForm] = useState({ title: "", body: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveAgentSettingsAction({
        enabled,
        systemPrompt,
        toolsCalendar,
        toolsFunnel,
        toolsHandoff,
        requireBookingConfirmation,
        closedMessage,
        businessHours: { timezone: settings.businessHours.timezone, days: weekdayHours },
      });

      if (result.error) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Agente actualizado");
    });
  };

  return (
    <Card id="agent-ia" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Agente de inteligencia artificial</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Define el prompt y las tools. El agente responde solo si la conversación está en modo IA.
              </CardDescription>
            </div>
          </div>
          <Badge variant={enabled && geminiConfigured ? "default" : "outline"}>
            {enabled && geminiConfigured ? "Listo" : "Inactivo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {geminiConfigured ? null : (
          <p className="text-sm text-destructive">
            Falta GEMINI_API_KEY en el entorno. El prompt se puede guardar, pero el agente no responderá.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={enabled}
            onCheckedChange={(value) => setEnabled(value === true)}
            disabled={!canManageOrganization}
          />
          Activar respuestas automáticas
        </label>

        <div className="space-y-2">
          <Label htmlFor="agent-prompt">Prompt del agente</Label>
          <textarea
            id="agent-prompt"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
            disabled={!canManageOrganization}
            rows={12}
            className="min-h-48 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-6"
            aria-label="Prompt del agente"
          />
          <p className="text-xs text-muted-foreground">
            Instrucciones de negocio. Las reglas de seguridad (IDs, no inventar citas, timezone) se aplican siempre.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Function calling</legend>
          {modules.calendar ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={toolsCalendar}
                onCheckedChange={(value) => setToolsCalendar(value === true)}
                disabled={!canManageOrganization}
              />
              Agendar citas en Google Calendar
            </label>
          ) : null}
          {modules.funnels ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={toolsFunnel}
                onCheckedChange={(value) => setToolsFunnel(value === true)}
                disabled={!canManageOrganization}
              />
              Mover al cliente en el embudo
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={toolsHandoff}
              onCheckedChange={(value) => setToolsHandoff(value === true)}
              disabled={!canManageOrganization}
            />
            Ceder la conversación a un asesor
          </label>
          {modules.calendar ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={requireBookingConfirmation}
                onCheckedChange={(value) => setRequireBookingConfirmation(value === true)}
                disabled={!canManageOrganization}
              />
              Exigir confirmación del cliente antes de crear la cita
            </label>
          ) : null}
          {modules.orders ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Pedidos e inventario están activos: la IA confirmará ventas con precios reales, ITBIS y stock. El cliente puede responder CONFIRMAR.
            </p>
          ) : null}
        </fieldset>

        <div className="space-y-2">
          <Label>Horario del agente</Label>
          <p className="text-xs text-muted-foreground">Fuera de horario envía el mensaje de cerrado y no usa tools.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {["1", "2", "3", "4", "5", "6", "0"].map((day) => {
              const labels: Record<string, string> = {
                "1": "Lun",
                "2": "Mar",
                "3": "Mié",
                "4": "Jue",
                "5": "Vie",
                "6": "Sáb",
                "0": "Dom",
              };
              const hours = weekdayHours[day];
              return (
                <div key={day} className="flex items-center gap-2 text-sm">
                  <span className="w-10">{labels[day]}</span>
                  <Input
                    aria-label={`Apertura ${labels[day]}`}
                    value={hours?.open ?? ""}
                    placeholder="cerrado"
                    disabled={!canManageOrganization}
                    onChange={(event) => {
                      const open = event.target.value;
                      setWeekdayHours((current) => ({
                        ...current,
                        [day]: open ? { open, close: current[day]?.close || "22:00" } : null,
                      }));
                    }}
                  />
                  <Input
                    aria-label={`Cierre ${labels[day]}`}
                    value={hours?.close ?? ""}
                    placeholder="—"
                    disabled={!canManageOrganization}
                    onChange={(event) => {
                      const close = event.target.value;
                      setWeekdayHours((current) => ({
                        ...current,
                        [day]: close ? { open: current[day]?.open || "08:00", close } : null,
                      }));
                    }}
                  />
                </div>
              );
            })}
          </div>
          <Label htmlFor="closed-message">Mensaje fuera de horario</Label>
          <textarea
            id="closed-message"
            value={closedMessage}
            onChange={(event) => setClosedMessage(event.target.value)}
            disabled={!canManageOrganization}
            rows={3}
            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Base de conocimiento</Label>
          {canManageOrganization ? (
            <div className="space-y-2">
              <Input
                placeholder="Título"
                value={articleForm.title}
                onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))}
              />
              <textarea
                placeholder="Política, FAQ o dato que el agente debe usar"
                value={articleForm.body}
                onChange={(event) => setArticleForm((current) => ({ ...current, body: event.target.value }))}
                rows={3}
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await createKnowledgeArticleAction(articleForm);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(result.success);
                    setArticleForm({ title: "", body: "" });
                  });
                }}
              >
                Publicar artículo
              </Button>
            </div>
          ) : null}
          <ul className="space-y-2 text-sm">
            {articles.map((article) => (
              <li key={article.id} className="flex items-start justify-between gap-2 rounded-lg border border-primary/10 p-2">
                <span>
                  <span className="font-medium">{article.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{article.body.slice(0, 140)}</span>
                </span>
                {canManageOrganization ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await toggleKnowledgeArticleAction(article.id, !article.active);
                        if (result.error) toast.error(result.error);
                        else toast.success(result.success);
                      })
                    }
                  >
                    {article.active ? "Desactivar" : "Activar"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        {canManageOrganization ? (
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar agente
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo owner o admin pueden editar el agente.</p>
        )}
      </CardContent>
    </Card>
  );
};
