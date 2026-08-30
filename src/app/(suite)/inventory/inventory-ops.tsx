"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import {
  createDeliveryZoneAction,
  deleteDeliveryZoneAction,
  toggleDeliveryZoneAction,
} from "@/lib/commerce/actions";
import type { DeliveryZoneRecord } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/commerce/types";
import { PriceCurrencyField } from "@/components/ui/price-currency-field";
import type { OrganizationCurrencySettings } from "@/lib/organizations/currencies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InventoryOpsProps = {
  zones: DeliveryZoneRecord[];
  currencies: OrganizationCurrencySettings;
  canManage: boolean;
};

export const InventoryOps = ({ zones, currencies, canManage }: InventoryOpsProps) => {
  const [zoneForm, setZoneForm] = useState({
    name: "",
    fee: "",
    etaMinutes: "",
    currency: currencies.defaultCode,
  });
  const [isPending, startTransition] = useTransition();

  const handleCreateZone = () => {
    if (!zoneForm.name.trim()) {
      toast.error("Indica el nombre de la zona.");
      return;
    }

    startTransition(async () => {
      const result = await createDeliveryZoneAction({
        name: zoneForm.name,
        fee: Number(zoneForm.fee),
        etaMinutes: zoneForm.etaMinutes ? Number(zoneForm.etaMinutes) : undefined,
        currency: zoneForm.currency,
      });
      if (result.error) {
        toastActionError(result);
        return;
      }
      toast.success(result.success);
      setZoneForm({ name: "", fee: "", etaMinutes: "", currency: currencies.defaultCode });
    });
  };

  const handleToggleZone = (zone: DeliveryZoneRecord) => {
    startTransition(async () => {
      const result = await toggleDeliveryZoneAction(zone.id, !zone.active);
      if (!toastActionError(result)) toast.success(result.success);
    });
  };

  const handleDeleteZone = (zone: DeliveryZoneRecord) => {
    if (zone.active) return;

    startTransition(async () => {
      const result = await deleteDeliveryZoneAction(zone.id);
      if (!toastActionError(result)) toast.success(result.success);
    });
  };

  const activeCount = zones.filter((zone) => zone.active).length;

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Zonas de delivery</CardTitle>
          <CardDescription>La IA usa el nombre de la zona; el servidor aplica el fee y el IVA.</CardDescription>
        </div>
        <Badge variant="outline">
          {activeCount} activa{activeCount === 1 ? "" : "s"} · {zones.length} total
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="rounded-xl border border-primary/15 bg-primary/8 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7.5rem_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="zone-name">Zona</Label>
                <Input
                  id="zone-name"
                  placeholder="Ej. Brisas del Mar"
                  value={zoneForm.name}
                  onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <PriceCurrencyField
                id="zone-fee"
                label="Fee"
                amount={zoneForm.fee}
                currency={zoneForm.currency}
                currencies={currencies}
                onAmountChange={(value) => setZoneForm((current) => ({ ...current, fee: value }))}
                onCurrencyChange={(value) => setZoneForm((current) => ({ ...current, currency: value }))}
              />
              <div className="space-y-1.5">
                <Label htmlFor="zone-eta">ETA (min)</Label>
                <Input
                  id="zone-eta"
                  type="number"
                  min={1}
                  max={240}
                  inputMode="numeric"
                  placeholder="Opcional"
                  value={zoneForm.etaMinutes}
                  onChange={(event) => setZoneForm((current) => ({ ...current, etaMinutes: event.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" className="w-full lg:w-auto" onClick={handleCreateZone} disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {zones.length ? (
          <ul className="grid gap-2">
            {zones.map((zone) => (
              <li
                key={zone.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                  zone.active
                    ? "border-primary/15 bg-background/80"
                    : "border-border bg-muted/40",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      zone.active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{zone.name}</p>
                      <Badge variant={zone.active ? "default" : "outline"}>
                        {zone.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatMoney(zone.fee, zone.currency)}
                      {zone.etaMinutes ? ` · ${zone.etaMinutes} min` : ""}
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={zone.active ? "outline" : "secondary"}
                      disabled={isPending}
                      onClick={() => handleToggleZone(zone)}
                    >
                      {zone.active ? "Desactivar" : "Activar"}
                    </Button>
                    {!zone.active ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => handleDeleteZone(zone)}
                      >
                        <Trash2 />
                        Borrar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-primary/20 bg-primary/8 px-4 py-8 text-center">
            <MapPin className="mx-auto size-5 text-primary" aria-hidden />
            <p className="mt-2 text-sm font-medium">Sin zonas de delivery</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Crea al menos una si vendes a domicilio. La IA usará estos nombres.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
