import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContactDetailCard } from "./contact-detail-card";
import { ContactConversationHistory } from "@/components/contacts/contact-conversation-history";
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

  const primaryConversation = contact.conversations.find((c) => c.status !== "resolved") || contact.conversations[0];

  return (
    <ModuleShell
      title={contact.fullName}
      description={[contact.phone, contact.email, contact.funnelStage].filter(Boolean).join(" · ") || "Ficha del contacto"}
      eyebrow="Contacto"
      actions={
        primaryConversation ? (
          <Button asChild variant="outline">
            <Link href={`/inbox?conversation=${primaryConversation.id}`}>
              {primaryConversation.status === "resolved" ? "Ver chat archivado" : "Abrir chat activo"}
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <ContactDetailCard contact={contact} />
          <section className="rounded-2xl border border-primary/15 bg-card/80 p-4">
            <h2 className="text-sm font-semibold">Pedidos</h2>
            {contact.orders.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {contact.orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                    <span>Pedido #{order.id}</span>
                    <span className="font-medium">{formatMoney(order.total)}</span>
                    <span className="text-xs text-muted-foreground capitalize">{order.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sin pedidos registrados.</p>
            )}
          </section>
        </div>

        <div>
          <ContactConversationHistory
            conversations={contact.conversations}
            contactName={contact.fullName}
          />
        </div>
      </div>
    </ModuleShell>
  );
}
