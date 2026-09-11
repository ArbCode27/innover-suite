"use client";

import Link from "next/link";
import { ArrowRight, Bot, Check, MessageSquare, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LANDING_PLAN_VERTICALS,
  type LandingPlanTier,
  type LandingPlanVertical,
} from "@/lib/landing/product";
import { cn } from "@/lib/utils";

type LandingPricingProps = {
  isLoggedIn: boolean;
};

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

const formatMessages = (amount: number) =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 }).format(amount);

type PlanTierCardProps = {
  vertical: LandingPlanVertical;
  tier: LandingPlanTier;
  ctaHref: string;
  ctaLabel: string;
};

const PlanTierCard = ({ vertical, tier, ctaHref, ctaLabel }: PlanTierCardProps) => {
  const featured = Boolean(tier.featured);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card/90 p-5 shadow-sm backdrop-blur-sm transition duration-300",
        "hover:-translate-y-1 hover:shadow-lg",
        featured
          ? "border-primary/50 shadow-md shadow-primary/15 ring-1 ring-primary/25 md:-translate-y-1"
          : "border-border/60 hover:border-primary/35",
      )}
    >
      {featured ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[var(--brand-secondary)] to-primary"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{tier.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{vertical.tagline}</p>
        </div>
        {tier.badge ? (
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold tracking-wide text-primary-foreground uppercase">
            {tier.badge}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-end gap-1.5">
        <span className="text-4xl font-bold tracking-tight tabular-nums">
          {formatUsd(tier.priceUsd)}
        </span>
        <span className="mb-1 text-sm text-muted-foreground">/ mes</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
          <Users className="size-3 text-primary" aria-hidden />
          {tier.users} usuarios
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
          <MessageSquare className="size-3 text-primary" aria-hidden />
          {formatMessages(tier.aiMessages)} respuestas IA
        </span>
      </div>

      <div className="mt-5 flex-1 space-y-5 border-t border-border/50 pt-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground/70 uppercase">
            Incluye este nivel
          </p>
          <ul className="mt-3 space-y-2">
            {tier.extras.map((extra) => (
              <li key={extra} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span>{extra}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground/70 uppercase">
            Funciones CRM del rubro
          </p>
          <ul className="mt-3 space-y-2">
            {vertical.features.map((feature) => (
              <li key={feature} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3.5">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            <Bot className="size-3.5" aria-hidden />
            Alcance del asistente IA
          </p>
          <ul className="mt-3 space-y-2">
            {vertical.aiScope.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-relaxed text-foreground/80">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Button
        asChild
        size="lg"
        variant={featured ? "default" : "outline"}
        className={cn("mt-6 h-11 w-full font-semibold", featured && "shadow-md shadow-primary/25")}
      >
        <Link href={ctaHref}>
          {ctaLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>
    </article>
  );
};

export const LandingPricing = ({ isLoggedIn }: LandingPricingProps) => {
  const ctaHref = isLoggedIn ? "/home" : "/login";
  const ctaLabel = isLoggedIn ? "Ir al CRM" : "Empezar con este plan";
  const defaultVertical = LANDING_PLAN_VERTICALS[0]?.id ?? "restaurant";

  return (
    <section
      id="planes"
      className="relative scroll-mt-16 overflow-hidden border-t border-border/40 py-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_55%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--brand-secondary)_16%,transparent),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="border-primary/30 text-xs font-semibold text-primary">
            Planes en USD
          </Badge>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Tres propuestas por modelo de negocio
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Elige Restaurante, Ventas o Inmobiliaria y compara Básico, Pro y Plus. Las funciones CRM
            y el asistente IA son del modelo; el nivel define usuarios, cupo de respuestas IA y extras.
          </p>
        </div>

        <Tabs defaultValue={defaultVertical} className="mt-12 gap-8">
          <TabsList
            variant="default"
            className="mx-auto flex h-auto w-full max-w-xl flex-wrap justify-center gap-1 rounded-2xl bg-muted/80 p-1.5 sm:flex-nowrap"
            aria-label="Modelo de negocio"
          >
            {LANDING_PLAN_VERTICALS.map((vertical) => {
              const Icon = vertical.icon;
              return (
                <TabsTrigger
                  key={vertical.id}
                  value={vertical.id}
                  className="min-h-10 flex-1 gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm"
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{vertical.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {LANDING_PLAN_VERTICALS.map((vertical) => (
            <TabsContent key={vertical.id} value={vertical.id} className="mt-2 outline-none">
              <div className="mx-auto mb-8 max-w-2xl text-center">
                <p className="text-sm font-medium text-foreground">{vertical.idealFor}</p>
                <p className="mt-1 text-sm text-muted-foreground">{vertical.tagline}</p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {vertical.tiers.map((tier) => (
                  <PlanTierCard
                    key={`${vertical.id}-${tier.id}`}
                    vertical={vertical}
                    tier={tier}
                    ctaHref={ctaHref}
                    ctaLabel={ctaLabel}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Precios en USD. El cupo de respuestas IA se renueva cada mes. Puedes ampliar usuarios o
          respuestas según el consumo de tu organización.
        </p>
      </div>
    </section>
  );
};
