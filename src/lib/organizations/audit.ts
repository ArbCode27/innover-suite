import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const recordAuditEvent = async (params: {
  organizationId: number;
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  payload?: Record<string, unknown>;
}) => {
  try {
    const supabase = params.actorUserId
      ? await createSupabaseServerClient()
      : getSupabaseAdminClient();
    await supabase.from("audit_events").insert({
      organization_id: params.organizationId,
      actor_user_id: params.actorUserId ?? null,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId == null ? null : String(params.entityId),
      payload: params.payload ?? null,
    });
  } catch {
    // Auditoría no debe romper la acción principal.
  }
};
