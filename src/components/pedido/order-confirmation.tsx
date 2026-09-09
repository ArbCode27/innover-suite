"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCartStore } from "@/store/cart-store";

type OrderConfirmationProps = {
  numeroOrden?: string | null;
};

export const OrderConfirmation = ({ numeroOrden }: OrderConfirmationProps) => {
  const lastOrder = useCartStore((state) => state.lastOrder);
  const order = numeroOrden || lastOrder?.numeroOrden || "ORD-PENDIENTE";
  const estado = lastOrder?.estado || "enviado_a_cocina";

  return (
    <Card className="mx-auto max-w-lg border-primary/20 bg-card/90">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <CardTitle>Pedido confirmado</CardTitle>
        <CardDescription>Tu pedido fue enviado a cocina.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Número de orden</p>
          <p className="mt-1 font-mono text-lg font-semibold">{order}</p>
        </div>
        <Badge className="mx-auto">{estado.replaceAll("_", " ")}</Badge>
        <Button asChild className="w-full">
          <Link href="/pedir">Volver al menú</Link>
        </Button>
      </CardContent>
    </Card>
  );
};
