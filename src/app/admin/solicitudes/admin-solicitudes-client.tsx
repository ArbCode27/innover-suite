"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Search,
  Store,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminApproveJoinRequestAction,
  adminRejectJoinRequestAction,
} from "@/lib/billing/join-requests";
import type { JoinRequestRecord, JoinRequestStatus } from "@/lib/billing/join-requests-types";
import { PAYMENT_METHODS_CONFIG } from "@/lib/billing/payment-methods";
import { getPlanById } from "@/lib/billing/plans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AdminSolicitudesClientProps = {
  requests: JoinRequestRecord[];
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Caracas",
  }).format(new Date(iso));

const statusBadges: Record<
  JoinRequestStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pendiente",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  approved: {
    label: "Aprobada",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: Check,
  },
  rejected: {
    label: "Rechazada",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive",
    icon: XCircle,
  },
};

const templateIcons = {
  restaurant: UtensilsCrossed,
  ventas: Store,
  realestate: Building2,
};

export const AdminSolicitudesClient = ({ requests }: AdminSolicitudesClientProps) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modal de imagen de comprobante
  const [viewingReceipt, setViewingReceipt] = useState<JoinRequestRecord | null>(null);

  // Modal de aprobación
  const [approvingRequest, setApprovingRequest] = useState<JoinRequestRecord | null>(null);

  // Modal de rechazo
  const [rejectingRequest, setRejectingRequest] = useState<JoinRequestRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const filteredRequests = requests.filter((req) => {
    // Filtro por tab
    if (activeTab !== "all" && req.status !== activeTab) {
      return false;
    }

    // Filtro de búsqueda
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      req.organization_name.toLowerCase().includes(term) ||
      req.user_email.toLowerCase().includes(term) ||
      req.payment_reference.toLowerCase().includes(term) ||
      req.payment_method.toLowerCase().includes(term)
    );
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const handleConfirmApprove = () => {
    if (!approvingRequest) return;
    const id = approvingRequest.id;

    startTransition(async () => {
      const result = await adminApproveJoinRequestAction(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Organización aprobada y activada con éxito.");
      setApprovingRequest(null);
      router.refresh();
    });
  };

  const handleConfirmReject = () => {
    if (!rejectingRequest) return;
    if (!rejectReason.trim()) {
      toast.error("Por favor ingresa el motivo del rechazo.");
      return;
    }

    const payload = {
      requestId: rejectingRequest.id,
      reason: rejectReason.trim(),
    };

    startTransition(async () => {
      const result = await adminRejectJoinRequestAction(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Solicitud rechazada.");
      setRejectingRequest(null);
      setRejectReason("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Controles superiores: Tabs y Buscador */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 h-10 w-full sm:w-[480px]">
            <TabsTrigger value="pending" className="flex items-center gap-1.5 text-xs">
              Pendientes
              {pendingCount > 0 ? (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {pendingCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1.5 text-xs">
              Aprobadas
              <span className="text-[10px] text-muted-foreground">({approvedCount})</span>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1.5 text-xs">
              Rechazadas
              <span className="text-[10px] text-muted-foreground">({rejectedCount})</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              Todas ({requests.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, email o ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 text-xs"
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Listado de solicitudes */}
      {filteredRequests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="size-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-base font-semibold">No hay solicitudes en esta sección</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search
                ? "No se encontraron coincidencias con el término de búsqueda."
                : "No hay registros con el estado seleccionado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Fecha</TableHead>
                  <TableHead>Empresa & Solicitante</TableHead>
                  <TableHead>Plan & Monto</TableHead>
                  <TableHead>Método & Referencia</TableHead>
                  <TableHead className="text-center">Comprobante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const plan = getPlanById(req.plan_id);
                  const statusInfo = statusBadges[req.status];
                  const paymentInfo = PAYMENT_METHODS_CONFIG[req.payment_method];
                  const Icon = templateIcons[req.business_template] ?? Store;

                  return (
                    <TableRow key={req.id}>
                      {/* Fecha */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(req.created_at)}
                      </TableCell>

                      {/* Empresa y Solicitante */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="size-3.5 text-primary" />
                            <span className="font-semibold text-foreground text-sm">
                              {req.organization_name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{req.user_email}</p>
                          {req.customer_notes ? (
                            <p className="text-[11px] text-muted-foreground/80 italic">
                              Nota: {req.customer_notes}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Plan */}
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="text-xs font-medium">
                            {plan?.name ?? req.plan_id}
                          </Badge>
                          <p className="mt-0.5 text-xs font-semibold text-foreground">
                            ${req.amount_usd} USD
                          </p>
                        </div>
                      </TableCell>

                      {/* Método y Referencia */}
                      <TableCell>
                        <div className="space-y-1">
                          <span className="inline-block text-xs font-medium">
                            {paymentInfo?.name ?? req.payment_method}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {req.payment_reference}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-5"
                              onClick={() => handleCopy(req.payment_reference, "Referencia")}
                              title="Copiar referencia"
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>

                      {/* Comprobante */}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          onClick={() => setViewingReceipt(req)}
                          className="group relative inline-block overflow-hidden rounded-lg border border-border/80 transition hover:ring-2 hover:ring-primary/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={req.receipt_url}
                            alt="Capture"
                            className="size-12 object-cover transition group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                            <Eye className="size-4 text-white" />
                          </div>
                        </button>
                      </TableCell>

                      {/* Estado */}
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className={statusInfo.className}>
                            {statusInfo.label}
                          </Badge>
                          {req.status === "rejected" && req.admin_notes ? (
                            <p className="text-[11px] text-destructive max-w-xs truncate" title={req.admin_notes}>
                              {req.admin_notes}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-right whitespace-nowrap">
                        {req.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                              onClick={() => setApprovingRequest(req)}
                            >
                              <Check className="size-3.5 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                              onClick={() => {
                                setRejectingRequest(req);
                                setRejectReason("");
                              }}
                            >
                              <X className="size-3.5 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        ) : req.status === "approved" && req.created_organization_id ? (
                          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                            <Link href={`/admin/organizations/${req.created_organization_id}`}>
                              Ver Empresa
                            </Link>
                          </Button>
                        ) : req.status === "rejected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            onClick={() => setApprovingRequest(req)}
                          >
                            Re-evaluar y Aprobar
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal 1: Visor de Comprobante */}
      <Dialog open={!!viewingReceipt} onOpenChange={(open) => !open && setViewingReceipt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base pr-6">
              <span>
                Comprobante — {viewingReceipt?.organization_name} (
                {viewingReceipt && PAYMENT_METHODS_CONFIG[viewingReceipt.payment_method]?.name})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ref: <span className="font-mono font-bold">{viewingReceipt?.payment_reference}</span>{" "}
              — Monto: ${viewingReceipt?.amount_usd} USD
            </DialogDescription>
          </DialogHeader>

          {viewingReceipt ? (
            <div className="mt-2 flex items-center justify-center overflow-hidden rounded-xl bg-muted/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewingReceipt.receipt_url}
                alt="Comprobante en detalle"
                className="max-h-[70vh] w-auto rounded-lg object-contain shadow-md"
              />
            </div>
          ) : null}

          <DialogFooter className="flex sm:justify-between items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Usuario: <span className="font-medium text-foreground">{viewingReceipt?.user_email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={viewingReceipt?.receipt_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5 mr-1.5" />
                  Abrir original
                </a>
              </Button>
              {viewingReceipt?.status === "pending" ? (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      const r = viewingReceipt;
                      setViewingReceipt(null);
                      setApprovingRequest(r);
                    }}
                  >
                    <Check className="size-3.5 mr-1" />
                    Proceder a Aprobar
                  </Button>
                </>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Confirmación de Aprobación */}
      <Dialog
        open={!!approvingRequest}
        onOpenChange={(open) => !open && !isPending && setApprovingRequest(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-emerald-600 dark:text-emerald-400">
              <Check className="size-5" />
              Aprobar Solicitud y Crear Empresa
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirma que el pago ha sido validado satisfactoriamente en tu cuenta receptora.
            </DialogDescription>
          </DialogHeader>

          {approvingRequest ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empresa a crear:</span>
                <span className="font-semibold text-foreground">
                  {approvingRequest.organization_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuario Owner:</span>
                <span className="font-mono text-foreground">{approvingRequest.user_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan asignado:</span>
                <span className="font-semibold text-foreground">
                  {getPlanById(approvingRequest.plan_id)?.name} (${approvingRequest.amount_usd} USD)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Método y Ref:</span>
                <span>
                  {approvingRequest.payment_method.toUpperCase()} —{" "}
                  <span className="font-mono font-bold">{approvingRequest.payment_reference}</span>
                </span>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300">
                Al aprobar, el sistema provisionará inmediatamente 30 días de periodo activo,
                asignará los módulos correspondientes del plan y el usuario tendrá acceso total a su CRM.
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setApprovingRequest(null)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={handleConfirmApprove}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Activando...
                </>
              ) : (
                <>
                  <Check className="size-3.5 mr-1.5" />
                  Confirmar y Activar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Motivo de Rechazo */}
      <Dialog
        open={!!rejectingRequest}
        onOpenChange={(open) => !open && !isPending && setRejectingRequest(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertCircle className="size-5" />
              Rechazar Solicitud de Ingreso
            </DialogTitle>
            <DialogDescription className="text-xs">
              Indica la razón por la que no se pudo validar el pago. Esta nota la verá el cliente
              para poder corregir su comprobante o referencia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              Empresa:{" "}
              <span className="font-semibold text-foreground">
                {rejectingRequest?.organization_name}
              </span>{" "}
              ({rejectingRequest?.user_email})
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs">
                Motivo del Rechazo
              </Label>
              <Textarea
                id="reason"
                placeholder="Ej: La referencia 123456 no aparece acreditada en la cuenta bancaria. Por favor verificar los dígitos o enviar comprobante emitido por el banco emisor."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
              />
            </div>

            {/* Opciones rápidas */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "Referencia no encontrada en cuenta",
                "Monto transferido no coincide con el plan",
                "Capture borroso o ilegible",
                "Pago devuelto o rechazado por banco",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setRejectReason(suggestion)}
                  className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setRejectingRequest(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleConfirmReject}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Rechazando...
                </>
              ) : (
                <>
                  <X className="size-3.5 mr-1.5" />
                  Confirmar Rechazo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
