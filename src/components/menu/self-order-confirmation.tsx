"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { OrderStarRating } from "@/components/menu/order-star-rating";
import { OrderTicketIcon } from "@/components/menu/order-ticket-icon";
import { Button } from "@/components/ui/button";
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
          className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto h-[28rem] w-[min(100%,28rem)] -translate-y-1/2 rounded-[40%] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_18%,transparent)_0%,transparent_70%)] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--secondary)_35%,transparent),transparent_55%)]"
        />

        <article
          className={cn(
            "relative w-full overflow-hidden rounded-[1.5rem] bg-card shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)] ring-1 ring-foreground/8 transition duration-700",
            entered ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
          )}
        >
          {/* Ticket top strip */}
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_14%,var(--card))_0%,color-mix(in_oklch,var(--secondary)_28%,var(--card))_100%)] px-6 pb-5 pt-7 sm:px-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(color-mix(in_oklch,var(--foreground)_8%,transparent)_1px,transparent_1px)] [background-size:14px_14px]"
            />
            <div className="relative space-y-1 text-center">
              <p className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">
                {orgName}
              </p>
              <p className="text-sm text-muted-foreground">Pedido recibido · gracias por elegirnos</p>
            </div>
          </div>

          {/* Perforation */}
          <div className="relative h-4 bg-card" aria-hidden>
            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-foreground/15" />
            <span className="absolute left-0 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
            <span className="absolute right-0 top-1/2 size-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
          </div>

          <div className="space-y-6 px-6 pb-8 pt-2 sm:px-8">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Comanda
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {displayId}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                En cocina
              </p>
            </div>

            <OrderTicketIcon className="my-0" />

            <div className="space-y-3 text-center">
              <div className="space-y-2">
                <h1 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                  ¿Cómo estuvo tu experiencia?
                </h1>
                <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Tu orden ya está en cocina. Te avisaremos cuando esté lista para disfrutar.
                </p>
                <p className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
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

            <div className="space-y-2.5 rounded-2xl bg-muted/40 px-4 py-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Total del pedido</span>
                <span className="text-lg font-semibold tabular-nums tracking-tight">
                  {total != null ? formatMoney(total, currency) : "—"}
                </span>
              </div>
              <div className="border-t border-dashed border-foreground/12" />
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                Guarda el número {displayId} por si necesitas consultar tu orden.
              </p>
            </div>

            <div className="space-y-2.5">
              {!submitted ? (
                <Button
                  type="button"
                  size="lg"
                  className="h-12 w-full rounded-2xl text-base font-semibold"
                  disabled={rating < 1}
                  onClick={handleSubmitRating}
                >
                  Enviar calificación
                </Button>
              ) : (
                <div className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary/10 text-sm font-medium text-primary">
                  <Check className="size-4" aria-hidden />
                  Gracias por tu calificación · {rating}/5
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
            </div>
          </div>
        </article>
      </div>
    </main>
  );
};
