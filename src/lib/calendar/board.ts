import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentPurpose,
  AppointmentSource,
  AttendeeResponse,
  CalendarAgendaView,
  CalendarAttendee,
  CalendarEventView,
  CalendarViewMode,
} from "@/lib/calendar/types";
import { inferAppointmentPurpose, isVisitStatus } from "@/lib/calendar/constants";
import { getOrganizationGoogleCalendarSession } from "@/lib/integrations/google-calendar-credentials";
import {
  listGoogleCalendarEvents,
  resolveGoogleMeetingUrl,
  type GoogleCalendarAttendee,
  type GoogleCalendarEvent,
} from "@/lib/integrations/google-calendar";
import { getRangeIso, getVisibleDays, toDateKey } from "@/lib/calendar/range";
import type { AppointmentStatus } from "@/types/domain";

type AppointmentRow = {
  id: number;
  contact_id: number | null;
  external_calendar_event_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: AppointmentSource | null;
  meeting_url: string | null;
  attendees: unknown;
  notes: string | null;
  purpose: AppointmentPurpose | null;
  listing_id: number | null;
  visit_status: string | null;
  listings?: { title?: string | null; code?: string | null } | { title?: string | null; code?: string | null }[] | null;
  contacts: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
};

const mapAttendeeResponse = (value: string | undefined): AttendeeResponse => {
  if (value === "accepted") return "accepted";
  if (value === "declined") return "declined";
  if (value === "tentative") return "tentative";
  return "pending";
};

const mapGoogleAttendees = (attendees: GoogleCalendarAttendee[] | undefined): CalendarAttendee[] =>
  (attendees ?? [])
    .filter((item) => item.email)
    .map((item) => ({
      email: item.email!,
      name: item.displayName || null,
      response: mapAttendeeResponse(item.responseStatus),
    }));

const parseStoredAttendees = (value: unknown): CalendarAttendee[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("email" in item) || typeof item.email !== "string") {
      return [];
    }
    const record = item as { email: string; name?: string | null; response?: string };
    return [
      {
        email: record.email,
        name: record.name ?? null,
        response: mapAttendeeResponse(record.response),
      },
    ];
  });
};

const contactNameFrom = (row: AppointmentRow) => {
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  return contact?.full_name?.trim() || null;
};

const eventTiming = (event: GoogleCalendarEvent) => {
  const start = event.start?.dateTime || (event.start?.date ? `${event.start.date}T00:00:00-04:00` : null);
  const end = event.end?.dateTime || (event.end?.date ? `${event.end.date}T00:00:00-04:00` : null);
  return {
    startsAt: start,
    endsAt: end,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
  };
};

const listingTitleFrom = (row: AppointmentRow) => {
  const listing = Array.isArray(row.listings) ? row.listings[0] : row.listings;
  const title = listing?.title?.trim();
  const code = listing?.code?.trim();
  if (title && code) return `${code} · ${title}`;
  return title || code || null;
};

const toEventViewFromAppointment = (row: AppointmentRow): CalendarEventView => ({
  id: `appt-${row.id}`,
  appointmentId: row.id,
  googleEventId: row.external_calendar_event_id,
  title: row.title,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  allDay: false,
  status: row.status,
  source: row.source ?? "manual",
  notes: row.notes,
  meetingUrl: row.meeting_url,
  purpose: row.purpose ?? inferAppointmentPurpose(row.title),
  listingId: row.listing_id ?? null,
  listingTitle: listingTitleFrom(row),
  visitStatus: isVisitStatus(row.visit_status) ? row.visit_status : row.listing_id ? "pending" : null,
  contactId: row.contact_id,
  contactName: contactNameFrom(row),
  attendees: parseStoredAttendees(row.attendees),
});

const toEventViewFromGoogle = (event: GoogleCalendarEvent, appointment?: AppointmentRow): CalendarEventView => {
  const timing = eventTiming(event);
  const attendees = mapGoogleAttendees(event.attendees);
  const declined = attendees.some((item) => item.response === "declined");
  const accepted = attendees.length > 0 && attendees.every((item) => item.response === "accepted");

  return {
    id: event.id || `google-${timing.startsAt}`,
    appointmentId: appointment?.id ?? null,
    googleEventId: event.id ?? null,
    title: event.summary?.trim() || appointment?.title || "Sin título",
    startsAt: timing.startsAt || appointment?.starts_at || new Date().toISOString(),
    endsAt: timing.endsAt || appointment?.ends_at || new Date().toISOString(),
    allDay: timing.allDay,
    status: event.status === "cancelled" ? "cancelled" : declined ? "pending" : accepted ? "confirmed" : appointment?.status ?? "pending",
    source: appointment?.source ?? "google",
    notes: appointment?.notes || event.description || null,
    meetingUrl: resolveGoogleMeetingUrl(event) || appointment?.meeting_url || null,
    purpose: appointment?.purpose ?? inferAppointmentPurpose(event.summary || appointment?.title || ""),
    listingId: appointment?.listing_id ?? null,
    listingTitle: appointment ? listingTitleFrom(appointment) : null,
    visitStatus: appointment
      ? isVisitStatus(appointment.visit_status)
        ? appointment.visit_status
        : appointment.listing_id
          ? "pending"
          : null
      : null,
    contactId: appointment?.contact_id ?? null,
    contactName: appointment ? contactNameFrom(appointment) : attendees[0]?.name || attendees[0]?.email || null,
    attendees,
  };
};

