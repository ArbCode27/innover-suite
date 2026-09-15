"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Copy,
  CreditCard,
  Image as ImageIcon,
  Loader2,
  Store,
  UploadCloud,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { submitJoinRequestAction } from "@/lib/billing/join-requests";
import {
  PAYMENT_METHODS,
  PAYMENT_METHODS_CONFIG,
  type PaymentMethod,
} from "@/lib/billing/payment-methods";
import {
  PLAN_CATALOG,
  type BillingTier,
  type BillingVertical,
  type PlanRecord,
} from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const VERTICAL_OPTIONS: Array<{
  id: BillingVertical;
  label: string;
  desc: string;
  icon: typeof UtensilsCrossed;
}> = [
  {
    id: "restaurant",
    label: "Restaurante",
    desc: "Menú, pedidos y cocina por chat",
    icon: UtensilsCrossed,
  },
  {
    id: "ventas",
    label: "Ventas",
    desc: "Catálogo, pedidos, embudo y citas",
    icon: Store,
  },
  {
    id: "realestate",
    label: "Inmobiliaria",
    desc: "Inmuebles, visitas y captación",
    icon: Building2,
  },
];

const TIER_OPTIONS: Array<{ id: BillingTier; label: string }> = [
  { id: "basic", label: "Básico" },
  { id: "pro", label: "Pro (Recomendado)" },
  { id: "plus", label: "Plus" },
];

