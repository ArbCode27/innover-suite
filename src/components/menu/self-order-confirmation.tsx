"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { OrderStarRating } from "@/components/menu/order-star-rating";
import { OrderTicketIcon } from "@/components/menu/order-ticket-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/lib/commerce/types";
import { cn } from "@/lib/utils";

type SelfOrderConfirmationProps = {
  slug: string;
  orgName: string;
  orderId: string | null;
  total: number | null;
  currency: string;
};

const ratingStorageKey = (slug: string, orderId: string | null) =>
  `menu-order-rating:${slug}:${orderId ?? "pending"}`;

export const SelfOrderConfirmation = ({
  slug,
  orgName,
  orderId,
  total,
  currency,
}: SelfOrderConfirmationProps) => {
  const [entered, setEntered] = useState(false);
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const displayId = orderId ? `#${orderId}` : "#—";
  const confirmedAt = new Intl.DateTimeFormat("es-VE", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ratingStorageKey(slug, orderId));
      if (!raw) return;
      const parsed = Number(raw);
      if (parsed >= 1 && parsed <= 5) {
        setRating(parsed);
        setSubmitted(true);
      }
    } catch {
      // private mode
    }
  }, [slug, orderId]);

  const handleSubmitRating = () => {
    if (rating < 1) {
      toast.error("Elige una calificación de 1 a 5 estrellas.");
      return;
    }
    try {
      window.localStorage.setItem(ratingStorageKey(slug, orderId), String(rating));
    } catch {
      // private mode
    }
    setSubmitted(true);
    toast.success(
      rating >= 4
        ? "¡Gracias! Nos alegra que te haya gustado."
        : "Gracias por tu opinión. La tomaremos en cuenta.",
    );
  };

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center px-4 py-10">
      <div className="relative w-full">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[min(34rem,90vw)] w-[min(34rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--primary)_22%,transparent)_0%,transparent_68%)] blur-2xl"
        />

        <article
          className={cn(
            "relative w-full overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/95 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)] backdrop-blur-xl transition duration-700",
            entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <div className="space-y-6 px-6 pb-7 pt-6 sm:px-8">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground dark:text-foreground/65">
                  Tu pedido
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {displayId}
                </p>
                <p className="mt-1 text-xs text-muted-foreground dark:text-foreground/70">{orgName}</p>
              </div>
              <Badge className="rounded-full border-transparent bg-emerald-500/15 px-3 py-1 text-emerald-600 dark:text-emerald-400">
                Enviado
              </Badge>
            </header>

            <OrderTicketIcon className="my-1" />

            <div className="space-y-3 text-center">
              <div className="space-y-2">
                <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                  ¿Cómo estuvo tu experiencia?
                </h1>
                <p className="text-sm text-muted-foreground dark:text-foreground/75">
                  Tu orden ya está en cocina. Te avisaremos cuando esté lista.
                </p>
                <p className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground dark:text-foreground/65">
                  <Clock3 className="size-3.5" aria-hidden />
                  Confirmado a las {confirmedAt}
                </p>
              </div>

              <OrderStarRating
                value={rating}
                onChange={setRating}
                disabled={submitted}
              />
            </div>

            <Separator className="bg-border/60" />

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground dark:text-foreground/65">Total del pedido</p>
                <p className="text-lg font-semibold tabular-nums">
                  {total != null ? formatMoney(total, currency) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground dark:text-foreground/65">Estado</p>
                <p className="text-sm font-medium text-primary">En cocina</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              {!submitted ? (
                <Button
                  type="button"
                  size="lg"
                  className="h-12 w-full rounded-2xl text-base font-semibold shadow-md"
                  disabled={rating < 1}
                  onClick={handleSubmitRating}
                >
                  Enviar calificación
                </Button>
              ) : (
                <div className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" aria-hidden />
                  Calificación enviada · {rating}/5
                </div>
              )}

              <Button
                asChild
                size="lg"
                variant={submitted ? "default" : "outline"}
                className="h-12 w-full rounded-2xl text-base font-semibold"
              >
                <Link href={`/menu/${slug}`}>
                  Seguir pidiendo
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>

              <p className="text-center text-[11px] text-muted-foreground dark:text-foreground/60">
                Guarda el número {displayId} por si necesitas consultar tu orden.
              </p>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
};
