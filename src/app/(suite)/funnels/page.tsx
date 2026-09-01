import { ModuleShell } from "@/components/suite/module-shell";
import { loadFunnelBoard } from "@/lib/funnels/board";
import { loadListingOptions } from "@/lib/listings/board";
import type { ListingOption } from "@/lib/listings/types";
import { loadCatalog } from "@/lib/commerce/catalog";
import { requireSuiteModule } from "@/lib/modules/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FunnelBoard } from "./funnel-board";
import type { FunnelContactOption } from "./types";
import { loadOrganizationCurrencies } from "@/lib/organizations/currencies";

export default async function FunnelsPage() {
  const { membership, modules } = await requireSuiteModule("funnels");

  const supabase = await createSupabaseServerClient();
  const board = await loadFunnelBoard(supabase, membership.organizationId);
  const currencies = await loadOrganizationCurrencies(supabase, membership.organizationId);

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

  const listings: ListingOption[] = modules.listings
    ? await loadListingOptions(supabase, membership.organizationId)
    : [];

  const products = modules.catalog
    ? await loadCatalog(supabase, membership.organizationId)
        .then((catalog) =>
          catalog
            .filter((item) => item.active)
            .map((item) => ({
              id: item.id,
              name: item.name,
              price: item.price,
              currency: item.currency,
            })),
        )
        .catch(() => [])
    : [];

  return (
    <ModuleShell
      title="Embudo de ventas"
      description={
        modules.listings
          ? "Arrastra cada contacto entre etapas. Etapas típicas para inmobiliaria: Consulta, Visita, Negociación, Reserva, Cierre. No se migran etapas existentes."
          : "Arrastra cada contacto entre etapas para avanzar el pipeline."
      }
      eyebrow={board.name}
    >
      <FunnelBoard
        initialBoard={board}
        contacts={contacts}
        listings={listings}
        products={products}
        currencies={currencies}
      />
    </ModuleShell>
  );
}
