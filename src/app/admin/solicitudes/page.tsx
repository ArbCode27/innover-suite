import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { loadAdminJoinRequests } from "@/lib/billing/join-requests";
import { requirePlatformAdminSession } from "@/lib/billing/require-platform-admin";
import { Badge } from "@/components/ui/badge";
import { AdminSolicitudesClient } from "./admin-solicitudes-client";

export const metadata: Metadata = {
  title: "Solicitudes de Ingreso | Admin Innover",
  description: "Aprobación y revisión de comprobantes de pago de nuevas organizaciones.",
};

export const revalidate = 0;

const AdminSolicitudesPage = async () => {
  await requirePlatformAdminSession();
  const requests = await loadAdminJoinRequests("all");

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
            <span>/</span>
            <span className="text-foreground">Solicitudes</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Solicitudes de Ingreso</h1>
            {pendingCount > 0 ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-semibold">
                {pendingCount} por revisar
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Valida los comprobantes de Pago Móvil, Binance, Zelle y Transferencias para dar acceso al CRM.
          </p>
        </div>

        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Organizaciones
        </Link>
      </div>

      <AdminSolicitudesClient requests={requests} />
    </div>
  );
};

export default AdminSolicitudesPage;
