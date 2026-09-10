import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LandingHeroProps = {
  isLoggedIn: boolean;
};

export const LandingHero = ({ isLoggedIn }: LandingHeroProps) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-full max-w-5xl -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary shadow-xs"
            >
              <Sparkles className="mr-1.5 size-3.5" />
              CRM omnicanal con IA y operación por módulos
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">•</span>
            <span className="text-xs font-medium text-muted-foreground">
              Meta Cloud API oficial
            </span>
          </div>

          <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-primary uppercase">
            Innover Suite
          </p>

          <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Atiende WhatsApp, Instagram y Messenger.{" "}
            <span className="text-primary">Opera ventas, pedidos o inmuebles</span> en la misma
            plataforma.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Centraliza chats con agente IA 24/7, traspasa a asesores humanos y activa solo los
            módulos de tu rubro: menú y cocina, catálogo e inventario, embudos, citas o inmuebles.
          </p>

          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            {isLoggedIn ? (
              <Button
                asChild
                size="lg"
                className="h-11 px-7 text-sm font-semibold shadow-md shadow-primary/25"
              >
                <Link href="/home">
                  Ir al CRM
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="lg"
                className="h-11 px-7 text-sm font-semibold shadow-md shadow-primary/25"
              >
                <Link href="/login">
                  Empezar ahora
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" size="lg" className="h-11 px-6 text-sm font-semibold">
              <Link href="#industrias">Ver por industria</Link>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
            {["Restaurante", "Tienda", "Servicios", "Inmobiliaria"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-border/70 bg-card/70 px-3 py-1 font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" />
              Meta Cloud API oficial
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" />
              Atención 24/7 con IA
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" />
              Módulos activables
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-4 text-primary" />
              Datos aislados por organización
            </span>
          </div>

          <div className="relative mt-12 w-full max-w-5xl rounded-2xl border border-primary/20 bg-card/60 p-2 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:p-4">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/95">
              <div className="flex h-10 items-center justify-between border-b border-border/60 bg-muted/30 px-4">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-rose-500/70" />
                  <div className="size-2.5 rounded-full bg-amber-500/70" />
                  <div className="size-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <div className="rounded-md bg-muted px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  innover-suite.app/inbox
                </div>
                <div className="text-[11px] font-medium text-primary">Conectado</div>
              </div>

              <div className="grid grid-cols-1 divide-y divide-border/60 text-left md:grid-cols-12 md:divide-x md:divide-y-0">
                <div className="p-4 md:col-span-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Bandeja omnicanal
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      3 activos
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Carlos Méndez</span>
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 text-[10px] text-emerald-600"
                        >
                          WhatsApp
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        ¿Tienen el combo disponible para delivery?
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Valeria Gómez</span>
                        <Badge
                          variant="outline"
                          className="border-pink-500/30 text-[10px] text-pink-600"
                        >
                          Instagram
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        Quiero agendar una visita al apartamento.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Distribuidora Norte
                        </span>
                        <Badge
                          variant="outline"
                          className="border-blue-500/30 text-[10px] text-blue-600"
                        >
                          Messenger
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        Cotización por mayor de 50 unidades.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between p-4 md:col-span-5">
                  <div>
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          CM
                        </div>
                        <div>
                          <div className="text-xs font-semibold">Carlos Méndez</div>
                          <div className="text-[10px] text-muted-foreground">+58 412 ••• 4421</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Bot className="size-3" />
                        IA activa
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5 text-xs">
                      <div className="max-w-[85%] rounded-lg bg-muted p-2.5 text-foreground">
                        ¿Tienen el combo disponible para delivery?
                      </div>
                      <div className="ml-auto max-w-[85%] rounded-lg bg-primary p-2.5 text-primary-foreground">
                        <div className="mb-1 flex items-center gap-1 text-[10px] opacity-90">
                          <Sparkles className="size-3" /> Agente IA Innover
                        </div>
                        Sí, hay Combo Clásico. ¿Lo quieres con limonada incluida? Confirma y creo el
                        pedido para cocina.
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-dashed border-border/80 bg-muted/40 p-2 text-center text-[11px] text-muted-foreground">
                    IA confirma pedidos o citas · handoff humano en 1 clic
                  </div>
                </div>

                <div className="p-4 md:col-span-3">
                  <div className="mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Operación
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <div className="text-[11px] text-muted-foreground">Módulo activo</div>
                      <div className="mt-0.5 text-xs font-bold text-primary">Pedidos + cocina</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <div className="text-[11px] text-muted-foreground">Comanda</div>
                      <div className="mt-0.5 text-xs font-bold text-foreground">#18 · En cocina</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <div className="text-[11px] text-muted-foreground">Total</div>
                      <div className="mt-0.5 text-xs font-medium text-foreground">USD 12,33</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
