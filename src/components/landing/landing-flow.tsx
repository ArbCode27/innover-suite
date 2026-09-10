import { Badge } from "@/components/ui/badge";
import { LANDING_RESTAURANT_FLOW } from "@/lib/landing/product";

export const LandingFlow = () => {
  return (
    <section id="flujo" className="scroll-mt-16 border-t border-border/40 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Flujo de punta a punta
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Del menú a la cocina, sin fricción
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Ejemplo restaurante: el cliente pide, la cocina recibe y tú mides el resultado. El mismo
            enfoque aplica a tienda, servicios o inmuebles con otros módulos.
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LANDING_RESTAURANT_FLOW.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-border/60 bg-card/80 p-4"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Paso {index + 1}
              </span>
              <h3 className="mt-2 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              {index < LANDING_RESTAURANT_FLOW.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-1/2 -right-2 hidden h-px w-4 -translate-y-1/2 bg-border lg:block"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
