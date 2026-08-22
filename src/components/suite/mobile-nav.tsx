"use client";

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

const isActivePath = (pathname: string, href: string) => {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
};

export const MobileNav = ({ items }: MobileNavProps) => {
  const pathname = usePathname();

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
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
