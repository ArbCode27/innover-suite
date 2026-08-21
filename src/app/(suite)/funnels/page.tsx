import { redirect } from "next/navigation";
import { ModuleShell } from "@/components/suite/module-shell";
import { loadFunnelBoard } from "@/lib/funnels/board";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FunnelBoard } from "./funnel-board";
import type { FunnelContactOption } from "./types";

export default async function FunnelsPage() {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding/organization");
  }

  const supabase = await createSupabaseServerClient();
  const board = await loadFunnelBoard(supabase, membership.organizationId);

  const { data: contactRows, error: contactsError } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("organization_id", membership.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (contactsError) {
    throw new Error(`No se pudieron cargar los contactos del embudo: ${contactsError.message}`);
  }

  const contacts: FunnelContactOption[] = (contactRows ?? []).map((row) => ({
    id: row.id as number,
    fullName: (row.full_name as string) || "Contacto sin nombre",
  }));

  return (
    <ModuleShell
      title="Embudo de ventas"
      description="Arrastra cada contacto entre etapas para avanzar el pipeline."
      eyebrow={board.name}
    >
      <FunnelBoard initialBoard={board} contacts={contacts} />
    </ModuleShell>
  );
}
