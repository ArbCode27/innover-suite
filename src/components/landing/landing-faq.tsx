import { Badge } from "@/components/ui/badge";
import { LANDING_FAQS } from "@/lib/landing/product";

export const LandingFaq = () => {
  return (
    <section id="faq" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Preguntas frecuentes
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Respuestas claras antes de empezar
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Módulos, menú público, IA, industrias y protección de datos.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-4xl space-y-3">
          {LANDING_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-2xl border border-border/60 bg-card/60 px-5 py-4 open:border-primary/25 open:bg-card"
            >
              <summary className="cursor-pointer list-none text-base font-semibold tracking-tight marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {faq.question}
                  <span
                    aria-hidden
                    className="mt-0.5 text-muted-foreground transition group-open:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          ¿Otra duda? Escríbenos a{" "}
          <a
            href="mailto:privacidad@innover-suite.app"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            privacidad@innover-suite.app
          </a>
          .
        </div>
      </div>
    </section>
  );
};
