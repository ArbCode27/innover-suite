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
  metadata?: unknown;
  contacts: {
    full_name: string;
    phone: string | null;
  } | null;
  conversations: {
    channel: MetaChannel;
  } | null;
  listings?:
    | {
        title?: string | null;
        code?: string | null;
        price?: number | string | null;
        currency?: string | null;
      }
    | {
        title?: string | null;
        code?: string | null;
        price?: number | string | null;
        currency?: string | null;
      }[]
    | null;
};

const META_CHANNELS: MetaChannel[] = ["whatsapp", "instagram", "messenger"];

const isMetaChannel = (value: unknown): value is MetaChannel =>
  typeof value === "string" && META_CHANNELS.includes(value as MetaChannel);

const listingFromCard = (row: CardRow) => (Array.isArray(row.listings) ? row.listings[0] : row.listings) ?? null;

const listingTitleFromCard = (row: CardRow) => {
  const listing = listingFromCard(row);
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

const productFromMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { productName: null as string | null, productPrice: null as number | null, productCurrency: null as string | null };
  }
  const row = metadata as Record<string, unknown>;
  const productName = typeof row.product_name === "string" && row.product_name.trim() ? row.product_name.trim() : null;
  const productPrice = asNumber(
    typeof row.product_price === "number" || typeof row.product_price === "string" ? row.product_price : null,
  );
  const productCurrency =
    typeof row.product_currency === "string" && row.product_currency.trim() ? row.product_currency.trim() : null;
  return { productName, productPrice, productCurrency };
};

export const mapFunnelCard = (row: CardRow): FunnelCardView => {
  const listing = listingFromCard(row);
  const listingTitle = listingTitleFromCard(row);
  const fromMetadata = productFromMetadata(row.metadata);
  const listingPrice = asNumber(listing?.price ?? null);
  const productName = fromMetadata.productName || listingTitle;
  const productPrice = fromMetadata.productPrice ?? listingPrice ?? (productName ? asNumber(row.value_amount) : null);
  const productCurrency = fromMetadata.productCurrency || listing?.currency || row.currency || null;

  return {
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
    listingTitle,
    productName,
    productPrice,
    productCurrency,
  };
};

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

const parseToolProductId = (args: unknown) => {
  if (!args || typeof args !== "object") return null;
  const row = args as Record<string, unknown>;
  const raw = row.productId ?? row.product_id;
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const enrichFunnelCards = async (
  supabase: FunnelSupabase,
  organizationId: number,
  cards: FunnelCardView[],
): Promise<FunnelCardView[]> => {
  if (!cards.length) return cards;

  const contactIds = [...new Set(cards.map((card) => card.contactId))];
  const needsChannel = cards.some((card) => !card.channel);
  const needsProduct = cards.some((card) => !card.productName);

  const conversationByContact = new Map<number, { id: number; channel: MetaChannel }>();
  if (needsChannel || needsProduct) {
    const { data: conversationRows } = await supabase
      .from("conversations")
      .select("id, contact_id, channel, updated_at")
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds)
      .order("updated_at", { ascending: false });

    for (const row of conversationRows ?? []) {
      const contactId = row.contact_id as number;
      if (conversationByContact.has(contactId)) continue;
      if (!isMetaChannel(row.channel)) continue;
      conversationByContact.set(contactId, { id: row.id as number, channel: row.channel });
    }
  }

  const productByContact = new Map<number, { name: string; price: number | null; currency: string | null }>();
  if (needsProduct) {
    const { data: orderRows } = await supabase
      .from("orders")
      .select("contact_id, created_at, order_items(name_snapshot, unit_price)")
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(200);

    for (const row of orderRows ?? []) {
      const contactId = row.contact_id as number | null;
      if (!contactId || productByContact.has(contactId)) continue;
      const items = Array.isArray(row.order_items) ? row.order_items : [];
      const first = items[0] as { name_snapshot?: string | null; unit_price?: number | string | null } | undefined;
      const name = first?.name_snapshot?.trim();
      if (!name) continue;
      productByContact.set(contactId, {
        name,
        price: asNumber(first?.unit_price ?? null),
        currency: null,
      });
    }

    const conversationIds = [
      ...new Set(
        cards
          .map((card) => card.conversationId ?? conversationByContact.get(card.contactId)?.id ?? null)
          .filter((id): id is number => typeof id === "number"),
      ),
    ];

    if (conversationIds.length) {
      const { data: toolRows } = await supabase
        .from("agent_tool_runs")
        .select("conversation_id, arguments, created_at")
        .eq("organization_id", organizationId)
        .eq("tool_name", "send_image")
        .eq("ok", true)
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(120);

      const productIdByConversation = new Map<number, number>();
      for (const row of toolRows ?? []) {
        const conversationId = row.conversation_id as number;
        if (productIdByConversation.has(conversationId)) continue;
        const productId = parseToolProductId(row.arguments);
        if (productId) productIdByConversation.set(conversationId, productId);
      }

      const productIds = [...new Set(productIdByConversation.values())];
      if (productIds.length) {
        const { data: productRows } = await supabase
          .from("products")
          .select("id, name, price, currency")
          .eq("organization_id", organizationId)
          .in("id", productIds);

        const products = new Map(
          (productRows ?? []).map((row) => [
            row.id as number,
            {
              name: (row.name as string) || "Producto",
              price: asNumber(row.price as number | string | null),
              currency: (row.currency as string | null) ?? null,
            },
          ]),
        );

        const conversationToContact = new Map<number, number>();
        for (const card of cards) {
          const conversationId = card.conversationId ?? conversationByContact.get(card.contactId)?.id;
          if (conversationId) conversationToContact.set(conversationId, card.contactId);
        }

        for (const [conversationId, productId] of productIdByConversation) {
          const contactId = conversationToContact.get(conversationId);
          const product = products.get(productId);
          if (!contactId || !product || productByContact.has(contactId)) continue;
          productByContact.set(contactId, product);
        }
      }
    }
  }

  return cards.map((card) => {
    const conversation = conversationByContact.get(card.contactId);
    const product = productByContact.get(card.contactId);
    return {
      ...card,
      channel: card.channel ?? conversation?.channel ?? null,
      productName: card.productName || product?.name || null,
      productPrice: card.productPrice ?? product?.price ?? null,
      productCurrency: card.productCurrency || product?.currency || card.currency,
    };
  });
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
    "id, stage_id, contact_id, conversation_id, title, value_amount, currency, owner_user_id, position, updated_at, listing_id, metadata, contacts(full_name, phone), conversations(channel), listings(title, code, price, currency)";
  const cardSelectWithCurrency =
    "id, stage_id, contact_id, conversation_id, title, value_amount, currency, owner_user_id, position, updated_at, metadata, contacts(full_name, phone), conversations(channel)";
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

  const cards = ((cardRows ?? []) as CardRow[]).map(mapFunnelCard);
  const enriched = await enrichFunnelCards(supabase, organizationId, cards);

  const cardsByStage = new Map<number, FunnelCardView[]>();
  enriched.forEach((card) => {
    const current = cardsByStage.get(card.stageId) ?? [];
    current.push(card);
    cardsByStage.set(card.stageId, current);
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

export const loadOrganizationFunnelStages = async (
  supabase: FunnelSupabase,
  organizationId: number,
): Promise<Array<{ id: number; name: string }>> => {
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!funnel?.id) {
    return [];
  }

  const { data } = await supabase
    .from("funnel_stages")
    .select("id, name")
    .eq("funnel_id", funnel.id)
    .order("order_index", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
  }));
};
