import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const LandingFaq = () => {
  const faqs = [
    {
      question: "¿Qué es Innover Suite y a quién está dirigido?",
      answer:
        "Innover Suite es una plataforma CRM B2B diseñada para empresas, comercios y equipos de ventas que necesitan centralizar sus canales de mensajería (WhatsApp, Instagram y Facebook Messenger), automatizar la atención mediante Inteligencia Artificial y dar seguimiento a sus prospectos en un embudo comercial.",
    },
    {
      question: "¿Cómo se conectan los canales de Meta a la plataforma?",
      answer:
        "La conexión se realiza a través de las APIs oficiales de Meta Platforms mediante el inicio de sesión empresarial seguro (OAuth / Embedded Signup). Cada negocio autoriza exclusivamente sus páginas comerciales y líneas de WhatsApp sin exponer credenciales personales.",
    },
    {
      question: "¿Cómo funciona el agente de Inteligencia Artificial?",
      answer:
        "El agente responde consultas frecuentes basándose en las reglas, precios y catálogo de productos definidos por la empresa. Cuando detecta un caso complejo o el usuario solicita atención personalizada, transfiere la conversación en tiempo real al equipo de asesores humanos.",
    },
    {
      question: "¿Cómo se protegen los datos de las conversaciones?",
      answer:
        "Cada organización cuenta con aislamiento total de su información mediante políticas de seguridad a nivel de base de datos (Row-Level Security). Toda la información viaja cifrada y jamás es comercializada ni compartida con terceros con fines publicitarios.",
    },
    {
      question: "¿Cómo puedo solicitar la eliminación de mis datos?",
      answer:
        "Tanto las organizaciones como los usuarios finales pueden solicitar la supresión de sus registros en cualquier momento a través de nuestra Política de Privacidad o enviando un correo a privacidad@innover-suite.app.",
    },
  ];

  return (
    <section id="faq" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Preguntas Frecuentes
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Todo lo que necesitas saber sobre el servicio
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Transparencia total sobre la arquitectura, la integración de canales y el tratamiento de datos.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-4xl space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.question} className="border-border/60 bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          ¿Tienes alguna otra duda o consulta técnica? Contáctanos directamente en{" "}
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
