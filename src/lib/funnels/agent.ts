import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AgentFunnelStage } from "@/lib/agent/types";

const POSTGRES_UNIQUE_VIOLATION = "23505";

const nextStagePosition = async (stageId: number, organizationId: number) => {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("funnel_cards")
    .select("position")
    .eq("organization_id", organizationId)
    .eq("stage_id", stageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return typeof data?.position === "number" ? data.position + 1 : 0;
};

export const loadAgentFunnelSnapshot = async (organizationId: number, contactId: number) => {
  const admin = getSupabaseAdminClient();
  const { data: funnel } = await admin
    .from("funnels")
    .select("id, name")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!funnel?.id) {
    return { funnelName: null, stages: [] as AgentFunnelStage[], currentStage: null as AgentFunnelStage | null };
  }

  const { data: stageRows } = await admin
    .from("funnel_stages")
    .select("id, name, order_index")
    .eq("funnel_id", funnel.id)
    .order("order_index", { ascending: true });

  const stages: AgentFunnelStage[] = (stageRows ?? []).map((row) => ({
    id: row.id as number,
    name: row.name as string,
    orderIndex: row.order_index as number,
  }));

  const { data: card } = await admin
    .from("funnel_cards")
    .select("stage_id")
    .eq("organization_id", organizationId)
    .eq("funnel_id", funnel.id)
    .eq("contact_id", contactId)
    .maybeSingle();

  const currentStage = stages.find((stage) => stage.id === card?.stage_id) ?? null;

  return {
    funnelName: funnel.name as string,
    stages,
    currentStage,
  };
};

export const moveContactToFunnelStage = async (params: {
  organizationId: number;
  contactId: number;
  conversationId: number;
  stageId: number;
  reason: string;
  valueAmount?: number;
}) => {
  const snapshot = await loadAgentFunnelSnapshot(params.organizationId, params.contactId);
  const target = snapshot.stages.find((stage) => stage.id === params.stageId);
  if (!target) {
    return { ok: false as const, error: "La etapa no pertenece al embudo de esta organización." };
  }

  const admin = getSupabaseAdminClient();
  const { data: funnel } = await admin
    .from("funnels")
    .select("id")
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!funnel?.id) {
    return { ok: false as const, error: "No hay un embudo configurado." };
  }

  const { data: contact } = await admin
    .from("contacts")
    .select("id, full_name")
    .eq("id", params.contactId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!contact?.id) {
    return { ok: false as const, error: "El contacto no existe." };
  }

  const { data: existing } = await admin
    .from("funnel_cards")
    .select("id, stage_id, metadata")
    .eq("organization_id", params.organizationId)
    .eq("funnel_id", funnel.id)
    .eq("contact_id", contact.id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) as Record<string, unknown>),
    last_agent_reason: params.reason,
    last_agent_move_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await admin
      .from("funnel_cards")
      .update({
        stage_id: target.id,
        funnel_id: funnel.id,
        conversation_id: params.conversationId,
        value_amount: params.valueAmount ?? null,
        metadata,
      })
      .eq("id", existing.id)
      .eq("organization_id", params.organizationId);

    if (error) {
      return { ok: false as const, error: "No se pudo mover la oportunidad." };
    }

    return {
      ok: true as const,
      stageName: target.name,
      previousStageId: existing.stage_id as number,
    };
  }

  const position = await nextStagePosition(target.id, params.organizationId);
  const { error: insertError } = await admin.from("funnel_cards").insert({
    organization_id: params.organizationId,
    funnel_id: funnel.id,
    stage_id: target.id,
    contact_id: contact.id,
    conversation_id: params.conversationId,
    title: (contact.full_name as string) || "Oportunidad",
    value_amount: params.valueAmount ?? null,
    position,
    metadata,
  });

  if (insertError && insertError.code !== POSTGRES_UNIQUE_VIOLATION) {
    return { ok: false as const, error: "No se pudo crear la oportunidad en el embudo." };
  }

  return {
    ok: true as const,
    stageName: target.name,
    previousStageId: null,
  };
};

const asMetadataRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

export const rememberFunnelInterest = async (params: {
  organizationId: number;
  contactId: number;
  conversationId: number;
  productId?: number;
  productName?: string;
  productPrice?: number;
  productCurrency?: string;
  listingId?: number;
}) => {
  const productName = params.productName?.trim();
  if (!productName && params.listingId == null) return;

  const admin = getSupabaseAdminClient();
  const { data: funnel } = await admin
    .from("funnels")
    .select("id")
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!funnel?.id) return;

  const { data: card } = await admin
    .from("funnel_cards")
    .select("id, metadata, value_amount, listing_id")
    .eq("organization_id", params.organizationId)
    .eq("funnel_id", funnel.id)
    .eq("contact_id", params.contactId)
    .maybeSingle();

  if (!card?.id) return;

  const metadata = {
    ...asMetadataRecord(card.metadata),
    ...(params.productId != null ? { product_id: params.productId } : {}),
    ...(productName ? { product_name: productName } : {}),
    ...(params.productPrice != null ? { product_price: params.productPrice } : {}),
    ...(params.productCurrency ? { product_currency: params.productCurrency } : {}),
  };

  const patch: Record<string, unknown> = {
    conversation_id: params.conversationId,
    metadata,
  };
  if (params.productPrice != null && card.value_amount == null) {
    patch.value_amount = params.productPrice;
    if (params.productCurrency) patch.currency = params.productCurrency;
  }
  if (params.listingId != null && card.listing_id == null) {
    patch.listing_id = params.listingId;
  }

  await admin.from("funnel_cards").update(patch).eq("id", card.id).eq("organization_id", params.organizationId);
};
