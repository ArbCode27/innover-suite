import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Lock,
  MessageCircle,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LandingHeroProps = {
  isLoggedIn: boolean;
};

export const LandingHero = ({ isLoggedIn }: LandingHeroProps) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Decorative gradient glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-full max-w-5xl -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          {/* Eyebrow badge */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary shadow-xs"
            >
              <Sparkles className="mr-1.5 size-3.5" />
              CRM Omnicanal B2B con Inteligencia Artificial
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">•</span>
            <span className="text-xs font-medium text-muted-foreground">
              Integración oficial con Meta APIs
            </span>
          </div>

          {/* Heading */}
          <h1 className="max-w-4xl text-3xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Gestiona <span className="text-primary">WhatsApp, Instagram y Messenger</span> en una
            sola plataforma inteligente
          </h1>

          {/* Description */}
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Innover Suite permite a empresas y comercios conectar sus cuentas oficiales de Meta,
            responder consultas con agentes de IA 24/7, transferir conversaciones a asesores humanos
            y gestionar embudos comerciales con total trazabilidad y seguridad.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
            {isLoggedIn ? (
              <Button asChild size="lg" className="h-11 px-7 text-sm font-semibold shadow-md shadow-primary/25">
                <Link href="/home">
                  Ir al CRM
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-11 px-7 text-sm font-semibold shadow-md shadow-primary/25">
                <Link href="/login">
                  Acceder a la plataforma
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            )}

            <Button asChild variant="outline" size="lg" className="h-11 px-6 text-sm font-semibold">
              <Link href="#canales">Ver canales y funciones</Link>
            </Button>
          </div>

          {/* Value points */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
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
              Traspaso a asesor humano
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="size-4 text-primary" />
              Datos protegidos y aislados
            </span>
          </div>

          {/* UI Mockup / Visual representation */}
          <div className="relative mt-12 w-full max-w-5xl rounded-2xl border border-primary/20 bg-card/60 p-2 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:p-4">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background/95">
              {/* Mockup browser header */}
              <div className="flex h-10 items-center justify-between border-b border-border/60 bg-muted/30 px-4">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-rose-500/70" />
                  <div className="size-2.5 rounded-full bg-amber-500/70" />
                  <div className="size-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <div className="rounded-md bg-muted px-3 py-1 text-[11px] text-muted-foreground font-mono">
                  innover-suite.app/inbox
                </div>
                <div className="text-[11px] font-medium text-primary">Conectado</div>
              </div>

              {/* Mockup preview columns */}
              <div className="grid grid-cols-1 divide-y divide-border/60 text-left md:grid-cols-12 md:divide-x md:divide-y-0">
                {/* Left: Chat list */}
                <div className="p-4 md:col-span-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Bandeja Omnicanal
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      3 activos
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Carlos Méndez</span>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                          WhatsApp
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        ¿Tienen disponibilidad del modelo para entrega inmediata?
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Valeria Gómez</span>
                        <Badge variant="outline" className="text-[10px] text-pink-600 border-pink-500/30">
                          Instagram
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        Hola, vi su publicación y me interesa agendar una cita.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-card p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Distribuidora Norte</span>
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/30">
                          Messenger
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        Solicito cotización por mayor de 50 unidades.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Middle: Active Chat + AI Assistant */}
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
                        IA Activa
                      </div>
                    </div>

                    {/* Chat balloons */}
                    <div className="mt-4 space-y-2.5 text-xs">
                      <div className="max-w-[85%] rounded-lg bg-muted p-2.5 text-foreground">
                        ¿Tienen disponibilidad del modelo para entrega inmediata?
                      </div>
                      <div className="ml-auto max-w-[85%] rounded-lg bg-primary p-2.5 text-primary-foreground">
                        <div className="mb-1 flex items-center gap-1 text-[10px] opacity-90">
                          <Sparkles className="size-3" /> Agente IA Innover
                        </div>
                        ¡Hola Carlos! Sí, disponemos de 3 unidades para entrega inmediata. ¿Deseas que
                        te reserve una o prefieres hablar con un asesor humano?
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-dashed border-border/80 bg-muted/40 p-2 text-center text-[11px] text-muted-foreground">
                    Modo automático con traspaso a asesor humano en 1 clic
                  </div>
                </div>

                {/* Right: Funnel & Lead Status */}
                <div className="p-4 md:col-span-3">
                  <div className="mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Embudo de Ventas
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <div className="text-[11px] text-muted-foreground">Etapa actual</div>
                      <div className="mt-0.5 text-xs font-bold text-primary">Interesado / Calificado</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <div className="text-[11px] text-muted-foreground">Valor estimado</div>
                      <div className="mt-0.5 text-xs font-bold text-foreground">$140.00 USD</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <div className="text-[11px] text-muted-foreground">Asignación</div>
                      <div className="mt-0.5 text-xs font-medium text-foreground">Asesor Comercial 1</div>
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
