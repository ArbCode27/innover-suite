import type { ContactSource, MetaChannel } from "@/types/domain";
import {
  fallbackContactName,
  isPlaceholderContactName,
  parseContactUsername,
} from "@/lib/contacts/display";
import { resolveInstagramCredentials } from "@/lib/integrations/instagram-credentials";
import { fetchSocialUserProfile, resolveProfileDisplayName } from "@/lib/integrations/meta-profile";
import { mergeAttachmentMetadata } from "@/lib/media/parse";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logMetaWebhook, maskIdentifier } from "@/lib/webhooks/meta/logger";
import type { InboundMessageEvent, PersistResult } from "@/lib/webhooks/meta/types";

const POSTGRES_UNIQUE_VIOLATION = "23505";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;
type PersistStatus = "processed" | "duplicate" | "unmapped";
type PersistOutcome = {
  status: PersistStatus;
  job?: {
    organizationId: number;
    conversationId: number;
    inboundMessageId: number;
  };
};
type OrganizationContext = {
  organizationId: number;
  channelAccountId: number;
  accessToken: string | null;
};
type PersistContext = {
  requestId: string;
  channelGroup: "social" | "whatsapp";
  objectType: string | null;
};

const CONTACT_SOURCE_BY_CHANNEL: Record<MetaChannel, ContactSource> = {
  messenger: "meta",
  instagram: "instagram",
  whatsapp: "whatsapp",
};

const isUniqueViolation = (error: { code?: string } | null) =>
  error?.code === POSTGRES_UNIQUE_VIOLATION;

