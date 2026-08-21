"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  UserRound,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { createCalendarAppointmentAction, rescheduleCalendarAppointmentAction } from "@/lib/calendar/actions";
import { CalendarEventCard } from "./calendar-event-card";
import type {
  AppointmentPurpose,
  AttendeeResponse,
  CalendarAgendaView,
  CalendarContactOption,
  CalendarEventView,
  CalendarViewMode,
} from "./types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { APPOINTMENT_PURPOSE_LABELS, APPOINTMENT_PURPOSES } from "@/lib/calendar/constants";
import {
  dateAndMinutesToIso,
  formatDayHeading,
  formatRangeLabel,
  formatTime,
  getZonedTimeParts,
  shiftAnchor,
  toDateKey,
} from "@/lib/calendar/range";

type CalendarBoardProps = {
  agenda: CalendarAgendaView;
  contacts: CalendarContactOption[];
  view: CalendarViewMode;
  anchorDate: string;
};

const HOUR_START = 8;
const HOUR_END = 20;

const VIEW_OPTIONS: Array<{ id: CalendarViewMode; label: string }> = [
  { id: "day", label: "Día" },
  { id: "threeDay", label: "3 días" },
  { id: "week", label: "Semana" },
];

const RESPONSE_LABELS: Record<AttendeeResponse, string> = {
  pending: "Pendiente",
  accepted: "Aceptó",
  declined: "Rechazó",
  tentative: "Tal vez",
};

const resolveInitials = (name: string) => {
  const words = name.replace(/^@/, "").trim().split(" ").filter(Boolean);
  if (!words.length) return "SN";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
};

const calendarHref = (view: CalendarViewMode, date: string) => `/calendar?view=${view}&date=${date}`;

const padTime = (value: number) => String(value).padStart(2, "0");

const nextSlot = () => {
  const parts = getZonedTimeParts(new Date().toISOString());
  const hour = Math.min(Math.max(parts.hour + 1, HOUR_START), HOUR_END - 1);
  return {
    date: parts.dateKey,
    startTime: `${padTime(hour)}:00`,
    endTime: `${padTime(hour)}:30`,
  };
};

const eventDateKey = (event: CalendarEventView) => getZonedTimeParts(event.startsAt).dateKey;

const parseDayId = (value: string | number) => {
  const raw = String(value);
  return raw.startsWith("day-") ? raw.slice("day-".length) : null;
};

const DayColumn = ({
  day,
  isToday,
  children,
}: {
  day: string;
  isToday: boolean;
  children: ReactNode;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day}`,
    data: { type: "day", dateKey: day },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-72 space-y-2 border-l border-primary/15 p-2 transition-colors ${
        isToday ? "bg-primary/5" : ""
      } ${isOver ? "bg-primary/10" : ""}`}
    >
      {children}
    </div>
  );
};

