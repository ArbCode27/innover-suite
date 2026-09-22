"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resolveConversationAction } from "@/app/(suite)/inbox/actions";

const RESOLUTION_REASONS = [
  "Venta / Pedido concretado con éxito",
  "Consulta o soporte aclarado",
  "Cita o reserva agendada",
  "Información y catálogo enviados",
  "Atención culminada - Sin acción pendiente",
] as const;

type ResolveConversationDialogProps = {
  conversationId: number;
  contactName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
};

export const ResolveConversationDialog = ({
  conversationId,
  contactName,
  trigger,
  onSuccess,
}: ResolveConversationDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [outcome, setOutcome] = useState<"successful" | "unresolved">("successful");
  const [reason, setReason] = useState<string>(RESOLUTION_REASONS[0]);
  const [summary, setSummary] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleResolve = () => {
    startTransition(async () => {
      const result = await resolveConversationAction({
        conversationId,
        outcome,
        reason,
        summary: summary.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success || "Conversación culminada con éxito.");
      setIsOpen(false);
      setSummary("");
      onSuccess?.();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-emerald-500/35 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
            aria-label="Resolver conversación"
          >
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Resolver</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            Culminar conversación
          </DialogTitle>
          <DialogDescription>
            Archiva la conversación actual con <strong className="text-foreground">{contactName}</strong> en su historial.
            Si el cliente vuelve a escribir más adelante, se anexará al mismo historial sin perder este registro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="resolution-outcome" className="text-xs font-semibold">
              Resultado
            </Label>
            <select
              id="resolution-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as "successful" | "unresolved")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="successful">Exitosa / Lograda</option>
              <option value="unresolved">Culminada sin concretar</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resolution-reason" className="text-xs font-semibold">
              Motivo de culminación
            </Label>
            <select
              id="resolution-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {RESOLUTION_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="resolution-summary" className="text-xs font-semibold">
              Nota o resumen de cierre (opcional)
            </Label>
            <Textarea
              id="resolution-summary"
              placeholder="Ej: Se confirmó el pedido #104. Cliente agradecido por la rapidez."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleResolve}
            disabled={isPending}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Confirmar y archivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
