"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { toastActionError } from "@/lib/auth/action-toast";
import { upsertListingAction } from "@/lib/listings/actions";
import { listingSchema } from "@/lib/listings/schema";
import { zodErrorMessage, zodFieldErrors } from "@/lib/validation/zod-es";
import {
  LISTING_OPERATIONS,
  LISTING_OPERATION_LABELS,
  LISTING_STATUSES,
  LISTING_STATUS_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  parseAmenitiesInput,
  type ListingRecord,
  type PropertyType,
  type ListingOperation,
  type ListingStatus,
} from "@/lib/listings/types";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PriceCurrencyField } from "@/components/ui/price-currency-field";
import { DEFAULT_CURRENCY, type OrganizationCurrencySettings } from "@/lib/organizations/currencies";

export type ListingContactOption = {
  id: number;
  fullName: string;
};

type ListingFormProps = {
  listing?: ListingRecord | null;
  contacts: ListingContactOption[];
  currencies: OrganizationCurrencySettings;
  canManage: boolean;
  compact?: boolean;
  onSaved?: (listingId: number) => void;
  onBusyChange?: (busy: boolean) => void;
};

const toForm = (listing: ListingRecord | null | undefined, defaultCurrency: string) => ({
  code: listing?.code ?? "",
  title: listing?.title ?? "",
  description: listing?.description ?? "",
  propertyType: (listing?.propertyType ?? "apartment") as PropertyType,
  operation: (listing?.operation ?? "sale") as ListingOperation,
  status: (listing?.status ?? "available") as ListingStatus,
  zone: listing?.zone ?? "",
  neighborhood: listing?.neighborhood ?? "",
  city: listing?.city ?? "",
  areaM2: listing?.areaM2 != null ? String(listing.areaM2) : "",
  bedrooms: listing?.bedrooms != null ? String(listing.bedrooms) : "",
  bathrooms: listing?.bathrooms != null ? String(listing.bathrooms) : "",
  parking: listing?.parking != null ? String(listing.parking) : "",
  yearBuilt: listing?.yearBuilt != null ? String(listing.yearBuilt) : "",
  price: listing?.price != null ? String(listing.price) : "",
  currency: listing?.currency || defaultCurrency || DEFAULT_CURRENCY,
  amenities: listing?.amenities.join(", ") ?? "",
  ownerContactId: listing?.ownerContactId ? String(listing.ownerContactId) : "",
  exclusive: listing?.exclusive ?? false,
  videoUrl: listing?.videoUrl ?? "",
  tourUrl: listing?.tourUrl ?? "",
});

const FieldMessage = ({ message }: { message?: string }) =>
  message ? (
    <p className="text-sm text-destructive" role="alert">
      {message}
    </p>
  ) : null;

