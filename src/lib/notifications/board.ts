import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationRecord = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export const loadNotifications = async (
  supabase: SupabaseClient,
  organizationId: number,
  userId: string | null,
) => {
  let request = supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (userId) {
    request = request.or(`user_id.is.null,user_id.eq.${userId}`);
  }

  const { data, error } = await request;
  if (error) {
    return [] as NotificationRecord[];
  }

  return (data ?? []).map(
    (row): NotificationRecord => ({
      id: row.id as number,
      kind: row.kind as string,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      href: (row.href as string | null) ?? null,
      readAt: (row.read_at as string | null) ?? null,
      createdAt: row.created_at as string,
    }),
  );
};
