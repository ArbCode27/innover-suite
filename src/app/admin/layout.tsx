import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformAdminSession } from "@/lib/billing/require-platform-admin";
import { Badge } from "@/components/ui/badge";

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  await requirePlatformAdminSession();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm font-semibold tracking-tight">
              Admin Innover
            </Link>
            <Badge variant="outline" className="text-[10px]">
              Plataforma
            </Badge>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-muted-foreground hover:text-foreground">
              Organizaciones
            </Link>
            <Link href="/home" className="text-muted-foreground hover:text-foreground">
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
