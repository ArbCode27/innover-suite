import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SelfOrderConfirmation } from "@/components/menu/self-order-confirmation";
import { PublicPaletteSync } from "@/components/theme/public-palette-sync";
import { loadPublicSurfaceBySlug } from "@/lib/menu/public-menu";
import { parsePaletteId } from "@/lib/theme/palettes";

type ConfirmacionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ orden?: string; total?: string }>;
};

export const generateMetadata = async ({ params }: ConfirmacionPageProps): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const catalog = await loadPublicSurfaceBySlug(slug, "menu");
    return {
      title: catalog ? `Pedido confirmado | ${catalog.organization.name}` : "Pedido confirmado",
    };
  } catch {
    return { title: "Pedido confirmado" };
  }
};

const ConfirmacionPage = async ({ params, searchParams }: ConfirmacionPageProps) => {
  const { slug } = await params;
  const query = await searchParams;
  const catalog = await loadPublicSurfaceBySlug(slug, "menu");
  if (!catalog) notFound();

  const palette = parsePaletteId(catalog.organization.themePalette);
  const totalRaw = query.total ? Number(query.total) : null;
  const total = totalRaw != null && Number.isFinite(totalRaw) ? totalRaw : null;

  return (
    <>
      <PublicPaletteSync palette={palette} />
      <SelfOrderConfirmation
        slug={slug}
        orgName={catalog.organization.name}
        orderId={query.orden ?? null}
        total={total}
        currency={catalog.organization.currency}
      />
    </>
  );
};

export default ConfirmacionPage;
