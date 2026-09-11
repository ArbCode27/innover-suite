import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type LandingCtaProps = {
  isLoggedIn: boolean;
};

export const LandingCta = ({ isLoggedIn }: LandingCtaProps) => {
  return (
    <section className="border-t border-border/40 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_14%,var(--card))_0%,var(--card)_55%,color-mix(in_oklch,var(--secondary)_22%,var(--card))_100%)] px-6 py-12 text-center sm:px-10 sm:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(color-mix(in_oklch,var(--foreground)_8%,transparent)_1px,transparent_1px)] [background-size:18px_18px]"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Un CRM omnicanal que también opera tu negocio
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Chats, ventas, pedidos, cocina, inventario o inmuebles: activa solo los módulos que
              necesitas y empieza con la plantilla de tu industria.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
                Plantillas por rubro
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
                Módulos activables
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" aria-hidden />
                Meta Cloud API
              </span>
            </div>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isLoggedIn ? (
                <Button asChild size="lg" className="h-11 px-7 font-semibold shadow-md shadow-primary/25">
                  <Link href="/home">
                    Ir al CRM
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="h-11 px-7 font-semibold shadow-md shadow-primary/25">
                  <Link href="/login">
                    Empezar ahora
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="h-11 px-6 font-semibold">
                <Link href="#planes">Ver planes</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
