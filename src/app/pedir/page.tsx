import type { Metadata } from "next";
import { ProductCard } from "@/components/pedido/product-card";
import { getProductosPorCategoria } from "@/lib/mock-data";
import { CATEGORIA_LABELS } from "@/types/pedido";

export const metadata: Metadata = {
  title: "Autopedido | Menú",
  description: "Explora el menú, personaliza tu plato y envía el pedido a cocina.",
};

const PedirPage = () => {
  const sections = getProductosPorCategoria();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-6 pb-28 sm:px-6 lg:py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Autopedido</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Nuestro menú</h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Elige promociones o platos, personaliza ingredientes y extras, y envía tu orden cuando
          estés listo.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.categoria} className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              {CATEGORIA_LABELS[section.categoria]}
            </h2>
            <p className="text-xs text-muted-foreground">{section.productos.length} opciones</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.productos.map((producto) => (
              <ProductCard key={producto.id} producto={producto} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
};

export default PedirPage;
