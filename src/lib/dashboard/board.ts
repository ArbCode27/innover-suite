import type { SupabaseClient } from "@supabase/supabase-js";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { parseContactUsername } from "@/lib/contacts/display";
import { resolveMessagePreview } from "@/lib/media/parse";
import { toNumber } from "@/lib/commerce/types";
import type { MetaChannel } from "@/types/domain";

export type DashboardSnapshot = {
  openChats: number;
  unreadChats: number;
  humanQueue: number;
  ordersToday: number;
  revenueToday: number;
  unpaidOrders: number;
  appointmentsToday: number;
  lowStock: number;
  contacts: number;
};

export type DashboardReport = {
  revenue30d: number;
  orders30d: number;
  cancelled30d: number;
  byChannel: Record<string, number>;
  conversationsTotal: number;
  conversationsAi: number;
  conversationsHuman: number;
  conversationsOpen: number;
  audit: Array<{ id: number; action: string; entity: string; createdAt: string }>;
};

export type DashboardChat = {
  id: number;
  channel: MetaChannel;
  status: "open" | "in_progress" | "resolved";
  mode: "ai" | "human";
  contactId: number | null;
  contactName: string;
  contactUsername: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  ordersCount: number;
  revenue: number;
  unpaidCount: number;
  lastOrderStatus: string | null;
};

export type DashboardBoard = {
  today: DashboardSnapshot;
  report: DashboardReport;
  chats: DashboardChat[];
};

const isMetaChannel = (value: string): value is MetaChannel =>
  value === "whatsapp" || value === "instagram" || value === "messenger";

