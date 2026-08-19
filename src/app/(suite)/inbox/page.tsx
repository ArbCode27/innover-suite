import { Bot, Headphones, Inbox, MessageCircle, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

const filters = ["Todas", "No leídas", "Bot IA", "Humano"];

type ConversationRow = {
  id: number;
  status: "open" | "in_progress" | "resolved";
  mode: "ai" | "human";
  assigned_user_id: string | null;
  updated_at: string;
  contacts: {
    full_name: string;
    phone: string | null;
  } | null;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export default async function InboxPage() {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding/organization");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conversationsData, error } = await supabase
    .from("conversations")
    .select("id, status, mode, assigned_user_id, updated_at, contacts(full_name, phone)")
    .eq("organization_id", membership.organizationId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`No se pudo cargar el inbox: ${error.message}`);
  }

  const conversations = (conversationsData ?? []) as unknown as ConversationRow[];
  const aiOpenCount = conversations.filter(
    (item) => item.mode === "ai" && item.status !== "resolved",
  ).length;
  const humanCount = conversations.filter((item) => item.mode === "human").length;
  const unassignedCount = conversations.filter((item) => !item.assigned_user_id).length;
  const myAssignedCount = conversations.filter(
    (item) => user?.id && item.assigned_user_id === user.id,
  ).length;
  const hasConversations = conversations.length > 0;

  const metrics = [
    { label: "Conversaciones", value: String(conversations.length), icon: MessageCircle },
    { label: "Pendientes IA", value: String(aiOpenCount), icon: Bot },
    { label: "En humano", value: String(humanCount), icon: Headphones },
    { label: "Sin asignar", value: String(unassignedCount), icon: Inbox },
  ];

  return (
    <ModuleShell
      title="Centro de conversaciones"
      description="Gestiona chats de Meta y WhatsApp con IA, handoff humano, etiquetas y trazabilidad por conversación."
      eyebrow="Inbox Omnicanal"
      actions={
        <Button type="button">
          {membership.organizationName}
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
                <CardDescription>
                  {conversations.length} chats · {myAssignedCount} asignados a ti
                </CardDescription>
              </div>
              <Badge variant="outline">
                {hasConversations ? "Inbox activo" : "Meta sin mensajes"}
              </Badge>
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
            {hasConversations ? (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <article
                    key={conversation.id}
                    className="rounded-xl border border-primary/10 bg-background/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {conversation.contacts?.full_name || "Contacto sin nombre"}
                      </p>
                      <Badge variant="outline">{conversation.mode === "ai" ? "IA" : "Humano"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {conversation.contacts?.phone || "Sin teléfono"} · Estado: {conversation.status}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Actualizado: {formatDate(conversation.updated_at)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/8 p-6 text-center">
                <MessageCircle className="mx-auto mb-4 size-8 text-primary" />
                <p className="font-medium">Todavía no hay conversaciones</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Al conectar Meta, esta columna se llenará con contactos,
                  etiquetas, prioridades y estados de atención.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {hasConversations ? (
            <Card className="border-primary/15 bg-card/70">
              <CardContent className="p-6">
                <p className="text-sm font-medium">Tu equipo está atendiendo en tiempo real</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Conversaciones activas: {conversations.length}. Sin asignar: {unassignedCount}.
                </p>
              </CardContent>
            </Card>
          ) : (
            <EmptyMetaState
              title="Conecta Meta para recibir tus primeros mensajes"
              description="El inbox está preparado para mostrar conversaciones entrantes de WhatsApp y Meta. Vincula la cuenta para activar los chats, las etiquetas y el handoff entre IA y asesores."
            />
          )}
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
