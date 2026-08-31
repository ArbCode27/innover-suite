import { Skeleton } from "@/components/ui/skeleton";

export const ListingDetailSkeleton = () => {
  return (
    <section className="space-y-6" aria-busy="true" aria-label="Cargando ficha del inmueble">
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/75 px-5 py-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-8 w-48 max-w-full" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4 rounded-xl border border-primary/15 bg-card/80 p-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-3 rounded-xl border border-primary/15 bg-card/80 p-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
};
