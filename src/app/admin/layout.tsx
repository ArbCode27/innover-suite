import type { ReactNode } from "react";
import Link from "next/link";
import { loadPendingJoinRequestsCount } from "@/lib/billing/join-requests";
import { requirePlatformAdminSession } from "@/lib/billing/require-platform-admin";
import { Badge } from "@/components/ui/badge";

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  await requirePlatformAdminSession();
  const pendingRequestsCount = await loadPendingJoinRequestsCount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/70 sticky top-0 z-30 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-semibold tracking-tight">
              Admin Innover
            </Link>
            <Badge variant="outline" className="text-[10px]">
              Plataforma
            </Badge>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/admin"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Organizaciones
            </Link>
            <Link
              href="/admin/solicitudes"
              className="flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
            >
              <span>Solicitudes</span>
              {pendingRequestsCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {pendingRequestsCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/home"
              className="text-muted-foreground transition hover:text-foreground"
            >
              Ir al CRM
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
};

export default AdminLayout;
