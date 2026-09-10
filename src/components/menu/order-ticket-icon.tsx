"use client";

import { cn } from "@/lib/utils";

type OrderTicketIconProps = {
  className?: string;
};

/** Plato + cubiertos con entrada y loop suave (sin framer-motion). */
export const OrderTicketIcon = ({ className }: OrderTicketIconProps) => (
  <div
    className={cn("relative mx-auto flex size-36 items-center justify-center", className)}
    aria-hidden
  >
    <span className="order-ticket-glow absolute inset-6 rounded-full bg-primary/15 blur-2xl" />

    <svg
      viewBox="0 0 160 120"
      className="order-ticket-float relative z-10 h-28 w-full max-w-[11rem] overflow-visible"
      role="img"
    >
      <title>Plato y cubiertos</title>

      <g className="order-ticket-fork-in">
        <path
          d="M22 18v28c0 4 2.5 7 6 7v49"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="text-muted-foreground"
        />
        <path
          d="M16 18v16M22 18v16M28 18v16"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="text-muted-foreground"
        />
        <circle cx="28" cy="54" r="3.2" className="fill-muted-foreground/80" />
      </g>

      <g className="order-ticket-plate-in">
        <ellipse cx="80" cy="64" rx="36" ry="34" className="fill-card stroke-border" strokeWidth="2.5" />
        <ellipse cx="80" cy="64" rx="24" ry="22" className="fill-muted/60 stroke-border/80" strokeWidth="1.5" />
        <ellipse cx="72" cy="54" rx="10" ry="6" className="fill-background/50" />
        <path
          d="M52 70c8 10 48 10 56 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-primary/40"
        />
      </g>

      <g className="order-ticket-knife-in">
        <path
          d="M132 22c8 10 10 22 2 34l-4 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="text-muted-foreground"
        />
        <path
          d="M130 62v40"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          className="text-muted-foreground"
        />
        <path
          d="M126 28c10 8 12 20 6 30"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-foreground/25"
        />
      </g>

      <g className="order-ticket-check-in" style={{ transformOrigin: "108px 36px" }}>
        <circle cx="108" cy="36" r="11" className="fill-primary" />
        <path
          d="M102.5 36.5 106.5 40.5 114 33"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  </div>
);
