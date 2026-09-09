"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";

type PostAddDecisionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
};

export const PostAddDecisionModal = ({
  open,
  onOpenChange,
  productName,
}: PostAddDecisionModalProps) => {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSeguir = () => {
    onOpenChange(false);
    router.push("/pedir");
  };

  const handlePagar = () => {
    onOpenChange(false);
    router.push("/pedir?cart=1");
  };

  const body = (
    <>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{productName}</span> quedó en tu orden. ¿Qué
        quieres hacer ahora?
      </p>
    </>
  );

  const actions = (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" className="flex-1" onClick={handleSeguir}>
        Seguir pidiendo
      </Button>
      <Button type="button" className="flex-1" onClick={handlePagar}>
        Ir a pagar / Ver carrito
      </Button>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregado a la orden</DialogTitle>
            <DialogDescription>Elige si continúas explorando o revisas el carrito.</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter className="sm:justify-stretch">{actions}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Agregado a la orden</DrawerTitle>
          <DrawerDescription>Elige si continúas explorando o revisas el carrito.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2">{body}</div>
        <DrawerFooter>{actions}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
