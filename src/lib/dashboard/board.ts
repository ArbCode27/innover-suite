import type { SupabaseClient } from "@supabase/supabase-js";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { toNumber } from "@/lib/commerce/types";

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

const startOfTodayIso = () => {
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `${local}T00:00:00.000-04:00`;
};

export const loadDashboardSnapshot = async (
  supabase: SupabaseClient,
  organizationId: number,
): Promise<DashboardSnapshot> => {
  const todayStart = startOfTodayIso();

  const [
    openChats,
    conversations,
    ordersToday,
    unpaidOrders,
    appointmentsToday,
    inventory,
    contacts,
  ] = await Promise.all([
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
    const metadata = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
    return typeof metadata.unread_count === "number" && metadata.unread_count > 0;
  }).length;

  const humanQueue = (conversations.data ?? []).filter(
    (row) => row.mode === "human" && !row.assigned_user_id,
  ).length;

  const revenueToday = (ordersToday.data ?? []).reduce((sum, row) => sum + toNumber(row.total), 0);
  const lowStock = (inventory.data ?? []).filter((row) => {
    const onHand = toNumber(row.on_hand);
    const reorder = toNumber(row.reorder_point);
    return row.track_stock !== false && onHand <= reorder;
  }).length;

  return {
    openChats: openChats.count ?? (conversations.data ?? []).length,
    unreadChats,
    humanQueue,
    ordersToday: (ordersToday.data ?? []).length,
    revenueToday,
    unpaidOrders: unpaidOrders.count ?? 0,
    appointmentsToday: appointmentsToday.count ?? 0,
    lowStock,
    contacts: contacts.count ?? 0,
  };
};
