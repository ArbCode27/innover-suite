import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelfOrderBoard } from "@/components/menu/self-order-board";
import { PublicPaletteSync } from "@/components/theme/public-palette-sync";
import { loadPublicSurfaceBySlug } from "@/lib/menu/public-menu";
import { parsePaletteId } from "@/lib/theme/palettes";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
};

export const generateMetadata = async ({ params }: MenuPageProps): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const catalog = await loadPublicSurfaceBySlug(slug, "menu");
    if (!catalog) {
      return { title: "Menú no disponible" };
    }
    return {
      title: `${catalog.organization.name} | Menú`,
      description: `Explora el menú de ${catalog.organization.name} y envía tu pedido.`,
    };
  } catch {
    return { title: "Menú" };
  }
};

const MenuPage = async ({ params }: MenuPageProps) => {
  const { slug } = await params;
  let catalog = null;
  try {
    catalog = await loadPublicSurfaceBySlug(slug, "menu");
  } catch (error) {
    console.error("[PUBLIC_MENU] page load failed", error);
  }

  if (!catalog) {
    notFound();
  }

  const palette = parsePaletteId(catalog.organization.themePalette);

  return (
    <>
      <PublicPaletteSync palette={palette} />
      <Suspense fallback={null}>
        <SelfOrderBoard catalog={catalog} />
      </Suspense>
    </>
  );
};

export default MenuPage;
