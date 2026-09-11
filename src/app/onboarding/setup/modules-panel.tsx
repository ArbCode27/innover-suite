import { Check } from "lucide-react";
import { MODULE_CATALOG, type OrganizationModules } from "@/lib/modules/constants";
import { Badge } from "@/components/ui/badge";

type ModulesPanelProps = {
  modules: OrganizationModules;
  templateLabel: string | null;
};

export const ModulesPanel = ({ modules, templateLabel }: ModulesPanelProps) => {
  const enabled = MODULE_CATALOG.filter((module) => modules[module.key]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {templateLabel
          ? `Tu plan / plantilla (${templateLabel}) incluye estas funciones. Las gestiona el administrador de la plataforma según la suscripción.`
          : "Estas funciones vienen con tu plan de suscripción. Solo el administrador de la plataforma puede cambiarlas."}
      </p>
      <ul className="space-y-2" aria-label="Funciones incluidas">
        {enabled.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            Aún no hay módulos activos. Contacta a soporte si esto no coincide con tu plan.
          </li>
        ) : (
          enabled.map((module) => (
            <li
              key={module.key}
              className="flex items-start gap-3 rounded-xl border border-primary/15 bg-background/60 px-3 py-3"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{module.label}</p>
                  <Badge variant="outline" className="text-[10px]">
                    Incluido
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
