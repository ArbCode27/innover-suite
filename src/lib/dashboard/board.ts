import type { SupabaseClient } from "@supabase/supabase-js";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { toNumber } from "@/lib/commerce/types";
import {
  AGENT_HOURLY_COST,
  AI_MINUTES_PER_OUTBOUND,
  CHURN_INACTIVE_DAYS,
  DASHBOARD_CONVERSATION_LIMIT,
  DASHBOARD_MESSAGE_LIMIT,
  DASHBOARD_ORDER_LIMIT,
  HUMAN_QUEUE_STALE_MS,
  LOST_REASON_PATTERN,
  SLA_FIRST_RESPONSE_MS,
  TOKEN_EXPIRING_MS,
  UNANSWERED_STALE_MS,
  WEEKDAY_LABELS,
} from "@/lib/dashboard/constants";
import type { OrganizationModules } from "@/lib/modules/constants";
import { ROLE_LABELS, type OrganizationRole } from "@/lib/organizations/membership";
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
};

export type ChatChannelFunnel = {
  channel: MetaChannel | "otro";
  leads: number;
  buyers: number;
  inquirers: number;
};

export type ChatFunnel = {
  leads: number;
  buyers: number;
  inquirers: number;
  byChannel: ChatChannelFunnel[];
};

export type DashboardSla = {
  firstResponseAvgMs: number | null;
  firstResponseByChannel: Array<{ channel: string; avgMs: number; samples: number }>;
  resolutionAvgMs: number | null;
  slaHitPercent: number | null;
  slaTargetMinutes: number;
  unansweredStale: number;
  unansweredStaleMinutes: number;
};

export type DashboardAgentRow = {
  userId: string;
  label: string;
  chatsHandled: number;
  avgResponseMs: number | null;
  conversionPercent: number | null;
  openAssigned: number;
  revenue: number;
};

export type DashboardAi = {
  resolvedByAi: number;
  resolvedTotal: number;
  resolvedByAiPercent: number | null;
  handoffs: number;
  conversationsWithAi: number;
  handoffRate: number | null;
  hoursSaved: number;
  estimatedSavingDop: number;
};

export type DashboardStageRow = {
  id: number;
  name: string;
  count: number;
  conversionFromPrevious: number | null;
  conversionFromStart: number | null;
  avgDwellMs: number | null;
  estimatedValue: number;
};

export type DashboardStageFunnel = {
  stages: DashboardStageRow[];
  lostReasons: Array<{ reason: string; count: number }>;
};

export type DashboardFinanceComparison = {
  revenue: number;
  previousRevenue: number;
  orders: number;
  previousOrders: number;
  revenueGrowthPercent: number | null;
  ordersGrowthPercent: number | null;
};

export type DashboardFinance = {
  aov: number;
  revenue30d: number;
  revenuePrev30d: number;
  revenueGrowthPercent: number | null;
  orders30d: number;
  ordersPrev30d: number;
  ordersGrowthPercent: number | null;
  byChannel: Array<{ channel: string; revenue: number; orders: number }>;
  byAgent: Array<{ userId: string; label: string; revenue: number; orders: number }>;
  daily: Array<{ date: string; revenue: number; orders: number }>;
  previousDaily: Array<{ date: string; revenue: number; orders: number }>;
  comparisons: {
    weekly: DashboardFinanceComparison;
    monthly: DashboardFinanceComparison;
    annual: DashboardFinanceComparison;
  };
};

export type DashboardRetention = {
  newCustomers: number;
  returningCustomers: number;
  purchaseFrequency: number | null;
  ltv: number | null;
  inactiveCustomers: number;
  churnRiskDays: number;
};

export type DashboardActivity = {
  heatmap: number[][];
  maxHeat: number;
  bestConversionDay: { weekday: number; label: string; conversionPercent: number } | null;
};

export type DashboardAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  count: number;
};

export type DashboardProductRow = {
  name: string;
  quantity: number;
  revenue: number;
  orderSharePercent: number | null;
};

export type DashboardRestaurant = {
  topProducts: DashboardProductRow[];
  peakHour: { hour: number; orders: number } | null;
  hourlyOrders: Array<{ hour: number; orders: number }>;
  aov: number;
  aovPrev: number;
  ordersCount: number;
};

export type DashboardServicesComparison = {
  scheduled: number;
  previousScheduled: number;
  done: number;
  previousDone: number;
  cancelled: number;
  previousCancelled: number;
  scheduledGrowthPercent: number | null;
  doneGrowthPercent: number | null;
};

export type DashboardServices = {
  scheduled: number;
  done: number;
  cancelled: number;
  showRate: number | null;
  byPurpose: Array<{ purpose: string; count: number }>;
  topTitles: Array<{ title: string; count: number }>;
  comparisons: {
    weekly: DashboardServicesComparison;
    monthly: DashboardServicesComparison;
    annual: DashboardServicesComparison;
  };
};

export type DashboardRetail = {
  topProducts: DashboardProductRow[];
};

export type DashboardBoard = {
  modules: OrganizationModules;
  today: DashboardSnapshot;
  report: DashboardReport;
  funnel: ChatFunnel | null;
  sla: DashboardSla;
  agents: DashboardAgentRow[];
  ai: DashboardAi;
  stageFunnel: DashboardStageFunnel | null;
  finance: DashboardFinance | null;
  retention: DashboardRetention | null;
  activity: DashboardActivity;
  alerts: DashboardAlert[];
  restaurant: DashboardRestaurant | null;
  services: DashboardServices | null;
  retail: DashboardRetail | null;
};

