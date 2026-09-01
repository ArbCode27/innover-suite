"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumn, ChevronRight, LogOut, Settings, Sparkles } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { SuiteHeaderBackButton } from "@/components/suite/suite-header-back-button";
import { ThemeToggle } from "@/components/suite/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MobileSuiteHeaderProps = {
  email: string | null;
  roleLabel: string;
  organizationName: string;
  initials: string;
};

export const MobileSuiteHeader = ({
  email,
  roleLabel,
  organizationName,
  initials,
}: MobileSuiteHeaderProps) => {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  return (
    <header className="mb-3 flex items-center gap-2 md:hidden">
      <Link
        href="/home"
        prefetch={false}
        aria-label="Inicio"
        className="flex min-w-0 items-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-2 py-1.5"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <span className="truncate text-sm font-semibold tracking-tight">
          <span className="text-primary">Innover</span> Suite
        </span>
      </Link>
      <SuiteHeaderBackButton />
      <div className="ml-auto flex items-center gap-2">
        <Button asChild variant="outline" size="icon">
          <Link href="/home" prefetch={false} aria-label="Inicio">
            <ChartColumn />
          </Link>
        </Button>
        <div id="suite-notification-slot-mobile" />
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Ajustes">
              <Settings />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(20rem,88vw)] gap-0 p-0">
            <SheetHeader className="border-b border-primary/10">
              <SheetTitle>Ajustes</SheetTitle>
              <SheetDescription>{organizationName}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <section className="rounded-2xl border border-primary/15 bg-muted/40 p-3" aria-label="Sesión actual">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sesión actual</p>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{roleLabel}</p>
                    {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
                    <p className="truncate text-xs text-muted-foreground">{organizationName}</p>
                  </div>
                </div>
              </section>
              <div className="rounded-2xl border border-primary/15 px-3 py-3">
                <ThemeToggle row />
              </div>
              <SheetClose asChild>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-2xl border border-primary/15 px-3 py-3 text-sm font-medium transition hover:bg-primary/8"
                >
                  <Settings className="size-4 text-primary" aria-hidden />
                  <span className="flex-1">Ajustes avanzados</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </SheetClose>
            </div>
            <Separator />
            <SheetFooter>
              <form action={signOut}>
                <Button className="w-full" type="submit" variant="outline">
                  <LogOut />
                  Cerrar sesión
                </Button>
              </form>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};
