import { randomUUID } from "node:crypto";
import type { AppointmentPurpose } from "@/lib/calendar/constants";
import { APPOINTMENT_PURPOSES, CALENDAR_TIME_ZONE } from "@/lib/calendar/constants";
import { toZonedIso } from "@/lib/calendar/range";
import type { AttendeeResponse } from "@/lib/calendar/types";
import { getOrganizationGoogleCalendarSession } from "@/lib/integrations/google-calendar-credentials";
import {
  createGoogleCalendarEvent,
  invalidateGoogleCalendarEventsCache,
  resolveGoogleMeetingUrl,
} from "@/lib/integrations/google-calendar";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  const [hours, minutes] = time.split(":").map(Number);
  const total = (hours ?? 0) * 60 + (minutes ?? 0) + minutesToAdd;
  const nextHours = Math.min(23, Math.floor(total / 60));
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
};

export const createChatAppointment = async (params: {
  organizationId: number;
  contactId: number;
  conversationId: number;
  date: string;
  startTime: string;
  endTime?: string;
  purpose: AppointmentPurpose;
  notes?: string;
  createMeet: boolean;
}) => {
  const endTime = params.endTime || addMinutesToTime(params.startTime, 30);
  const startsAt = toZonedIso(params.date, params.startTime);
  const endsAt = toZonedIso(params.date, endTime);

  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { ok: false as const, error: "La hora de fin debe ser posterior a la de inicio." };
  }

  if (new Date(startsAt).getTime() < Date.now() - 60 * 1000) {
    return { ok: false as const, error: "No se puede agendar una cita en el pasado." };
  }

  if (!APPOINTMENT_PURPOSES.includes(params.purpose)) {
    return { ok: false as const, error: "El motivo de la cita no es válido." };
  }

  const admin = getSupabaseAdminClient();
  const { data: contact, error: contactError } = await admin
    .from("contacts")
    .select("id, full_name, email")
    .eq("id", params.contactId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (contactError || !contact?.id) {
    return { ok: false as const, error: "El contacto no existe en esta organización." };
  }

  const session = await getOrganizationGoogleCalendarSession(params.organizationId);
  if (!session) {
    return { ok: false as const, error: "Google Calendar no está conectado. Un asesor debe vincularlo en Ajustes." };
  }

  const title = `Cita con ${contact.full_name || "cliente"}`;
  const googleEvent = await createGoogleCalendarEvent({
    accessToken: session.accessToken,
    calendarId: session.calendarId,
    title,
    description: params.notes,
    startsAt,
    endsAt,
    timeZone: CALENDAR_TIME_ZONE,
    attendeeEmail: contact.email || undefined,
    createMeet: params.createMeet,
  });

  if (!googleEvent.ok) {
    console.error("[AGENT_CALENDAR] create event failed", googleEvent);
    return { ok: false as const, error: "Google Calendar rechazó la creación de la cita." };
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
      return { email: item.email as string, name: item.displayName || null, response };
    });

  const payload = {
    organization_id: params.organizationId,
    contact_id: contact.id,
    conversation_id: params.conversationId,
    external_calendar_event_id: googleEvent.data.id ?? `local-${randomUUID()}`,
    title,
    starts_at: startsAt,
    ends_at: endsAt,
    status: "pending",
    source: "chat",
    purpose: params.purpose,
    meeting_url: meetingUrl,
    attendees,
    notes: params.notes || null,
  };

  let { data: inserted, error: insertError } = await admin.from("appointments").insert(payload).select("id").single();

  if (insertError?.message.toLowerCase().includes("purpose")) {
    const { purpose: _purpose, ...withoutPurpose } = payload;
    const fallback = await admin.from("appointments").insert(withoutPurpose).select("id").single();
    inserted = fallback.data;
    insertError = fallback.error;
  }

  if (insertError || !inserted) {
    console.error("[AGENT_CALENDAR] persist appointment failed", insertError);
    return { ok: false as const, error: "La cita se creó en Google, pero no se pudo guardar en el CRM." };
  }

  invalidateGoogleCalendarEventsCache();
  return {
    ok: true as const,
    title,
    startsAt,
    endsAt,
    meetingUrl,
    appointmentId: inserted.id as number,
  };
};
