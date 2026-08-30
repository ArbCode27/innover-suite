"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { addListingMediaAction, removeListingMediaAction } from "@/lib/listings/actions";
import type { ListingMedia, ListingMediaKind } from "@/lib/listings/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/app-select";

type ListingGalleryProps = {
  listingId: number;
  media: ListingMedia[];
  canManage: boolean;
};

export const ListingGallery = ({ listingId, media, canManage }: ListingGalleryProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<ListingMediaKind>("image");
  const [isPending, startTransition] = useTransition();

  const handleUpload = (file: File | undefined, kind: ListingMediaKind) => {
    if (!file || !canManage) return;
    const formData = new FormData();
    formData.set("listingId", String(listingId));
    formData.set("kind", kind);
    formData.set("image", file);

    startTransition(async () => {
      const result = await addListingMediaAction(formData);
      if (result.error) {
        toastActionError(result);
        return;
      }
      toast.success(result.success ?? "Imagen agregada");
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const handleRemove = (mediaId: number) => {
    startTransition(async () => {
      const result = await removeListingMediaAction(mediaId);
      if (result.error) {
        toastActionError(result);
        return;
      }
      toast.success(result.success ?? "Imagen eliminada");
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Galería</h2>
          <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Máximo 5 MB por archivo.</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="listing-media-kind">Tipo</Label>
              <AppSelect
                id="listing-media-kind"
                aria-label="Tipo de imagen"
                value={kind}
                onValueChange={(value) => setKind(value as ListingMediaKind)}
                options={[
                  { value: "image", label: "Foto" },
                  { value: "floorplan", label: "Plano" },
                ]}
              />
            </div>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => fileRef.current?.click()}>
              {isPending ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              Subir
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Subir imagen del inmueble"
              onChange={(event) => handleUpload(event.target.files?.[0], kind)}
            />
          </div>
        ) : null}
      </div>

      {media.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl border border-primary/15 bg-card/80">
              <img src={item.url} alt={item.caption || "Foto del inmueble"} className="h-40 w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2">
                <p className="text-xs text-muted-foreground">{item.kind === "floorplan" ? "Plano" : "Foto"}</p>
                {canManage ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar imagen"
                    disabled={isPending}
                    onClick={() => handleRemove(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-primary/20 p-6 text-center text-sm text-muted-foreground">
          Aún no hay fotos. La IA solo envía imagen si hay al menos una.
        </p>
      )}
    </section>
  );
};
