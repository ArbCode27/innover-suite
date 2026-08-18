import { CalendarCheck, CalendarDays, Clock, Link2, MessageSquareText, Users } from "lucide-react";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { ModuleShell } from "@/components/suite/module-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const metrics = [
  { label: "Citas hoy", value: "0", icon: CalendarCheck },
  { label: "Por confirmar", value: "0", icon: Clock },
  { label: "Asesores activos", value: "0", icon: Users },
  { label: "Reservas desde chat", value: "0", icon: MessageSquareText },
];

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const timeSlots = ["09:00", "11:00", "14:00", "16:00"];

export default function CalendarPage() {
  return (
    <ModuleShell
      title="Calendario de citas"
      description="Centraliza reservas que nacen desde chats de Meta y sincroniza el seguimiento con Google Calendar."
      eyebrow="Agenda operacional"
      actions={
        <Button type="button" variant="outline">
          Vincular calendario
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

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="border-primary/15 bg-card/70">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <Badge className="mb-3" variant="outline">
                Semana actual
              </Badge>
              <CardTitle>Agenda sin eventos</CardTitle>
              <CardDescription>
                La disponibilidad aparecerá aquí cuando entren solicitudes desde Meta o conectes Google Calendar.
              </CardDescription>
            </div>
            <CalendarDays className="size-6 text-primary" />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[760px] rounded-2xl border border-primary/20 bg-primary/8">
              <div className="grid grid-cols-7 border-b border-primary/20">
                {weekDays.map((day) => (
                  <div key={day} className="p-4 text-sm font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {weekDays.map((day) => (
                  <div key={day} className="min-h-72 border-r border-primary/20 p-3 last:border-r-0">
                    <div className="space-y-3">
                      {timeSlots.map((slot) => (
                        <div
                          key={`${day}-${slot}`}
                          className="rounded-xl border border-dashed border-primary/20 bg-card/60 p-3"
                        >
                          <p className="text-xs font-medium text-muted-foreground">{slot}</p>
                          <p className="mt-2 text-xs text-muted-foreground">Disponible al conectar</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/15 bg-card/70">
          <CardHeader>
            <Badge className="w-fit" variant="outline">
              Sincronización
            </Badge>
            <CardTitle>Reservas inteligentes</CardTitle>
            <CardDescription>
              La IA podrá sugerir horarios, crear eventos y actualizar el estado de la conversación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Solicitud detectada en chat", "Horario sugerido por IA", "Evento confirmado"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/8 p-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Link2 className="size-4" />
                </span>
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <EmptyMetaState
        title="Conecta Meta para agendar desde conversaciones"
        description="Aún no hay solicitudes de cita porque no entran mensajes. Al vincular Meta, la IA podrá detectar intención de reserva y convertirla en citas visibles en este calendario."
        steps={[
          "Recibe mensajes de WhatsApp o Instagram.",
          "Detecta intención de reserva desde el chat.",
          "Confirma horarios y sincroniza con Google Calendar.",
        ]}
      />
    </ModuleShell>
  );
}
