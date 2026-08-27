"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Contact,
  Home,
  Inbox,
  KanbanSquare,
  Package,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ICONS = {
  home: Home,
  inbox: Inbox,
  orders: ClipboardList,
  inventory: Package,
  funnels: KanbanSquare,
  calendar: CalendarDays,
  contacts: Contact,
  settings: Settings,
} as const;

export type MobileNavIcon = keyof typeof NAV_ICONS;

export type MobileNavItem = {
  href: string;
  label: string;
  icon: MobileNavIcon;
};

type MobileNavProps = {
  items: MobileNavItem[];
};

type MobileChromeContextValue = {
  hideMobileNav: boolean;
  setHideMobileNav: (hidden: boolean) => void;
};

const MobileChromeContext = createContext<MobileChromeContextValue>({
  hideMobileNav: false,
  setHideMobileNav: () => undefined,
});

export const MobileChromeProvider = ({ children }: { children: ReactNode }) => {
  const [hideMobileNav, setHideMobileNav] = useState(false);
  const value = useMemo(() => ({ hideMobileNav, setHideMobileNav }), [hideMobileNav]);

  return <MobileChromeContext.Provider value={value}>{children}</MobileChromeContext.Provider>;
};

export const useMobileChrome = () => useContext(MobileChromeContext);

const isActivePath = (pathname: string, href: string) => {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
};

const SuiteNavLink = ({
  href,
  className,
  children,
  ...props
}: {
  href: string;
  className: string;
  children: ReactNode;
  "aria-current"?: "page";
}) => {
  const [prefetch, setPrefetch] = useState(false);

  const handleEnablePrefetch = () => {
    setPrefetch(true);
  };

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={handleEnablePrefetch}
      onFocus={handleEnablePrefetch}
      onTouchStart={handleEnablePrefetch}
      className={className}
      {...props}
    >
      {children}
    </Link>
  );
};

export const SidebarNav = ({ items }: MobileNavProps) => {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="space-y-2 group-hover/sidebar:mt-6">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const isActive = isActivePath(pathname, item.href);

        return (
          <SuiteNavLink
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center justify-center gap-0 rounded-2xl px-3 py-3 text-sm transition group-hover/sidebar:justify-start group-hover/sidebar:gap-3",
              isActive
                ? "bg-primary text-primary-foreground shadow-[0_0_22px_rgba(56,189,248,0.55)]"
                : "text-muted-foreground hover:bg-primary/12 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-40 group-hover/sidebar:opacity-100">
              {item.label}
            </span>
          </SuiteNavLink>
        );
      })}
    </nav>
  );
};

export const MobileNav = ({ items }: MobileNavProps) => {
  const pathname = usePathname();
  const { hideMobileNav } = useMobileChrome();

  if (hideMobileNav) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/20 bg-card/90 px-2 pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="flex items-stretch justify-between gap-0.5 overflow-x-auto">
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          const isActive = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <SuiteNavLink
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-medium transition-all",
                  isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/40"
                    : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </SuiteNavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
