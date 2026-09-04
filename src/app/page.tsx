import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingChannels } from "@/components/landing/landing-channels";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingSecurity } from "@/components/landing/landing-security";

export const metadata: Metadata = {
  title: "Innover Suite | CRM Omnicanal con IA para WhatsApp, Instagram y Messenger",
  description:
    "Plataforma CRM para centralizar WhatsApp Business, Instagram Direct y Facebook Messenger. Agentes de IA 24/7, traspaso a asesores humanos y embudos de ventas en tiempo real.",
};

const hasSupabaseAuthCookie = (store: Awaited<ReturnType<typeof cookies>>) =>
  store.getAll().some((cookie) => cookie.name.includes("-auth-token"));

const HomePage = async () => {
  const store = await cookies();
  const isLoggedIn = hasSupabaseAuthCookie(store);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingNavbar isLoggedIn={isLoggedIn} />
      <main className="flex-1">
        <LandingHero isLoggedIn={isLoggedIn} />
        <LandingChannels />
        <LandingFeatures />
        <LandingSecurity />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
};

export default HomePage;
