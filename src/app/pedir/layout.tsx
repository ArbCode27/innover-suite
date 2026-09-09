import { Suspense } from "react";
import type { ReactNode } from "react";
import { CartSheet } from "@/components/pedido/cart-sheet";

const PedirLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh bg-background text-foreground">
    {children}
    <Suspense fallback={null}>
      <CartSheet />
    </Suspense>
  </div>
);

export default PedirLayout;
