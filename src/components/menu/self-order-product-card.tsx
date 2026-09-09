"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/commerce/types";
import { displayPrice } from "@/lib/menu/self-order";
import type { CatalogItem } from "@/lib/menu/types";
import { cn } from "@/lib/utils";

type SelfOrderProductCardProps = {
  item: CatalogItem;
  slug: string;
  className?: string;
};

export const SelfOrderProductCard = ({ item, slug, className }: SelfOrderProductCardProps) => {
  const price = displayPrice(item);
  const href = `/menu/${slug}/producto/${item.sourceId}`;

  return (
    <Link
      href={href}
      className={cn(
        "group block h-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-2xl",
        className,
      )}
      aria-label={`Ver ${item.title}`}
    >
      <Card className="h-full overflow-hidden border-primary/15 bg-card/90 transition group-hover:border-primary/40 group-hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground text-sm">
              Sin imagen
            </div>
          )}
          {item.metaLabel ? (
            <Badge className="absolute top-2 left-2 bg-background/90 text-foreground backdrop-blur">
              {item.metaLabel}
            </Badge>
          ) : null}
          {!item.available ? (
            <Badge variant="outline" className="absolute top-2 right-2 bg-background/90">
              No disponible
            </Badge>
          ) : null}
        </div>
        <CardHeader className="space-y-1 p-4 pb-2">
          <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {item.description || "Sin descripción"}
          </p>
          <div>
            {item.promoPrice != null && item.price != null ? (
              <p className="text-xs text-destructive line-through">
                {formatMoney(item.price, item.currency)}
              </p>
            ) : null}
            <p className="text-sm font-semibold tabular-nums">
              {formatMoney(price, item.currency)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
