import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelfOrderProductClient } from "@/components/menu/self-order-product-client";
import { loadPublicSurfaceBySlug } from "@/lib/menu/public-menu";
import { PALETTE_ATTRIBUTE, parsePaletteId } from "@/lib/theme/palettes";

type ProductPageProps = {
  params: Promise<{ slug: string; id: string }>;
};

export const generateMetadata = async ({ params }: ProductPageProps): Promise<Metadata> => {
  const { slug, id } = await params;
  try {
    const catalog = await loadPublicSurfaceBySlug(slug, "menu");
    const item = catalog?.items.find((entry) => String(entry.sourceId) === id);
    if (!item) return { title: "Producto no encontrado" };
    return {
      title: `${item.title} | ${catalog?.organization.name ?? "Menú"}`,
      description: item.description ?? undefined,
    };
  } catch {
    return { title: "Producto" };
  }
};

const ProductPage = async ({ params }: ProductPageProps) => {
  const { slug, id } = await params;
  const catalog = await loadPublicSurfaceBySlug(slug, "menu");
  if (!catalog) notFound();

  const item = catalog.items.find((entry) => String(entry.sourceId) === id);
  if (!item) notFound();

  const drinkItems = catalog.items.filter((entry) => entry.menuType === "drink");
  const palette = parsePaletteId(catalog.organization.themePalette);

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{document.documentElement.setAttribute(${JSON.stringify(PALETTE_ATTRIBUTE)},${JSON.stringify(palette)});}catch(e){}`,
        }}
      />
      <Suspense fallback={null}>
        <SelfOrderProductClient
          slug={slug}
          org={catalog.organization}
          item={item}
          drinkItems={drinkItems}
        />
      </Suspense>
    </>
  );
};

export default ProductPage;
