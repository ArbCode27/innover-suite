import { ContactRound, MessageCircle, Tags, Users } from "lucide-react";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { ModuleShell } from "@/components/suite/module-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { label: "Contactos", value: "0", icon: Users },
  { label: "Canales", value: "0", icon: MessageCircle },
  { label: "Etiquetas", value: "0", icon: Tags },
  { label: "Afiliaciones", value: "0", icon: ContactRound },
];

export default function ContactsPage() {
  return (
    <ModuleShell
      title="Contactos y afiliaciones"
      description="Centraliza personas captadas por Meta, WhatsApp e Instagram con historial y canal de origen."
      eyebrow="Base comercial"
    >
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="border-primary/15 bg-card/70">
            <CardHeader className="flex flex-row items-center justify-between gap-3 p-4">
              <div>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="mt-2 text-3xl">{metric.value}</CardTitle>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <metric.icon className="size-5" />
              </span>
            </CardHeader>
          </Card>
        ))}
      </div>

      <EmptyMetaState
        title="Conecta Meta para crear contactos automáticamente"
        description="Aún no hay contactos. Cuando entren mensajes desde Meta, el CRM creará perfiles, canales y etiquetas para iniciar el seguimiento comercial."
      />
    </ModuleShell>
  );
}
