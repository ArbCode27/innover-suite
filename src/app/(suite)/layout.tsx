import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Contact,
  Home,
  Inbox,
  KanbanSquare,
  LogOut,
  Package,
  Settings,
  Sparkles,
  Building2,
  UtensilsCrossed,
} from "lucide-react";
import { loadCachedOrgEntitlements } from "@/lib/billing/entitlements";
import { BillingUsageBanner } from "@/components/suite/billing-usage-banner";
import { signOut } from "@/lib/auth/actions";
import { redirectIfSetupIncomplete } from "@/lib/onboarding/guard";
import {
  canManageCatalog,
  canManageOrders,
  canUseInbox,
  loadCurrentMemberSession,
  ROLE_LABELS,
  type OrganizationRole,
} from "@/lib/organizations/membership";
import {
  MobileChromeProvider,
  MobileNav,
  SidebarNav,
  TabletNav,
  type MobileNavIcon,
} from "@/components/suite/mobile-nav";
import { ThemeToggle } from "@/components/suite/theme-toggle";
import { MobileSuiteHeader } from "@/components/suite/mobile-suite-header";
import { NotificationBellLoader } from "@/components/suite/notification-bell-loader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Inbox;
  iconKey: MobileNavIcon;
  show: boolean;
};

const SuiteLayout = async ({ children }: { children: ReactNode }) => {
  const { user, membership, timedOut } = await loadCurrentMemberSession();

  if (timedOut || !user) {
    redirect("/login");
  }

  if (!membership) {
    redirect("/onboarding/organization");
  }

  await redirectIfSetupIncomplete(membership);

  const entitlements = await loadCachedOrgEntitlements(
    membership.organizationId,
  );
  if (entitlements.suiteAccess === "blocked") {
    redirect("/billing");
  }

  const modules = entitlements.effectiveModules;
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "IS";

  const navItems: NavItem[] = [
    { href: "/home", label: "Inicio", icon: Home, iconKey: "home", show: true },
    {
      href: "/inbox",
      label: "Chats",
      icon: Inbox,
      iconKey: "inbox",
      show: canUseInbox(membership),
    },
    {
      href: "/orders",
      label: modules.kitchen ? "Comandas" : "Pedidos",
      icon: ClipboardList,
      iconKey: "orders",
      show: Boolean(modules.orders && canManageOrders(membership)),
    },
    {
      href: "/carta",
      label: "Menú",
      icon: UtensilsCrossed,
      iconKey: "menu",
      show: Boolean(modules.catalog && canManageCatalog(membership)),
    },
    {
      href: "/inventory",
      label: "Inventario",
      icon: Package,
      iconKey: "inventory",
      show: Boolean(modules.catalog && canManageCatalog(membership)),
    },
    {
      href: "/funnels",
      label: "Embudos",
      icon: KanbanSquare,
      iconKey: "funnels",
      show: Boolean(modules.funnels && canUseInbox(membership)),
    },
    {
      href: "/calendar",
      label: "Calendario",
      icon: CalendarDays,
      iconKey: "calendar",
      show: Boolean(modules.calendar && canUseInbox(membership)),
    },
    {
      href: "/listings",
      label: "Inmuebles",
      icon: Building2,
      iconKey: "listings",
      show: Boolean(modules.listings && canUseInbox(membership)),
    },
    {
      href: "/contacts",
      label: "Contactos",
      icon: Contact,
      iconKey: "contacts",
      show: canUseInbox(membership),
    },
    {
      href: "/settings",
      label: "Ajustes",
      icon: Settings,
      iconKey: "settings",
      show: true,
    },
  ];
  const items = navItems.filter((item) => item.show);
  const mobileNavItems = items.filter(
    (item) => item.href !== "/home" && item.href !== "/settings",
  );

  return (
    <MobileChromeProvider>
      <div className="h-full overflow-hidden bg-background text-foreground">
        <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col p-3 md:p-5">
          <aside className="group/sidebar fixed top-5 left-5 z-50 hidden h-[calc(100vh-2.5rem)] w-[78px] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-primary/20 bg-card/80 p-3 shadow-2xl shadow-primary/15 backdrop-blur transition-all duration-300 [scrollbar-width:none] hover:w-72 [-ms-overflow-style:none] max-[1399px]:hidden min-[1400px]:flex min-[1400px]:flex-col [&::-webkit-scrollbar]:hidden">
            <span className="mx-auto mb-2 flex size-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground group-hover/sidebar:hidden">
              {membership.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={membership.logoUrl}
                  alt={membership.organizationName}
                  className="size-10 object-cover"
                />
              ) : (
                <Sparkles className="size-5" />
              )}
            </span>
            <Link
              href="/home"
              prefetch={false}
              className="hidden items-center gap-3 rounded-2xl border border-primary/35 bg-primary/15 p-3 group-hover/sidebar:flex">
              <span className="flex size-10 min-w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
                {membership.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={membership.logoUrl}
                    alt={membership.organizationName}
                    className="size-10 object-cover"
                  />
                ) : (
                  <Sparkles className="size-5" />
                )}
              </span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.25em] text-primary whitespace-nowrap">
                  Innover
                </span>
                <span className="block text-sm font-semibold whitespace-nowrap">
                  Suite CRM
                </span>
              </span>
            </Link>
            <SidebarNav
              items={items.map((item) => ({
                href: item.href,
                label: item.label,
                icon: item.iconKey,
              }))}
            />
            <Separator className="mt-6" />
            <div className="mt-auto space-y-4 pt-6">
              <div
                id="suite-notification-slot-desktop"
                className="flex justify-center group-hover/sidebar:justify-end"
              />
              <div className="flex items-center justify-center gap-3 group-hover/sidebar:justify-start group-hover/sidebar:rounded-2xl group-hover/sidebar:bg-muted/50 group-hover/sidebar:p-3">
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 group-hover/sidebar:block">
                  <p className="text-sm font-medium whitespace-nowrap">
                    {ROLE_LABELS[membership.role as OrganizationRole]}
                  </p>
                  {user.email ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  ) : null}
                  <p className="truncate text-xs text-muted-foreground">
                    {membership.organizationName}
                  </p>
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
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden min-[1400px]:pl-[94px]">
            <MobileSuiteHeader
              email={user.email ?? null}
              roleLabel={ROLE_LABELS[membership.role as OrganizationRole]}
              organizationName={membership.organizationName}
              organizationLogoUrl={membership.logoUrl}
              initials={initials}
            />
            <div className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:max-[1399px]:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-[1400px]:pb-0">
              <BillingUsageBanner entitlements={entitlements} />
              {children}
            </div>
          </main>
          <MobileNav
            items={mobileNavItems.map((item) => ({
              href: item.href,
              label: item.label,
              icon: item.iconKey,
            }))}
          />
          <TabletNav
            items={mobileNavItems.map((item) => ({
              href: item.href,
              label: item.label,
              icon: item.iconKey,
            }))}
          />
          <Suspense fallback={null}>
            <NotificationBellLoader
              organizationId={membership.organizationId}
              userId={user.id}
            />
          </Suspense>
        </div>
      </div>
    </MobileChromeProvider>
  );
};

export default SuiteLayout;
