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

export type ContactDetail = ContactListItem & {
  conversations: Array<{ id: number; channel: string; mode: string; updatedAt: string }>;
  orders: Array<{ id: number; total: number; status: string; createdAt: string }>;
  notes: ContactNote[];
  funnelStage: string | null;
};

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

  const [{ data: conversations }, { data: orders }, notesResult, { data: card }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, channel, mode, updated_at")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("orders")
      .select("id, total, status, created_at")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(10),
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

  return {
    id: base.id as number,
    fullName: (base.full_name as string) || "Contacto sin nombre",
    phone: (base.phone as string | null) ?? null,
    email: (base.email as string | null) ?? null,
    updatedAt: base.updated_at as string,
    tags: mapTags((base as { contact_tag_links?: unknown }).contact_tag_links),
    conversations: (conversations ?? []).map((row) => ({
      id: row.id as number,
      channel: row.channel as string,
      mode: row.mode as string,
      updatedAt: row.updated_at as string,
    })),
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