const CHANNELS: MetaChannel[] = ["whatsapp", "instagram", "messenger"];

const isMetaChannel = (value: string): value is MetaChannel => CHANNELS.includes(value as MetaChannel);

const isOrganizationRole = (value: string): value is OrganizationRole =>
  value === "owner" ||
  value === "admin" ||
  value === "agent" ||
  value === "viewer" ||
  value === "kitchen" ||
  value === "cashier";

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

const leadKey = (contactId: number | null, conversationId: number) =>
  contactId ? `contact:${contactId}` : `conversation:${conversationId}`;

const channelOf = (value: string | null): ChatChannelFunnel["channel"] =>
  value && isMetaChannel(value) ? value : "otro";

const average = (values: number[]) => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const growthPercent = (current: number, previous: number) => {
  if (!previous && !current) return null;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
};

const summarizeOrders = (
  rows: Array<{ created_at: string; status: string; total: number | string }>,
  startIso: string,
  endIso?: string,
) => {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Number.POSITIVE_INFINITY;
  const active = rows.filter((row) => {
    if (row.status === "cancelled") return false;
    const time = new Date(row.created_at).getTime();
    return time >= start && time < end;
  });
  return {
    revenue: active.reduce((sum, row) => sum + toNumber(row.total), 0),
    orders: active.length,
  };
};

const toFinanceComparison = (
  current: { revenue: number; orders: number },
  previous: { revenue: number; orders: number },
) => ({
  revenue: current.revenue,
  previousRevenue: previous.revenue,
  orders: current.orders,
  previousOrders: previous.orders,
  revenueGrowthPercent: growthPercent(current.revenue, previous.revenue),
  ordersGrowthPercent: growthPercent(current.orders, previous.orders),
});

const toServicesComparison = (
  current: { scheduled: number; done: number; cancelled: number },
  previous: { scheduled: number; done: number; cancelled: number },
): DashboardServicesComparison => ({
  scheduled: current.scheduled,
  previousScheduled: previous.scheduled,
  done: current.done,
  previousDone: previous.done,
  cancelled: current.cancelled,
  previousCancelled: previous.cancelled,
  scheduledGrowthPercent: growthPercent(current.scheduled, previous.scheduled),
  doneGrowthPercent: growthPercent(current.done, previous.done),
});

const summarizeAppointments = (
  rows: Array<{ starts_at: string; status: string }>,
  startIso: string,
  endIso?: string,
) => {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Number.POSITIVE_INFINITY;
  const inWindow = rows.filter((row) => {
    const time = new Date(row.starts_at).getTime();
    return time >= start && time < end;
  });
  return {
    scheduled: inWindow.filter((row) => row.status !== "cancelled").length,
    done: inWindow.filter((row) => row.status === "done").length,
    cancelled: inWindow.filter((row) => row.status === "cancelled").length,
  };
};

const percentOrNull = (value: number, total: number) => {
  if (!total) return null;
  return Math.round((value / total) * 100);
};

const localDateKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

const localDateKeyFromOffset = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const buildDailySeries = (
  rows: Array<{ created_at: string; total: number | string }>,
  days: number,
  endOffset = 0,
) => {
  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    dailyMap.set(localDateKeyFromOffset(offset + endOffset), { revenue: 0, orders: 0 });
  }
  rows.forEach((row) => {
    const current = dailyMap.get(localDateKey(row.created_at));
    if (!current) return;
    current.revenue += toNumber(row.total);
    current.orders += 1;
  });
  return [...dailyMap.entries()].map(([date, value]) => ({ date, ...value }));
};

const localWeekdayHour = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const weekdayLabel = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { weekday: weekdayMap[weekdayLabel] ?? 0, hour: Number.isFinite(hour) ? hour : 0 };
};

const agentLabel = (userId: string, role?: string | null) => {
  const prefix = role && isOrganizationRole(role) ? ROLE_LABELS[role] : "Agente";
  return `${prefix} ${userId.slice(0, 4).toUpperCase()}`;
};

type ConversationRow = {
  id: number;
  contact_id: number | null;
  channel: string;
  mode: string;
  status: string;
  assigned_user_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: unknown;
};

type MessageRow = {
  conversation_id: number;
  direction: string;
  sender_type: string;
  sender_user_id: string | null;
  created_at: string;
};

type OrderItemRow = {
  product_id: number | null;
  name_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
};

type OrderRow = {
  id: number;
  total: number | string;
  status: string;
  payment_status?: string | null;
  channel: string | null;
  conversation_id: number | null;
  contact_id: number | null;
  created_at: string;
  order_items?: OrderItemRow[] | null;
};

type EmptyList = { data: never[]; count: number };

const emptyList = (): EmptyList => ({ data: [], count: 0 });

export const loadDashboardSnapshot = async (
  supabase: SupabaseClient,
  organizationId: number,
  modules: OrganizationModules,
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
      modules.orders
        ? supabase
            .from("orders")
            .select("id, total, status")
            .eq("organization_id", organizationId)
            .gte("created_at", todayStart)
            .neq("status", "cancelled")
        : Promise.resolve(emptyList()),
      modules.orders
        ? supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .eq("payment_status", "unpaid")
            .neq("status", "cancelled")
        : Promise.resolve(emptyList()),
      modules.calendar
        ? supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId)
            .neq("status", "cancelled")
            .gte("starts_at", todayStart)
        : Promise.resolve(emptyList()),
      modules.catalog
        ? supabase
            .from("inventory_items")
            .select("on_hand, reorder_point, track_stock")
            .eq("organization_id", organizationId)
            .eq("track_stock", true)
        : Promise.resolve(emptyList()),
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
    lowStock: ((inventory.data ?? []) as Array<{ on_hand: unknown; reorder_point: unknown; track_stock: boolean }>).filter(
      (row) => {
        const onHand = toNumber(row.on_hand);
        const reorder = toNumber(row.reorder_point);
        return row.track_stock !== false && onHand <= reorder;
      },
    ).length,
    contacts: contacts.count ?? 0,
  };
};

