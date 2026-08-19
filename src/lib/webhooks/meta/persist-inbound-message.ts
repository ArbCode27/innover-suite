import type { ContactSource, MetaChannel } from "@/types/domain";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InboundMessageEvent, PersistResult } from "@/lib/webhooks/meta/types";

const POSTGRES_UNIQUE_VIOLATION = "23505";
const PLACEHOLDER_CONTACT_PREFIX = "Contacto ";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
type PersistStatus = "processed" | "duplicate" | "unmapped";
type OrganizationContext = {
  organizationId: number;
  channelAccountId: number;
};

const CONTACT_SOURCE_BY_CHANNEL: Record<MetaChannel, ContactSource> = {
  messenger: "meta",
  instagram: "instagram",
  whatsapp: "whatsapp",
};

const isUniqueViolation = (error: { code?: string } | null) =>
  error?.code === POSTGRES_UNIQUE_VIOLATION;

const fallbackContactName = (event: InboundMessageEvent) =>
  event.displayName || `${PLACEHOLDER_CONTACT_PREFIX}${event.channel}`;

const resolveOrganizationContext = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
): Promise<OrganizationContext | null> => {
  const { data: account, error: accountError } = await supabase
    .from("channel_accounts")
    .select("id, organization_id")
    .eq("channel", event.channel)
    .eq("external_account_id", event.accountId)
    .maybeSingle();

  if (accountError) {
    throw accountError;
  }

  if (!account?.organization_id || !account?.id) {
    return null;
  }

  return {
    organizationId: account.organization_id as number,
    channelAccountId: account.id as number,
  };
};

const claimWebhookEvent = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
  organizationId: number,
) => {
  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      organization_id: organizationId,
      provider: "meta",
      channel: event.channel,
      external_event_id: event.externalMessageId,
      payload: event.rawPayload,
    })
    .select("id, processed_at")
    .single();

  if (!insertError && inserted?.id) {
    return { id: inserted.id as number, alreadyProcessed: Boolean(inserted.processed_at) };
  }

  if (!isUniqueViolation(insertError)) {
    throw insertError || new Error("Failed to claim webhook event");
  }

  const { data: existing, error: existingError } = await supabase
    .from("webhook_events")
    .select("id, processed_at")
    .eq("provider", "meta")
    .eq("channel", event.channel)
    .eq("external_event_id", event.externalMessageId)
    .single();

  if (existingError || !existing?.id) {
    throw existingError || new Error("Failed to read existing webhook event");
  }

  return {
    id: existing.id as number,
    alreadyProcessed: Boolean(existing.processed_at),
  };
};

const findContactIdByChannel = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
  organizationId: number,
) => {
  const { data, error } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("channel", event.channel)
    .eq("external_id", event.externalUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data?.contact_id as number | undefined) ?? null;
};

const resolveContactId = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
  organizationId: number,
) => {
  const existingContactId = await findContactIdByChannel(supabase, event, organizationId);
  if (existingContactId) {
    return existingContactId;
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      organization_id: organizationId,
      full_name: fallbackContactName(event),
      phone: event.phone,
      source: CONTACT_SOURCE_BY_CHANNEL[event.channel],
    })
    .select("id")
    .single();

  if (contactError || !contact?.id) {
    throw contactError || new Error("Failed to create contact");
  }

  const { error: channelError } = await supabase.from("contact_channels").insert({
    organization_id: organizationId,
    contact_id: contact.id,
    channel: event.channel,
    external_id: event.externalUserId,
  });

  if (!channelError) {
    return contact.id as number;
  }

  if (!isUniqueViolation(channelError)) {
    throw channelError;
  }

  const racedContactId = await findContactIdByChannel(supabase, event, organizationId);
  if (!racedContactId) {
    throw new Error("Failed to resolve contact after unique conflict");
  }

  return racedContactId;
};

const resolveConversationId = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
  organizationId: number,
  channelAccountId: number,
  contactId: number,
) => {
  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("channel", event.channel)
    .in("status", ["open", "in_progress"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    return existing.id as number;
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      channel_account_id: channelAccountId,
      channel: event.channel,
      mode: "ai",
      status: "open",
      customer_phone: event.phone,
    })
    .select("id")
    .single();

  if (!createError && created?.id) {
    return created.id as number;
  }

  if (!isUniqueViolation(createError)) {
    throw createError || new Error("Failed to create conversation");
  }

  const { data: raced, error: racedError } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("channel", event.channel)
    .in("status", ["open", "in_progress"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (racedError || !raced?.id) {
    throw racedError || new Error("Failed to resolve conversation after unique conflict");
  }

  return raced.id as number;
};

const persistInboundMessage = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
): Promise<PersistStatus> => {
  const organizationContext = await resolveOrganizationContext(supabase, event);
  if (!organizationContext) {
    return "unmapped";
  }

  const claimed = await claimWebhookEvent(supabase, event, organizationContext.organizationId);
  if (claimed.alreadyProcessed) {
    return "duplicate";
  }

  const contactId = await resolveContactId(supabase, event, organizationContext.organizationId);
  const conversationId = await resolveConversationId(
    supabase,
    event,
    organizationContext.organizationId,
    organizationContext.channelAccountId,
    contactId,
  );

  const { error: messageError } = await supabase.from("messages").insert({
    organization_id: organizationContext.organizationId,
    conversation_id: conversationId,
    direction: "inbound",
    sender_type: "contact",
    content: event.text,
    media_url: event.mediaUrl,
    external_message_id: event.externalMessageId,
    metadata: {
      channel: event.channel,
      accountId: event.accountId,
      externalUserId: event.externalUserId,
    },
    created_at: event.timestamp,
  });

  if (messageError && !isUniqueViolation(messageError)) {
    throw messageError;
  }

  const conversationUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (event.phone) {
    conversationUpdate.customer_phone = event.phone;
  }

  const { error: conversationError } = await supabase
    .from("conversations")
    .update(conversationUpdate)
    .eq("id", conversationId);

  if (conversationError) {
    throw conversationError;
  }

  const { error: processedError } = await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", claimed.id);

  if (processedError) {
    throw processedError;
  }

  return messageError ? "duplicate" : "processed";
};

export const persistInboundMessages = async (
  events: InboundMessageEvent[],
): Promise<PersistResult> => {
  if (events.length === 0) {
    return { processed: 0, duplicates: 0, ignored: 0 };
  }

  const supabase = getSupabaseAdminClient();
  const failures: unknown[] = [];
  let processed = 0;
  let duplicates = 0;
  let ignored = 0;

  for (const event of events) {
    try {
      const status = await persistInboundMessage(supabase, event);
      if (status === "unmapped") {
        ignored += 1;
      } else if (status === "duplicate") {
        duplicates += 1;
      } else {
        processed += 1;
      }
    } catch (error) {
      failures.push(error);
      console.error("[META_WEBHOOK] persist failed", {
        channel: event.channel,
        externalMessageId: event.externalMessageId,
        error,
      });
    }
  }

  if (failures.length > 0) {
    throw new Error("One or more webhook events failed to persist");
  }

  return { processed, duplicates, ignored };
};