export const JoinRequestForm = () => {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [vertical, setVertical] = useState<BillingVertical>("ventas");
  const [tier, setTier] = useState<BillingTier>("pro");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pagomovil");
  const [paymentReference, setPaymentReference] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentPlan: PlanRecord =
    PLAN_CATALOG.find((p) => p.vertical === vertical && p.tier === tier) ??
    PLAN_CATALOG[4]!;

  const paymentInfo = PAYMENT_METHODS_CONFIG[paymentMethod];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen (JPG, PNG o WebP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen no puede pesar más de 10MB.");
      return;
    }

    setReceiptFile(file);
    const objectUrl = URL.createObjectURL(file);
    setReceiptPreview(objectUrl);
  };

  const handleRemoveFile = () => {
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationName.trim()) {
      toast.error("Ingresa el nombre de tu empresa.");
      return;
    }

    if (!paymentReference.trim()) {
      toast.error("Indica el número o código de referencia de tu pago.");
      return;
    }

    if (!receiptFile) {
      toast.error("Adjunta el comprobante o captura de pantalla del pago.");
      return;
    }

    const formData = new FormData();
    formData.append("organizationName", organizationName.trim());
    formData.append("businessTemplate", vertical);
    formData.append("planId", currentPlan.id);
    formData.append("paymentMethod", paymentMethod);
    formData.append("paymentReference", paymentReference.trim());
    if (customerNotes.trim()) {
      formData.append("customerNotes", customerNotes.trim());
    }
    formData.append("receipt", receiptFile);

    startTransition(async () => {
      const result = await submitJoinRequestAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Solicitud enviada");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Datos de la empresa */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <CardTitle className="text-lg">Tu Empresa</CardTitle>
          </div>
          <CardDescription>
            Ingresa el nombre comercial y el modelo de negocio principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Nombre de la Empresa o Marca</Label>
            <Input
              id="orgName"
              placeholder="Ej: Hamburguesas Caracas, Boutique Rosa, etc."
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Modelo de Negocio</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {VERTICAL_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = vertical === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVertical(opt.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition hover:border-primary/40",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border/60 bg-card",
                    )}
                  >
                    <Icon className="size-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Selección de Plan */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <CardTitle className="text-lg">Plan Seleccionado</CardTitle>
          </div>
          <CardDescription>
            Elige el nivel de capacidad que mejor se adapte a tu operación mensual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {TIER_OPTIONS.map((t) => {
              const plan = PLAN_CATALOG.find(
                (p) => p.vertical === vertical && p.tier === t.id,
              );
              const isSelected = tier === t.id;
              if (!plan) return null;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-4 text-left transition hover:border-primary/40",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border/60 bg-card",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{t.label}</span>
                      {plan.leadRecovery ? (
                        <Badge variant="outline" className="text-[10px] text-primary">
                          Follow-up IA
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-2xl font-bold tracking-tight">
                      ${plan.priceUsd}
                      <span className="text-xs font-normal text-muted-foreground">/mes</span>
                    </p>
                  </div>
                  <div className="mt-4 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                    <p>• Hasta {plan.usersLimit} usuarios</p>
                    <p>• {plan.aiResponsesLimit.toLocaleString("es-VE")} respuestas IA</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{currentPlan.name}:</span> Este plan se
            activará con un periodo inicial de 30 días con todos los módulos correspondientes.
          </div>
        </CardContent>
      </Card>

      {/* 3. Datos de Pago */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <CardTitle className="text-lg">Información de Pago</CardTitle>
          </div>
          <CardDescription>
            Monto a transferir:{" "}
            <span className="font-bold text-foreground">
              ${currentPlan.priceUsd} USD
            </span>{" "}
            o su equivalente según el método elegido.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map((methodKey) => {
              const info = PAYMENT_METHODS_CONFIG[methodKey];
              const isSelected = paymentMethod === methodKey;
              return (
                <button
                  key={methodKey}
                  type="button"
                  onClick={() => setPaymentMethod(methodKey)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition",
                    isSelected
                      ? "border-primary bg-primary/10 font-semibold text-primary ring-1 ring-primary/30"
                      : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <CreditCard className="size-4" />
                  <span className="text-xs">{info.name}</span>
                </button>
              );
            })}
          </div>

          {/* Caja con datos receptores */}
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{paymentInfo.name}</p>
                <p className="text-xs text-muted-foreground">{paymentInfo.subtitle}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {paymentInfo.currency}
              </Badge>
            </div>

            {paymentInfo.note ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Nota: {paymentInfo.note}
              </p>
            ) : null}

            <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
              {paymentInfo.fields.map((field) => (
                <div
                  key={field.label}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-background/80 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="block text-[10px] text-muted-foreground">{field.label}</span>
                    <span className="font-medium text-foreground">{field.value}</span>
                  </div>
                  {field.copyable ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => handleCopy(field.value, field.label)}
                      title={`Copiar ${field.label}`}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Comprobante y Referencia */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              4
            </span>
            <CardTitle className="text-lg">Comprobante de Pago</CardTitle>
          </div>
          <CardDescription>
            Sube la captura de pantalla legible donde se aprecie la fecha, monto y referencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ref">Número de Referencia / Código de Confirmación</Label>
            <Input
              id="ref"
              placeholder="Ej: 12345678, Ref #987263, TxID..."
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Captura del Comprobante (JPG, PNG o WebP)</Label>

            {receiptPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="size-4 text-primary" />
                    <span className="truncate max-w-xs">{receiptFile?.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleRemoveFile}
                  >
                    <X className="size-3.5 mr-1" />
                    Quitar
                  </Button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptPreview}
                  alt="Vista previa del comprobante"
                  className="max-h-80 w-auto rounded-xl object-contain shadow-sm"
                />
              </div>
            ) : (
              <label
                htmlFor="receipt-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-8 text-center transition hover:border-primary/50 hover:bg-muted/40"
              >
                <UploadCloud className="size-10 text-primary/70" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Haz clic para subir o arrastra la captura aquí
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG o WebP (máximo 10MB)
                </p>
                <input
                  id="receipt-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas o Comentarios Adicionales (Opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ej: Pago realizado desde cuenta de tercero a nombre de..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="h-12 w-full text-base font-semibold shadow-md shadow-primary/25"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin mr-2" />
            Enviando solicitud y comprobante...
          </>
        ) : (
          <>
            <Check className="size-4 mr-2" />
            Enviar solicitud para activación
          </>
        )}
      </Button>
    </form>
  );
};
