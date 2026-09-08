import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogBoard } from "./menu-board";
import { loadPublicMenuBySlug } from "@/lib/menu/public-menu";
import { PALETTE_ATTRIBUTE, parsePaletteId } from "@/lib/theme/palettes";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
};

export const generateMetadata = async ({ params }: MenuPageProps): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const catalog = await loadPublicMenuBySlug(slug);
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

const MenuPage = async ({ params }: MenuPageProps) => {
  const { slug } = await params;
  let catalog = null;
  try {
    catalog = await loadPublicMenuBySlug(slug);
  } catch (error) {
    console.error("[PUBLIC_CATALOG] page load failed", error);
  }

  if (!catalog) {
    notFound();
  }

  const palette = parsePaletteId(catalog.organization.themePalette);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{document.documentElement.setAttribute(${JSON.stringify(PALETTE_ATTRIBUTE)},${JSON.stringify(palette)});}catch(e){}`,
        }}
      />
      <CatalogBoard catalog={catalog} />
    </>
  );
};

export default MenuPage;
