"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createDeliveryZoneAction,
  toggleDeliveryZoneAction,
} from "@/lib/commerce/actions";
import type { DeliveryZoneRecord } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/commerce/types";
import { PriceCurrencyField } from "@/components/ui/price-currency-field";
import type { OrganizationCurrencySettings } from "@/lib/organizations/currencies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InventoryOpsProps = {
  zones: DeliveryZoneRecord[];
  currencies: OrganizationCurrencySettings;
  canManage: boolean;
};

export const InventoryOps = ({ zones, currencies, canManage }: InventoryOpsProps) => {
  const [zoneForm, setZoneForm] = useState({ name: "", fee: "", etaMinutes: "", currency: currencies.defaultCode });
  const [isPending, startTransition] = useTransition();

  const handleCreateZone = () => {
    startTransition(async () => {
      const result = await createDeliveryZoneAction({
        name: zoneForm.name,
        fee: Number(zoneForm.fee),
        etaMinutes: zoneForm.etaMinutes ? Number(zoneForm.etaMinutes) : undefined,
        currency: zoneForm.currency,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setZoneForm({ name: "", fee: "", etaMinutes: "", currency: currencies.defaultCode });
    });
  };

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader>
        <CardTitle>Zonas de delivery</CardTitle>
        <CardDescription>La IA usa el nombre y el servidor aplica el fee e IVA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canManage ? (
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="zone-name">Zona</Label>
              <Input
                id="zone-name"
                value={zoneForm.name}
                onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className={currencies.codes.length > 1 ? "sm:col-span-2" : undefined}>
              <PriceCurrencyField
                id="zone-fee"
                label="Fee"
                amount={zoneForm.fee}
                currency={zoneForm.currency}
                currencies={currencies}
                onAmountChange={(value) => setZoneForm((current) => ({ ...current, fee: value }))}
                onCurrencyChange={(value) => setZoneForm((current) => ({ ...current, currency: value }))}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" className="w-full" onClick={handleCreateZone} disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : null}
                Agregar
              </Button>
            </div>
          </div>
        ) : null}
        <ul className="space-y-2 text-sm">
          {zones.length ? (
            zones.map((zone) => (
              <li
                key={zone.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                  zone.active
                    ? "border-primary/10 bg-background/80"
                    : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                <span>
                    {zone.name} · {formatMoney(zone.fee, zone.currency)}
                  {zone.etaMinutes ? ` · ${zone.etaMinutes} min` : ""}
                  {zone.active ? "" : " (inactiva)"}
                </span>
                {canManage ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        const result = await toggleDeliveryZoneAction(zone.id, !zone.active);
                        if (result.error) toast.error(result.error);
                        else toast.success(result.success);
                      })
                    }
                  >
                    {zone.active ? "Desactivar" : "Activar"}
                  </Button>
                ) : null}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Sin zonas. Si vendes delivery, crea al menos una.</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
};
