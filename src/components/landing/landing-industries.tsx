import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LANDING_INDUSTRIES } from "@/lib/landing/product";

export const LandingIndustries = () => {
  return (
    <section id="industrias" className="scroll-mt-16 border-t border-border/40 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Por industria
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Activa solo lo que tu negocio necesita
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Empieza con una plantilla y enciende módulos según tu rubro. Misma plataforma, operación
            distinta.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {LANDING_INDUSTRIES.map((industry) => {
            const Icon = industry.icon;
            return (
              <article
                key={industry.id}
                className="flex flex-col rounded-2xl border border-border/60 bg-card/80 p-5 transition hover:border-primary/35 hover:shadow-md"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{industry.label}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {industry.promise}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {industry.modules.map((module) => (
                    <li key={module} className="text-xs font-medium text-foreground/80">
                      · {module}
                    </li>
                  ))}
                </ul>
                <Link
                  href={industry.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Ver cómo funciona
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
