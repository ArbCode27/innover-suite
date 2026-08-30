"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Filter, Plus, Search } from "lucide-react";
import {
  LISTING_OPERATIONS,
  LISTING_OPERATION_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_STYLES,
  PROPERTY_TYPE_LABELS,
  formatListingLocation,
  formatListingPrice,
  formatListingSummary,
  type ListingRecord,
  type ListingOperation,
  type ListingStatus,
} from "@/lib/listings/types";
import { ListingForm, type ListingContactOption } from "./listing-form";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { OrganizationCurrencySettings } from "@/lib/organizations/currencies";

type ListingsBoardProps = {
  listings: ListingRecord[];
  contacts: ListingContactOption[];
  currencies: OrganizationCurrencySettings;
  canManage: boolean;
};

export const ListingsBoard = ({ listings, contacts, currencies, canManage }: ListingsBoardProps) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [operationFilter, setOperationFilter] = useState<ListingOperation | "all">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return listings.filter((listing) => {
      if (statusFilter !== "all" && listing.status !== statusFilter) return false;
      if (operationFilter !== "all" && listing.operation !== operationFilter && listing.operation !== "both") {
        return false;
      }
      if (!query) return true;
      const haystack = `${listing.title} ${listing.code} ${listing.city ?? ""} ${listing.zone ?? ""} ${listing.neighborhood ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [listings, searchTerm, statusFilter, operationFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por código, título o zona"
            className="pl-8"
            aria-label="Buscar inmuebles"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowFilters((current) => !current)}>
            <Filter />
            Filtros
          </Button>
          {canManage ? (
            <Button type="button" onClick={() => setIsCreateOpen(true)}>
              <Plus />
              Nuevo inmueble
            </Button>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <AppSelect
            aria-label="Filtrar por estado"
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ListingStatus | "all")}
            options={[
              { value: "all", label: "Todos los estados" },
              ...LISTING_STATUSES.map((item) => ({ value: item, label: LISTING_STATUS_LABELS[item] })),
            ]}
          />
          <AppSelect
            aria-label="Filtrar por operación"
            value={operationFilter}
            onValueChange={(value) => setOperationFilter(value as ListingOperation | "all")}
            options={[
              { value: "all", label: "Venta y alquiler" },
              ...LISTING_OPERATIONS.map((item) => ({ value: item, label: LISTING_OPERATION_LABELS[item] })),
            ]}
          />
        </div>
      ) : null}

      {filtered.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing) => (
            <li key={listing.id}>
              <Link href={`/listings/${listing.id}`} className="block h-full">
                <Card className="h-full overflow-hidden border-primary/15 bg-card/80 transition hover:border-primary/40">
                  {listing.coverUrl ? (
                    <img src={listing.coverUrl} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-primary/10 text-primary">
                      <Building2 className="size-8" aria-hidden />
                    </div>
                  )}
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardDescription className="text-[11px]">{listing.code}</CardDescription>
                        <CardTitle className="mt-1 truncate text-base">{listing.title}</CardTitle>
                      </div>
                      <Badge className={LISTING_STATUS_STYLES[listing.status]}>{LISTING_STATUS_LABELS[listing.status]}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0 text-sm">
                    <p className="font-medium">{formatListingPrice(listing)}</p>
                    <p className="text-xs text-muted-foreground">{formatListingLocation(listing)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PROPERTY_TYPE_LABELS[listing.propertyType]} · {LISTING_OPERATION_LABELS[listing.operation]}
                      {formatListingSummary(listing) ? ` · ${formatListingSummary(listing)}` : ""}
                    </p>
                    {listing.exclusive ? <Badge variant="outline">Exclusiva</Badge> : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-primary/20 p-8 text-center text-sm text-muted-foreground">
          {listings.length ? "Ningún inmueble coincide con la búsqueda." : "Crea la primera ficha para que la IA pueda enviarla por chat."}
        </p>
      )}

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Nuevo inmueble</SheetTitle>
            <SheetDescription>Zona, ciudad y urbanización van como texto. No hace falta mapa.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <ListingForm
              contacts={contacts}
              currencies={currencies}
              canManage={canManage}
              onSaved={(listingId) => {
                setIsCreateOpen(false);
                router.push(`/listings/${listingId}`);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
