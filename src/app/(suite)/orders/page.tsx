import { ClipboardList } from "lucide-react";
import { OrdersBoard } from "./orders-board";
import { ModuleShell } from "@/components/suite/module-shell";
import { loadOrders } from "@/lib/commerce/orders";
import type { OrderRecord } from "@/lib/commerce/types";
import { requireSuiteModule } from "@/lib/modules/guard";
import { canManageOrders, canMarkPayment } from "@/lib/organizations/membership";

export default async function OrdersPage() {
  const { membership, supabase, modules } = await requireSuiteModule("orders");
  const canManage = canManageOrders(membership);
  const kitchenMode = modules.kitchen;

  let orders: OrderRecord[] = [];
  let loadError: string | null = null;

  try {
    orders = await loadOrders(supabase, membership.organizationId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "No se pudieron cargar los pedidos.";
  }

  return (
    <ModuleShell
      title={kitchenMode ? "Comandas" : "Pedidos"}
      description={
        kitchenMode
          ? "Pedidos que entra la IA desde WhatsApp, Instagram o Messenger. Avanza cada comanda en cocina."
          : "Pedidos generados por la IA. El inventario ya se descontó al confirmar."
      }
      eyebrow={kitchenMode ? "Cocina" : "Ventas"}
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
          <ClipboardList className="size-3.5" aria-hidden />
          {orders.filter((order) => order.status !== "cancelled" && order.status !== "completed").length} activos
        </span>
      }
    >
      {loadError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError} Si es la primera vez, corre el SQL de supabase/commerce-upgrade.sql.
        </p>
      ) : (
        <OrdersBoard
          organizationId={membership.organizationId}
          kitchenMode={kitchenMode}
          initialOrders={orders}
          canManage={canManage}
          canMarkPayment={canMarkPayment(membership)}
        />
      )}
    </ModuleShell>
  );
}
