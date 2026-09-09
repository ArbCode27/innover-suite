"use client";

import { useCallback, useState } from "react";
import { SelfOrderCart } from "@/components/menu/self-order-cart";
import { SelfOrderDetail } from "@/components/menu/self-order-detail";
import type { CatalogItem, PublicCatalogOrg } from "@/lib/menu/types";

type SelfOrderProductClientProps = {
  slug: string;
  org: PublicCatalogOrg;
  item: CatalogItem;
  drinkItems: CatalogItem[];
};

export const SelfOrderProductClient = ({
  slug,
  org,
  item,
  drinkItems,
}: SelfOrderProductClientProps) => {
  const [forceCartOpen, setForceCartOpen] = useState(false);
  const handleOpenCart = useCallback(() => setForceCartOpen(true), []);

  return (
    <>
      <SelfOrderDetail
        slug={slug}
        item={item}
        drinkItems={drinkItems}
        onOpenCart={handleOpenCart}
      />
      <SelfOrderCart
        org={org}
        fabClassName="bottom-24 md:bottom-28"
        forceOpen={forceCartOpen}
        onForceOpenHandled={() => setForceCartOpen(false)}
      />
    </>
  );
};
