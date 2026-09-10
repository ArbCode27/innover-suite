import { Badge } from "@/components/ui/badge";
import { LANDING_LAYERS } from "@/lib/landing/product";

export const LandingLayers = () => {
  return (
    <section id="plataforma" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Mapa del producto
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Tres capas. Un solo CRM.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            De la conversación a la operación: atención, ventas y ejecución del negocio en la misma
            Suite.
          </p>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {LANDING_LAYERS.map((layer, index) => (
            <li
              key={layer.id}
              className="relative rounded-2xl border border-border/60 bg-card/70 p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="text-xl font-semibold tracking-tight">{layer.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{layer.summary}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {layer.items.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/85"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
