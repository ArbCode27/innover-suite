import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "../listing-form";
import { ListingGallery } from "../listing-gallery";
import { ModuleShell } from "@/components/suite/module-shell";
import { Button } from "@/components/ui/button";
import { loadListing } from "@/lib/listings/board";
import { requireSuiteModule } from "@/lib/modules/guard";
import { canManageListings } from "@/lib/organizations/membership";
import { loadOrganizationCurrencies } from "@/lib/organizations/currencies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const { membership } = await requireSuiteModule("listings");
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  let listing = null;
  try {
    listing = await loadListing(supabase, membership.organizationId, listingId);
  } catch {
    listing = null;
  }

  if (!listing) {
    notFound();
  }

  const currencies = await loadOrganizationCurrencies(supabase, membership.organizationId);
  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("organization_id", membership.organizationId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const contacts = (contactRows ?? []).map((row) => ({
    id: row.id as number,
    fullName: (row.full_name as string) || "Contacto sin nombre",
  }));

  return (
    <ModuleShell
      title={listing.title}
      description={`${listing.code} · ficha interna para visitas y chat.`}
      eyebrow="Inmueble"
      actions={
        <Button asChild variant="outline">
          <Link href="/listings">
            <ArrowLeft />
            Volver
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ListingForm
          listing={listing}
          contacts={contacts}
          currencies={currencies}
          canManage={canManageListings(membership)}
        />
        <ListingGallery listingId={listing.id} media={listing.media} canManage={canManageListings(membership)} />
      </div>
    </ModuleShell>
  );
}
