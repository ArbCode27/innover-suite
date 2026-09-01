import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type ModuleShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};

export const ModuleShell = ({
  title,
  description,
  children,
  eyebrow = "Innover Suite",
  actions,
}: ModuleShellProps) => {
  return (
    <section className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/75 px-5 py-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_20%,transparent),transparent_20rem),radial-gradient(circle_at_85%_20%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_22rem)]" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-2" variant="outline">
              {eyebrow}
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {title}
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>
      {children}
    </section>
  );
};
