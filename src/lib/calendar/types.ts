import type { AppointmentStatus } from "@/types/domain";
import type { AppointmentPurpose, VisitStatus } from "@/lib/calendar/constants";

export type { AppointmentPurpose, CalendarViewMode, VisitStatus } from "@/lib/calendar/constants";

export type AppointmentSource = "chat" | "manual" | "google";
export type AttendeeResponse = "pending" | "accepted" | "declined" | "tentative";

export type CalendarContactOption = {
  id: number;
  fullName: string;
  email: string | null;
};

export type CalendarAttendee = {
  email: string;
  name: string | null;
  response: AttendeeResponse;
};

export type CalendarEventView = {
  id: string;
  appointmentId: number | null;
  googleEventId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  meetingUrl: string | null;
  purpose: AppointmentPurpose;
  listingId: number | null;
  listingTitle: string | null;
  visitStatus: VisitStatus | null;
  contactId: number | null;
  contactName: string | null;
  attendees: CalendarAttendee[];
};

export type CalendarAgendaView = {
  connected: boolean;
  connectedEmail: string | null;
  googleError: string | null;
  rangeStart: string;
  rangeEnd: string;
  days: string[];
  events: CalendarEventView[];
};

export type CalendarMetrics = {
  todayCount: number;
  pendingCount: number;
  meetCount: number;
};
