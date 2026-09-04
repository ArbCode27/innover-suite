import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const LandingSecurity = () => {
  const commitments = [
    {
      title: "Uso exclusivo del servicio contratado",
      description:
        "Los datos obtenidos a través de las APIs de Meta (WhatsApp, Instagram, Messenger) se utilizan únicamente para procesar las conversaciones y pedidos solicitados por el cliente de cada organización.",
    },
    {
      title: "Prohibición de venta o transferencia de datos",
      description:
        "Innover Suite no vende, arrienda ni transfiere datos de usuarios o de conversaciones a terceros, corredores de datos o redes publicitarias bajo ninguna circunstancia.",
    },
    {
      title: "Aislamiento de datos y control de accesos",
      description:
        "Cada organización cuenta con aislamiento lógico y políticas de seguridad estrictas (Row-Level Security). Ninguna empresa tiene visibilidad ni acceso a la información de otra.",
    },
    {
      title: "Cifrado y verificación de Webhooks",
      description:
        "Todas las comunicaciones viajan cifradas en tránsito (TLS) y en reposo. Los webhooks de Meta son validados mediante firma criptográfica SHA-256 para evitar accesos no autorizados.",
    },
  ];

  return (
    <section id="seguridad" className="scroll-mt-16 border-t border-border/40 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Cumplimiento y Privacidad
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Seguridad por diseño y respeto total a las políticas de Meta
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Diseñamos nuestra arquitectura siguiendo los estándares de la Plataforma de Desarrolladores de
            Meta y las mejores prácticas internacionales de protección de datos personales.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {commitments.map((item) => (
            <Card key={item.title} className="border-border/60 bg-card/80">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-4.5" />
                  </span>
                  <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data rights & legal callout */}
        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">
                Derechos de los usuarios y eliminación de datos
              </h3>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Cualquier usuario o empresa puede solicitar el acceso, rectificación o eliminación
                definitiva de sus datos registrados en Innover Suite. Cumplimos con los mecanismos de
                eliminación de datos de Meta de forma oportuna y transparente.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/privacy">
                  <FileText className="mr-2 size-4" />
                  Política de Privacidad
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/terms">Condiciones del Servicio</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
