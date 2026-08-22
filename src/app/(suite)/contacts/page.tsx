import { redirect } from "next/navigation";
import { ContactRound, MessageCircle, Tags, Users } from "lucide-react";
import { ContactsBoard } from "./contacts-board";
import { ModuleShell } from "@/components/suite/module-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContacts } from "@/lib/contacts/board";
import { canUseInbox, getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ContactsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");
  if (!canUseInbox(membership)) redirect("/home");

  const { q } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const contacts = await loadContacts(supabase, membership.organizationId, q);
  const tagged = contacts.filter((contact) => contact.tags.length).length;

  const metrics = [
    { label: "Contactos", value: String(contacts.length), icon: Users },
    { label: "Con teléfono", value: String(contacts.filter((item) => item.phone).length), icon: MessageCircle },
    { label: "Con etiqueta", value: String(tagged), icon: Tags },
    { label: "Con correo", value: String(contacts.filter((item) => item.email).length), icon: ContactRound },
  ];

  return (
    <ModuleShell
      title="Contactos"
      description="Personas captadas por WhatsApp, Instagram o Messenger, con historial, etiquetas y notas internas."
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
      <ContactsBoard contacts={contacts} initialQuery={q ?? ""} />
    </ModuleShell>
  );
}
