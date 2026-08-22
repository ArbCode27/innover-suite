import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Contact,
  Inbox,
  KanbanSquare,
  LogOut,
  Package,
  Settings,
  Sparkles,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { DEFAULT_MODULES, type OrganizationModules } from "@/lib/modules/constants";
import { loadOrganizationModules } from "@/lib/modules/settings";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { ThemeToggle } from "@/components/suite/theme-toggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/inbox", label: "Chats", icon: Inbox, module: null },
  { href: "/orders", label: "Pedidos", icon: ClipboardList, module: "orders" as const },
  { href: "/inventory", label: "Inventario", icon: Package, module: "catalog" as const },
  { href: "/funnels", label: "Embudos", icon: KanbanSquare, module: "funnels" as const },
  { href: "/calendar", label: "Calendario", icon: CalendarDays, module: "calendar" as const },
  { href: "/contacts", label: "Contactos", icon: Contact, module: null },
  { href: "/settings", label: "Ajustes", icon: Settings, module: null },
];

const visibleNavItems = (modules: OrganizationModules) =>
  navItems
    .filter((item) => !item.module || modules[item.module])
    .map((item) =>
      item.href === "/orders" && modules.kitchen ? { ...item, label: "Comandas" } : item,
    );

const SuiteLayout = async ({ children }: { children: ReactNode }) => {
  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership();
  const modules = membership
    ? await loadOrganizationModules(supabase, membership.organizationId)
    : DEFAULT_MODULES;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "IS";
  const items = visibleNavItems(modules);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(56,189,248,0.18),transparent_26rem),radial-gradient(circle_at_85%_25%,rgba(59,130,246,0.16),transparent_24rem)]" />
      <div className="relative mx-auto min-h-screen w-full max-w-[1800px] p-3 md:p-5">
        <aside className="group/sidebar fixed top-3 left-3 z-50 hidden h-[calc(100vh-1.5rem)] w-[78px] overflow-y-auto rounded-3xl border border-primary/20 bg-card/80 p-3 shadow-2xl shadow-blue-950/25 backdrop-blur transition-all duration-300 hover:w-72 md:flex md:flex-col md:top-5 md:left-5 md:h-[calc(100vh-2.5rem)]">
          <Link
            href="/inbox"
            className="flex items-center justify-center gap-0 rounded-2xl border border-primary/35 bg-primary/15 p-3 transition-all duration-200 group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
          >
            <span className="flex size-10 min-w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/sidebar:max-w-40 group-hover/sidebar:opacity-100">
              <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-primary whitespace-nowrap">
                Innover
              </span>
              <span className="block text-sm font-semibold whitespace-nowrap">Suite CRM</span>
            </span>
          </Link>
          <nav className="mt-6 space-y-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-center gap-0 rounded-2xl px-3 py-3 text-sm text-muted-foreground transition hover:bg-primary/12 hover:text-foreground group-hover/sidebar:justify-start group-hover/sidebar:gap-3"
              >
                <item.icon className="size-4" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-40 group-hover/sidebar:opacity-100">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
          <Separator className="mt-6" />
          <div className="mt-5 max-h-0 overflow-hidden rounded-2xl border border-transparent bg-primary/8 p-0 opacity-0 transition-all duration-200 group-hover/sidebar:max-h-44 group-hover/sidebar:border-primary/20 group-hover/sidebar:p-4 group-hover/sidebar:opacity-100">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary whitespace-nowrap">
              Estado
            </p>
            <p className="mt-2 text-sm font-medium">Meta pendiente</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {membership?.organizationName
                ? `${membership.organizationName}: vincula Instagram o WhatsApp para activar el inbox.`
                : "Vincula Instagram o WhatsApp para recibir mensajes, contactos y oportunidades."}
            </p>
          </div>
          <div className="mt-auto space-y-4 pt-6">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/sidebar:max-w-40 group-hover/sidebar:opacity-100">
                <p className="text-sm font-medium whitespace-nowrap">Asesor CRM</p>
                {user?.email ? (
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                ) : null}
                {membership ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {membership.role.toUpperCase()} · {membership.organizationName}
                  </p>
                ) : null}
              </div>
            </div>
            <ThemeToggle labelClassName="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-28 group-hover/sidebar:opacity-100" />
            <form action={signOut}>
              <Button className="w-full" type="submit" variant="outline">
                <LogOut />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-28 group-hover/sidebar:opacity-100">
                  Cerrar sesión
                </span>
              </Button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 md:pl-[94px]">{children}</main>
      </div>
    </div>
  );
};

export default SuiteLayout;
