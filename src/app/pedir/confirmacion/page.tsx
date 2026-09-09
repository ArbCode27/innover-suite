import type { Metadata } from "next";
import { OrderConfirmation } from "@/components/pedido/order-confirmation";

export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Tu pedido fue enviado a cocina.",
};

type ConfirmacionPageProps = {
  searchParams: Promise<{ orden?: string }>;
};

const ConfirmacionPage = async ({ searchParams }: ConfirmacionPageProps) => {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-10">
      <OrderConfirmation numeroOrden={params.orden ?? null} />
    </main>
  );
};

export default ConfirmacionPage;
