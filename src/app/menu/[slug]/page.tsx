import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuBoard } from "./menu-board";
import { loadPublicMenuBySlug } from "@/lib/menu/public-menu";

type MenuPageProps = {
  params: Promise<{ slug: string }>;
};

export const generateMetadata = async ({ params }: MenuPageProps): Promise<Metadata> => {
  const { slug } = await params;
  try {
    const menu = await loadPublicMenuBySlug(slug);
    if (!menu) {
      return { title: "Menú no disponible" };
    }
    return {
      title: `${menu.restaurant.name} | Auto-pedido`,
      description: `Ordena en ${menu.restaurant.name} desde el menú digital.`,
    };
  } catch {
    return { title: "Menú" };
  }
};

const MenuPage = async ({ params }: MenuPageProps) => {
  const { slug } = await params;
  let menu = null;
  try {
    menu = await loadPublicMenuBySlug(slug);
  } catch (error) {
    console.error("[PUBLIC_MENU] page load failed", error);
  }

  if (!menu) {
    notFound();
  }

  return <MenuBoard menu={menu} />;
};

export default MenuPage;