export const loadCalendarAgenda = async (
  supabase: SupabaseClient,
  organizationId: number,
  view: CalendarViewMode,
  anchorDate: string,
): Promise<CalendarAgendaView> => {
  const days = getVisibleDays(view, anchorDate);
  const range = getRangeIso(days);

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("email")
    .eq("organization_id", organizationId)
    .eq("provider", "google")
    .is("revoked_at", null)
    .maybeSingle<{ email: string | null }>();

  const appointmentSelectWithListing =
    "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, purpose, listing_id, visit_status, meeting_url, attendees, notes, contacts(full_name, email), listings(title, code)";
  const appointmentSelect =
    "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, purpose, meeting_url, attendees, notes, contacts(full_name, email)";
  const appointmentSelectWithoutPurpose =
    "id, contact_id, external_calendar_event_id, title, starts_at, ends_at, status, source, meeting_url, attendees, notes, contacts(full_name, email)";

  const loadAppointments = async (select: string) =>
    supabase
      .from("appointments")
      .select(select)
      .eq("organization_id", organizationId)
      .gte("starts_at", range.timeMin)
      .lt("starts_at", range.timeMax)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true });

  let appointmentRows: AppointmentRow[] | null = null;
  const firstLoad = await loadAppointments(appointmentSelectWithListing);

  if (firstLoad.error && /listing|visit_status/i.test(firstLoad.error.message)) {
    const secondLoad = await loadAppointments(appointmentSelect);
    if (secondLoad.error && secondLoad.error.message.toLowerCase().includes("purpose")) {
      const fallbackLoad = await loadAppointments(appointmentSelectWithoutPurpose);
      if (fallbackLoad.error) {
        throw new Error(`No se pudieron cargar las citas: ${fallbackLoad.error.message}`);
      }
      appointmentRows = (fallbackLoad.data ?? []) as unknown as AppointmentRow[];
    } else if (secondLoad.error) {
      throw new Error(`No se pudieron cargar las citas: ${secondLoad.error.message}`);
    } else {
      appointmentRows = (secondLoad.data ?? []) as unknown as AppointmentRow[];
    }
  } else if (firstLoad.error && firstLoad.error.message.toLowerCase().includes("purpose")) {
    const fallbackLoad = await loadAppointments(appointmentSelectWithoutPurpose);
    if (fallbackLoad.error) {
      throw new Error(`No se pudieron cargar las citas: ${fallbackLoad.error.message}`);
    }
    appointmentRows = (fallbackLoad.data ?? []) as unknown as AppointmentRow[];
  } else if (firstLoad.error) {
    throw new Error(`No se pudieron cargar las citas: ${firstLoad.error.message}`);
  } else {
    appointmentRows = (firstLoad.data ?? []) as unknown as AppointmentRow[];
  }

  const appointments = appointmentRows ?? [];
  const appointmentsByGoogleId = new Map(
    appointments
      .filter((row) => row.external_calendar_event_id)
      .map((row) => [row.external_calendar_event_id as string, row]),
  );

  if (!connection) {
    return {
      connected: false,
      connectedEmail: null,
      googleError: null,
      rangeStart: range.timeMin,
      rangeEnd: range.timeMax,
      days,
      events: appointments.map(toEventViewFromAppointment),
    };
  }

  const session = await getOrganizationGoogleCalendarSession(organizationId);
  if (!session) {
    return {
      connected: true,
      connectedEmail: connection.email,
      googleError: "No se pudo renovar el token de Google Calendar. Vuelve a conectar la cuenta.",
      rangeStart: range.timeMin,
      rangeEnd: range.timeMax,
      days,
      events: appointments.map(toEventViewFromAppointment),
    };
  }

  const googleEvents = await listGoogleCalendarEvents({
    accessToken: session.accessToken,
    calendarId: session.calendarId,
    timeMin: range.timeMin,
    timeMax: range.timeMax,
  });

  if (!googleEvents.ok) {
    console.error("[GOOGLE_CALENDAR] list events failed", googleEvents);
    return {
      connected: true,
      connectedEmail: connection.email,
      googleError: "No se pudieron leer los eventos de Google Calendar.",
      rangeStart: range.timeMin,
      rangeEnd: range.timeMax,
      days,
      events: appointments.map(toEventViewFromAppointment),
    };
  }

  const usedAppointmentIds = new Set<number>();
  const events: CalendarEventView[] = [];

  for (const googleEvent of googleEvents.data) {
    if (googleEvent.status === "cancelled" || !googleEvent.id) {
      continue;
    }
    const appointment = appointmentsByGoogleId.get(googleEvent.id);
    if (appointment) {
      usedAppointmentIds.add(appointment.id);
    }
    events.push(toEventViewFromGoogle(googleEvent, appointment));
  }

  for (const appointment of appointments) {
    if (!usedAppointmentIds.has(appointment.id)) {
      events.push(toEventViewFromAppointment(appointment));
    }
  }

  events.sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  return {
    connected: true,
    connectedEmail: connection.email,
    googleError: null,
    rangeStart: range.timeMin,
    rangeEnd: range.timeMax,
    days,
    events,
  };
};

export const computeCalendarMetrics = (events: CalendarEventView[]) => {
  const todayKey = toDateKey(new Date());
  return {
    todayCount: events.filter((event) => toDateKey(new Date(event.startsAt)) === todayKey).length,
    pendingCount: events.filter((event) => event.status === "pending").length,
    meetCount: events.filter((event) => Boolean(event.meetingUrl)).length,
  };
};
