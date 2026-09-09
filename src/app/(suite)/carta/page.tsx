import { UtensilsCrossed } from "lucide-react";
import { MenuBoard } from "./menu-board";
import { ModuleShell } from "@/components/suite/module-shell";
import { loadMenuItems } from "@/lib/menu/crm-catalog";
import type { MenuItemRecord } from "@/lib/menu/crm-types";
import { requireSuiteModule } from "@/lib/modules/guard";
import { canManageCatalog } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies } from "@/lib/organizations/currencies";

export default async function CartaPage() {
  const { membership, supabase } = await requireSuiteModule("catalog");
  const canManage = canManageCatalog(membership);
  const currencies = await loadOrganizationCurrencies(supabase, membership.organizationId);

  let dishes: MenuItemRecord[] = [];
  let loadError: string | null = null;

  try {
    dishes = await loadMenuItems(supabase, membership.organizationId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "No se pudo cargar el menú.";
  }

  return (
    <ModuleShell
      title="Menú"
      description="Gestiona platos, bebidas, postres, combos y promos en la carta. El inventario queda para insumos y productos físicos."
      eyebrow="Carta"
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
          <UtensilsCrossed className="size-3.5" aria-hidden />
          {dishes.length} ítems
        </span>
      }
    >
      {loadError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError} Si es la primera vez, corre <code className="text-xs">supabase/menu-items.sql</code>.
        </p>
      ) : (
        <MenuBoard dishes={dishes} currencies={currencies} canManage={canManage} />
      )}
    </ModuleShell>
  );
}
