import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_FUNNEL_NAME, DEFAULT_FUNNEL_STAGES } from "@/app/(suite)/funnels/types";
import type { FunnelBoardView, FunnelCardView, FunnelStageView } from "@/app/(suite)/funnels/types";
import type { MetaChannel } from "@/types/domain";

type FunnelSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type FunnelRow = {
  id: number;
  name: string;
};

type StageRow = {
  id: number;
  funnel_id: number;
  name: string;
  order_index: number;
};

type CardRow = {
  id: number;
  stage_id: number;
  contact_id: number;
  conversation_id: number | null;
  title: string;
  value_amount: number | string | null;
  currency?: string | null;
  owner_user_id: string | null;
  position: number;
  updated_at: string;
  listing_id?: number | null;
  contacts: {
    full_name: string;
    phone: string | null;
  } | null;
  conversations: {
    channel: MetaChannel;
  } | null;
  listings?: { title?: string | null; code?: string | null } | { title?: string | null; code?: string | null }[] | null;
};

const listingTitleFromCard = (row: CardRow) => {
  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
  const title = listing?.title?.trim();
  const code = listing?.code?.trim();
  if (title && code) return `${code} · ${title}`;
  return title || code || null;
};

const asNumber = (value: number | string | null) => {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapFunnelCard = (row: CardRow): FunnelCardView => ({
  id: row.id,
  stageId: row.stage_id,
  contactId: row.contact_id,
  conversationId: row.conversation_id,
  title: row.title,
  valueAmount: asNumber(row.value_amount),
  currency: row.currency ?? null,
  ownerUserId: row.owner_user_id,
  position: row.position,
  updatedAt: row.updated_at,
  contactName: row.contacts?.full_name || row.title,
  contactPhone: row.contacts?.phone ?? null,
  channel: row.conversations?.channel ?? null,
  listingId: row.listing_id ?? null,
  listingTitle: listingTitleFromCard(row),
});

const ensureDefaultStages = async (
  supabase: FunnelSupabase,
  funnelId: number,
  stageNames: readonly string[] = DEFAULT_FUNNEL_STAGES,
) => {
  const { count, error } = await supabase
    .from("funnel_stages")
    .select("id", { count: "exact", head: true })
    .eq("funnel_id", funnelId);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const { error: stagesError } = await supabase.from("funnel_stages").insert(
    stageNames.map((name, orderIndex) => ({
      funnel_id: funnelId,
      name,
      order_index: orderIndex,
    })),
  );

  if (stagesError) {
    throw stagesError;
  }
};

export const ensureDefaultFunnel = async (
  supabase: FunnelSupabase,
  organizationId: number,
  stageNames: readonly string[] = DEFAULT_FUNNEL_STAGES,
) => {
  const { data: existing, error: existingError } = await supabase
    .from("funnels")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    await ensureDefaultStages(supabase, existing.id as number, stageNames);
    return existing as FunnelRow;
  }

  const { data: created, error: createError } = await supabase
    .from("funnels")
    .insert({
      organization_id: organizationId,
      name: DEFAULT_FUNNEL_NAME,
    })
    .select("id, name")
    .single();

  if (createError) {
    const { data: raced } = await supabase
      .from("funnels")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (raced?.id) {
      await ensureDefaultStages(supabase, raced.id as number, stageNames);
      return raced as FunnelRow;
    }

    throw createError;
  }

  const { error: stagesError } = await supabase.from("funnel_stages").insert(
    stageNames.map((name, orderIndex) => ({
      funnel_id: created.id,
      name,
      order_index: orderIndex,
    })),
  );

  if (stagesError) {
    throw stagesError;
  }

  return created as FunnelRow;
};

export const loadFunnelBoard = async (
  supabase: FunnelSupabase,
  organizationId: number,
): Promise<FunnelBoardView> => {
  const funnel = await ensureDefaultFunnel(supabase, organizationId);

  const { data: stageRows, error: stagesError } = await supabase
    .from("funnel_stages")
    .select("id, funnel_id, name, order_index")
    .eq("funnel_id", funnel.id)
    .order("order_index", { ascending: true });

  if (stagesError) {
    throw stagesError;
  }

  const stages = (stageRows ?? []) as StageRow[];
  const stageIds = stages.map((stage) => stage.id);

  const cardSelectWithListing =
    "id, stage_id, contact_id, conversation_id, title, value_amount, currency, owner_user_id, position, updated_at, listing_id, contacts(full_name, phone), conversations(channel), listings(title, code)";
  const cardSelectWithCurrency =
    "id, stage_id, contact_id, conversation_id, title, value_amount, currency, owner_user_id, position, updated_at, contacts(full_name, phone), conversations(channel)";
  const cardSelect =
    "id, stage_id, contact_id, conversation_id, title, value_amount, owner_user_id, position, updated_at, contacts(full_name, phone), conversations(channel)";

  let cardRows: unknown[] | null = [];
  let cardsError: { message?: string } | null = null;
  if (stageIds.length) {
    const withListing = await supabase
      .from("funnel_cards")
      .select(cardSelectWithListing)
      .eq("organization_id", organizationId)
      .eq("funnel_id", funnel.id)
      .order("position", { ascending: true })
      .order("id", { ascending: true });
    if (withListing.error && /listing/i.test(withListing.error.message)) {
      const withCurrency = await supabase
        .from("funnel_cards")
        .select(cardSelectWithCurrency)
        .eq("organization_id", organizationId)
        .eq("funnel_id", funnel.id)
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (withCurrency.error) {
        const fallback = await supabase
          .from("funnel_cards")
          .select(cardSelect)
          .eq("organization_id", organizationId)
          .eq("funnel_id", funnel.id)
          .order("position", { ascending: true })
          .order("id", { ascending: true });
        cardRows = fallback.data;
        cardsError = fallback.error;
      } else {
        cardRows = withCurrency.data;
      }
    } else if (withListing.error) {
      const fallback = await supabase
        .from("funnel_cards")
        .select(cardSelect)
        .eq("organization_id", organizationId)
        .eq("funnel_id", funnel.id)
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      cardRows = fallback.data;
      cardsError = fallback.error;
    } else {
      cardRows = withListing.data;
    }
  }

  if (cardsError) {
    throw cardsError;
  }

  const cardsByStage = new Map<number, FunnelCardView[]>();
  ((cardRows ?? []) as CardRow[]).forEach((row) => {
    const current = cardsByStage.get(row.stage_id) ?? [];
    current.push(mapFunnelCard(row));
    cardsByStage.set(row.stage_id, current);
  });

  const mappedStages: FunnelStageView[] = stages.map((stage) => ({
    id: stage.id,
    funnelId: stage.funnel_id,
    name: stage.name,
    orderIndex: stage.order_index,
    cards: cardsByStage.get(stage.id) ?? [],
  }));

  return {
    id: funnel.id,
    name: funnel.name,
    stages: mappedStages,
  };
};