export const CalendarBoard = ({ agenda, contacts, view, anchorDate }: CalendarBoardProps) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const rangeKey = `${agenda.rangeStart}:${agenda.rangeEnd}`;
  const [syncedRange, setSyncedRange] = useState(rangeKey);
  const [localEvents, setLocalEvents] = useState<CalendarEventView[] | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventView | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaults = nextSlot();
  const [contactId, setContactId] = useState(contacts[0]?.id ? String(contacts[0].id) : "");
  const [title, setTitle] = useState(contacts[0]?.fullName ? `Cita con ${contacts[0].fullName}` : "");
  const [date, setDate] = useState(defaults.date);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [purpose, setPurpose] = useState<AppointmentPurpose>("consulta");
  const [notes, setNotes] = useState("");
  const [createMeet, setCreateMeet] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  if (syncedRange !== rangeKey) {
    setSyncedRange(rangeKey);
    setLocalEvents(null);
  }

  const displayEvents = localEvents ?? agenda.events;
  const todayKey = toDateKey(new Date());
  const activeEvent = displayEvents.find((event) => event.id === activeEventId) ?? null;

  const metrics = useMemo(() => {
    return {
      todayCount: displayEvents.filter((event) => getZonedTimeParts(event.startsAt).dateKey === todayKey).length,
      pendingCount: displayEvents.filter((event) => event.status === "pending").length,
      meetCount: displayEvents.filter((event) => Boolean(event.meetingUrl)).length,
    };
  }, [displayEvents, todayKey]);

  const nextEvent = displayEvents.find((event) => new Date(event.endsAt).getTime() > Date.now()) ?? null;

  const persistSchedule = (original: CalendarEventView, startsAt: string, endsAt: string) => {
    setLocalEvents((current) =>
      (current ?? agenda.events).map((item) => (item.id === original.id ? { ...item, startsAt, endsAt } : item)),
    );
    startTransition(async () => {
      const result = await rescheduleCalendarAppointmentAction({
        appointmentId: original.appointmentId,
        googleEventId: original.googleEventId,
        startsAt,
        endsAt,
      });
      if (result.error) {
        toast.error(result.error);
        setLocalEvents((current) =>
          (current ?? agenda.events).map((item) => (item.id === original.id ? original : item)),
        );
        return;
      }
      toast.success(result.success ?? "Cita actualizada correctamente");
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveEventId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const current = displayEvents.find((item) => item.id === String(event.active.id));
    setActiveEventId(null);
    if (!current || !event.over) {
      return;
    }

    const nextDay = parseDayId(event.over.id) ?? getZonedTimeParts(current.startsAt).dateKey;
    const startParts = getZonedTimeParts(current.startsAt);
    const endParts = getZonedTimeParts(current.endsAt);
    const startsAt = dateAndMinutesToIso(nextDay, startParts.hour * 60 + startParts.minute);
    const endsAt = dateAndMinutesToIso(nextDay, endParts.hour * 60 + endParts.minute);

    if (startsAt === current.startsAt && endsAt === current.endsAt) {
      return;
    }

    persistSchedule(current, startsAt, endsAt);
  };

  const handleContactChange = (nextContactId: string) => {
    setContactId(nextContactId);
    const selected = contacts.find((item) => String(item.id) === nextContactId);
    if (selected) {
      setTitle(`Cita con ${selected.fullName}`);
    }
  };

  const handleCreate = () => {
    const selectedContactId = Number(contactId);
    if (!selectedContactId || !title.trim()) {
      setFormError("Selecciona un contacto y un título.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const result = await createCalendarAppointmentAction({
        contactId: selectedContactId,
        title: title.trim(),
        date,
        startTime,
        endTime,
        notes: notes.trim() || undefined,
        createMeet,
        purpose,
      });

      if (result.error || !result.data?.event) {
        const message = result.error ?? "No se pudo crear la cita.";
        setFormError(message);
        toast.error(message);
        return;
      }

      setLocalEvents([...(localEvents ?? agenda.events), result.data.event].sort((left, right) => left.startsAt.localeCompare(right.startsAt)));
      setIsCreateOpen(false);
      setNotes("");
      toast.success(result.success ?? "Cita creada correctamente");
    });
  };

  const metricItems = [
    { label: "Citas hoy", value: String(metrics.todayCount), icon: CalendarDays },
    { label: "Por confirmar", value: String(metrics.pendingCount), icon: Clock },
    { label: "Con Meet", value: String(metrics.meetCount), icon: Video },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-3">
        {metricItems.map((metric) => (
          <Card key={metric.label} className="border-primary/15 bg-card/70 py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-2 p-3">
              <div>
                <CardDescription className="text-[11px]">{metric.label}</CardDescription>
                <CardTitle className="mt-1 text-lg">{metric.value}</CardTitle>
              </div>
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <metric.icon className="size-4" />
              </span>
            </CardHeader>
          </Card>
        ))}
      </div>

      {nextEvent ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Próxima cita</p>
            <p className="mt-1 truncate text-sm font-semibold">{nextEvent.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatDayHeading(getZonedTimeParts(nextEvent.startsAt).dateKey)} · {formatTime(nextEvent.startsAt)} –{" "}
              {formatTime(nextEvent.endsAt)}
              {nextEvent.contactName ? ` · ${nextEvent.contactName}` : ""}
            </p>
          </div>
          {nextEvent.meetingUrl ? (
            <Button asChild>
              <a href={nextEvent.meetingUrl} target="_blank" rel="noreferrer">
                <Video />
                Unirse a Meet
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {agenda.googleError ? <p className="text-sm text-destructive">{agenda.googleError}</p> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Periodo anterior">
            <Link href={calendarHref(view, shiftAnchor(view, anchorDate, -1))}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={calendarHref(view, todayKey)}>Hoy</Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Periodo siguiente">
            <Link href={calendarHref(view, shiftAnchor(view, anchorDate, 1))}>
              <ChevronRight />
            </Link>
          </Button>
          <p className="px-2 text-sm font-medium">{formatRangeLabel(agenda.days)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-primary/20 p-1">
            {VIEW_OPTIONS.map((option) => (
              <Button key={option.id} asChild size="sm" variant={view === option.id ? "default" : "ghost"}>
                <Link href={calendarHref(option.id, anchorDate)}>{option.label}</Link>
              </Button>
            ))}
          </div>
          <Button type="button" onClick={() => setIsCreateOpen(true)} disabled={!agenda.connected || !contacts.length}>
            <Plus />
            Nueva cita
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-card/80">
          <div className="min-w-[720px]">
            <div
              className="grid border-b border-primary/15"
              style={{ gridTemplateColumns: `repeat(${agenda.days.length}, minmax(0, 1fr))` }}
            >
              {agenda.days.map((day) => (
                <div
                  key={day}
                  className={`border-l border-primary/15 p-3 text-sm font-medium first:border-l-0 ${
                    day === todayKey ? "text-primary" : ""
                  }`}
                >
                  {formatDayHeading(day)}
                </div>
              ))}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${agenda.days.length}, minmax(0, 1fr))` }}
            >
              {agenda.days.map((day) => {
                const dayEvents = displayEvents
                  .filter((event) => eventDateKey(event) === day)
                  .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

                return (
                  <DayColumn key={`grid-${day}`} day={day} isToday={day === todayKey}>
                    {dayEvents.length ? (
                      dayEvents.map((event) => (
                        <CalendarEventCard key={event.id} event={event} onOpen={setSelectedEvent} />
                      ))
                    ) : (
                      <p className="px-1 py-6 text-center text-xs text-muted-foreground">Sin citas</p>
                    )}
                  </DayColumn>
                );
              })}
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null} zIndex={80}>
          {activeEvent ? (
            <div className="w-[220px]">
              <CalendarEventCard event={activeEvent} isOverlay onOpen={() => undefined} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nueva cita</SheetTitle>
            <SheetDescription>
              Se creará en Google Calendar{createMeet ? " con enlace de Meet" : ""} y quedará vinculada al contacto.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-contact">Contacto</Label>
              <select
                id="calendar-contact"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={contactId}
                onChange={(event) => handleContactChange(event.target.value)}
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.fullName}
                    {contact.email ? ` · ${contact.email}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-title">Título</Label>
              <Input id="calendar-title" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-purpose">Motivo</Label>
              <select
                id="calendar-purpose"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value as AppointmentPurpose)}
              >
                {APPOINTMENT_PURPOSES.map((item) => (
                  <option key={item} value={item}>
                    {APPOINTMENT_PURPOSE_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="calendar-date">Fecha</Label>
                <Input id="calendar-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-start">Inicio</Label>
                <Input id="calendar-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-end">Fin</Label>
                <Input id="calendar-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-notes">Notas</Label>
              <Input id="calendar-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={createMeet} onCheckedChange={(value) => setCreateMeet(value === true)} />
              Crear enlace de Google Meet
            </label>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {!contacts.length ? (
              <p className="text-sm text-muted-foreground">Aún no hay contactos para agendar.</p>
            ) : null}
          </div>
          <SheetFooter>
            <Button type="button" onClick={handleCreate} disabled={isPending || !contacts.length || !agenda.connected}>
              {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Crear cita
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => (!open ? setSelectedEvent(null) : null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedEvent?.title ?? "Cita"}</SheetTitle>
            <SheetDescription>
              {selectedEvent
                ? `${formatDayHeading(getZonedTimeParts(selectedEvent.startsAt).dateKey)} · ${formatTime(selectedEvent.startsAt)} – ${formatTime(selectedEvent.endsAt)}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {selectedEvent ? (
            <div className="space-y-4 px-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{APPOINTMENT_PURPOSE_LABELS[selectedEvent.purpose]}</Badge>
                <Badge variant="outline">{selectedEvent.status === "confirmed" ? "Confirmada" : "Pendiente"}</Badge>
              </div>
              {selectedEvent.contactName ? (
                <div className="flex items-center gap-3 rounded-xl border border-primary/15 p-3">
                  <Avatar size="sm">
                    <AvatarFallback>{resolveInitials(selectedEvent.contactName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{selectedEvent.contactName}</p>
                    <p className="text-xs text-muted-foreground">Contacto vinculado</p>
                  </div>
                </div>
              ) : null}
              {selectedEvent.notes ? <p className="text-sm text-muted-foreground">{selectedEvent.notes}</p> : null}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <UserRound className="size-4" />
                  Participantes
                </p>
                {selectedEvent.attendees.length ? (
                  <div className="space-y-2">
                    {selectedEvent.attendees.map((attendee) => (
                      <div key={attendee.email} className="flex items-center justify-between rounded-lg border border-primary/10 px-3 py-2">
                        <span className="truncate text-sm">{attendee.name || attendee.email}</span>
                        <Badge variant={attendee.response === "accepted" ? "default" : "outline"}>
                          {RESPONSE_LABELS[attendee.response]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin invitados registrados.</p>
                )}
              </div>
            </div>
          ) : null}
          <SheetFooter>
            {selectedEvent?.meetingUrl ? (
              <Button asChild>
                <a href={selectedEvent.meetingUrl} target="_blank" rel="noreferrer">
                  <Video />
                  Unirse a Meet
                </a>
              </Button>
            ) : null}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
