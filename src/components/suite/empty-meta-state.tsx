import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, Link2, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type EmptyMetaStateProps = {
  title?: string;
  description?: string;
  steps?: string[];
};

const defaultSteps = [
  "Conecta WhatsApp Cloud API desde Meta Business.",
  "Valida el webhook para recibir mensajes entrantes.",
  "Asigna conversaciones a IA o atención humana.",
];

const featureItems: Array<{
  icon: ComponentType<{ className?: string }>;
  label: string;
}> = [
  { icon: MessageCircle, label: "Mensajes en tiempo real" },
  { icon: Sparkles, label: "Respuesta asistida por IA" },
  { icon: ShieldCheck, label: "Trazabilidad por asesor" },
];

export const EmptyMetaState = ({
  title = "Vincula Meta para empezar a operar",
  description = "Aún no hay datos en este módulo. Cuando conectes Meta y WhatsApp, el CRM empezará a recibir conversaciones, contactos y oportunidades automáticamente.",
  steps = defaultSteps,
}: EmptyMetaStateProps) => {
  return (
    <Card className="relative overflow-hidden border-primary/25 bg-card/75">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.2),transparent_30rem),radial-gradient(circle_at_left_bottom,rgba(37,99,235,0.16),transparent_24rem)]" />
      <CardHeader className="relative max-w-3xl gap-3 p-6 md:p-8">
        <Badge className="w-fit" variant="outline">
          Integración requerida
        </Badge>
        <CardTitle className="text-2xl font-semibold md:text-3xl">{title}</CardTitle>
        <CardDescription className="text-base leading-7">{description}</CardDescription>
      </CardHeader>
      <CardContent className="relative grid gap-6 p-6 pt-0 md:grid-cols-[1fr_0.85fr] md:p-8 md:pt-0">
        <div className="grid gap-3 sm:grid-cols-3">
          {featureItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-xl border border-primary/20 bg-primary/8 p-4"
              >
                <Icon className="mb-3 size-5 text-primary" />
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed border-primary/35 bg-primary/10 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
            <Link2 className="size-4" />
            Próximos pasos
          </div>
          <ol className="space-y-3 text-sm text-muted-foreground">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Button asChild className="mt-5 w-full">
            <Link href="/settings">
              Ir a configuración
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
