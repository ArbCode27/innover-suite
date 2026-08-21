import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarBoard } from "./calendar-board";
import type { CalendarContactOption } from "./types";
import { EmptyMetaState } from "@/components/suite/empty-meta-state";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { loadCalendarAgenda } from "@/lib/calendar/board";
import { parseAnchorDate, parseViewMode } from "@/lib/calendar/range";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CalendarPageProps = {
  searchParams: Promise<{ view?: string; date?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/onboarding/organization");
  }

  const params = await searchParams;
  const view = parseViewMode(params.view);
  const anchorDate = parseAnchorDate(params.date);
  const supabase = await createSupabaseServerClient();
  const agenda = await loadCalendarAgenda(supabase, membership.organizationId, view, anchorDate);

  const { data: contactRows, error: contactsError } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("organization_id", membership.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (contactsError) {
    throw new Error(`No se pudieron cargar los contactos del calendario: ${contactsError.message}`);
  }

  const contacts: CalendarContactOption[] = (contactRows ?? []).map((row) => ({
    id: row.id as number,
    fullName: (row.full_name as string) || "Contacto sin nombre",
    email: (row.email as string | null) ?? null,
  }));

  return (
    <ModuleShell
      title="Calendario de citas"
      description={
        agenda.connected
          ? `Agenda de ${agenda.connectedEmail || membership.organizationName}. Crea citas y únete a Meet desde el CRM.`
          : "Conecta Google Calendar en Ajustes para ver y crear citas."
      }
      eyebrow="Agenda operacional"
      actions={
        <Button asChild variant="outline">
          <Link href="/settings">{agenda.connected ? "Gestionar calendario" : "Vincular calendario"}</Link>
        </Button>
      }
    >
      <CalendarBoard key={`${view}-${anchorDate}`} agenda={agenda} contacts={contacts} view={view} anchorDate={anchorDate} />
      {agenda.connected ? null : (
        <EmptyMetaState
          title="Conecta Google Calendar para agendar"
          description="Vincula el calendario de tu organización en Ajustes. Después podrás crear citas, ver la semana y unirte a Meet."
          steps={[
            "Abre Ajustes y conecta Google Calendar.",
            "Acepta los permisos de eventos y disponibilidad.",
            "Crea la primera cita desde esta agenda.",
          ]}
        />
      )}
    </ModuleShell>
  );
}
