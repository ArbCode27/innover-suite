import { redirect } from "next/navigation";
import { canUseInbox, loadCurrentMemberSession } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { areAdvisorsAvailable, isScheduleEnabled } from "@/lib/agent/hours";
import { loadAgentSettings } from "@/lib/agent/settings";
import { mapConversationListRow } from "@/lib/inbox/board";
import { InboxPanel } from "./inbox-panel";
import { normalizeInboxMessage, sortInboxMessages, type InboxConversation, type InboxMessage } from "./types";

type ConversationRow = {
  id: number;
  contact_id: number | null;
  channel: "messenger" | "instagram" | "whatsapp";
  status: "open" | "in_progress" | "resolved";
  mode: "ai" | "human";
  assigned_user_id: string | null;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview?: string | null;
  metadata: unknown;
  contacts: {
    full_name: string;
    phone: string | null;
    metadata: unknown;
  } | null;
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
  const conversationSelectWithPreview =
    "id, contact_id, channel, status, mode, assigned_user_id, updated_at, last_message_at, last_message_preview, metadata, contacts(full_name, phone, metadata)";
  const conversationSelect =
    "id, contact_id, channel, status, mode, assigned_user_id, updated_at, last_message_at, metadata, contacts(full_name, phone, metadata)";

  const [conversationsWithPreview, agentSettings] = await Promise.all([
    supabase
      .from("conversations")
      .select(conversationSelectWithPreview)
      .eq("organization_id", membership.organizationId)
      .order("updated_at", { ascending: false })
      .limit(50),
    loadAgentSettings(membership.organizationId),
  ]);

  const conversationsResult = conversationsWithPreview.error?.message?.includes("last_message_preview")
    ? await supabase
        .from("conversations")
        .select(conversationSelect)
        .eq("organization_id", membership.organizationId)
        .order("updated_at", { ascending: false })
        .limit(50)
    : conversationsWithPreview;

  if (conversationsResult.error) {
    throw new Error(`No se pudo cargar el inbox: ${conversationsResult.error.message}`);
  }

  const conversationRows = (conversationsResult.data ?? []) as unknown as ConversationRow[];
  const requestedId =
    Number.isInteger(requestedConversationId) && requestedConversationId > 0 ? requestedConversationId : null;

  const initialMessagesResult = requestedId
    ? await supabase
        .from("messages")
        .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
        .eq("conversation_id", requestedId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(250)
    : { data: [] as MessageRow[] };

  const conversations: InboxConversation[] = conversationRows.flatMap((conversation) => {
    const mapped = mapConversationListRow(conversation);
    return mapped ? [mapped] : [];
  });

  const initialMessagesByConversation: Record<number, InboxMessage[]> = {};
  if (requestedId) {
    initialMessagesByConversation[requestedId] = sortInboxMessages(
      (initialMessagesResult.data ?? []).map((row) => normalizeInboxMessage(row as MessageRow)),
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
