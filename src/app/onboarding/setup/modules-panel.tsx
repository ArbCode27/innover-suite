"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Store, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { saveOrganizationModulesAction } from "@/lib/modules/actions";
import {
  BUSINESS_TEMPLATES,
  MODULE_CATALOG,
  MODULE_KEYS,
  normalizeModules,
  type OrganizationModules,
} from "@/lib/modules/constants";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const TEMPLATE_ICONS = {
  restaurant: UtensilsCrossed,
  retail: Store,
  services: Briefcase,
  realestate: Building2,
} as const;

const modulesMatch = (left: OrganizationModules, right: OrganizationModules) =>
  MODULE_KEYS.every((key) => left[key] === right[key]);

type ModulesPanelProps = {
  modules: OrganizationModules;
  templateLabel: string | null;
};

export const ModulesPanel = ({ modules, templateLabel }: ModulesPanelProps) => {
  const router = useRouter();
  const [values, setValues] = useState<OrganizationModules>(modules);
  const [isPending, startTransition] = useTransition();

  const persistModules = (next: OrganizationModules, previous: OrganizationModules) => {
    setValues(next);
    startTransition(async () => {
      const result = await saveOrganizationModulesAction(next);
      if (result.error) {
        toastActionError(result);
        setValues(previous);
        return;
      }
      if (result.modules) {
        setValues(result.modules);
      }
      toast.success(result.success ?? "Funciones actualizadas");
      router.refresh();
    });
  };

  const handleToggle = (key: keyof OrganizationModules, enabled: boolean) => {
    persistModules(normalizeModules({ ...values, [key]: enabled }), values);
  };

  const handleSelectTemplate = (templateModules: OrganizationModules) => {
    persistModules(normalizeModules(templateModules), values);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {templateLabel
          ? `Partiste de ${templateLabel}. Elige un modelo o ajusta los interruptores; el menú del CRM se adapta al instante.`
          : "Elige un modelo de negocio o enciende solo lo que vas a usar. Puedes cambiarlo después en Ajustes."}
      </p>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Modelos de negocio">
        {BUSINESS_TEMPLATES.map((template) => {
          const Icon = TEMPLATE_ICONS[template.id];
          const selected = modulesMatch(values, normalizeModules(template.modules));
          return (
            <Button
              key={template.id}
              type="button"
              variant="outline"
              className={cn(
                "h-auto justify-start gap-3 px-3 py-3 text-left whitespace-normal",
                selected && "border-primary bg-primary/10 ring-2 ring-primary/30",
              )}
              disabled={isPending}
              aria-pressed={selected}
              onClick={() => handleSelectTemplate(template.modules)}
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{template.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{template.description}</span>
              </span>
            </Button>
          );
        })}
      </div>
      <ul className="space-y-2">
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
              disabled={isPending}
              aria-label={module.label}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};
