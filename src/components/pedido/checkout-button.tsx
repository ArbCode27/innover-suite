"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PedidoRequestError } from "@/lib/pedidos-service";
import { useCartStore } from "@/store/cart-store";

type CheckoutButtonProps = {
  onBeforeNavigate?: () => void;
};

export const CheckoutButton = ({ onBeforeNavigate }: CheckoutButtonProps) => {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const isSubmitting = useCartStore((state) => state.isSubmitting);
  const enviarPedido = useCartStore((state) => state.enviarPedido);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await enviarPedido();
        onBeforeNavigate?.();
        toast.success(`Pedido ${result.numeroOrden} enviado a cocina`);
        router.push(`/pedir/confirmacion?orden=${encodeURIComponent(result.numeroOrden)}`);
      } catch (err) {
        const message =
          err instanceof PedidoRequestError
            ? err.message
            : err instanceof Error
              ? err.message
              : "No se pudo enviar el pedido.";
        setError(message);
      }
    });
  };

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo confirmar</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={handleSubmit}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        className="h-12 w-full rounded-2xl"
        disabled={!items.length || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Enviando…
          </>
        ) : (
          "Confirmar y enviar pedido"
        )}
      </Button>
    </div>
  );
};
