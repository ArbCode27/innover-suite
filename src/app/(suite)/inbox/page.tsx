import { Bot, Headphones, Inbox, MessageCircle, Search } from "lucide-react";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { ModuleShell } from "@/components/suite/module-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const metrics = [
  { label: "Conversaciones", value: "0", icon: MessageCircle },
  { label: "Pendientes IA", value: "0", icon: Bot },
  { label: "En humano", value: "0", icon: Headphones },
  { label: "Sin responder", value: "0", icon: Inbox },
];

const filters = ["Todas", "No leídas", "Bot IA", "Humano"];

export default function InboxPage() {
  return (
    <ModuleShell
      title="Centro de conversaciones"
      description="Gestiona chats de Meta y WhatsApp con IA, handoff humano, etiquetas y trazabilidad por conversación."
      eyebrow="Inbox Omnicanal"
      actions={
        <Button type="button">
          Vincular Meta
        </Button>
      }
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

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="border-primary/15 bg-card/70">
          <CardHeader className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Conversaciones</CardTitle>
                <CardDescription>0 chats disponibles</CardDescription>
              </div>
              <Badge variant="outline">Meta sin vincular</Badge>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar conversación"
                className="h-10 pl-9"
                disabled
                placeholder="Buscar por nombre, teléfono o etiqueta"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Badge key={filter} variant="outline">
                  {filter}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/8 p-6 text-center">
              <MessageCircle className="mx-auto mb-4 size-8 text-primary" />
              <p className="font-medium">Todavía no hay conversaciones</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Al conectar Meta, esta columna se llenará con contactos,
                etiquetas, prioridades y estados de atención.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <EmptyMetaState
            title="Conecta Meta para recibir tus primeros mensajes"
            description="El inbox está preparado para mostrar conversaciones entrantes de WhatsApp y Meta. Vincula la cuenta para activar los chats, las etiquetas y el handoff entre IA y asesores."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {["IA responde consultas frecuentes", "Humano toma control", "CRM guarda la trazabilidad"].map((item) => (
              <Card key={item} className="border-primary/10 bg-card/65">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">{item}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Se activará automáticamente cuando empiecen a entrar mensajes.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
