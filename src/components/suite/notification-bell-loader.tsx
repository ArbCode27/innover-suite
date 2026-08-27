import { loadNotifications } from "@/lib/notifications/board";
import { NotificationBellHost } from "@/components/suite/notification-bell-host";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationBellLoaderProps = {
  organizationId: number;
  userId: string;
};

export const NotificationBellLoader = async ({ organizationId, userId }: NotificationBellLoaderProps) => {
  const supabase = await createSupabaseServerClient();
  const notifications = await loadNotifications(supabase, organizationId, userId);

  return <NotificationBellHost organizationId={organizationId} initialNotifications={notifications} />;
};
