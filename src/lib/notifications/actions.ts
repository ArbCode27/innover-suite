"use server";

import { getCurrentMembership } from "@/lib/organizations/membership";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionExpiredResult } from "@/lib/auth/session-result";

export const markNotificationsReadAction = async () => {
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Sin organización." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", membership.organizationId)
    .is("read_at", null)
    .or(user?.id ? `user_id.is.null,user_id.eq.${user.id}` : "user_id.is.null");

  if (error) {
    return { error: error.message || "No se pudieron marcar las notificaciones." };
  }

  return { success: "Notificaciones leídas." };
};

export const deleteNotificationAction = async (notificationId: number) => {
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return { error: "Notificación no válida." };
  }

  const membership = await getCurrentMembership();
  if (!membership) return { error: "Sin organización." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return sessionExpiredResult();
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("organization_id", membership.organizationId)
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  if (error) {
    return { error: error.message || "No se pudo eliminar el aviso." };
  }

  return { success: "Aviso eliminado." };
};
