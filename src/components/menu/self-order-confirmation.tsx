"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/commerce/types";

type SelfOrderConfirmationProps = {
  slug: string;
  orgName: string;
  orderId: string | null;
  total: number | null;
  currency: string;
};

export const SelfOrderConfirmation = ({
  slug,
  orgName,
  orderId,
  total,
  currency,
}: SelfOrderConfirmationProps) => (
  <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-10">
    <Card className="mx-auto w-full max-w-lg border-primary/20 bg-card/90">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <CardTitle>Pedido confirmado</CardTitle>
        <CardDescription>
          Tu pedido fue enviado a cocina en {orgName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Número de orden</p>
          <p className="mt-1 font-mono text-lg font-semibold">{orderId || "ORD-PENDIENTE"}</p>
        </div>
        {total != null ? (
          <p className="text-sm text-muted-foreground">
            Total {formatMoney(total, currency)}
          </p>
        ) : null}
        <Badge className="mx-auto">enviado a cocina</Badge>
        <Button asChild className="w-full">
          <Link href={`/menu/${slug}`}>Volver al menú</Link>
        </Button>
      </CardContent>
    </Card>
  </main>
);
