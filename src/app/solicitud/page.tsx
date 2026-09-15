import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { loadUserJoinRequest } from "@/lib/billing/join-requests";
import { getCurrentMembership } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { JoinRequestForm } from "./join-request-form";
import { JoinRequestPending } from "./join-request-pending";
import { JoinRequestRejected } from "./join-request-rejected";

export const metadata: Metadata = {
  title: "Solicitud de Ingreso | Innover Suite",
  description: "Solicita la activación de tu organización enviando el comprobante de pago.",
};

const SolicitudPage = async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/solicitud");
  }

  // Si ya tiene membresía activa en una organización, va directo al CRM
  const membership = await getCurrentMembership();
  if (membership) {
    redirect("/home");
  }

  const latestRequest = await loadUserJoinRequest(user.id);

  if (latestRequest?.status === "approved") {
    redirect("/home");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
              <Sparkles className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Innover</span>
              <span className="text-sm font-semibold tracking-tight text-foreground">Suite CRM</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline-block">
              {user.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                <LogOut className="size-4 mr-1 sm:mr-1.5" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {latestRequest?.status === "pending" ? (
          <JoinRequestPending request={latestRequest} />
        ) : latestRequest?.status === "rejected" ? (
          <JoinRequestRejected request={latestRequest} />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Activación de Cuenta
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Solicitud de Ingreso al CRM</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Selecciona el plan para tu negocio, realiza el pago por tu método preferido y adjunta el
                comprobante para que la administración active tu entorno de trabajo.
              </p>
            </div>

            <JoinRequestForm />
          </div>
        )}
      </main>
    </div>
  );
};

export default SolicitudPage;
