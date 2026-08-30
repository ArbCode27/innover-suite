"use client";

import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { createOrganizationAction } from "@/lib/organizations/actions";
import { redirectIfSessionExpired } from "@/lib/auth/session-client";
import {
  BUSINESS_TEMPLATES,
  enabledModuleLabels,
  getBusinessTemplate,
  normalizeModules,
  type BusinessTemplateId,
} from "@/lib/modules/constants";
import {
  CURRENCY_CATALOG,
  DEFAULT_CURRENCY,
  currencyOptionLabel,
} from "@/lib/organizations/currencies";
import { DEFAULT_TAX_RATE } from "@/lib/commerce/types";
import {
  createOrganizationWizardSchema,
  toCreateOrganizationPayload,
  type CreateOrganizationWizardValues,
} from "@/lib/organizations/schema";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TEMPLATE_ICONS = {
  restaurant: UtensilsCrossed,
  retail: Store,
  services: Briefcase,
  realestate: Building2,
} as const;

const STEPS = [
  { id: 1, label: "Empresa" },
  { id: 2, label: "Negocio" },
  { id: 3, label: "Confirmar" },
] as const;

export const CreateOrganizationForm = () => {
  const [step, setStep] = useState(1);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const {
    register,
    setValue,
    trigger,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationWizardValues>({
    resolver: zodResolver(createOrganizationWizardSchema),
    defaultValues: {
      name: "",
      currency: DEFAULT_CURRENCY,
      taxPercent: String(Math.round(DEFAULT_TAX_RATE * 100)),
      templateId: undefined,
    },
    shouldFocusError: true,
  });

  const name = watch("name");
  const currency = watch("currency");
  const taxPercent = watch("taxPercent");
  const templateId = watch("templateId");
  const template = templateId ? getBusinessTemplate(templateId) : null;
  const modules = template ? normalizeModules(template.modules) : null;

  const handleGoToStep = (nextStep: number) => {
    if (nextStep < step) {
      setStep(nextStep);
    }
  };

  const handleNext = async () => {
    setFormMessage(null);
    if (step === 1) {
      const valid = await trigger(["name", "currency", "taxPercent"]);
      if (valid) setStep(2);
      return;
    }
    if (step === 2) {
      const valid = await trigger(["templateId"]);
      if (valid) setStep(3);
    }
  };

  const handleCreate = handleSubmit(
    async (values) => {
      setFormMessage(null);
      const result = await createOrganizationAction(toCreateOrganizationPayload(values));
      if (redirectIfSessionExpired(result)) return;
      if (result?.error) {
        setFormMessage(result.error);
      }
    },
    (formErrors) => {
      if (formErrors.name || formErrors.currency || formErrors.taxPercent) {
        setStep(1);
        return;
      }
      if (formErrors.templateId) {
        setStep(2);
      }
    },
  );

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      void handleNext();
      return;
    }
    void handleCreate();
  };

  const handleSelectTemplate = (id: BusinessTemplateId) => {
    setValue("templateId", id, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <form className="space-y-5" onSubmit={handleFormSubmit} noValidate>
      <ol className="flex items-center gap-2" aria-label="Pasos del alta">
        {STEPS.map((item) => {
          const completed = step > item.id;
          const current = step === item.id;
          return (
            <li key={item.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!completed}
                onClick={() => handleGoToStep(item.id)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                  current
                    ? "border-primary bg-primary text-primary-foreground"
                    : completed
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground",
                )}
                aria-current={current ? "step" : undefined}
                aria-label={completed ? `Volver a ${item.label}` : item.label}
              >
                {completed ? <Check className="size-3.5" aria-hidden /> : item.id}
              </button>
              <span className={cn("text-xs", current ? "font-medium" : "text-muted-foreground")}>
                {item.label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="space-y-4">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor="organization-name">Nombre de la empresa</FieldLabel>
              <Input
                id="organization-name"
                autoFocus
                placeholder="Acme Dental Studio"
                aria-invalid={Boolean(errors.name)}
                className="h-10"
                {...register("name")}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>
          </FieldGroup>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.currency) || undefined}>
              <FieldLabel htmlFor="organization-currency">Moneda principal</FieldLabel>
              <AppSelect
                id="organization-currency"
                aria-label="Moneda principal"
                value={currency}
                onValueChange={(value) => setValue("currency", value, { shouldValidate: true, shouldDirty: true })}
                options={CURRENCY_CATALOG.map((item) => ({
                  value: item.code,
                  label: currencyOptionLabel(item.code),
                }))}
              />
              <FieldError>{errors.currency?.message}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.taxPercent) || undefined}>
              <FieldLabel htmlFor="organization-tax">IVA (%)</FieldLabel>
              <Input
                id="organization-tax"
                inputMode="decimal"
                aria-invalid={Boolean(errors.taxPercent)}
                {...register("taxPercent")}
              />
              <FieldError>{errors.taxPercent?.message}</FieldError>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Podrás agregar más monedas después en Ajustes.</p>
          <Button className="w-full" type="submit">
            Continuar
            <ChevronRight />
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <fieldset className="space-y-4" disabled={isSubmitting}>
          <p className="text-sm text-muted-foreground">
            El menú, el embudo y la IA se adaptan a esta plantilla. Más adelante puedes cambiar módulos en Ajustes
            sin borrar el embudo ni el prompt.
          </p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de negocio">
            {BUSINESS_TEMPLATES.map((item) => {
              const Icon = TEMPLATE_ICONS[item.id];
              const selected = templateId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => handleSelectTemplate(item.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition",
                    selected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-primary/15 hover:border-primary/40",
                  )}
                >
                  <span className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.templateId ? (
            <p className="text-sm text-destructive" role="alert">
              {errors.templateId.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft />
              Atrás
            </Button>
            <Button className="flex-1" type="submit">
              Continuar
              <ChevronRight />
            </Button>
          </div>
        </fieldset>
      ) : null}

      {step === 3 ? (
        <fieldset className="space-y-4" disabled={isSubmitting}>
          <div className="space-y-3 rounded-xl border border-primary/15 bg-muted/30 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Empresa: </span>
              {name.trim() || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Modelo: </span>
              {template?.label ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Módulos: </span>
              {modules ? enabledModuleLabels(modules).join(", ") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Embudo: </span>
              {template ? template.funnelStages.join(" → ") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Moneda / IVA: </span>
              {currency} · {taxPercent || "16"}%
            </p>
          </div>
          {formMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {formMessage}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft />
              Atrás
            </Button>
            <Button className="flex-1" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Creando organización...
                </>
              ) : (
                "Crear y adaptar el CRM"
              )}
            </Button>
          </div>
        </fieldset>
      ) : null}
    </form>
  );
};
