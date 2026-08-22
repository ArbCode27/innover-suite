"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  createDeliveryZoneAction,
  importCatalogCsvAction,
  toggleDeliveryZoneAction,
} from "@/lib/commerce/actions";
import { catalogToCsv } from "@/lib/commerce/catalog";
import type { DeliveryZoneRecord, ProductRecord } from "@/lib/commerce/types";
import { formatMoney } from "@/lib/commerce/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InventoryOpsProps = {
  products: ProductRecord[];
  zones: DeliveryZoneRecord[];
  canManage: boolean;
};

export const InventoryOps = ({ products, zones, canManage }: InventoryOpsProps) => {
  const [zoneForm, setZoneForm] = useState({ name: "", fee: "", etaMinutes: "" });
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    const csv = catalogToCsv(products);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalogo.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (file: File) => {
    startTransition(async () => {
      const text = await file.text();
      const result = await importCatalogCsvAction(text);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
    });
  };

  const handleCreateZone = () => {
    startTransition(async () => {
      const result = await createDeliveryZoneAction({
        name: zoneForm.name,
        fee: Number(zoneForm.fee),
        etaMinutes: zoneForm.etaMinutes ? Number(zoneForm.etaMinutes) : undefined,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      setZoneForm({ name: "", fee: "", etaMinutes: "" });
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-primary/15 bg-card/80">
        <CardHeader>
          <CardTitle>Importar / exportar</CardTitle>
          <CardDescription>CSV con columnas name, sku, category, kind, price, stock.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download />
            Exportar
          </Button>
          {canManage ? (
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleImport(file);
                  event.target.value = "";
                }}
              />
              <Button type="button" variant="outline" asChild>
                <span>
                  {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                  Importar CSV
                </span>
              </Button>
            </label>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-primary/15 bg-card/80">
        <CardHeader>
          <CardTitle>Zonas de delivery</CardTitle>
          <CardDescription>La IA usa el nombre y el servidor aplica el fee e ITBIS.</CardDescription>
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
              <div>
                <Label htmlFor="zone-fee">Fee</Label>
                <Input
                  id="zone-fee"
                  type="number"
                  min="0"
                  value={zoneForm.fee}
                  onChange={(event) => setZoneForm((current) => ({ ...current, fee: event.target.value }))}
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
                <li key={zone.id} className="flex items-center justify-between gap-2">
                  <span>
                    {zone.name} · {formatMoney(zone.fee)}
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
    </div>
  );
};
