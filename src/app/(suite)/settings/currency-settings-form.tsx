"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Save, Wallet } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { updateOrganizationCurrenciesAction } from "@/lib/organizations/actions";
import {
  CURRENCY_CATALOG,
  type OrganizationCurrencySettings,
} from "@/lib/organizations/currencies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CurrencySettingsFormProps = {
  canManageOrganization: boolean;
  currencies: OrganizationCurrencySettings;
};

export const CurrencySettingsForm = ({ canManageOrganization, currencies }: CurrencySettingsFormProps) => {
  const [selected, setSelected] = useState<string[]>(currencies.codes);
  const [defaultCode, setDefaultCode] = useState(currencies.defaultCode);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = (code: string) => {
    setSelected((current) => {
      const isSelected = current.includes(code);
      if (isSelected) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== code);
        if (defaultCode === code) {
          setDefaultCode(next[0] ?? code);
        }
        return next;
      }
      return [...current, code];
    });
  };

  const handleSubmit = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await updateOrganizationCurrenciesAction({
        codes: selected,
        defaultCode,
      });
      if (result.error) {
        setFormError(result.error);
        toastActionError(result);
        return;
      }
      toast.success(result.success);
    });
  };

  return (
    <Card id="monedas" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wallet className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Monedas</CardTitle>
              <CardDescription className="mt-1 leading-6">
                Elige en qué monedas cobra este negocio. Si hay más de una, aparecerá un selector al crear precios.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">{selected.length} activa{selected.length === 1 ? "" : "s"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {CURRENCY_CATALOG.map((item) => {
            const isActive = selected.includes(item.code);
            const isDefault = defaultCode === item.code;
            return (
              <button
                key={item.code}
                type="button"
                disabled={!canManageOrganization}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition",
                  isActive
                    ? "border-primary/40 bg-primary/8"
                    : "border-primary/10 bg-background/70 hover:border-primary/25",
                  !canManageOrganization && "cursor-not-allowed opacity-70",
                )}
                onClick={() => handleToggle(item.code)}
              >
                <span>
                  <span className="block text-sm font-medium">
                    {item.code} · {item.hint}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </span>
                {isActive ? (
                  <span className="flex items-center gap-1 text-xs text-primary">
                    <Check className="size-4" aria-hidden />
                    {isDefault ? "Principal" : "Activa"}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Inactiva</span>
                )}
              </button>
            );
          })}
        </div>

        {selected.length > 1 ? (
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="default-currency">Moneda principal</Label>
            <AppSelect
              id="default-currency"
              aria-label="Moneda principal"
              value={defaultCode}
              disabled={!canManageOrganization}
              onValueChange={setDefaultCode}
              options={selected.map((code) => {
                const item = CURRENCY_CATALOG.find((entry) => entry.code === code);
                return {
                  value: code,
                  label: item ? `${item.code} · ${item.label}` : code,
                };
              })}
            />
            <p className="text-xs text-muted-foreground">
              Se usa por defecto al crear productos, zonas y oportunidades.
            </p>
          </div>
        ) : null}

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        {canManageOrganization ? (
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar monedas
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Solo owner o admin pueden cambiar las monedas.</p>
        )}
      </CardContent>
    </Card>
  );
};
