import Link from "next/link";
import { Bath, BedDouble, Building2, Car, MapPin, Maximize2 } from "lucide-react";
import {
  LISTING_OPERATION_LABELS,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_STYLES,
  PROPERTY_TYPE_LABELS,
  formatListingLocation,
  formatListingPrice,
  type ListingRecord,
} from "@/lib/listings/types";
import { Badge } from "@/components/ui/badge";

type ListingCardProps = {
  listing: ListingRecord;
};

const SpecBadge = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble;
  label: string;
  value: number | null;
}) => {
  if (value == null) return null;
  return (
    <Badge
      variant="outline"
      className="border-primary/30 bg-primary/18 text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] backdrop-blur-md dark:border-primary/40 dark:bg-primary/22 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]"
    >
      <Icon aria-hidden />
      {label}
    </Badge>
  );
};

export const ListingCard = ({ listing }: ListingCardProps) => {
  const location = formatListingLocation(listing);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${listing.title}, ${formatListingPrice(listing)}`}
    >
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/55 bg-white/45 shadow-[0_10px_40px_rgba(30,64,120,0.08),inset_0_1px_0_0_rgba(255,255,255,0.75)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/80 hover:bg-white/60 hover:shadow-[0_18px_48px_rgba(30,64,120,0.14)] dark:border-white/10 dark:bg-white/8 dark:shadow-[0_10px_40px_rgba(0,0,0,0.28),inset_0_1px_0_0_rgba(255,255,255,0.08)] dark:hover:bg-white/12">
        <div className="relative overflow-hidden">
          {listing.coverUrl ? (
            <img
              src={listing.coverUrl}
              alt=""
              className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-44 w-full items-center justify-center bg-primary/15 text-primary">
              <Building2 className="size-8 opacity-80" aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-black/10" />
          <div className="absolute left-2.5 top-2.5">
            <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white shadow-sm backdrop-blur-md">
              {LISTING_OPERATION_LABELS[listing.operation]}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="border-white/60 bg-white/40 backdrop-blur-md dark:border-white/10 dark:bg-white/10">
              {PROPERTY_TYPE_LABELS[listing.propertyType]}
            </Badge>
            <Badge className={`${LISTING_STATUS_STYLES[listing.status]} backdrop-blur-md`}>
              {LISTING_STATUS_LABELS[listing.status]}
            </Badge>
            {listing.exclusive ? (
              <Badge variant="outline" className="border-white/60 bg-white/40 backdrop-blur-md dark:border-white/10 dark:bg-white/10">
                Exclusiva
              </Badge>
            ) : null}
          </div>

          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">{formatListingPrice(listing)}</p>
            <h2 className="mt-0.5 truncate text-sm font-medium text-foreground/90">{listing.title}</h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <SpecBadge icon={Maximize2} label={`${listing.areaM2} m²`} value={listing.areaM2} />
            <SpecBadge icon={BedDouble} label={`${listing.bedrooms} hab`} value={listing.bedrooms} />
            <SpecBadge icon={Bath} label={`${listing.bathrooms} baños`} value={listing.bathrooms} />
            <SpecBadge icon={Car} label={`${listing.parking} puestos`} value={listing.parking} />
          </div>

          <p className="mt-auto flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 leading-4">{location}</span>
          </p>
          <p className="text-[11px] tracking-wide text-muted-foreground/70">{listing.code}</p>
        </div>
      </article>
    </Link>
  );
};
