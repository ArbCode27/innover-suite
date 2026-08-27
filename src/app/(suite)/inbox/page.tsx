import { redirect } from "next/navigation";
import { canUseInbox, loadCurrentMemberSession } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { areAdvisorsAvailable, isScheduleEnabled } from "@/lib/agent/hours";
import { loadAgentSettings } from "@/lib/agent/settings";
import { mapConversationListRow, previewFromMessageRow } from "@/lib/inbox/board";
import { InboxPanel } from "./inbox-panel";
import { normalizeInboxMessage, type InboxConversation, type InboxMessage } from "./types";

type ConversationRow = {
  id: number;
  contact_id: number | null;
  channel: "messenger" | "instagram" | "whatsapp";
  status: "open" | "in_progress" | "resolved";
  mode: "ai" | "human";
  assigned_user_id: string | null;
  updated_at: string;
  last_message_at: string | null;
  metadata: unknown;
  contacts: {
    full_name: string;
    phone: string | null;
    metadata: unknown;
  } | null;
};

type LatestMessageRow = {
  conversation_id: number;
  content: string | null;
  media_url: string | null;
  metadata: unknown;
};

type MessageRow = {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  sender_type: "contact" | "agent" | "ai" | "system";
  content: string | null;
  media_url: string | null;
  metadata: unknown;
  created_at: string;
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { user, membership } = await loadCurrentMemberSession();
  if (!membership) {
    redirect("/onboarding/organization");
  }
  if (!canUseInbox(membership)) {
    redirect("/home");
  }

  const params = await searchParams;
  const requestedConversationId = Number(params.conversation);

  const supabase = await createSupabaseServerClient();
  const [conversationsResult, agentSettings] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, contact_id, channel, status, mode, assigned_user_id, updated_at, last_message_at, metadata, contacts(full_name, phone, metadata)",
      )
      .eq("organization_id", membership.organizationId)
      .order("updated_at", { ascending: false })
      .limit(50),
    loadAgentSettings(membership.organizationId),
  ]);

  if (conversationsResult.error) {
    throw new Error(`No se pudo cargar el inbox: ${conversationsResult.error.message}`);
  }

  const conversationRows = (conversationsResult.data ?? []) as unknown as ConversationRow[];
  const conversationIds = conversationRows.map((item) => item.id);
  const requestedId =
    Number.isInteger(requestedConversationId) && requestedConversationId > 0 ? requestedConversationId : null;

  const [latestMessagesResult, initialMessagesResult] = await Promise.all([
    conversationIds.length
      ? supabase
          .from("messages")
          .select("conversation_id, content, media_url, metadata, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as LatestMessageRow[] }),
    requestedId
      ? supabase
          .from("messages")
          .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
          .eq("conversation_id", requestedId)
          .order("created_at", { ascending: true })
          .limit(250)
      : Promise.resolve({ data: [] as MessageRow[] }),
  ]);

  const latestMessagesByConversation = new Map<number, LatestMessageRow>();
  (latestMessagesResult.data ?? []).forEach((row) => {
    const typedRow = row as LatestMessageRow;
    if (!latestMessagesByConversation.has(typedRow.conversation_id)) {
      latestMessagesByConversation.set(typedRow.conversation_id, typedRow);
    }
  });

  const conversations: InboxConversation[] = conversationRows.flatMap((conversation) => {
    const latest = latestMessagesByConversation.get(conversation.id);
    const mapped = mapConversationListRow(conversation, latest ? previewFromMessageRow(latest) : undefined);
    return mapped ? [mapped] : [];
  });

  const initialMessagesByConversation: Record<number, InboxMessage[]> = {};
  if (requestedId) {
    initialMessagesByConversation[requestedId] = (initialMessagesResult.data ?? []).map((row) =>
      normalizeInboxMessage(row as MessageRow),
    );
  }

  const officeClosed =
    isScheduleEnabled(agentSettings.businessHours) && !areAdvisorsAvailable(agentSettings.businessHours);

  return (
    <section>
      <InboxPanel
        organizationId={membership.organizationId}
        organizationName={membership.organizationName}
        currentUserId={user?.id ?? null}
        initialConversationId={requestedId}
        initialConversations={conversations}
        initialMessagesByConversation={initialMessagesByConversation}
        officeClosed={officeClosed}
      />
    </section>
  );
}
