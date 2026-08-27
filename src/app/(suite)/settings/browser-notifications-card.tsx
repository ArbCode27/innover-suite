"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrowserNotificationsControls } from "@/components/suite/browser-notifications-controls";

export const BrowserNotificationsCard = () => {
  return (
    <Card id="avisos" className="border-primary/15 bg-card/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Avisos en este dispositivo</CardTitle>
            <CardDescription className="mt-1 leading-6">
              Permiso del navegador para este equipo. No sustituye la campana del CRM y no llega si cierras la pestaña.
            </CardDescription>
          </div>
          <Badge variant="outline">Este dispositivo</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-primary/10 bg-background/60 px-3 py-3">
          <BrowserNotificationsControls />
        </div>
      </CardContent>
    </Card>
  );
};
