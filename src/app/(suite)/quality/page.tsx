import { redirect } from "next/navigation";
import { QualityBoard } from "./quality-board";
import { ModuleShell } from "@/components/suite/module-shell";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function QualityPage() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/onboarding/organization");
  if (!hasOrganizationRole(membership, ["owner", "admin", "agent"])) redirect("/home");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("agent_turns")
    .select("id, status, error, last_model, review_score, review_notes, created_at, conversation_id")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <ModuleShell
      title="Calidad del agente"
      description="Revisa turnos recientes y califica respuestas para detectar fallos o handoffs."
      eyebrow="IA"
    >
      <QualityBoard
        turns={(data ?? []).map((row) => ({
          id: row.id as number,
          status: row.status as string,
          error: (row.error as string | null) ?? null,
          lastModel: (row.last_model as string | null) ?? null,
          reviewScore: (row.review_score as number | null) ?? null,
          reviewNotes: (row.review_notes as string | null) ?? null,
          createdAt: row.created_at as string,
          conversationId: row.conversation_id as number,
        }))}
      />
    </ModuleShell>
  );
}