const buildLeadFunnel = (conversationRows: ConversationRow[], orderRows: OrderRow[]): ChatFunnel => {
  const buyerKeys = new Set<string>();
  orderRows
    .filter((row) => row.status !== "cancelled")
    .forEach((row) => {
      const contactId = row.contact_id ?? null;
      const conversationId = row.conversation_id ?? null;
      if (contactId) buyerKeys.add(leadKey(contactId, 0));
      else if (conversationId) buyerKeys.add(leadKey(null, conversationId));
    });

  const leads = new Map<string, ChatChannelFunnel["channel"]>();
  conversationRows.forEach((row) => {
    const key = leadKey(row.contact_id, row.id);
    if (!leads.has(key)) leads.set(key, channelOf(row.channel));
  });

  const byChannelFunnel = new Map<ChatChannelFunnel["channel"], { leads: number; buyers: number }>();
  const ensureChannel = (channel: ChatChannelFunnel["channel"]) => {
    const current = byChannelFunnel.get(channel) ?? { leads: 0, buyers: 0 };
    byChannelFunnel.set(channel, current);
    return current;
  };

  CHANNELS.forEach((channel) => ensureChannel(channel));

  leads.forEach((channel, key) => {
    const bucket = ensureChannel(channel);
    bucket.leads += 1;
    if (buyerKeys.has(key)) bucket.buyers += 1;
  });

  const funnelByChannel = [...byChannelFunnel.entries()]
    .map(([channel, value]) => ({
      channel,
      leads: value.leads,
      buyers: value.buyers,
      inquirers: Math.max(value.leads - value.buyers, 0),
    }))
    .filter((row) => row.leads > 0 || row.channel !== "otro");

  const leadsCount = leads.size;
  const buyersCount = [...leads.keys()].filter((key) => buyerKeys.has(key)).length;

  return {
    leads: leadsCount,
    buyers: buyersCount,
    inquirers: Math.max(leadsCount - buyersCount, 0),
    byChannel: funnelByChannel,
  };
};

