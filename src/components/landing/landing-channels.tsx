import { CheckCircle2, MessageCircle, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const LandingChannels = () => {
  const channels = [
    {
      id: "whatsapp",
      title: "WhatsApp Business Cloud API",
      badge: "WhatsApp Oficial",
      badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: MessageCircle,
      description:
        "Atiende a tus clientes en la aplicación de mensajería líder a nivel global mediante la API oficial de la nube de WhatsApp.",
      features: [
        "Recepción y envío de mensajes en tiempo real vía Webhooks de Meta",
        "Soporte para texto, imágenes, audios, documentos y botones interactivos",
        "Plantillas de mensajes pre-aprobadas y respuestas automáticas 24/7",
        "Gestión de números telefónicos y perfiles comerciales verificados",
      ],
    },
    {
      id: "instagram",
      title: "Instagram Direct Messaging",
      badge: "Instagram Direct",
      badgeColor: "border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400",
      icon: Send,
      description:
        "Transforma seguidores y consultas de tu perfil de Instagram en oportunidades de venta organizadas en tu embudo.",
      features: [
        "Respuestas inmediatas a mensajes directos (DMs) de usuarios interesados",
        "Conversión de menciones en historias y publicaciones en hilos de chat",
        "Identificación de productos del catálogo de interés del cliente",
        "Asignación automática a asesores comerciales disponibles",
      ],
    },
    {
      id: "messenger",
      title: "Facebook Messenger",
      badge: "Facebook Pages",
      badgeColor: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      icon: MessageSquare,
      description:
        "Centraliza la atención al público que visita la página de Facebook de tu empresa sin perder ningún prospecto.",
      features: [
        "Integración con páginas de Facebook comerciales de la organización",
        "Sincronización de hilos de chat con historial completo de cliente",
        "Clasificación automática de consultas generales o de soporte",
        "Traspaso fluido entre el bot de IA y el equipo de asesores",
      ],
    },
  ];

  return (
    <section id="canales" className="scroll-mt-16 border-t border-border/40 bg-muted/20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Ecosistema Meta Conectado
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Todos los canales de mensajería de Meta en un único lugar
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Innover Suite opera mediante las APIs oficiales de Meta Platforms, garantizando una
            comunicación segura, estable y en estricto cumplimiento de las políticas de la plataforma.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <Card
                key={channel.id}
                className="flex flex-col justify-between border-border/60 bg-card/80 transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <Badge variant="outline" className={`text-[11px] ${channel.badgeColor}`}>
                      {channel.badge}
                    </Badge>
                  </div>
                  <CardTitle className="pt-3 text-xl">{channel.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {channel.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="border-t border-border/60 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Capacidades clave:
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {channel.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
