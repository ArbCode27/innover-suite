import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LandingChannels } from "@/components/landing/landing-channels";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFlow } from "@/components/landing/landing-flow";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingIndustries } from "@/components/landing/landing-industries";
import { LandingLayers } from "@/components/landing/landing-layers";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingSecurity } from "@/components/landing/landing-security";

export const metadata: Metadata = {
  title: "Innover Suite | CRM Omnicanal con IA para WhatsApp, Instagram y Messenger",
  description:
    "CRM omnicanal con IA: inbox Meta, embudos, calendario, menú y autopedido, pedidos, cocina, inventario e inmuebles. Activa solo los módulos de tu industria.",
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
        <LandingIndustries />
        <LandingLayers />
        <LandingFeatures />
        <LandingFlow />
        <LandingChannels />
        <LandingSecurity />
        <LandingFaq />
        <LandingCta isLoggedIn={isLoggedIn} />
      </main>
      <LandingFooter />
    </div>
  );
};

export default HomePage;
