"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIA_LABELS, formatPrecio, type Producto } from "@/types/pedido";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  producto: Producto;
  hrefBase?: string;
  className?: string;
};

export const ProductCard = ({ producto, hrefBase = "/pedir/producto", className }: ProductCardProps) => (
  <Link
    href={`${hrefBase}/${producto.id}`}
    className={cn("group block h-full focus-visible:outline-none", className)}
    aria-label={`Ver ${producto.nombre}`}
  >
    <Card className="h-full overflow-hidden border-primary/15 bg-card/90 transition group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={producto.imagenUrl}
          alt={producto.nombre}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition duration-300 group-hover:scale-105"
          unoptimized
        />
        {producto.etiquetas.length ? (
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {producto.etiquetas.map((etiqueta) => (
              <Badge key={etiqueta} variant="secondary" className="bg-background/90 backdrop-blur">
                {etiqueta}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardDescription className="text-[11px] uppercase tracking-wide">
          {CATEGORIA_LABELS[producto.categoria]}
        </CardDescription>
        <CardTitle className="text-base leading-snug">{producto.nombre}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <p className="line-clamp-2 text-sm text-muted-foreground">{producto.descripcion}</p>
        <p className="text-sm font-semibold tabular-nums">{formatPrecio(producto.precio)}</p>
      </CardContent>
    </Card>
  </Link>
);
