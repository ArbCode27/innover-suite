import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactListItem = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  updatedAt: string;
  tags: string[];
};

export type ContactNote = {
  id: number;
  body: string;
  visibleToAgent: boolean;
  createdAt: string;
};

export type ContactResolutionEntry = {
  id?: string;
  resolvedAt: string;
  resolvedBy?: string | null;
  outcome?: string | null;
  reason?: string | null;
  summary?: string | null;
};

export type ContactConversationItem = {
  id: number;
  channel: string;
  status: "open" | "in_progress" | "resolved";
  mode: string;
  updatedAt: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionOutcome: string | null;
  resolutionReason: string | null;
  resolutionSummary: string | null;
  resolutionHistory: ContactResolutionEntry[];
};

export type ContactDetail = ContactListItem & {
  conversations: ContactConversationItem[];
  orders: Array<{ id: number; total: number; status: string; createdAt: string }>;
  notes: ContactNote[];
  funnelStage: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const mapTags = (links: unknown) => {
  if (!Array.isArray(links)) return [] as string[];
  return links
    .map((link) => {
      if (!link || typeof link !== "object") return null;
      const raw = (link as { contact_tags?: { name?: string } | { name?: string }[] }).contact_tags;
      const tag = Array.isArray(raw) ? raw[0] : raw;
      return tag?.name ?? null;
    })
    .filter((name): name is string => Boolean(name));
};

export const loadContacts = async (supabase: SupabaseClient, organizationId: number, query?: string) => {
  const like = query?.trim() ? `%${query.trim()}%` : null;

  const withTags = supabase
    .from("contacts")
    .select("id, full_name, phone, email, updated_at, contact_tag_links(contact_tags(name))")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const { data, error } = like
    ? await withTags.or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    : await withTags;

  if (!error) {
    return (data ?? []).map((row): ContactListItem => ({
      id: row.id as number,
      fullName: (row.full_name as string) || "Contacto sin nombre",
      phone: (row.phone as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      updatedAt: row.updated_at as string,
      tags: mapTags(row.contact_tag_links),
    }));
  }

  let fallback = supabase
    .from("contacts")
    .select("id, full_name, phone, email, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (like) {
    fallback = fallback.or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`);
  }

  const result = await fallback;
  if (result.error) {
    throw new Error(result.error.message || "No se pudieron cargar los contactos.");
  }

  return (result.data ?? []).map((row): ContactListItem => ({
    id: row.id as number,
    fullName: (row.full_name as string) || "Contacto sin nombre",
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    updatedAt: row.updated_at as string,
    tags: [],
  }));
};

export const loadContactDetail = async (
  supabase: SupabaseClient,
  organizationId: number,
  contactId: number,
): Promise<ContactDetail | null> => {
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, phone, email, updated_at, contact_tag_links(contact_tags(name))")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle();

  const base = contact?.id
    ? contact
    : (
        await supabase
          .from("contacts")
          .select("id, full_name, phone, email, updated_at")
          .eq("organization_id", organizationId)
          .eq("id", contactId)
          .maybeSingle()
      ).data;

  if (!base?.id) return null;

  const conversationQueryWithPreview = supabase
    .from("conversations")
    .select("id, channel, status, mode, updated_at, created_at, last_message_at, last_message_preview, metadata")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const conversationQueryFallback = supabase
    .from("conversations")
    .select("id, channel, status, mode, updated_at, created_at, last_message_at, metadata")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("updated_at", { ascending: false })
    .limit(50);

  const [conversationsResult, { data: orders }, notesResult, { data: card }] = await Promise.all([
    conversationQueryWithPreview.then(async (res) => {
      if (res.error?.message?.includes("last_message_preview")) {
        return conversationQueryFallback;
      }
      return res;
    }),
    supabase
      .from("orders")
      .select("id, total, status, created_at")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("contact_notes")
      .select("id, body, visible_to_agent, created_at")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("funnel_cards")
      .select("funnel_stages(name)")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .maybeSingle(),
  ]);

  const stageRaw = card?.funnel_stages as { name?: string } | { name?: string }[] | null | undefined;
  const funnelStage = Array.isArray(stageRaw) ? stageRaw[0]?.name : stageRaw?.name;

  const rawConversations = (conversationsResult.data ?? []) as unknown as Array<{
    id: number;
    channel: string;
    status: string;
    mode: string;
    updated_at: string;
    created_at?: string;
    last_message_at?: string | null;
    last_message_preview?: string | null;
    metadata: unknown;
  }>;

  const mappedConversations: ContactConversationItem[] = rawConversations.map((row) => {
    const meta = asRecord(row.metadata);
    const rawHistory = Array.isArray(meta.resolution_history) ? meta.resolution_history : [];
    const resolutionHistory: ContactResolutionEntry[] = rawHistory
      .map((item) => {
        const record = asRecord(item);
        return {
          id: typeof record.id === "string" ? record.id : undefined,
          resolvedAt: typeof record.resolved_at === "string" ? record.resolved_at : "",
          resolvedBy: typeof record.resolved_by === "string" ? record.resolved_by : null,
          outcome: typeof record.outcome === "string" ? record.outcome : null,
          reason: typeof record.reason === "string" ? record.reason : null,
          summary: typeof record.summary === "string" ? record.summary : null,
        };
      })
      .filter((item) => Boolean(item.resolvedAt));

    const statusVal =
      row.status === "resolved" || row.status === "in_progress" || row.status === "open"
        ? row.status
        : "open";

    return {
      id: row.id,
      channel: row.channel,
      status: statusVal,
      mode: row.mode,
      updatedAt: row.updated_at || new Date().toISOString(),
      createdAt: row.created_at || row.updated_at || new Date().toISOString(),
      lastMessageAt: row.last_message_at ?? null,
      lastMessagePreview:
        row.last_message_preview?.trim() ||
        (typeof meta.last_message_preview === "string" ? meta.last_message_preview.trim() : null),
      resolvedAt: typeof meta.resolved_at === "string" ? meta.resolved_at : null,
      resolvedBy: typeof meta.resolved_by === "string" ? meta.resolved_by : null,
      resolutionOutcome: typeof meta.resolution_outcome === "string" ? meta.resolution_outcome : null,
      resolutionReason: typeof meta.resolution_reason === "string" ? meta.resolution_reason : null,
      resolutionSummary: typeof meta.resolution_summary === "string" ? meta.resolution_summary : null,
      resolutionHistory,
    };
  });

  return {
    id: base.id as number,
    fullName: (base.full_name as string) || "Contacto sin nombre",
    phone: (base.phone as string | null) ?? null,
    email: (base.email as string | null) ?? null,
    updatedAt: base.updated_at as string,
    tags: mapTags((base as { contact_tag_links?: unknown }).contact_tag_links),
    conversations: mappedConversations,
    orders: (orders ?? []).map((row) => ({
      id: row.id as number,
      total: Number(row.total ?? 0),
      status: row.status as string,
      createdAt: row.created_at as string,
    })),
    notes: (notesResult.error ? [] : notesResult.data ?? []).map((row) => ({
      id: row.id as number,
      body: row.body as string,
      visibleToAgent: row.visible_to_agent === true,
      createdAt: row.created_at as string,
    })),
    funnelStage: funnelStage ?? null,
  };
};
