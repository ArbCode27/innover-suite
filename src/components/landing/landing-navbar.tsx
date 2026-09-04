import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type LandingNavbarProps = {
  isLoggedIn: boolean;
};

export const LandingNavbar = ({ isLoggedIn }: LandingNavbarProps) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/15 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Sparkles className="size-4.5" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Innover</span>
            <span className="text-sm font-semibold tracking-tight text-foreground">Suite CRM</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegación principal">
          <Link
            href="#canales"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Canales de Meta
          </Link>
          <Link
            href="#funciones"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Funcionalidades
          </Link>
          <Link
            href="#seguridad"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Seguridad y Datos
          </Link>
          <Link
            href="#faq"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Preguntas
          </Link>
          <Link
            href="/privacy"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Privacidad
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Button asChild size="sm">
              <Link href="/home">
                Ir al CRM
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">
                Iniciar sesión
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
