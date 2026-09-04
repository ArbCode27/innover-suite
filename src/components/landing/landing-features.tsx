import {
  Bot,
  CalendarDays,
  Columns3,
  Inbox,
  PackageSearch,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const LandingFeatures = () => {
  const features = [
    {
      title: "Bandeja Unificada Multicanal",
      description:
        "Gestiona conversaciones de WhatsApp, Instagram y Messenger en un hilo limpio. Sin duplicidad ni pérdida de mensajes.",
      icon: Inbox,
    },
    {
      title: "Agente IA con Traspaso Humano",
      description:
        "Respuestas automatizadas basadas en las políticas de tu negocio con capacidad de ceder el control al equipo en horario de oficina.",
      icon: Bot,
    },
    {
      title: "Embudos de Ventas Kanban",
      description:
        "Visualiza el progreso de tus clientes potenciales desde el primer contacto hasta el cierre de la venta con métricas de conversión.",
      icon: Columns3,
    },
    {
      title: "Catálogo y Monedas",
      description:
        "Controla tus productos, precios e inventario para que tanto tus asesores como el agente de IA ofrezcan información precisa.",
      icon: PackageSearch,
    },
    {
      title: "Agenda y Citas Integradas",
      description:
        "Sincroniza con Google Calendar para programar reuniones y videollamadas con prospectos directamente desde la conversación.",
      icon: CalendarDays,
    },
    {
      title: "Aislamiento y Roles Multi-tenant",
      description:
        "Cada negocio opera en su propio espacio seguro con roles para asesores y administradores, protegiendo la privacidad de los clientes.",
      icon: ShieldCheck,
    },
  ];

  return (
    <section id="funciones" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Potencia Comercial
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Herramientas diseñadas para cerrar más ventas y atender mejor
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Una plataforma integral que une la inmediatez de la inteligencia artificial con el criterio
            de tu equipo de ventas.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="border-border/60 bg-card/60 transition-all hover:border-primary/30 hover:bg-card hover:shadow-md"
              >
                <CardHeader className="pb-2">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <CardTitle className="pt-3 text-lg font-semibold">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
