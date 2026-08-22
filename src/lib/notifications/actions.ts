"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  revalidatePath("/home");
  return { success: "Notificaciones leídas." };
};
