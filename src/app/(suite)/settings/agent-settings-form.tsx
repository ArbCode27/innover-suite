"use client";

import { useState, useTransition } from "react";
import { BookOpen, Bot, ImagePlus, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { saveAgentSettingsAction, createKnowledgeArticleAction, toggleKnowledgeArticleAction } from "@/lib/agent/actions";
import { AGENT_PROMPT_MAX_CHARS } from "@/lib/agent/constants";
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
  const [articleForm, setArticleForm] = useState({ title: "", body: "", useWhen: "" });
  const [articleImage, setArticleImage] = useState<File | null>(null);
  const [articleImagePreview, setArticleImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleArticleImageChange = (file: File | null) => {
    if (articleImagePreview) {
      URL.revokeObjectURL(articleImagePreview);
    }
    setArticleImage(file);
    setArticleImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handlePublishArticle = () => {
    startTransition(async () => {
      const payload = new FormData();
      payload.set("title", articleForm.title);
      payload.set("body", articleForm.body);
      payload.set("useWhen", articleForm.useWhen);
      if (articleImage) {
        payload.set("image", articleImage);
      }
      const result = await createKnowledgeArticleAction(payload);
      if (result.error) {
        toastActionError(result);
        return;
      }
      toast.success(result.success);
      setArticleForm({ title: "", body: "", useWhen: "" });
      handleArticleImageChange(null);
    });
  };

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
      });

      if (result.error) {
        setFormError(result.error);
        toastActionError(result);
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
                Define el prompt y las tools. El agente responde 24/7; el horario de oficina solo aplica a los asesores.
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
            Instrucciones de negocio. Las reglas de seguridad (IDs, no inventar citas, timezone) se aplican siempre.{" "}
            <span className={systemPrompt.length > AGENT_PROMPT_MAX_CHARS ? "text-destructive" : undefined}>
              {systemPrompt.length.toLocaleString("es-VE")} / {AGENT_PROMPT_MAX_CHARS.toLocaleString("es-VE")}
            </span>
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
              Pedidos e inventario están activos: la IA confirmará ventas con precios reales, IVA y stock. El cliente puede responder CONFIRMAR.
            </p>
          ) : null}
        </fieldset>

        <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/8">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-primary/10 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <BookOpen className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Base de conocimiento</h3>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  FAQs y fotos que el agente puede enviar. Adjunta una imagen si el cliente suele pedir “cómo se ve”.
                </p>
              </div>
            </div>
            <Badge variant="outline">
              {articles.length} artículo{articles.length === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="space-y-4 p-4">
            {canManageOrganization ? (
              <div className="space-y-3 rounded-xl border border-primary/15 bg-background/80 p-3">
                <p className="text-xs font-medium text-primary">Nuevo artículo</p>
                <div className="space-y-1.5">
                  <Label htmlFor="knowledge-title">Título</Label>
                  <Input
                    id="knowledge-title"
                    placeholder="Ej. Kit de 3"
                    value={articleForm.title}
                    onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="knowledge-body">Contenido</Label>
                  <textarea
                    id="knowledge-body"
                    placeholder="Política, FAQ o dato que el agente debe usar"
                    value={articleForm.body}
                    onChange={(event) => setArticleForm((current) => ({ ...current, body: event.target.value }))}
                    rows={4}
                    className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="knowledge-use-when">¿Cuándo enviar la foto?</Label>
                  <Input
                    id="knowledge-use-when"
                    placeholder="Ej. si preguntan cómo se ve el kit"
                    value={articleForm.useWhen}
                    onChange={(event) => setArticleForm((current) => ({ ...current, useWhen: event.target.value }))}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-primary/25 bg-primary/8 px-3 py-2.5">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm">
                    <ImagePlus className="size-4 text-primary" aria-hidden />
                    {articleImage ? "Cambiar imagen" : "Adjuntar imagen"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => handleArticleImageChange(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {articleImagePreview ? (
                    <span className="relative inline-flex">
                      <img
                        src={articleImagePreview}
                        alt="Vista previa de la imagen del artículo"
                        className="size-14 rounded-lg object-cover"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="secondary"
                        className="absolute -top-2 -right-2 size-6 rounded-full"
                        aria-label="Quitar imagen"
                        onClick={() => handleArticleImageChange(null)}
                      >
                        <X className="size-3" />
                      </Button>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">JPG, PNG o WebP. Máx. 5 MB.</span>
                  )}
                </div>
                <Button type="button" disabled={isPending} onClick={handlePublishArticle}>
                  Publicar artículo
                </Button>
              </div>
            ) : null}

            {articles.length ? (
              <ul className="space-y-2">
                {articles.map((article) => (
                  <li
                    key={article.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-primary/10 bg-background/70 p-3"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      {article.imageUrl ? (
                        <img
                          src={article.imageUrl}
                          alt=""
                          className="size-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <BookOpen className="size-4" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{article.title}</span>
                          <Badge variant={article.active ? "default" : "outline"}>
                            {article.active ? "Activo" : "Inactivo"}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{article.body.slice(0, 140)}</span>
                        {article.useWhen ? (
                          <span className="mt-1 block text-xs text-muted-foreground">Foto si: {article.useWhen}</span>
                        ) : null}
                      </span>
                    </span>
                    {canManageOrganization ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          startTransition(async () => {
                            const result = await toggleKnowledgeArticleAction(article.id, !article.active);
                            if (!toastActionError(result)) toast.success(result.success);
                          })
                        }
                      >
                        {article.active ? "Desactivar" : "Activar"}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-primary/20 px-3 py-6 text-center text-xs text-muted-foreground">
                Aún no hay artículos. Publica el primero para que el agente tenga FAQs y fotos.
              </p>
            )}
          </div>
        </section>

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
