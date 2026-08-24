import { Package } from "lucide-react";
import { InventoryBoard } from "./inventory-board";
import { InventoryOps } from "./inventory-ops";
import { ModuleShell } from "@/components/suite/module-shell";
import { loadCatalog, loadDeliveryZones, loadInventoryMovements, loadPromotions } from "@/lib/commerce/catalog";
import type { DeliveryZoneRecord, InventoryMovementRecord, ProductRecord, PromotionRecord } from "@/lib/commerce/types";
import { requireSuiteModule } from "@/lib/modules/guard";
import { canManageCatalog } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies } from "@/lib/organizations/currencies";

export default async function InventoryPage() {
  const { membership, supabase } = await requireSuiteModule("catalog");
  const canManage = canManageCatalog(membership);
  const currencies = await loadOrganizationCurrencies(supabase, membership.organizationId);

  let products: ProductRecord[] = [];
  let promotions: PromotionRecord[] = [];
  let movements: InventoryMovementRecord[] = [];
  let zones: DeliveryZoneRecord[] = [];
  let loadError: string | null = null;

  try {
    [products, promotions, movements, zones] = await Promise.all([
      loadCatalog(supabase, membership.organizationId),
      loadPromotions(supabase, membership.organizationId),
      loadInventoryMovements(supabase, membership.organizationId, 500),
      loadDeliveryZones(supabase, membership.organizationId),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "No se pudo cargar el inventario.";
  }

  return (
    <ModuleShell
      title="Catálogo e inventario"
      description="Carga productos, precios y existencias. Cada venta confirmada por la IA descuenta stock sola."
      eyebrow="Comercio"
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
          <Package className="size-3.5" aria-hidden />
          {products.length} ítems
        </span>
      }
    >
      {loadError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError} Si es la primera vez, corre el SQL de supabase/commerce-upgrade.sql.
        </p>
      ) : (
        <>
          <InventoryOps zones={zones} currencies={currencies} canManage={canManage} />
          <InventoryBoard
            products={products}
            promotions={promotions}
            movements={movements}
            currencies={currencies}
            canManage={canManage}
          />
        </>
      )}
    </ModuleShell>
  );
}
