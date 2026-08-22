import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContactDetailCard } from "./contact-detail-card";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { loadContactDetail } from "@/lib/contacts/board";
import { formatMoney } from "@/lib/commerce/types";
import { canUseInbox, getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ContactDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");
  if (!canUseInbox(membership)) redirect("/home");

  const { id } = await params;
  const contactId = Number(id);
  if (!Number.isInteger(contactId) || contactId <= 0) notFound();

  const supabase = await createSupabaseServerClient();
  const contact = await loadContactDetail(supabase, membership.organizationId, contactId);
  if (!contact) notFound();

  return (
    <ModuleShell
      title={contact.fullName}
      description={[contact.phone, contact.email, contact.funnelStage].filter(Boolean).join(" · ") || "Ficha del contacto"}
      eyebrow="Contacto"
      actions={
        contact.conversations[0] ? (
          <Button asChild variant="outline">
            <Link href={`/inbox?conversation=${contact.conversations[0].id}`}>Abrir chat</Link>
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ContactDetailCard contact={contact} />
        <div className="space-y-4">
          <section className="rounded-2xl border border-primary/15 bg-card/80 p-4">
            <h2 className="text-sm font-semibold">Conversaciones</h2>
            {contact.conversations.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {contact.conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link className="text-primary hover:underline" href={`/inbox?conversation=${conversation.id}`}>
                      #{conversation.id} · {conversation.channel} · {conversation.mode}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sin chats aún.</p>
            )}
          </section>
          <section className="rounded-2xl border border-primary/15 bg-card/80 p-4">
            <h2 className="text-sm font-semibold">Pedidos</h2>
            {contact.orders.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {contact.orders.map((order) => (
                  <li key={order.id}>
                    #{order.id} · {formatMoney(order.total)} · {order.status}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sin pedidos.</p>
            )}
          </section>
        </div>
      </div>
    </ModuleShell>
  );
}
