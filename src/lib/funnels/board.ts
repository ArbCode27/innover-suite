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
  owner_user_id: string | null;
  position: number;
  updated_at: string;
  contacts: {
    full_name: string;
    phone: string | null;
  } | null;
  conversations: {
    channel: MetaChannel;
  } | null;
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
  ownerUserId: row.owner_user_id,
  position: row.position,
  updatedAt: row.updated_at,
  contactName: row.contacts?.full_name || row.title,
  contactPhone: row.contacts?.phone ?? null,
  channel: row.conversations?.channel ?? null,
});

const ensureDefaultStages = async (supabase: FunnelSupabase, funnelId: number) => {
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
    DEFAULT_FUNNEL_STAGES.map((name, orderIndex) => ({
      funnel_id: funnelId,
      name,
      order_index: orderIndex,
    })),
  );

  if (stagesError) {
    throw stagesError;
  }
};

export const ensureDefaultFunnel = async (supabase: FunnelSupabase, organizationId: number) => {
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
    await ensureDefaultStages(supabase, existing.id as number);
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
      await ensureDefaultStages(supabase, raced.id as number);
      return raced as FunnelRow;
    }

    throw createError;
  }

  const { error: stagesError } = await supabase.from("funnel_stages").insert(
    DEFAULT_FUNNEL_STAGES.map((name, orderIndex) => ({
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

  const { data: cardRows, error: cardsError } = stageIds.length
    ? await supabase
        .from("funnel_cards")
        .select(
          "id, stage_id, contact_id, conversation_id, title, value_amount, owner_user_id, position, updated_at, contacts(full_name, phone), conversations(channel)",
        )
        .eq("organization_id", organizationId)
        .eq("funnel_id", funnel.id)
        .order("position", { ascending: true })
        .order("id", { ascending: true })
    : { data: [], error: null };

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
