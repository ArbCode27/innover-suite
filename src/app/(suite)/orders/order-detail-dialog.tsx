"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  Phone,
  Printer,
  Save,
  Store,
  Truck,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { updateOrderDeliveryAction } from "@/lib/commerce/actions";
import {
  formatMoney,
  FULFILLMENT_LABELS,
  KITCHEN_STATUS_LABELS,
  NEXT_ORDER_STATUS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/commerce/types";
import { CHANNEL_LABELS } from "@/lib/contacts/display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type OrderDetailDialogProps = {
  order: OrderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitchenMode: boolean;
  canManage: boolean;
  canMarkPayment: boolean;
  isPending: boolean;
  onAdvance: (order: OrderRecord) => void;
  onPay: (order: OrderRecord) => void;
  onCancel: (order: OrderRecord) => void;
  onOrderUpdated?: (updated: OrderRecord) => void;
};

const ORDER_STEPS: OrderStatus[] = ["received", "preparing", "ready", "completed"];

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(iso));

const cleanPhoneForWa = (phone: string | null) => {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
};

export const OrderDetailDialog = ({
  order,
  open,
  onOpenChange,
  kitchenMode,
  canManage,
  canMarkPayment,
  isPending,
  onAdvance,
  onPay,
  onCancel,
  onOrderUpdated,
}: OrderDetailDialogProps) => {
  const [isEditingDelivery, setIsEditingDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [isSavingDelivery, startSavingTransition] = useTransition();

  if (!order) return null;

  const statusLabel = (status: OrderStatus) =>
    kitchenMode ? KITCHEN_STATUS_LABELS[status] : ORDER_STATUS_LABELS[status];

  const handleStartEdit = () => {
    setDeliveryAddress(order.deliveryAddress ?? "");
    setDeliveryZone(order.deliveryZone ?? "");
    setCustomerNote(order.customerNote ?? "");
    setIsEditingDelivery(true);
  };

  const handleSaveDelivery = () => {
    startSavingTransition(async () => {
      const result = await updateOrderDeliveryAction({
        orderId: order.id,
        deliveryAddress: deliveryAddress.trim() || null,
        deliveryZone: deliveryZone.trim() || null,
        customerNote: customerNote.trim() || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success ?? "Datos actualizados.");
      setIsEditingDelivery(false);

      if (onOrderUpdated) {
        onOrderUpdated({
          ...order,
          deliveryAddress: deliveryAddress.trim() || null,
          deliveryZone: deliveryZone.trim() || null,
          customerNote: customerNote.trim() || null,
        });
      }
    });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const cleanPhone = cleanPhoneForWa(order.contactPhone);
  const currentStepIndex = ORDER_STEPS.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const nextStatus = NEXT_ORDER_STATUS[order.status];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                #{order.id}
              </span>
              <div>
                <DialogTitle className="text-lg">
                  Pedido #{order.id} — {order.contactName}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {formatDateTime(order.createdAt)}
                  {order.channel ? ` · Vía ${CHANNEL_LABELS[order.channel as keyof typeof CHANNEL_LABELS] ?? order.channel}` : ""}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-semibold px-2.5 py-0.5",
                  order.paymentStatus === "paid"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                )}
              >
                <Wallet className="size-3 mr-1" />
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </Badge>
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                {statusLabel(order.status)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* 1. Stepper de Estado */}
        {!isCancelled ? (
          <div className="my-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs">
              {ORDER_STEPS.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = order.status === step;
                return (
                  <div key={step} className="flex flex-1 flex-col items-center text-center relative">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs font-bold transition",
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : isPassed
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isPassed && !isCurrent ? <Check className="size-3.5" /> : idx + 1}
                    </div>
                    <span
                      className={cn(
                        "mt-1 text-[11px]",
                        isCurrent
                          ? "font-bold text-foreground"
                          : isPassed
                            ? "font-medium text-foreground/80"
                            : "text-muted-foreground",
                      )}
                    >
                      {statusLabel(step)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>Este pedido fue cancelado y su inventario fue restaurado.</span>
          </div>
        )}

        {/* 2. Cliente y Canal */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Cliente
            </p>
            <p className="text-sm font-semibold text-foreground">{order.contactName}</p>

            {order.contactPhone ? (
              <div className="flex items-center gap-2 pt-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                  <Phone className="size-3.5 text-primary" />
                  {order.contactPhone}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => handleCopy(order.contactPhone!, "Teléfono")}
                  title="Copiar teléfono"
                >
                  <Copy className="size-3" />
                </Button>
                {cleanPhone ? (
                  <Button asChild variant="outline" size="xs" className="h-6 text-[11px] gap-1 text-emerald-600 hover:text-emerald-700">
                    <a
                      href={`https://wa.me/${cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                      <ExternalLink className="size-2.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}

            {order.conversationId ? (
              <div className="pt-2">
                <Button asChild variant="secondary" size="xs" className="h-7 text-xs gap-1.5">
                  <Link href={`/inbox?conversation=${order.conversationId}`}>
                    <MessageSquare className="size-3.5" />
                    Abrir conversación en CRM
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          {/* 3. Entrega y Logística */}
          <div className="rounded-xl border border-border/60 bg-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Logística y Entrega
              </p>
              {!isEditingDelivery && canManage && !isCancelled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleStartEdit}
                >
                  <Edit2 className="size-3" />
                  Editar datos
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1",
                  order.fulfillment === "delivery"
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold"
                    : "border-border/60 bg-muted/40",
                )}
              >
                {order.fulfillment === "delivery" ? (
                  <Truck className="size-3.5" />
                ) : (
                  <Store className="size-3.5" />
                )}
                {FULFILLMENT_LABELS[order.fulfillment]}
              </Badge>
              {order.deliveryZone ? (
                <span className="text-xs text-muted-foreground font-medium">
                  Zona: {order.deliveryZone}
                </span>
              ) : null}
            </div>

            {isEditingDelivery ? (
              <div className="space-y-2 pt-1 border-t border-border/40">
                <div>
                  <Label className="text-[11px]">Dirección de Entrega</Label>
                  <Input
                    className="h-8 text-xs mt-0.5"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Calle, avenida, edificio, referencia..."
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Zona de Envío</Label>
                  <Input
                    className="h-8 text-xs mt-0.5"
                    value={deliveryZone}
                    onChange={(e) => setDeliveryZone(e.target.value)}
                    placeholder="Ej: Chacao, Altamira, etc."
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Notas de Entrega / Despacho</Label>
                  <Textarea
                    className="min-h-[50px] text-xs mt-0.5"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Detalles para el repartidor o cliente..."
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={isSavingDelivery}
                    onClick={() => setIsEditingDelivery(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    disabled={isSavingDelivery}
                    onClick={handleSaveDelivery}
                    className="gap-1 font-semibold"
                  >
                    {isSavingDelivery ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-xs">
                {order.deliveryAddress ? (
                  <div className="flex items-start gap-1.5 text-foreground">
                    <MapPin className="size-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">{order.deliveryAddress}</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">
                    {order.fulfillment === "delivery"
                      ? "Sin dirección de entrega registrada"
                      : "Retiro en sede principal"}
                  </p>
                )}

                {order.customerNote ? (
                  <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground mt-1">
                    <span className="font-semibold text-foreground">Nota:</span> {order.customerNote}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* 4. Tabla de Productos */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Productos ({order.items.length})
          </p>
          <div className="rounded-xl border border-border/70 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Producto</TableHead>
                  <TableHead className="text-center text-xs font-semibold w-20">Cant.</TableHead>
                  <TableHead className="text-right text-xs font-semibold w-24">P. Unitario</TableHead>
                  <TableHead className="text-right text-xs font-semibold w-28">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id} className="text-xs">
                    <TableCell>
                      <p className="font-semibold text-foreground">{item.name}</p>
                      {item.notes ? (
                        <p className="text-[11px] text-muted-foreground italic">{item.notes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatMoney(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 5. Desglose Financiero */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-1.5 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums font-medium text-foreground">
              {formatMoney(order.subtotal)}
            </span>
          </div>
          {order.discountAmount ? (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Descuento aplicado</span>
              <span className="tabular-nums font-medium">-{formatMoney(order.discountAmount)}</span>
            </div>
          ) : null}
          {order.taxAmount ? (
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatMoney(order.taxAmount)}
              </span>
            </div>
          ) : null}
          {order.deliveryFee ? (
            <div className="flex justify-between text-muted-foreground">
              <span>Costo de Envío / Delivery</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatMoney(order.deliveryFee)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border/60 pt-2 text-sm font-bold text-foreground">
            <span>Total a pagar</span>
            <span className="text-base text-primary tabular-nums">{formatMoney(order.total)}</span>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Link href={`/print/orders/${order.id}`} target="_blank">
                <Printer className="size-3.5" />
                Imprimir Comanda / Guía
              </Link>
            </Button>

            {canManage && !isCancelled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onCancel(order)}
              >
                <Undo2 className="size-3.5 mr-1" />
                Cancelar Pedido
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {canMarkPayment ? (
              <Button
                type="button"
                variant={order.paymentStatus === "paid" ? "outline" : "secondary"}
                size="sm"
                disabled={isPending}
                className="h-8 text-xs gap-1 font-semibold"
                onClick={() => onPay(order)}
              >
                <Wallet className="size-3.5" />
                {order.paymentStatus === "paid" ? "Marcar como Impago" : "Marcar como Pagado"}
              </Button>
            ) : null}

            {canManage && nextStatus && !isCancelled ? (
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                className="h-8 text-xs gap-1 font-semibold bg-primary hover:bg-primary/90"
                onClick={() => onAdvance(order)}
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="size-3.5" />
                )}
                Avanzar a {statusLabel(nextStatus)}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
