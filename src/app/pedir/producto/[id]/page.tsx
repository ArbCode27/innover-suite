import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailView } from "@/components/pedido/product-detail-view";
import { getProductoById } from "@/lib/mock-data";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export const generateMetadata = async ({ params }: ProductPageProps): Promise<Metadata> => {
  const { id } = await params;
  const producto = getProductoById(id);
  if (!producto) return { title: "Producto no encontrado" };
  return {
    title: `${producto.nombre} | Autopedido`,
    description: producto.descripcion,
  };
};

const ProductPage = async ({ params }: ProductPageProps) => {
  const { id } = await params;
  const producto = getProductoById(id);
  if (!producto) notFound();
  return <ProductDetailView producto={producto} />;
};

export default ProductPage;
