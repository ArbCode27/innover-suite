import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogBoard } from "@/app/menu/[slug]/menu-board";
import { PublicPaletteSync } from "@/components/theme/public-palette-sync";
import { loadPublicSurfaceBySlug } from "@/lib/menu/public-menu";
import { parsePaletteId } from "@/lib/theme/palettes";

type CatalogPageProps = {
  params: Promise<{ slug: string }>;
};

export const generateMetadata = async ({ params }: CatalogPageProps): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const catalog = await loadPublicSurfaceBySlug(slug, "catalog");
    if (!catalog) {
      return { title: "Catálogo no disponible" };
    }
    return {
      title: `${catalog.organization.name} | Catálogo`,
      description: `Explora el catálogo de ${catalog.organization.name}.`,
    };
  } catch {
    return { title: "Catálogo" };
  }
};

const CatalogPage = async ({ params }: CatalogPageProps) => {
  const { slug } = await params;
  let catalog = null;
  try {
    catalog = await loadPublicSurfaceBySlug(slug, "catalog");
  } catch (error) {
    console.error("[PUBLIC_CATALOG] page load failed", error);
  }

  if (!catalog) {
    notFound();
  }

  const palette = parsePaletteId(catalog.organization.themePalette);

  return (
    <>
      <PublicPaletteSync palette={palette} />
      <CatalogBoard catalog={catalog} />
    </>
  );
};

export default CatalogPage;