const topProductsFromOrders = (orders: OrderRow[]): DashboardProductRow[] => {
  const totals = new Map<string, { quantity: number; revenue: number; orders: Set<number> }>();
  orders
    .filter((row) => row.status !== "cancelled")
    .forEach((row) => {
      (row.order_items ?? []).forEach((item) => {
        const name = item.name_snapshot?.trim() || "Producto";
        const current = totals.get(name) ?? { quantity: 0, revenue: 0, orders: new Set<number>() };
        current.quantity += toNumber(item.quantity);
        current.revenue += toNumber(item.quantity) * toNumber(item.unit_price);
        current.orders.add(row.id);
        totals.set(name, current);
      });
    });

  const activeOrders = orders.filter((row) => row.status !== "cancelled").length;
  return [...totals.entries()]
    .map(([name, value]) => ({
      name,
      quantity: value.quantity,
      revenue: value.revenue,
      orderSharePercent: percentOrNull(value.orders.size, activeOrders),
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);
};

export const loadDashboardBoard = async (
  supabase: SupabaseClient,
  organizationId: number,
  modules: OrganizationModules,
): Promise<DashboardBoard> => {
  const now = Date.now();
  const since30 = startOfRangeIso(30);
  const since60 = startOfRangeIso(60);
  const since7 = startOfRangeIso(7);
  const since14 = startOfRangeIso(14);
  const since365 = startOfRangeIso(365);
  const since730 = startOfRangeIso(730);
  const todayStart = startOfTodayIso();
  const [

    conversationsResult,
    messagesResult,
    ordersResult,
    membersResult,
    stagesResult,
    cardsResult,
    appointmentsResult,
    channelAccountsResult,
    instagramResult,
    calendarResult,
    handoffResult,
    tagsResult,
    openChatsResult,
    unpaidOrdersResult,
    contactsResult,
    inventoryResult,
    appointmentsTodayResult,
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, contact_id, channel, mode, status, assigned_user_id, last_message_at, created_at, updated_at, metadata")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(DASHBOARD_CONVERSATION_LIMIT),
    supabase
      .from("messages")
      .select("conversation_id, direction, sender_type, sender_user_id, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", since30)
      .neq("sender_type", "system")
      .order("created_at", { ascending: true })
      .limit(DASHBOARD_MESSAGE_LIMIT),
    modules.orders
      ? supabase
          .from("orders")
          .select(
            "id, total, status, payment_status, channel, conversation_id, contact_id, created_at, order_items(product_id, name_snapshot, quantity, unit_price)",
          )
          .eq("organization_id", organizationId)
          .gte("created_at", since730)
          .order("created_at", { ascending: false })
          .limit(DASHBOARD_ORDER_LIMIT)
      : Promise.resolve(emptyList()),
    supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    modules.funnels
      ? supabase
          .from("funnels")
          .select("id, funnel_stages(id, name, order_index)")
          .eq("organization_id", organizationId)
          .limit(3)
      : Promise.resolve(emptyList()),
    modules.funnels
      ? supabase
          .from("funnel_cards")
          .select("id, stage_id, contact_id, value_amount, created_at, updated_at")
          .eq("organization_id", organizationId)
          .limit(250)
      : Promise.resolve(emptyList()),
    modules.calendar
      ? supabase
          .from("appointments")
          .select("id, title, status, purpose, starts_at")
          .eq("organization_id", organizationId)
          .gte("starts_at", since730)
          .limit(600)
      : Promise.resolve(emptyList()),
    supabase
      .from("channel_accounts")
      .select("channel, updated_at")
      .eq("organization_id", organizationId),
    supabase
      .from("instagram_connections")
      .select("token_expires_at, revoked_at")
      .eq("organization_id", organizationId)
      .is("revoked_at", null)
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    modules.calendar
      ? supabase
          .from("calendar_connections")
          .select("token_expires_at, revoked_at")
          .eq("organization_id", organizationId)
          .eq("provider", "google")
          .is("revoked_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("agent_tool_runs")
      .select("conversation_id, ok")
      .eq("organization_id", organizationId)
      .eq("tool_name", "handoff_to_human")
      .eq("ok", true)
      .limit(200),
    modules.funnels
      ? supabase
          .from("contact_tags")
          .select("name, contact_tag_links(contact_id)")
          .eq("organization_id", organizationId)
          .limit(80)
      : Promise.resolve(emptyList()),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .neq("status", "resolved"),
    modules.orders
      ? supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("payment_status", "unpaid")
          .neq("status", "cancelled")
      : Promise.resolve(emptyList()),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    modules.catalog
      ? supabase
          .from("inventory_items")
          .select("on_hand, reorder_point, track_stock")
          .eq("organization_id", organizationId)
          .eq("track_stock", true)
      : Promise.resolve(emptyList()),
    modules.calendar
      ? supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .neq("status", "cancelled")
          .gte("starts_at", todayStart)
      : Promise.resolve(emptyList()),
  ]);

  const conversationRows = (conversationsResult.data ?? []) as ConversationRow[];
  const messageRows = (messagesResult.data ?? []) as MessageRow[];
  const orderRows = (ordersResult.data ?? []) as OrderRow[];
  const memberRows = (membersResult.data ?? []) as Array<{ user_id: string; role: string }>;
  const unreadChats = conversationRows.filter((row) => {
    const unread = asMetadata(row.metadata)["unread_count"];
    return row.status !== "resolved" && typeof unread === "number" && unread > 0;
  }).length;
  const humanQueue = conversationRows.filter(
    (row) => row.status !== "resolved" && row.mode === "human" && !row.assigned_user_id,
  ).length;
  const ordersToday = orderRows.filter(
    (row) => row.status !== "cancelled" && new Date(row.created_at).getTime() >= new Date(todayStart).getTime(),
  );
  const today: DashboardSnapshot = {
    openChats: openChatsResult.count ?? conversationRows.filter((row) => row.status !== "resolved").length,
    unreadChats,
    humanQueue,
    ordersToday: ordersToday.length,
    revenueToday: ordersToday.reduce((sum, row) => sum + toNumber(row.total), 0),
    unpaidOrders: unpaidOrdersResult.count ?? 0,
    appointmentsToday: appointmentsTodayResult.count ?? 0,
    lowStock: (
      (inventoryResult.data ?? []) as Array<{ on_hand: unknown; reorder_point: unknown; track_stock: boolean }>
    ).filter((row) => {
      const onHand = toNumber(row.on_hand);
      const reorder = toNumber(row.reorder_point);
      return row.track_stock !== false && onHand <= reorder;
    }).length,
    contacts: contactsResult.count ?? 0,
  };
  const conversationById = new Map(conversationRows.map((row) => [row.id, row]));
  const roleByUser = new Map(memberRows.map((row) => [row.user_id, row.role]));

  const messagesByConversation = new Map<number, MessageRow[]>();
  messageRows.forEach((row) => {
    const list = messagesByConversation.get(row.conversation_id) ?? [];
    list.push(row);
    messagesByConversation.set(row.conversation_id, list);
  });

  const firstResponseMs: number[] = [];
  const firstResponseByChannel = new Map<string, number[]>();
  const resolutionMs: number[] = [];
  let slaHits = 0;
  let slaSamples = 0;
  let unansweredStale = 0;
  let staleHumanQueue = 0;
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let maxHeat = 0;
  let aiOutbound = 0;
  const conversationsWithAi = new Set<number>();
  const conversationsWithAgent = new Set<number>();
  const handoffConversations = new Set<number>();
  const agentChats = new Map<string, Set<number>>();
  const agentResponses = new Map<string, number[]>();
  const weekdayLeads = Array.from({ length: 7 }, () => 0);
  const weekdayOrders = Array.from({ length: 7 }, () => 0);

  conversationRows.forEach((row) => {
    const weekday = localWeekdayHour(row.created_at).weekday;
    weekdayLeads[weekday] += 1;
  });

  orderRows
    .filter((row) => row.status !== "cancelled" && new Date(row.created_at).getTime() >= new Date(since30).getTime())
    .forEach((row) => {
      weekdayOrders[localWeekdayHour(row.created_at).weekday] += 1;
    });

  conversationRows.forEach((conversation) => {
    const messages = messagesByConversation.get(conversation.id) ?? [];
    const inbound = messages.find((row) => row.direction === "inbound" || row.sender_type === "contact");
    const outbound = inbound
      ? messages.find(
          (row) =>
            row.direction === "outbound" &&
            new Date(row.created_at).getTime() >= new Date(inbound.created_at).getTime(),
        )
      : undefined;
    const lastMessage = messages[messages.length - 1];
    const waitingMs = lastMessage
      ? now - new Date(lastMessage.created_at).getTime()
      : conversation.last_message_at
        ? now - new Date(conversation.last_message_at).getTime()
        : 0;
    const unanswered =
      conversation.status !== "resolved" &&
      Boolean(lastMessage) &&
      (lastMessage.direction === "inbound" || lastMessage.sender_type === "contact");

    if (inbound && outbound) {
      const tpr = new Date(outbound.created_at).getTime() - new Date(inbound.created_at).getTime();
      if (tpr >= 0) {
        firstResponseMs.push(tpr);
        const channel = channelOf(conversation.channel);
        const bucket = firstResponseByChannel.get(channel) ?? [];
        bucket.push(tpr);
        firstResponseByChannel.set(channel, bucket);
        slaSamples += 1;
        if (tpr <= SLA_FIRST_RESPONSE_MS) slaHits += 1;
      }
    } else if (unanswered && waitingMs >= SLA_FIRST_RESPONSE_MS) {
      slaSamples += 1;
    }

    if (unanswered && waitingMs >= UNANSWERED_STALE_MS) unansweredStale += 1;
    if (
      conversation.mode === "human" &&
      conversation.status !== "resolved" &&
      !conversation.assigned_user_id &&
      waitingMs >= HUMAN_QUEUE_STALE_MS
    ) {
      staleHumanQueue += 1;
    }

    if (conversation.status === "resolved" && inbound) {
      const resolvedAt = conversation.last_message_at || conversation.updated_at;
      const duration = new Date(resolvedAt).getTime() - new Date(inbound.created_at).getTime();
      if (duration >= 0) resolutionMs.push(duration);
    }
  });

  messageRows.forEach((row) => {
    if (row.direction === "inbound" || row.sender_type === "contact") {
      const { weekday, hour } = localWeekdayHour(row.created_at);
      heatmap[weekday][hour] += 1;
      maxHeat = Math.max(maxHeat, heatmap[weekday][hour]);
    }
    if (row.sender_type === "ai") {
      aiOutbound += 1;
      conversationsWithAi.add(row.conversation_id);
    }
    if (row.sender_type === "agent") {
      conversationsWithAgent.add(row.conversation_id);
      if (row.sender_user_id) {
        const chats = agentChats.get(row.sender_user_id) ?? new Set<number>();
        chats.add(row.conversation_id);
        agentChats.set(row.sender_user_id, chats);
      }
    }
  });

  messagesByConversation.forEach((messages) => {
    const inbound = messages.find((row) => row.direction === "inbound" || row.sender_type === "contact");
    if (!inbound) return;
    const firstAgent = messages.find(
      (row) =>
        row.sender_type === "agent" &&
        row.sender_user_id &&
        new Date(row.created_at).getTime() >= new Date(inbound.created_at).getTime(),
    );
    if (!firstAgent?.sender_user_id) return;
    const wait = new Date(firstAgent.created_at).getTime() - new Date(inbound.created_at).getTime();
    if (wait < 0) return;
    const list = agentResponses.get(firstAgent.sender_user_id) ?? [];
    list.push(wait);
    agentResponses.set(firstAgent.sender_user_id, list);
  });

  ((handoffResult.data ?? []) as Array<{ conversation_id: number | null }>).forEach((row) => {
    if (row.conversation_id) handoffConversations.add(row.conversation_id);
  });
  conversationRows.forEach((row) => {
    if (row.mode === "human" && conversationsWithAi.has(row.id)) handoffConversations.add(row.id);
  });

  const buyerConversationIds = new Set(
    orderRows.filter((row) => row.status !== "cancelled" && row.conversation_id).map((row) => row.conversation_id as number),
  );
  const buyerContactIds = new Set(
    orderRows.filter((row) => row.status !== "cancelled" && row.contact_id).map((row) => row.contact_id as number),
  );
  const revenueByAssignee = new Map<string, { revenue: number; orders: number }>();
  orderRows
    .filter((row) => row.status !== "cancelled" && new Date(row.created_at).getTime() >= new Date(since30).getTime())
    .forEach((row) => {
      const assignee =
        (row.conversation_id ? conversationById.get(row.conversation_id)?.assigned_user_id : null) ?? null;
      if (!assignee) return;
      const current = revenueByAssignee.get(assignee) ?? { revenue: 0, orders: 0 };
      current.revenue += toNumber(row.total);
      current.orders += 1;
      revenueByAssignee.set(assignee, current);
    });

  const openAssigned = new Map<string, number>();
  conversationRows.forEach((row) => {
    if (row.status === "resolved" || !row.assigned_user_id) return;
    openAssigned.set(row.assigned_user_id, (openAssigned.get(row.assigned_user_id) ?? 0) + 1);
  });

  const agentIds = new Set<string>([
    ...memberRows.filter((row) => ["owner", "admin", "agent"].includes(row.role)).map((row) => row.user_id),
    ...agentChats.keys(),
    ...openAssigned.keys(),
  ]);

  const agents: DashboardAgentRow[] = [...agentIds]
    .map((userId) => {
      const chats = agentChats.get(userId) ?? new Set<number>();
      const converted = [...chats].filter((conversationId) => {
        const conversation = conversationById.get(conversationId);
        return buyerConversationIds.has(conversationId) || (conversation?.contact_id ? buyerContactIds.has(conversation.contact_id) : false);
      }).length;
      return {
        userId,
        label: agentLabel(userId, roleByUser.get(userId)),
        chatsHandled: chats.size,
        avgResponseMs: average(agentResponses.get(userId) ?? []),
        conversionPercent: percentOrNull(converted, chats.size),
        openAssigned: openAssigned.get(userId) ?? 0,
        revenue: revenueByAssignee.get(userId)?.revenue ?? 0,
      };
    })
    .filter((row) => row.chatsHandled || row.openAssigned)
    .sort((a, b) => b.chatsHandled - a.chatsHandled || b.openAssigned - a.openAssigned);

  const resolvedRows = conversationRows.filter((row) => row.status === "resolved");
  const resolvedByAi = resolvedRows.filter(
    (row) => row.mode === "ai" && !conversationsWithAgent.has(row.id),
  ).length;
  const hoursSaved = (aiOutbound * AI_MINUTES_PER_OUTBOUND) / 60;

  const recentOrders = orderRows.filter((row) => new Date(row.created_at).getTime() >= new Date(since30).getTime());
  const previousOrders = orderRows.filter((row) => {
    const time = new Date(row.created_at).getTime();
    return time >= new Date(since60).getTime() && time < new Date(since30).getTime();
  });
  const activeRecent = recentOrders.filter((row) => row.status !== "cancelled");
  const activePrevious = previousOrders.filter((row) => row.status !== "cancelled");
  const byChannelRevenue = activeRecent.reduce<Record<string, number>>((acc, row) => {
    const key = row.channel || "otro";
    acc[key] = (acc[key] ?? 0) + toNumber(row.total);
    return acc;
  }, {});

  const report: DashboardReport = {
    revenue30d: activeRecent.reduce((sum, row) => sum + toNumber(row.total), 0),
    orders30d: activeRecent.length,
    cancelled30d: recentOrders.filter((row) => row.status === "cancelled").length,
    byChannel: byChannelRevenue,
    conversationsTotal: conversationRows.length,
    conversationsAi: conversationRows.filter((row) => row.mode === "ai").length,
    conversationsHuman: conversationRows.filter((row) => row.mode === "human").length,
    conversationsOpen: conversationRows.filter((row) => row.status !== "resolved").length,
  };

  const sla: DashboardSla = {
    firstResponseAvgMs: average(firstResponseMs),
    firstResponseByChannel: [...firstResponseByChannel.entries()]
      .map(([channel, values]) => ({
        channel,
        avgMs: average(values) ?? 0,
        samples: values.length,
      }))
      .sort((a, b) => b.samples - a.samples),
    resolutionAvgMs: average(resolutionMs),
    slaHitPercent: percentOrNull(slaHits, slaSamples),
    slaTargetMinutes: SLA_FIRST_RESPONSE_MS / 60000,
    unansweredStale,
    unansweredStaleMinutes: UNANSWERED_STALE_MS / 60000,
  };

  const ai: DashboardAi = {
    resolvedByAi,
    resolvedTotal: resolvedRows.length,
    resolvedByAiPercent: percentOrNull(resolvedByAi, resolvedRows.length),
    handoffs: handoffConversations.size,
    conversationsWithAi: conversationsWithAi.size,
    handoffRate: percentOrNull(handoffConversations.size, conversationsWithAi.size),
    hoursSaved: Number(hoursSaved.toFixed(1)),
    estimatedSavingDop: Math.round(hoursSaved * AGENT_HOURLY_COST),
  };

  let stageFunnel: DashboardStageFunnel | null = null;
  if (modules.funnels) {
    const stages = (
      (stagesResult.data ?? []) as Array<{
        funnel_stages?: Array<{ id: number; name: string; order_index: number }>;
      }>
    )
      .flatMap((funnel) => funnel.funnel_stages ?? [])
      .sort((a, b) => a.order_index - b.order_index);
    const cards = (cardsResult.data ?? []) as Array<{
      stage_id: number;
      contact_id: number;
      value_amount: number | string | null;
      updated_at: string;
    }>;
    const firstCount = stages[0]
      ? cards.filter((card) => card.stage_id === stages[0].id).length
      : 0;
    const stageRows: DashboardStageRow[] = stages.map((stage, index) => {
      const stageCards = cards.filter((card) => card.stage_id === stage.id);
      const previousCount = index === 0 ? stageCards.length : cards.filter((card) => card.stage_id === stages[index - 1].id).length;
      return {
        id: stage.id,
        name: stage.name,
        count: stageCards.length,
        conversionFromPrevious: index === 0 ? 100 : percentOrNull(stageCards.length, previousCount),
        conversionFromStart: percentOrNull(stageCards.length, firstCount),
        avgDwellMs: average(stageCards.map((card) => now - new Date(card.updated_at).getTime())),
        estimatedValue: stageCards.reduce((sum, card) => sum + toNumber(card.value_amount), 0),
      };
    });

    const lostReasons = new Map<string, number>();
    ((tagsResult.data ?? []) as Array<{ name: string; contact_tag_links?: Array<{ contact_id: number }> | { contact_id: number } }>).forEach(
      (tag) => {
        if (!LOST_REASON_PATTERN.test(tag.name)) return;
        const links = Array.isArray(tag.contact_tag_links)
          ? tag.contact_tag_links
          : tag.contact_tag_links
            ? [tag.contact_tag_links]
            : [];
        lostReasons.set(tag.name, (lostReasons.get(tag.name) ?? 0) + links.length);
      },
    );

    stageFunnel = {
      stages: stageRows,
      lostReasons: [...lostReasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    };
  }

  let finance: DashboardFinance | null = null;
  let retention: DashboardRetention | null = null;
  if (modules.orders) {
    const channelMap = new Map<string, { revenue: number; orders: number }>();
    activeRecent.forEach((row) => {
      const key = row.channel || "otro";
      const current = channelMap.get(key) ?? { revenue: 0, orders: 0 };
      current.revenue += toNumber(row.total);
      current.orders += 1;
      channelMap.set(key, current);
    });

    finance = {
      aov: activeRecent.length
        ? activeRecent.reduce((sum, row) => sum + toNumber(row.total), 0) / activeRecent.length
        : 0,
      revenue30d: report.revenue30d,
      revenuePrev30d: activePrevious.reduce((sum, row) => sum + toNumber(row.total), 0),
      revenueGrowthPercent: growthPercent(
        report.revenue30d,
        activePrevious.reduce((sum, row) => sum + toNumber(row.total), 0),
      ),
      orders30d: activeRecent.length,
      ordersPrev30d: activePrevious.length,
      ordersGrowthPercent: growthPercent(activeRecent.length, activePrevious.length),
      byChannel: [...channelMap.entries()].map(([channel, value]) => ({ channel, ...value })),
      byAgent: [...revenueByAssignee.entries()]
        .map(([userId, value]) => ({
          userId,
          label: agentLabel(userId, roleByUser.get(userId)),
          revenue: value.revenue,
          orders: value.orders,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      daily: buildDailySeries(activeRecent, 30),
      previousDaily: buildDailySeries(activePrevious, 30, 30),
      comparisons: {
        weekly: toFinanceComparison(
          summarizeOrders(orderRows, since7),
          summarizeOrders(orderRows, since14, since7),
        ),
        monthly: toFinanceComparison(
          summarizeOrders(orderRows, since30),
          summarizeOrders(orderRows, since60, since30),
        ),
        annual: toFinanceComparison(
          summarizeOrders(orderRows, since365),
          summarizeOrders(orderRows, since730, since365),
        ),
      },
    };

    const ordersByContact = new Map<number, { count: number; first: number; last: number; revenue: number }>();
    orderRows
      .filter((row) => row.status !== "cancelled" && row.contact_id)
      .forEach((row) => {
        const contactId = row.contact_id as number;
        const time = new Date(row.created_at).getTime();
        const current = ordersByContact.get(contactId) ?? {
          count: 0,
          first: time,
          last: time,
          revenue: 0,
        };
        current.count += 1;
        current.first = Math.min(current.first, time);
        current.last = Math.max(current.last, time);
        current.revenue += toNumber(row.total);
        ordersByContact.set(contactId, current);
      });

    const buyers = [...ordersByContact.values()];
    const since30Ms = new Date(since30).getTime();
    const inactiveMs = CHURN_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
    retention = {
      newCustomers: buyers.filter((row) => row.first >= since30Ms).length,
      returningCustomers: buyers.filter((row) => row.count > 1).length,
      purchaseFrequency: buyers.length
        ? Number((buyers.reduce((sum, row) => sum + row.count, 0) / buyers.length).toFixed(2))
        : null,
      ltv: buyers.length
        ? buyers.reduce((sum, row) => sum + row.revenue, 0) / buyers.length
        : null,
      inactiveCustomers: buyers.filter((row) => now - row.last >= inactiveMs).length,
      churnRiskDays: CHURN_INACTIVE_DAYS,
    };
  }

  let bestConversionDay: DashboardActivity["bestConversionDay"] = null;
  WEEKDAY_LABELS.forEach((label, weekday) => {
    const conversion = percentOrNull(weekdayOrders[weekday], weekdayLeads[weekday]);
    if (conversion === null) return;
    if (!bestConversionDay || conversion > bestConversionDay.conversionPercent) {
      bestConversionDay = { weekday, label, conversionPercent: conversion };
    }
  });

  const connectedChannels = new Set(
    ((channelAccountsResult.data ?? []) as Array<{ channel: string }>).map((row) => row.channel),
  );
  if (instagramResult.data) connectedChannels.add("instagram");

  const alerts: DashboardAlert[] = [];
  if (unansweredStale) {
    alerts.push({
      id: "unanswered",
      severity: "critical",
      title: "Chats sin responder",
      detail: `Llevan más de ${sla.unansweredStaleMinutes} min esperando la primera respuesta.`,
      href: "/inbox",
      count: unansweredStale,
    });
  }
  if (staleHumanQueue) {
    alerts.push({
      id: "human-queue",
      severity: "critical",
      title: "Cola humana estancada",
      detail: "Chats cedidos a un asesor y sin asignar hace más de 10 min.",
      href: "/inbox",
      count: staleHumanQueue,
    });
  }
  if (modules.orders && today.unpaidOrders) {
    alerts.push({
      id: "unpaid",
      severity: "warning",
      title: "Pedidos sin pagar",
      detail: "Tickets activos pendientes de caja.",
      href: "/orders",
      count: today.unpaidOrders,
    });
  }
  if (modules.catalog && today.lowStock) {
    alerts.push({
      id: "stock",
      severity: "warning",
      title: "Stock bajo",
      detail: "Productos en o por debajo del punto de reorden.",
      href: "/inventory",
      count: today.lowStock,
    });
  }
  if (!connectedChannels.size) {
    alerts.push({
      id: "no-channel",
      severity: "warning",
      title: "Sin canal conectado",
      detail: "Conecta WhatsApp, Instagram o Messenger para recibir chats.",
      href: "/settings",
      count: 1,
    });
  }
  CHANNELS.forEach((channel) => {
    const used = conversationRows.some((row) => row.channel === channel);
    if (used && !connectedChannels.has(channel)) {
      alerts.push({
        id: `channel-${channel}`,
        severity: "critical",
        title: `Canal ${channel} caído`,
        detail: "Hay conversaciones, pero la integración no está activa.",
        href: "/settings",
        count: 1,
      });
    }
  });
  const instagramExpiry = instagramResult.data?.token_expires_at
    ? new Date(instagramResult.data.token_expires_at as string).getTime()
    : 0;
  if (instagramExpiry && instagramExpiry - now <= TOKEN_EXPIRING_MS) {
    alerts.push({
      id: "ig-token",
      severity: instagramExpiry < now ? "critical" : "warning",
      title: instagramExpiry < now ? "Instagram vencido" : "Instagram por vencer",
      detail: "Reconecta la cuenta para no perder mensajes.",
      href: "/settings",
      count: 1,
    });
  }
  if (modules.calendar && !calendarResult.data) {
    alerts.push({
      id: "calendar-down",
      severity: "warning",
      title: "Calendario desconectado",
      detail: "Google Calendar no está vinculado. Las citas no se sincronizan.",
      href: "/settings",
      count: 1,
    });
  } else if (modules.calendar && calendarResult.data?.token_expires_at) {
    const expiry = new Date(calendarResult.data.token_expires_at as string).getTime();
    if (expiry - now <= TOKEN_EXPIRING_MS) {
      alerts.push({
        id: "calendar-token",
        severity: expiry < now ? "critical" : "warning",
        title: expiry < now ? "Google Calendar vencido" : "Google Calendar por vencer",
        detail: "Reconecta el calendario para seguir agendando.",
        href: "/settings",
        count: 1,
      });
    }
  }

  const recentActiveOrders = activeRecent;
  const restaurant: DashboardRestaurant | null = modules.kitchen
    ? (() => {
        const hours = Array.from({ length: 24 }, () => 0);
        recentActiveOrders.forEach((row) => {
          hours[localWeekdayHour(row.created_at).hour] += 1;
        });
        const peak = hours.reduce((best, count, hour) => (count > best.count ? { hour, count } : best), {
          hour: 0,
          count: 0,
        });
        const prevRevenue = activePrevious.reduce((sum, row) => sum + toNumber(row.total), 0);
        return {
          topProducts: topProductsFromOrders(recentActiveOrders),
          peakHour: peak.count ? { hour: peak.hour, orders: peak.count } : null,
          hourlyOrders: hours.map((orders, hour) => ({ hour, orders })),
          aov: finance?.aov ?? 0,
          aovPrev: activePrevious.length ? prevRevenue / activePrevious.length : 0,
          ordersCount: recentActiveOrders.length,
        };
      })()
    : null;

  const appointmentRows = (appointmentsResult.data ?? []) as Array<{
    title: string | null;
    status: string;
    purpose: string | null;
    starts_at: string;
  }>;
  const recentAppointments = appointmentRows.filter(
    (row) => new Date(row.starts_at).getTime() >= new Date(since30).getTime(),
  );
  const services: DashboardServices | null =
    modules.calendar && !modules.kitchen
      ? (() => {
          const scheduled = recentAppointments.filter((row) => row.status !== "cancelled").length;
          const done = recentAppointments.filter((row) => row.status === "done").length;
          const cancelled = recentAppointments.filter((row) => row.status === "cancelled").length;
          const purposeMap = new Map<string, number>();
          const titleMap = new Map<string, number>();
          recentAppointments.forEach((row) => {
            const purpose = row.purpose || "consulta";
            purposeMap.set(purpose, (purposeMap.get(purpose) ?? 0) + 1);
            const title = row.title?.trim() || "Cita";
            titleMap.set(title, (titleMap.get(title) ?? 0) + 1);
          });
          return {
            scheduled,
            done,
            cancelled,
            showRate: percentOrNull(done, scheduled),
            byPurpose: [...purposeMap.entries()].map(([purpose, count]) => ({ purpose, count })),
            topTitles: [...titleMap.entries()]
              .map(([title, count]) => ({ title, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5),
            comparisons: {
              weekly: toServicesComparison(
                summarizeAppointments(appointmentRows, since7),
                summarizeAppointments(appointmentRows, since14, since7),
              ),
              monthly: toServicesComparison(
                summarizeAppointments(appointmentRows, since30),
                summarizeAppointments(appointmentRows, since60, since30),
              ),
              annual: toServicesComparison(
                summarizeAppointments(appointmentRows, since365),
                summarizeAppointments(appointmentRows, since730, since365),
              ),
            },
          };
        })()
      : null;

  const retail: DashboardRetail | null =
    modules.catalog && modules.orders && !modules.kitchen
      ? { topProducts: topProductsFromOrders(recentActiveOrders) }
      : null;

  return {
    modules,
    today,
    report,
    funnel: modules.orders ? buildLeadFunnel(conversationRows, orderRows) : null,
    sla,
    agents,
    ai,
    stageFunnel,
    finance,
    retention,
    activity: { heatmap, maxHeat, bestConversionDay },
    alerts,
    restaurant,
    services,
    retail,
  };
};
