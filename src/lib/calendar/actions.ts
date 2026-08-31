"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APPOINTMENT_PURPOSES, CALENDAR_TIME_ZONE, VISIT_STATUSES, isVisitPurpose } from "@/lib/calendar/constants";
import type { AttendeeResponse, CalendarEventView, VisitStatus } from "@/lib/calendar/types";
import { toZonedIso } from "@/lib/calendar/range";
import { getOrganizationGoogleCalendarSession } from "@/lib/integrations/google-calendar-credentials";
import {
  createGoogleCalendarEvent,
  invalidateGoogleCalendarEventsCache,
  patchGoogleCalendarEvent,
  resolveGoogleMeetingUrl,
} from "@/lib/integrations/google-calendar";
import { getCurrentMembership, hasOrganizationRole } from "@/lib/organizations/membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionExpiredResult } from "@/lib/auth/session-result";
import { zodErrorMessage } from "@/lib/validation/zod-es";

const isoDateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: "La fecha no es válida.",
});

const createAppointmentSchema = z.object({
  contactId: z.number().int().positive("Elige un contacto para la cita."),
  title: z.string().trim().min(3, "El título de la cita debe tener al menos 3 caracteres.").max(160, "El título no puede tener más de 160 caracteres."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener el formato AAAA-MM-DD."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "La hora de inicio no es válida."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "La hora de fin no es válida."),
  notes: z.string().trim().max(1000, "Las notas no pueden tener más de 1000 caracteres.").optional(),
  createMeet: z.boolean(),
  purpose: z.enum(APPOINTMENT_PURPOSES, { error: "Elige un motivo de cita válido." }).default("consulta"),
  listingId: z.number().int().positive("El inmueble de la visita no es válido.").optional(),
});

const rescheduleAppointmentSchema = z.object({
  appointmentId: z.number().int().positive().nullable(),
  googleEventId: z.string().trim().min(1).nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
});

const updateVisitSchema = z.object({
  appointmentId: z.number().int().positive(),
  visitStatus: z.enum(VISIT_STATUSES),
  notes: z.string().trim().max(1000).optional(),
});

type ActionResult<T = undefined> = {
  success?: string;
  error?: string;
  data?: T;
};

const requireAgentMembership = async () => {
  const membership = await getCurrentMembership();
  if (!membership || !hasOrganizationRole(membership, ["owner", "admin", "agent"])) {
    return { error: "No tienes permisos para gestionar el calendario." } as const;
  }
  return { membership } as const;
};

const isPersistedGoogleEventId = (value: string | null) =>
  Boolean(value && !value.startsWith("local-"));

export const createCalendarAppointmentAction = async (
  rawValues: unknown,
): Promise<ActionResult<{ event: CalendarEventView }>> => {
  const parsed = createAppointmentSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: zodErrorMessage(parsed.error, "Los datos de la cita no son válidos.") };
  }

  const access = await requireAgentMembership();
  if ("error" in access) {
    return { error: access.error };
  }

  const startsAt = toZonedIso(parsed.data.date, parsed.data.startTime);
  const endsAt = toZonedIso(parsed.data.date, parsed.data.endTime);
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return sessionExpiredResult();
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("id", parsed.data.contactId)
    .eq("organization_id", access.membership.organizationId)
    .maybeSingle();

  if (contactError || !contact?.id) {
    return { error: "El contacto no existe o no pertenece a tu organización." };
  }

  let listingId: number | null = null;
  let listingTitle: string | null = null;
  if (parsed.data.listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, code")
      .eq("id", parsed.data.listingId)
      .eq("organization_id", access.membership.organizationId)
      .maybeSingle();
    if (!listing?.id) {
      return { error: "El inmueble no existe o no pertenece a tu organización." };
    }
    listingId = listing.id as number;
    listingTitle = `${listing.code} · ${listing.title}`;
  }

  const session = await getOrganizationGoogleCalendarSession(access.membership.organizationId);
  if (!session) {
    return { error: "Conecta Google Calendar en Ajustes antes de crear citas." };
  }

  const googleEvent = await createGoogleCalendarEvent({
    accessToken: session.accessToken,
    calendarId: session.calendarId,
    title: parsed.data.title,
    description: parsed.data.notes,
    startsAt,
    endsAt,
    timeZone: CALENDAR_TIME_ZONE,
    attendeeEmail: contact.email || undefined,
    createMeet: parsed.data.createMeet,
  });

  if (!googleEvent.ok) {
    console.error("[GOOGLE_CALENDAR] create event failed", googleEvent);
    return { error: "Google Calendar rechazó la creación del evento. Inténtalo de nuevo." };
  }

  const meetingUrl = resolveGoogleMeetingUrl(googleEvent.data);
  const attendees = (googleEvent.data.attendees ?? [])
    .filter((item) => item.email)
    .map((item) => {
      const response: AttendeeResponse =
        item.responseStatus === "accepted"
          ? "accepted"
          : item.responseStatus === "declined"
            ? "declined"
            : item.responseStatus === "tentative"
              ? "tentative"
              : "pending";
      return {
        email: item.email as string,
        name: item.displayName || null,
        response,
      };
    });

  const appointmentPayload = {
    organization_id: access.membership.organizationId,
    contact_id: contact.id,
    owner_user_id: user.id,
    external_calendar_event_id: googleEvent.data.id ?? `local-${randomUUID()}`,
    title: parsed.data.title,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "pending",
    source: "manual",
    purpose: parsed.data.purpose,
    listing_id: listingId,
    visit_status: listingId || isVisitPurpose(parsed.data.purpose) ? "pending" : null,
    meeting_url: meetingUrl,
    attendees,
    notes: parsed.data.notes || null,
  };

  let { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert(appointmentPayload)
    .select(
      "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, purpose, listing_id, visit_status, meeting_url, attendees, notes",
    )
    .single();

  if (insertError && /listing_id|visit_status/i.test(insertError.message)) {
    const { listing_id: _listingId, visit_status: _visitStatus, ...payloadWithoutListing } = appointmentPayload;
    const listingFallback = await supabase
      .from("appointments")
      .insert(payloadWithoutListing)
      .select(
        "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, purpose, meeting_url, attendees, notes",
      )
      .single();
    inserted = listingFallback.data
      ? { ...listingFallback.data, listing_id: null, visit_status: null }
      : null;
    insertError = listingFallback.error;
  }

  if (insertError?.message.toLowerCase().includes("purpose")) {
    const { purpose: _purpose, listing_id: _listingId, visit_status: _visitStatus, ...payloadWithoutPurpose } = appointmentPayload;
    const fallbackInsert = await supabase
      .from("appointments")
      .insert(payloadWithoutPurpose)
      .select(
        "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, meeting_url, attendees, notes",
      )
      .single();
    inserted = fallbackInsert.data
      ? { ...fallbackInsert.data, purpose: parsed.data.purpose, listing_id: null, visit_status: null }
      : null;
    insertError = fallbackInsert.error;
  }

  if (insertError || !inserted) {
    console.error("[GOOGLE_CALENDAR] persist appointment failed", insertError);
    return { error: "El evento se creó en Google, pero no se pudo guardar en el CRM." };
  }

  invalidateGoogleCalendarEventsCache();
  revalidatePath("/calendar");
  return {
    success: "Cita creada en Google Calendar",
    data: {
      event: {
        id: googleEvent.data.id || `appt-${inserted.id}`,
        appointmentId: inserted.id,
        googleEventId: inserted.external_calendar_event_id,
        title: inserted.title,
        startsAt: inserted.starts_at,
        endsAt: inserted.ends_at,
        allDay: false,
        status: "pending",
        source: "manual",
        purpose: parsed.data.purpose,
        listingId: (inserted as { listing_id?: number | null }).listing_id ?? null,
        listingTitle: (inserted as { listing_id?: number | null }).listing_id ? listingTitle : null,
        visitStatus: (inserted as { visit_status?: VisitStatus | null }).visit_status ?? null,
        notes: inserted.notes,
        meetingUrl: inserted.meeting_url,
        contactId: inserted.contact_id,
        contactName: contact.full_name || parsed.data.title,
        attendees,
      },
    },
  };
};

export const rescheduleCalendarAppointmentAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = rescheduleAppointmentSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "El nuevo horario de la cita no es válido." };
  }

  if (!parsed.data.appointmentId && !parsed.data.googleEventId) {
    return { error: "No se pudo identificar la cita a actualizar." };
  }

  if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }

  const access = await requireAgentMembership();
  if ("error" in access) {
    return { error: access.error };
  }

  const session = await getOrganizationGoogleCalendarSession(access.membership.organizationId);
  if (!session) {
    return { error: "Conecta Google Calendar en Ajustes para actualizar citas." };
  }

  if (isPersistedGoogleEventId(parsed.data.googleEventId)) {
    const patched = await patchGoogleCalendarEvent({
      accessToken: session.accessToken,
      calendarId: session.calendarId,
      eventId: parsed.data.googleEventId as string,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      timeZone: CALENDAR_TIME_ZONE,
    });

    if (!patched.ok) {
      console.error("[GOOGLE_CALENDAR] patch event failed", patched);
      return { error: "Google Calendar rechazó el cambio de horario." };
    }
  }

  const supabase = await createSupabaseServerClient();
  if (parsed.data.appointmentId) {
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        starts_at: parsed.data.startsAt,
        ends_at: parsed.data.endsAt,
      })
      .eq("id", parsed.data.appointmentId)
      .eq("organization_id", access.membership.organizationId);

    if (updateError) {
      return { error: "Se actualizó Google, pero no se pudo guardar el cambio en el CRM." };
    }
  }

  invalidateGoogleCalendarEventsCache();
  return { success: "Cita actualizada correctamente" };
};

export const updateAppointmentVisitAction = async (rawValues: unknown): Promise<ActionResult> => {
  const parsed = updateVisitSchema.safeParse(rawValues);
  if (!parsed.success) {
    return { error: "El resultado de la visita no es válido." };
  }

  const access = await requireAgentMembership();
  if ("error" in access) {
    return { error: access.error };
  }

  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = {
    visit_status: parsed.data.visitStatus,
  };
  if (parsed.data.notes !== undefined) {
    patch.notes = parsed.data.notes.trim() || null;
  }

  const { error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", parsed.data.appointmentId)
    .eq("organization_id", access.membership.organizationId);

  if (error) {
    if (/visit_status/i.test(error.message)) {
      return { error: "No se pudo guardar el resultado. ¿Corriste el SQL de supabase/listings-upgrade.sql?" };
    }
    return { error: error.message || "No se pudo guardar el resultado de la visita." };
  }

  revalidatePath("/calendar");
  return { success: "Visita actualizada." };
};
