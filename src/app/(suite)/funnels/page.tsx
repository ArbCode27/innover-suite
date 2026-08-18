import { ArrowUpRight, DollarSign, KanbanSquare, Target, Users } from "lucide-react";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { ModuleShell } from "@/components/suite/module-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stages = [
  { id: "lead", title: "Nuevo lead", cards: [] as string[], color: "bg-sky-500" },
  { id: "qualified", title: "Calificado", cards: [] as string[], color: "bg-cyan-400" },
  { id: "proposal", title: "Propuesta", cards: [] as string[], color: "bg-violet-400" },
  { id: "won", title: "Cerrado", cards: [] as string[], color: "bg-emerald-400" },
];

const metrics = [
  { label: "Oportunidades", value: "0", icon: Target },
  { label: "Valor estimado", value: "$0", icon: DollarSign },
  { label: "Contactos activos", value: "0", icon: Users },
  { label: "Etapas", value: "4", icon: KanbanSquare },
];

export default function FunnelsPage() {
  return (
    <ModuleShell
      title="Embudo de ventas"
      description="Convierte conversaciones de Meta y WhatsApp en oportunidades con etapas claras, prioridades y seguimiento comercial."
      eyebrow="Pipeline comercial"
      actions={
        <Button type="button" variant="outline">
          Crear etapa
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

      <div className="grid gap-4 lg:grid-cols-4">
        {stages.map((stage) => (
          <Card key={stage.id} className="min-h-[360px] border-primary/15 bg-card/70">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`size-2.5 rounded-full ${stage.color}`} />
                  <CardTitle className="text-base">{stage.title}</CardTitle>
                </div>
                <Badge variant="outline">{stage.cards.length}</Badge>
              </div>
              <CardDescription>Sin tarjetas en esta etapa</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/8 p-5 text-center">
                <KanbanSquare className="mb-4 size-8 text-primary" />
                <p className="text-sm font-medium">Arrastra oportunidades aquí</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Las tarjetas aparecerán cuando una conversación genere una intención de compra.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <EmptyMetaState
          title="Vincula Meta para generar oportunidades"
          description="El embudo se alimenta de conversaciones reales. Cuando conectes Meta, cada lead podrá moverse por las etapas del pipeline y mantener su historial comercial."
          steps={[
            "Recibe mensajes desde WhatsApp o Instagram.",
            "Convierte contactos interesados en oportunidades.",
            "Mueve cada oportunidad por las etapas del embudo.",
          ]}
        />
        <Card className="border-primary/15 bg-card/70">
          <CardHeader>
            <Badge className="w-fit" variant="outline">
              Automatización
            </Badge>
            <CardTitle>Qué pasará al conectar Meta</CardTitle>
            <CardDescription>
              El pipeline se podrá poblar automáticamente según intención,
              etiquetas y seguimiento del asesor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Lead nuevo desde chat", "Calificación por IA", "Seguimiento por asesor"].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/8 p-3"
              >
                <span className="text-sm font-medium">{item}</span>
                <ArrowUpRight className="size-4 text-primary" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ModuleShell>
  );
}
