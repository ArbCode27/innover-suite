import { Building2 } from "lucide-react";
import { ListingsBoard } from "./listings-board";
import { ModuleShell } from "@/components/suite/module-shell";
import { loadListings } from "@/lib/listings/board";
import type { ListingRecord } from "@/lib/listings/types";
import { requireSuiteModule } from "@/lib/modules/guard";
import { canManageListings } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies } from "@/lib/organizations/currencies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ListingsPage() {
  const { membership } = await requireSuiteModule("listings");
  const canManage = canManageListings(membership);
  const supabase = await createSupabaseServerClient();
  const currencies = await loadOrganizationCurrencies(supabase, membership.organizationId);

  let listings: ListingRecord[] = [];
  let loadError: string | null = null;

  try {
    listings = await loadListings(supabase, membership.organizationId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "No se pudieron cargar los inmuebles.";
  }

  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("organization_id", membership.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const contacts = (contactRows ?? []).map((row) => ({
    id: row.id as number,
    fullName: (row.full_name as string) || "Contacto sin nombre",
  }));

  return (
    <ModuleShell
      title="Inmuebles"
      description="Fichas de propiedades para visitas, embudo y respuestas de la IA. Sin mapas ni portales."
      eyebrow="Inmobiliaria"
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
          <Building2 className="size-3.5" aria-hidden />
          {listings.length} fichas
        </span>
      }
    >
      {loadError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError} Si es la primera vez, corre el SQL de supabase/listings-upgrade.sql.
        </p>
      ) : (
        <ListingsBoard listings={listings} contacts={contacts} currencies={currencies} canManage={canManage} />
      )}
    </ModuleShell>
  );
}
