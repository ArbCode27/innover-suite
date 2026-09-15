"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  LogOut,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import type { JoinRequestRecord } from "@/lib/billing/join-requests-types";
import { PAYMENT_METHODS_CONFIG } from "@/lib/billing/payment-methods";
import { getPlanById } from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type JoinRequestPendingProps = {
  request: JoinRequestRecord;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(iso));

export const JoinRequestPending = ({ request }: JoinRequestPendingProps) => {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isViewingImage, setIsViewingImage] = useState(false);

  const plan = getPlanById(request.plan_id);
  const paymentInfo = PAYMENT_METHODS_CONFIG[request.payment_method];

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent">
        <CardHeader className="text-center sm:text-left">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Clock className="size-6 animate-pulse" />
              </span>
              <div>
                <CardTitle className="text-xl">Solicitud en Revisión</CardTitle>
                <CardDescription>
                  Estamos verificando tu pago para activar tu organización.
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
            >
              Pendiente de Aprobación
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resumen de la Solicitud
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-xs text-muted-foreground">Empresa</span>
                <span className="text-sm font-semibold">{request.organization_name}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Plan solicitado</span>
                <span className="text-sm font-semibold">
                  {plan?.name ?? request.plan_id} (${request.amount_usd} USD/mes)
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Método de pago</span>
                <span className="text-sm font-semibold">
                  {paymentInfo?.name ?? request.payment_method}
                </span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Referencia bancaria</span>
                <span className="font-mono text-sm font-bold">{request.payment_reference}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground">Fecha de envío</span>
                <span className="text-xs">{formatDate(request.created_at)}</span>
              </div>
              {request.customer_notes ? (
                <div>
                  <span className="block text-xs text-muted-foreground">Nota enviada</span>
                  <span className="text-xs text-foreground/80">{request.customer_notes}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Comprobante enviado */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Comprobante de pago adjunto</p>
            <div className="group relative flex max-w-sm cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-3 transition hover:border-primary/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={request.receipt_url}
                alt="Comprobante de pago"
                className="size-16 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">Comprobante subido</p>
                <p className="text-[11px] text-muted-foreground">Haz clic para ver en tamaño completo</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsViewingImage(true)}
                className="size-8"
              >
                <Eye className="size-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">¿Cuánto tarda la activación?</p>
            <p className="mt-1">
              Las transferencias y pagos se validan habitualmente en un plazo de 15 minutos a 2 horas
              dentro del horario de oficina. Una vez aprobado, tu CRM se configurará automáticamente
              con los módulos y el asistente IA de tu plan.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={handleRefresh}
            >
              <RefreshCw className={`size-3.5 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Comprobar si ya fue aprobada
            </Button>

            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut className="size-3.5 mr-2" />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Modal para ver comprobante en grande */}
      <Dialog open={isViewingImage} onOpenChange={setIsViewingImage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Comprobante de pago</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-center justify-center overflow-hidden rounded-xl bg-black/5 p-2 dark:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={request.receipt_url}
              alt="Comprobante en grande"
              className="max-h-[75vh] w-auto rounded-lg object-contain"
            />
          </div>
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={request.receipt_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5 mr-1.5" />
                Abrir imagen original
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
