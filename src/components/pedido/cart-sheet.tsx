"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { CartSummary } from "@/components/pedido/cart-summary";
import { CheckoutButton } from "@/components/pedido/checkout-button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCartStore } from "@/store/cart-store";

export const CartSheet = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const cantidad = useCartStore((state) => state.getCantidadItems());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("cart") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && searchParams.get("cart") === "1") {
      router.replace(pathname);
    }
  };

  const handleSeguirExplorando = () => {
    handleOpenChange(false);
    router.push("/pedir");
  };

  const panel = (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <CartSummary />
      </div>
      <div className="space-y-2 border-t border-border px-4 py-4">
        <Button type="button" variant="outline" className="w-full" onClick={handleSeguirExplorando}>
          Seguir explorando
        </Button>
        <CheckoutButton onBeforeNavigate={() => handleOpenChange(false)} />
      </div>
    </>
  );

  const hideFab = pathname.startsWith("/pedir/confirmacion");
  const onProductDetail = pathname.includes("/pedir/producto/");

  return (
    <>
      {!hideFab ? (
      <Button
        type="button"
        size="icon"
        className={
          onProductDetail
            ? "fixed right-4 bottom-24 z-40 size-14 rounded-full shadow-lg md:right-6 md:bottom-28"
            : "fixed right-4 bottom-4 z-40 size-14 rounded-full shadow-lg md:right-6 md:bottom-6"
        }
        aria-label={`Abrir carrito, ${cantidad} ítems`}
        onClick={() => setOpen(true)}
      >
        <ShoppingBag className="size-5" />
        {cantidad > 0 ? (
          <Badge className="absolute -top-1 -right-1 size-5 justify-center rounded-full p-0 text-[10px]">
            {cantidad}
          </Badge>
        ) : null}
      </Button>
      ) : null}

      {isDesktop ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b border-border">
              <SheetTitle>Tu carrito</SheetTitle>
              <SheetDescription>Revisa personalizaciones y confirma el pedido.</SheetDescription>
            </SheetHeader>
            {panel}
            <SheetFooter className="sr-only">Carrito</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[92dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Tu carrito</DrawerTitle>
              <DrawerDescription>Revisa personalizaciones y confirma el pedido.</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panel}</div>
            <DrawerFooter className="sr-only">Carrito</DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};