const startOfTodayIso = () => {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${local}T00:00:00.000-04:00`;
};

const startOfRangeIso = (days: number) => {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString();
};

const asMetadata = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export const loadDashboardSnapshot = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<DashboardSnapshot> => {
  const todayStart = startOfTodayIso();

  const [openChats, conversations, ordersToday, unpaidOrders, appointmentsToday, inventory, contacts] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .neq("status", "resolved"),
      supabase
        .from("conversations")
        .select("id, mode, assigned_user_id, metadata")
        .eq("organization_id", organizationId)
        .neq("status", "resolved")
        .limit(200),
      supabase
        .from("orders")
        .select("id, total, status")
        .eq("organization_id", organizationId)
        .gte("created_at", todayStart)
        .neq("status", "cancelled"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("payment_status", "unpaid")
        .neq("status", "cancelled"),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .neq("status", "cancelled")
        .gte("starts_at", todayStart),
      supabase
        .from("inventory_items")
        .select("on_hand, reorder_point, track_stock")
        .eq("organization_id", organizationId)
        .eq("track_stock", true),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId),
    ]);

  const unreadChats = (conversations.data ?? []).filter((row) => {
    const unread = asMetadata(row.metadata)["unread_count"];
    return typeof unread === "number" && unread > 0;
  }).length;

  const humanQueue = (conversations.data ?? []).filter(
    (row) => row.mode === "human" && !row.assigned_user_id,
  ).length;

  return {
    openChats: openChats.count ?? (conversations.data ?? []).length,
    unreadChats,
    humanQueue,
    ordersToday: (ordersToday.data ?? []).length,
    revenueToday: (ordersToday.data ?? []).reduce((sum, row) => sum + toNumber(row.total), 0),
    unpaidOrders: unpaidOrders.count ?? 0,
    appointmentsToday: appointmentsToday.count ?? 0,
    lowStock: (inventory.data ?? []).filter((row) => {
      const onHand = toNumber(row.on_hand);
      const reorder = toNumber(row.reorder_point);
      return row.track_stock !== false && onHand <= reorder;
    }).length,
    contacts: contacts.count ?? 0,
  };
};

export const loadDashboardBoard = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<DashboardBoard> => {
  const since = startOfRangeIso(30);

  const [today, ordersResult, conversationStats, auditResult, chatRows] = await Promise.all([
    loadDashboardSnapshot(supabase, organizationId),
    supabase
      .from("orders")
      .select("id, total, status, payment_status, channel, conversation_id, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", since)
      .limit(500),
    supabase
      .from("conversations")
      .select("id, channel, mode, status")
      .eq("organization_id", organizationId)
      .limit(500),
    supabase
      .from("audit_events")
      .select("id, action, entity, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("conversations")
      .select(
        "id, contact_id, channel, status, mode, updated_at, last_message_at, metadata, contacts(full_name, metadata)",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(24),
  ]);

  const orderRows = ordersResult.data ?? [];
  const activeOrders = orderRows.filter((row) => row.status !== "cancelled");
  const byChannel = activeOrders.reduce<Record<string, number>>((acc, row) => {
    const key = (row.channel as string) || "otro";
    acc[key] = (acc[key] ?? 0) + toNumber(row.total);
    return acc;
  }, {});

  const conversationRows = conversationStats.data ?? [];
  const report: DashboardReport = {
    revenue30d: activeOrders.reduce((sum, row) => sum + toNumber(row.total), 0),
    orders30d: activeOrders.length,
    cancelled30d: orderRows.filter((row) => row.status === "cancelled").length,
    byChannel,
    conversationsTotal: conversationRows.length,
    conversationsAi: conversationRows.filter((row) => row.mode === "ai").length,
    conversationsHuman: conversationRows.filter((row) => row.mode === "human").length,
    conversationsOpen: conversationRows.filter((row) => row.status !== "resolved").length,
    audit: (auditResult.data ?? []).map((row) => ({
      id: row.id as number,
      action: row.action as string,
      entity: row.entity as string,
      createdAt: row.created_at as string,
    })),
  };

  const chatsRaw = (chatRows.data ?? []) as Array<{
    id: number;
    contact_id: number | null;
    channel: string;
    status: "open" | "in_progress" | "resolved";
    mode: "ai" | "human";
    updated_at: string;
    last_message_at: string | null;
    metadata: unknown;
    contacts: { full_name?: string | null; metadata?: unknown } | { full_name?: string | null; metadata?: unknown }[] | null;
  }>;

  const chatIds = chatsRaw.map((row) => row.id);
  const latestByChat = new Map<number, { content: string | null; media_url: string | null; metadata: unknown }>();
  const metricsByChat = new Map<
    number,
    { ordersCount: number; revenue: number; unpaidCount: number; lastOrderStatus: string | null; lastCreatedAt: string }
  >();

  if (chatIds.length) {
    const [{ data: latestMessages }, { data: chatOrders }] = await Promise.all([
      supabase
        .from("messages")
        .select("conversation_id, content, media_url, metadata, created_at")
        .in("conversation_id", chatIds)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase
        .from("orders")
        .select("conversation_id, total, status, payment_status, created_at")
        .eq("organization_id", organizationId)
        .in("conversation_id", chatIds)
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    (latestMessages ?? []).forEach((row) => {
      const conversationId = row.conversation_id as number;
      if (!latestByChat.has(conversationId)) {
        latestByChat.set(conversationId, {
          content: (row.content as string | null) ?? null,
          media_url: (row.media_url as string | null) ?? null,
          metadata: row.metadata,
        });
      }
    });

    (chatOrders ?? []).forEach((row) => {
      const conversationId = row.conversation_id as number | null;
      if (!conversationId) return;
      const current = metricsByChat.get(conversationId) ?? {
        ordersCount: 0,
        revenue: 0,
        unpaidCount: 0,
        lastOrderStatus: null,
        lastCreatedAt: "",
      };
      if (row.status !== "cancelled") {
        current.ordersCount += 1;
        current.revenue += toNumber(row.total);
        if (row.payment_status === "unpaid") current.unpaidCount += 1;
      }
      if (!current.lastCreatedAt) {
        current.lastOrderStatus = (row.status as string) ?? null;
        current.lastCreatedAt = (row.created_at as string) ?? "";
      }
      metricsByChat.set(conversationId, current);
    });
  }

  const chats: DashboardChat[] = chatsRaw
    .filter((row): row is typeof row & { channel: MetaChannel } => isMetaChannel(row.channel))
    .map((row) => {
      const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
      const latest = latestByChat.get(row.id);
      const metrics = metricsByChat.get(row.id);
      const unreadRaw = asMetadata(row.metadata)["unread_count"];
      return {
        id: row.id,
        channel: row.channel,
        status: row.status,
        mode: row.mode,
        contactId: row.contact_id,
        contactName: contact?.full_name?.trim() || "Contacto sin nombre",
        contactUsername: parseContactUsername(contact?.metadata),
        lastMessagePreview: resolveMessagePreview({
          content: latest?.content ?? null,
          mediaUrl: latest?.media_url ?? null,
          metadata: latest?.metadata,
        }),
        lastMessageAt: row.last_message_at,
        unreadCount: typeof unreadRaw === "number" ? unreadRaw : 0,
        ordersCount: metrics?.ordersCount ?? 0,
        revenue: metrics?.revenue ?? 0,
        unpaidCount: metrics?.unpaidCount ?? 0,
        lastOrderStatus: metrics?.lastOrderStatus ?? null,
      };
    });

  return { today, report, chats };
};
