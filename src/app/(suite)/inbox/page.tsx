import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InboxPanel } from "./inbox-panel";
import type { InboxConversation, InboxMessage } from "./types";

type ConversationRow = {
  id: number;
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
  } | null;
};

type LatestMessageRow = {
  conversation_id: number;
  content: string | null;
  media_url: string | null;
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
    .select(
      "id, channel, status, mode, assigned_user_id, updated_at, last_message_at, metadata, contacts(full_name, phone)",
    )
    .eq("organization_id", membership.organizationId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`No se pudo cargar el inbox: ${error.message}`);
  }

  const conversationRows = (conversationsData ?? []) as unknown as ConversationRow[];

  const conversationIds = conversationRows.map((item) => item.id);
  const latestMessagesByConversation = new Map<number, LatestMessageRow>();

  if (conversationIds.length) {
    const { data: latestMessages } = await supabase
      .from("messages")
      .select("conversation_id, content, media_url, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(500);

    (latestMessages ?? []).forEach((row) => {
      const typedRow = row as LatestMessageRow;
      if (!latestMessagesByConversation.has(typedRow.conversation_id)) {
        latestMessagesByConversation.set(typedRow.conversation_id, typedRow);
      }
    });
  }

  const conversations: InboxConversation[] = conversationRows.map((conversation) => {
    const latest = latestMessagesByConversation.get(conversation.id);
    const metadata =
      conversation.metadata && typeof conversation.metadata === "object"
        ? (conversation.metadata as Record<string, unknown>)
        : {};

    const unreadRaw = metadata["unread_count"];
    const unreadCount = typeof unreadRaw === "number" ? unreadRaw : 0;

    const latestPreview =
      latest?.content?.trim() ||
      (latest?.media_url ? "Adjunto multimedia" : "") ||
      "Sin mensajes recientes";

    return {
      id: conversation.id,
      channel: conversation.channel,
      status: conversation.status,
      mode: conversation.mode,
      assignedUserId: conversation.assigned_user_id,
      updatedAt: conversation.updated_at,
      lastMessageAt: conversation.last_message_at,
      contactName: conversation.contacts?.full_name || "Contacto sin nombre",
      contactPhone: conversation.contacts?.phone || null,
      lastMessagePreview: latestPreview,
      unreadCount,
    };
  });

  const firstConversationId = conversations[0]?.id ?? null;
  const initialMessagesByConversation: Record<number, InboxMessage[]> = {};

  if (firstConversationId) {
    const { data: initialMessages } = await supabase
      .from("messages")
      .select("id, conversation_id, direction, sender_type, content, media_url, metadata, created_at")
      .eq("conversation_id", firstConversationId)
      .order("created_at", { ascending: true })
      .limit(250);

    initialMessagesByConversation[firstConversationId] = (initialMessages ?? []).map((row) => {
      const typedRow = row as MessageRow;
      const metadata =
        typedRow.metadata && typeof typedRow.metadata === "object"
          ? (typedRow.metadata as Record<string, unknown>)
          : {};

      const attachmentKindRaw = metadata["attachment_kind"];
      const attachmentNameRaw = metadata["attachment_name"];

      return {
        id: typedRow.id,
        conversationId: typedRow.conversation_id,
        direction: typedRow.direction,
        senderType: typedRow.sender_type,
        content: typedRow.content,
        mediaUrl: typedRow.media_url,
        createdAt: typedRow.created_at,
        attachmentKind:
          attachmentKindRaw === "image" ||
          attachmentKindRaw === "video" ||
          attachmentKindRaw === "audio" ||
          attachmentKindRaw === "document"
            ? attachmentKindRaw
            : null,
        attachmentName: typeof attachmentNameRaw === "string" ? attachmentNameRaw : null,
      };
    });
  }

  return (
    <section>
      <InboxPanel
        organizationName={membership.organizationName}
        currentUserId={user?.id ?? null}
        initialConversations={conversations}
        initialMessagesByConversation={initialMessagesByConversation}
      />
    </section>
  );
}
