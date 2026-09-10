import { Badge } from "@/components/ui/badge";
import { LANDING_CAPABILITIES } from "@/lib/landing/product";

export const LandingFeatures = () => {
  return (
    <section id="funciones" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Capacidades
          </Badge>
          <h2 id="capacidades" className="mt-3 scroll-mt-20 text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que incluye la Suite
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Cada capacidad tiene un beneficio claro, cómo funciona y para quién es. Activas solo lo
            que usas.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {LANDING_CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            return (
              <article
                key={capability.id}
                id={capability.id}
                className="flex flex-col rounded-2xl border border-border/60 bg-card/70 p-5 transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {capability.forWhom}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{capability.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {capability.benefit}
                </p>
                <ul className="mt-4 space-y-2 border-t border-border/50 pt-4">
                  {capability.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
