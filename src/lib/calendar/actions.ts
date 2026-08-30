"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { APPOINTMENT_PURPOSES, CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import type { AttendeeResponse, CalendarEventView } from "@/lib/calendar/types";
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

const isoDateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: "La fecha no es válida.",
});

const createAppointmentSchema = z.object({
  contactId: z.number().int().positive(),
  title: z.string().trim().min(3).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
  createMeet: z.boolean(),
  purpose: z.enum(APPOINTMENT_PURPOSES).default("consulta"),
});

const rescheduleAppointmentSchema = z.object({
  appointmentId: z.number().int().positive().nullable(),
  googleEventId: z.string().trim().min(1).nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
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
    return { error: parsed.error.issues[0]?.message ?? "Los datos de la cita no son válidos." };
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
    meeting_url: meetingUrl,
    attendees,
    notes: parsed.data.notes || null,
  };

  let { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert(appointmentPayload)
    .select(
      "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, purpose, meeting_url, attendees, notes",
    )
    .single();

  if (insertError?.message.toLowerCase().includes("purpose")) {
    const { purpose: _purpose, ...payloadWithoutPurpose } = appointmentPayload;
    const fallbackInsert = await supabase
      .from("appointments")
      .insert(payloadWithoutPurpose)
      .select(
        "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, meeting_url, attendees, notes",
      )
      .single();
    inserted = fallbackInsert.data
      ? { ...fallbackInsert.data, purpose: parsed.data.purpose }
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