export const ListingForm = ({
  listing,
  contacts,
  currencies,
  canManage,
  compact = false,
  onSaved,
  onBusyChange,
}: ListingFormProps) => {
  const router = useRouter();
  const [form, setForm] = useState(() => toForm(listing, currencies.defaultCode));
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const handleChange = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const listingPayload = () => ({
    id: listing?.id,
    code: form.code.trim() || undefined,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    propertyType: form.propertyType,
    operation: form.operation,
    status: form.status,
    zone: form.zone.trim() || undefined,
    neighborhood: form.neighborhood.trim() || undefined,
    city: form.city.trim() || undefined,
    areaM2: form.areaM2,
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    parking: form.parking,
    yearBuilt: form.yearBuilt,
    price: form.price,
    currency: form.price.trim() ? form.currency : undefined,
    amenities: parseAmenitiesInput(form.amenities),
    ownerContactId: form.ownerContactId || undefined,
    exclusive: form.exclusive,
    videoUrl: form.videoUrl.trim() || undefined,
    tourUrl: form.tourUrl.trim() || undefined,
  });

  const handleSubmit = () => {
    if (!canManage) return;
    const parsed = listingSchema.safeParse(listingPayload());
    if (!parsed.success) {
      const message = zodErrorMessage(parsed.error, "Revisa los datos del inmueble.");
      setFieldErrors(zodFieldErrors(parsed.error));
      setFormError(message);
      return;
    }

    setFormError(null);
    setFieldErrors({});
    const isCreate = !listing;
    if (isCreate) onBusyChange?.(true);
    startTransition(async () => {
      const result = await upsertListingAction(parsed.data);

      if (result.error || !result.listingId) {
        if (isCreate) onBusyChange?.(false);
        const message = result.error ?? "No se pudo guardar el inmueble.";
        setFormError(message);
        toastActionError(result);
        return;
      }

      toast.success(result.success ?? "Inmueble guardado");
      if (onSaved) {
        onSaved(result.listingId);
      } else {
        if (isCreate) onBusyChange?.(false);
        router.refresh();
      }
    });
  };

  return (
    <fieldset className="@container space-y-4" disabled={!canManage}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="listing-title">Título</Label>
          <Input
            id="listing-title"
            value={form.title}
            maxLength={160}
            disabled={!canManage}
            onChange={(event) => handleChange("title", event.target.value)}
          />
          <FieldMessage message={fieldErrors.title} />
        </div>
        {compact ? null : (
          <div className="space-y-2">
            <Label htmlFor="listing-code">Código interno</Label>
            <Input
              id="listing-code"
              value={form.code}
              maxLength={40}
              placeholder="Se genera si lo dejas vacío"
              disabled={!canManage}
              onChange={(event) => handleChange("code", event.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="listing-type">Tipo</Label>
          <AppSelect
            id="listing-type"
            aria-label="Tipo de inmueble"
            value={form.propertyType}
            disabled={!canManage}
            onValueChange={(value) => handleChange("propertyType", value)}
            options={PROPERTY_TYPES.map((item) => ({ value: item, label: PROPERTY_TYPE_LABELS[item] }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listing-operation">Operación</Label>
          <AppSelect
            id="listing-operation"
            aria-label="Operación"
            value={form.operation}
            disabled={!canManage}
            onValueChange={(value) => handleChange("operation", value)}
            options={LISTING_OPERATIONS.map((item) => ({ value: item, label: LISTING_OPERATION_LABELS[item] }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listing-status">Disponibilidad</Label>
          <AppSelect
            id="listing-status"
            aria-label="Disponibilidad"
            value={form.status}
            disabled={!canManage}
            onValueChange={(value) => handleChange("status", value)}
            options={LISTING_STATUSES.map((item) => ({ value: item, label: LISTING_STATUS_LABELS[item] }))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-state">Estado</Label>
          <Input
            id="listing-state"
            placeholder="Miranda"
            value={form.neighborhood}
            disabled={!canManage}
            onChange={(event) => handleChange("neighborhood", event.target.value)}
          />
          <FieldMessage message={fieldErrors.neighborhood} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-city">Ciudad</Label>
          <Input
            id="listing-city"
            placeholder="Caracas"
            value={form.city}
            disabled={!canManage}
            onChange={(event) => handleChange("city", event.target.value)}
          />
          <FieldMessage message={fieldErrors.city} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-zone">Zona</Label>
          <Input
            id="listing-zone"
            placeholder="Las Mercedes"
            value={form.zone}
            disabled={!canManage}
            onChange={(event) => handleChange("zone", event.target.value)}
          />
          <FieldMessage message={fieldErrors.zone} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4 @min-[40rem]:grid-cols-4">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-area">m²</Label>
          <Input
            id="listing-area"
            inputMode="decimal"
            value={form.areaM2}
            disabled={!canManage}
            onChange={(event) => handleChange("areaM2", event.target.value)}
          />
          <FieldMessage message={fieldErrors.areaM2} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-beds">Habitaciones</Label>
          <Input
            id="listing-beds"
            inputMode="numeric"
            value={form.bedrooms}
            disabled={!canManage}
            onChange={(event) => handleChange("bedrooms", event.target.value)}
          />
          <FieldMessage message={fieldErrors.bedrooms} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-baths">Baños</Label>
          <Input
            id="listing-baths"
            inputMode="numeric"
            value={form.bathrooms}
            disabled={!canManage}
            onChange={(event) => handleChange("bathrooms", event.target.value)}
          />
          <FieldMessage message={fieldErrors.bathrooms} />
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-parking">Puestos</Label>
          <Input
            id="listing-parking"
            inputMode="numeric"
            value={form.parking}
            disabled={!canManage}
            onChange={(event) => handleChange("parking", event.target.value)}
          />
          <FieldMessage message={fieldErrors.parking} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 @min-[40rem]:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="listing-year">Año</Label>
          <Input
            id="listing-year"
            inputMode="numeric"
            value={form.yearBuilt}
            disabled={!canManage}
            aria-invalid={Boolean(fieldErrors.yearBuilt)}
            onChange={(event) => handleChange("yearBuilt", event.target.value)}
          />
          <FieldMessage message={fieldErrors.yearBuilt} />
        </div>
        <div className="min-w-0 space-y-2">
          <PriceCurrencyField
            id="listing-price"
            label="Precio"
            amount={form.price}
            currency={form.currency}
            currencies={currencies}
            placeholder="A consultar"
            onAmountChange={(value) => handleChange("price", value)}
            onCurrencyChange={(value) => handleChange("currency", value)}
          />
          <FieldMessage message={fieldErrors.price} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="listing-description">Descripción</Label>
        <textarea
          id="listing-description"
          value={form.description}
          disabled={!canManage}
          rows={4}
          maxLength={4000}
          onChange={(event) => handleChange("description", event.target.value)}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
        />
      </div>

      {compact ? null : (
        <>
      <div className="space-y-2">
        <Label htmlFor="listing-amenities">Amenidades</Label>
        <Input
          id="listing-amenities"
          value={form.amenities}
          disabled={!canManage}
          placeholder="Piscina, planta eléctrica, vigilancia"
          onChange={(event) => handleChange("amenities", event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="listing-owner">Propietario</Label>
          <AppSelect
            id="listing-owner"
            aria-label="Propietario"
            value={form.ownerContactId}
            disabled={!canManage}
            onValueChange={(value) => handleChange("ownerContactId", value)}
            placeholder="Sin propietario"
            options={[
              { value: "", label: "Sin propietario" },
              ...contacts.map((contact) => ({ value: String(contact.id), label: contact.fullName })),
            ]}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-1 text-sm">
            <Switch checked={form.exclusive} disabled={!canManage} onCheckedChange={(checked) => handleChange("exclusive", checked)} />
            Exclusiva
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="listing-video">Video</Label>
          <Input
            id="listing-video"
            type="url"
            value={form.videoUrl}
            disabled={!canManage}
            placeholder="https://"
            onChange={(event) => handleChange("videoUrl", event.target.value)}
          />
          <FieldMessage message={fieldErrors.videoUrl} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="listing-tour">Tour virtual</Label>
          <Input
            id="listing-tour"
            type="url"
            value={form.tourUrl}
            disabled={!canManage}
            placeholder="https://"
            onChange={(event) => handleChange("tourUrl", event.target.value)}
          />
          <FieldMessage message={fieldErrors.tourUrl} />
        </div>
      </div>
        </>
      )}

      {formError && Object.keys(fieldErrors).length === 0 ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      {canManage ? (
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Save />}
          {listing ? (isPending ? "Guardando..." : "Guardar cambios") : isPending ? "Creando inmueble..." : "Crear inmueble"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Solo owner, admin o asesor pueden editar inmuebles.</p>
      )}
    </fieldset>
  );
};
