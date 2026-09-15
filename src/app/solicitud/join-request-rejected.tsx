"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Eye,
  Image as ImageIcon,
  Loader2,
  LogOut,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth/actions";
import { resubmitJoinRequestAction } from "@/lib/billing/join-requests";
import type { JoinRequestRecord } from "@/lib/billing/join-requests-types";
import { PAYMENT_METHODS_CONFIG } from "@/lib/billing/payment-methods";
import { getPlanById } from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type JoinRequestRejectedProps = {
  request: JoinRequestRecord;
};

export const JoinRequestRejected = ({ request }: JoinRequestRejectedProps) => {
  const router = useRouter();
  const [paymentReference, setPaymentReference] = useState(request.payment_reference);
  const [customerNotes, setCustomerNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isViewingPrevious, setIsViewingPrevious] = useState(false);
  const [isPending, startTransition] = useTransition();

  const plan = getPlanById(request.plan_id);
  const paymentInfo = PAYMENT_METHODS_CONFIG[request.payment_method];

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

  const handleResubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentReference.trim()) {
      toast.error("Indica el número o código de referencia.");
      return;
    }

    const formData = new FormData();
    formData.append("requestId", String(request.id));
    formData.append("paymentReference", paymentReference.trim());
    if (customerNotes.trim()) {
      formData.append("customerNotes", customerNotes.trim());
    }
    if (receiptFile) {
      formData.append("receipt", receiptFile);
    }

    startTransition(async () => {
      const result = await resubmitJoinRequestAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Comprobante reenviado a revisión.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-destructive/30 bg-destructive/[0.03]">
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                <AlertCircle className="size-6" />
              </span>
              <div>
                <CardTitle className="text-xl">Pago No Validado</CardTitle>
                <CardDescription>
                  Tu solicitud anterior fue rechazada. Revisa el motivo a continuación y corrige los
                  datos.
                </CardDescription>
              </div>
            </div>
            <Badge variant="destructive" className="px-3 py-1 text-xs">
              Rechazado
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Motivo del rechazo indicado por el admin */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
              Motivo indicado por la administración
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {request.admin_notes || "El comprobante no pudo ser validado o la referencia es incorrecta."}
            </p>
          </div>

          <div className="grid gap-4 text-xs sm:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <span className="text-muted-foreground">Empresa:</span>
              <p className="font-semibold text-foreground">{request.organization_name}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <span className="text-muted-foreground">Plan:</span>
              <p className="font-semibold text-foreground">
                {plan?.name ?? request.plan_id} (${request.amount_usd} USD)
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <span className="text-muted-foreground">Método:</span>
              <p className="font-semibold text-foreground">{paymentInfo?.name ?? request.payment_method}</p>
            </div>
          </div>

          {/* Formulario de corrección */}
          <form onSubmit={handleResubmit} className="space-y-5 rounded-2xl border border-border/70 bg-card p-5">
            <h3 className="text-base font-semibold">Corregir y Reenviar Comprobante</h3>

            <div className="space-y-2">
              <Label htmlFor="ref">Número de Referencia Corregido</Label>
              <Input
                id="ref"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Nuevo Comprobante o Captura</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setIsViewingPrevious(true)}
                >
                  <Eye className="size-3.5 mr-1" />
                  Ver comprobante anterior
                </Button>
              </div>

              {receiptPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-3">
                  <div className="flex items-center justify-between pb-2">
                    <span className="truncate text-xs text-muted-foreground">{receiptFile?.name}</span>
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
                    alt="Vista previa del nuevo comprobante"
                    className="max-h-72 w-auto rounded-xl object-contain"
                  />
                </div>
              ) : (
                <label
                  htmlFor="new-receipt-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-6 text-center transition hover:border-primary/50"
                >
                  <UploadCloud className="size-8 text-primary/70" />
                  <p className="mt-2 text-xs font-medium text-foreground">
                    Sube una nueva captura si la anterior estaba borrosa o incorrecta
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Si el comprobante anterior era el correcto, puedes dejar este campo vacío y corregir solo la referencia.
                  </p>
                  <input
                    id="new-receipt-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Aclaratoria o Nota para el Administrador (Opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Ej: Ya corregí el número de referencia correcto, disculpen el error..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <Button type="submit" disabled={isPending} className="font-semibold">
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Reenviando comprobante...
                  </>
                ) : (
                  <>
                    <Check className="size-4 mr-2" />
                    Reenviar para nueva revisión
                  </>
                )}
              </Button>

              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                  <LogOut className="size-3.5 mr-2" />
                  Cerrar sesión
                </Button>
              </form>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modal para ver comprobante anterior */}
      <Dialog open={isViewingPrevious} onOpenChange={setIsViewingPrevious}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">Comprobante anterior</DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-center justify-center overflow-hidden rounded-xl bg-black/5 p-2 dark:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={request.receipt_url}
              alt="Comprobante anterior"
              className="max-h-[75vh] w-auto rounded-lg object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