const asMetadata = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const resolveOrganizationContext = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
): Promise<OrganizationContext | null> => {
  const { data: account, error: accountError } = await supabase
    .from("channel_accounts")
    .select("id, organization_id, access_token")
    .eq("channel", event.channel)
    .eq("external_account_id", event.accountId)
    .maybeSingle();

  if (accountError) {
    throw accountError;
  }

  if (!account?.organization_id || !account?.id) {
    return null;
  }

  const organizationId = account.organization_id as number;
  const instagramCredentials =
    event.channel === "instagram"
      ? await resolveInstagramCredentials({
          organizationId,
          channelAccountId: account.id as number,
          supabase,
        })
      : null;

  return {
    organizationId,
    channelAccountId: account.id as number,
    accessToken:
      instagramCredentials?.accessToken || (account.access_token as string | null) || null,
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
      full_name: fallbackContactName(event.channel, event.displayName),
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

const enrichContactIdentity = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
  organizationContext: OrganizationContext,
  contactId: number,
) => {
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, metadata")
    .eq("id", contactId)
    .eq("organization_id", organizationContext.organizationId)
    .maybeSingle();

  if (contactError || !contact?.id) {
    return;
  }

  const currentName = (contact.full_name as string) || "";
  const currentMetadata = asMetadata(contact.metadata);
  const currentUsername = parseContactUsername(currentMetadata);
  const hasPlaceholderName = isPlaceholderContactName(currentName);
  const webhookName = event.displayName?.trim() || null;

  let profileName: string | null = webhookName;
  let profileUsername = currentUsername;

  const needsSocialProfile =
    event.channel !== "whatsapp" && (hasPlaceholderName || !currentUsername);

  if (needsSocialProfile) {
    if (!organizationContext.accessToken) {
      logMetaWebhook("warn", "persist.profile_skipped_no_token", {
        channel: event.channel,
        contactId,
        externalUserIdMasked: maskIdentifier(event.externalUserId),
      });
    } else {
      try {
        const profile = await fetchSocialUserProfile(
          event.channel,
          event.externalUserId,
          organizationContext.accessToken,
        );
        if (profile) {
          profileName = resolveProfileDisplayName(profile) || profileName;
          profileUsername = profile.username || currentUsername;
        } else {
          logMetaWebhook("warn", "persist.profile_empty", {
            channel: event.channel,
            contactId,
            externalUserIdMasked: maskIdentifier(event.externalUserId),
          });
        }
      } catch (error) {
        logMetaWebhook("warn", "persist.profile_lookup_failed", {
          channel: event.channel,
          contactId,
          externalUserIdMasked: maskIdentifier(event.externalUserId),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  const nextName = hasPlaceholderName && profileName ? profileName : currentName;
  const nextMetadata = {
    ...currentMetadata,
    ...(profileUsername ? { username: profileUsername } : {}),
    ...(profileName ? { profile_name: profileName } : {}),
  };

  const nameChanged = nextName !== currentName;
  const usernameChanged = profileUsername !== currentUsername;
  if (!nameChanged && !usernameChanged) {
    return;
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      full_name: nextName,
      metadata: nextMetadata,
    })
    .eq("id", contactId)
    .eq("organization_id", organizationContext.organizationId);

  if (updateError) {
    logMetaWebhook("warn", "persist.profile_update_failed", {
      channel: event.channel,
      contactId,
      error: updateError.message,
    });
  }
};

const persistInboundMessage = async (
  supabase: AdminClient,
  event: InboundMessageEvent,
): Promise<PersistOutcome> => {
  const organizationContext = await resolveOrganizationContext(supabase, event);
  if (!organizationContext) {
    return { status: "unmapped" };
  }

  const claimed = await claimWebhookEvent(supabase, event, organizationContext.organizationId);
  if (claimed.alreadyProcessed) {
    return { status: "duplicate" };
  }

  const contactId = await resolveContactId(supabase, event, organizationContext.organizationId);
  const conversationId = await resolveConversationId(
    supabase,
    event,
    organizationContext.organizationId,
    organizationContext.channelAccountId,
    contactId,
  );

  const now = new Date().toISOString();
  const messageMetadata: Record<string, unknown> = {
    channel: event.channel,
    accountId: event.accountId,
    externalUserId: event.externalUserId,
  };
  if (event.attachment) {
    Object.assign(messageMetadata, mergeAttachmentMetadata({}, event.attachment));
  }

  const { data: insertedMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      organization_id: organizationContext.organizationId,
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "contact",
      content: event.text,
      media_url: null,
      external_message_id: event.externalMessageId,
      metadata: messageMetadata,
      created_at: event.timestamp,
    })
    .select("id")
    .single();

  if (messageError && !isUniqueViolation(messageError)) {
    throw messageError;
  }

  const conversationUpdate: Record<string, unknown> = {
    updated_at: now,
    last_message_at: event.timestamp || now,
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

  try {
    await enrichContactIdentity(supabase, event, organizationContext, contactId);
  } catch (error) {
    logMetaWebhook("warn", "persist.profile_enrich_failed", {
      channel: event.channel,
      contactId,
      externalUserIdMasked: maskIdentifier(event.externalUserId),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const { error: processedError } = await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", claimed.id);

  if (processedError) {
    throw processedError;
  }

  if (messageError || !insertedMessage?.id) {
    return { status: "duplicate" };
  }

  return {
    status: "processed",
    job: {
      organizationId: organizationContext.organizationId,
      conversationId,
      inboundMessageId: insertedMessage.id as number,
    },
  };
};

export const persistInboundMessages = async (
  events: InboundMessageEvent[],
  context?: PersistContext,
): Promise<PersistResult> => {
  if (events.length === 0) {
    return { processed: 0, duplicates: 0, ignored: 0, mediaJobs: [], agentJobs: [] };
  }

  const supabase = getSupabaseAdminClient();
  const failures: unknown[] = [];
  let processed = 0;
  let duplicates = 0;
  let ignored = 0;
  const mediaJobs: PersistResult["mediaJobs"] = [];
  const agentJobs: PersistResult["agentJobs"] = [];

  for (const event of events) {
    try {
      const outcome = await persistInboundMessage(supabase, event);
      if (outcome.status === "unmapped") {
        ignored += 1;
        logMetaWebhook("warn", "persist.unmapped_channel_account", {
          requestId: context?.requestId,
          channelGroup: context?.channelGroup,
          objectType: context?.objectType,
          channel: event.channel,
          accountIdMasked: maskIdentifier(event.accountId),
          externalMessageIdMasked: maskIdentifier(event.externalMessageId),
        });
      } else if (outcome.status === "duplicate") {
        duplicates += 1;
      } else {
        processed += 1;
        if (outcome.job) {
          const needsIngest =
            Boolean(event.attachment) &&
            event.attachment?.kind !== "location" &&
            event.attachment?.status !== "ready";
          if (needsIngest) {
            mediaJobs.push(outcome.job);
          }
          if (event.text?.trim() || event.attachment) {
            agentJobs.push(outcome.job);
          }
        }
      }
    } catch (error) {
      failures.push(error);
      logMetaWebhook("error", "persist.event_failed", {
        requestId: context?.requestId,
        channelGroup: context?.channelGroup,
        objectType: context?.objectType,
        channel: event.channel,
        accountIdMasked: maskIdentifier(event.accountId),
        externalMessageIdMasked: maskIdentifier(event.externalMessageId),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (failures.length > 0) {
    logMetaWebhook("error", "persist.summary_failed", {
      requestId: context?.requestId,
      channelGroup: context?.channelGroup,
      objectType: context?.objectType,
      totalEvents: events.length,
      processed,
      duplicates,
      ignored,
      failures: failures.length,
    });
    throw new Error("One or more webhook events failed to persist");
  }

  logMetaWebhook("info", "persist.summary", {
    requestId: context?.requestId,
    channelGroup: context?.channelGroup,
    objectType: context?.objectType,
    totalEvents: events.length,
    processed,
    duplicates,
    ignored,
  });

  return { processed, duplicates, ignored, mediaJobs, agentJobs };
};
