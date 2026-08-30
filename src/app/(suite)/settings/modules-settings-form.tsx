"use client";

import { useState, useTransition } from "react";
import { LayoutGrid, Loader2, Save, Store, UtensilsCrossed, Briefcase, Building2 } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { saveOrganizationModulesAction } from "@/lib/modules/actions";
import {
  BUSINESS_TEMPLATES,
  MODULE_CATALOG,
  normalizeModules,
  type OrganizationModules,
} from "@/lib/modules/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type ModulesSettingsFormProps = {
  canManageOrganization: boolean;
  modules: OrganizationModules;
};

const TEMPLATE_ICONS = {
  restaurant: UtensilsCrossed,
  retail: Store,
  services: Briefcase,
  realestate: Building2,
} as const;

export const ModulesSettingsForm = ({ canManageOrganization, modules }: ModulesSettingsFormProps) => {
  const [values, setValues] = useState<OrganizationModules>(modules);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (key: keyof OrganizationModules, enabled: boolean) => {
    setValues((current) => normalizeModules({ ...current, [key]: enabled }));
  };

  const handleTemplate = (templateModules: OrganizationModules) => {
    setValues(normalizeModules(templateModules));
  };

  const handleSubmit = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveOrganizationModulesAction(values);
      if (result.error) {
        setFormError(result.error);
        toastActionError(result);
        return;
      }
      if (result.modules) {
        setValues(result.modules);
      }
      toast.success(result.success ?? "Módulos actualizados");
    });
  };

  return (
    <Card id="modulos" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LayoutGrid className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Funciones del CRM</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Activa solo lo que usa este negocio. El menú y la IA se adaptan a estos interruptores.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">Por organización</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {BUSINESS_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template.id];
            return (
              <Button
                key={template.id}
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-3 py-3 text-left"
                disabled={!canManageOrganization || isPending}
                onClick={() => handleTemplate(template.modules)}
              >
                <Icon className="size-4 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{template.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{template.description}</span>
                </span>
              </Button>
            );
          })}
        </div>

        <ul className="space-y-3">
          {MODULE_CATALOG.map((module) => (
            <li
              key={module.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-primary/10 bg-background/60 px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{module.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
              </div>
              <Switch
                checked={values[module.key]}
                onCheckedChange={(checked) => handleToggle(module.key, checked)}
                disabled={!canManageOrganization || isPending}
                aria-label={module.label}
              />
            </li>
          ))}
        </ul>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        {canManageOrganization ? (
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar funciones
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo owner o admin pueden cambiar las funciones.</p>
        )}
      </CardContent>
    </Card>
  );
};
