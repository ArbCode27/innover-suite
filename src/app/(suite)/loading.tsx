import { Skeleton } from "@/components/ui/skeleton";

const SuiteLoading = () => {
  return (
    <section className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/75 px-5 py-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-8 w-64 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </section>
  );
};

export default SuiteLoading;
