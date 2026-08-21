"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Video } from "lucide-react";
import type { CalendarEventView } from "./types";
import { Badge } from "@/components/ui/badge";
import {
  APPOINTMENT_PURPOSE_LABELS,
  APPOINTMENT_PURPOSE_STYLES,
} from "@/lib/calendar/constants";
import { clampGridMinutes, dateAndMinutesToIso, formatTime, getZonedTimeParts, snapMinutes } from "@/lib/calendar/range";
import { cn } from "@/lib/utils";

type CalendarEventCardProps = {
  event: CalendarEventView;
  top: number;
  height: number;
  hourHeight: number;
  isOverlay?: boolean;
  onOpen: (event: CalendarEventView) => void;
  onResize: (event: CalendarEventView, nextEndsAt: string, commit: boolean) => void;
};

const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 240;

export const CalendarEventCard = ({
  event,
  top,
  height,
  hourHeight,
  isOverlay = false,
  onOpen,
  onResize,
}: CalendarEventCardProps) => {
  const resizeOriginY = useRef<number | null>(null);
  const resizeOriginEnd = useRef(event.endsAt);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { type: "event", eventId: event.id },
    disabled: isOverlay,
  });
  const didDrag = useRef(false);

  useEffect(() => {
    if (isDragging) {
      didDrag.current = true;
    }
  }, [isDragging]);

  const handleOpen = () => {
    if (isDragging || resizeOriginY.current !== null || didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen(event);
  };

  const resolveNextEnd = (clientY: number) => {
    const originY = resizeOriginY.current;
    if (originY === null) {
      return event.endsAt;
    }
    const startParts = getZonedTimeParts(event.startsAt);
    const originParts = getZonedTimeParts(resizeOriginEnd.current);
    const startMinutes = startParts.hour * 60 + startParts.minute;
    const originMinutes = originParts.hour * 60 + originParts.minute;
    const deltaMinutes = snapMinutes(((clientY - originY) / hourHeight) * 60);
    const nextMinutes = clampGridMinutes(
      Math.min(startMinutes + MAX_DURATION_MINUTES, Math.max(startMinutes + MIN_DURATION_MINUTES, originMinutes + deltaMinutes)),
    );
    return dateAndMinutesToIso(startParts.dateKey, nextMinutes);
  };

  const handleResizePointerDown = (pointerEvent: ReactPointerEvent<HTMLSpanElement>) => {
    pointerEvent.stopPropagation();
    pointerEvent.preventDefault();
    resizeOriginY.current = pointerEvent.clientY;
    resizeOriginEnd.current = event.endsAt;
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
  };

  const handleResizePointerMove = (pointerEvent: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeOriginY.current === null) {
      return;
    }
    onResize(event, resolveNextEnd(pointerEvent.clientY), false);
  };

  const handleResizePointerUp = (pointerEvent: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeOriginY.current === null) {
      return;
    }
    const nextEndsAt = resolveNextEnd(pointerEvent.clientY);
    resizeOriginY.current = null;
    onResize(event, nextEndsAt, true);
  };

  return (
    <article
      ref={isOverlay ? undefined : setNodeRef}
      className={cn(
        "z-20 flex flex-col overflow-hidden rounded-xl border p-2.5 text-left shadow-sm",
        APPOINTMENT_PURPOSE_STYLES[event.purpose],
        isOverlay ? "relative w-full cursor-grabbing shadow-2xl ring-2 ring-primary" : "absolute inset-x-1 cursor-grab",
        isDragging && "opacity-40",
      )}
      style={{ top: isOverlay ? undefined : top, height, minHeight: height }}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={handleOpen}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
          keyboardEvent.preventDefault();
          handleOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${event.title}, ${formatTime(event.startsAt)} a ${formatTime(event.endsAt)}`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="line-clamp-2 text-xs font-semibold leading-4">{event.title}</p>
        {event.meetingUrl ? <Video className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden /> : null}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
        <Badge variant="outline">{APPOINTMENT_PURPOSE_LABELS[event.purpose]}</Badge>
        {event.contactName ? (
          <span className="truncate text-[11px] text-muted-foreground">{event.contactName}</span>
        ) : null}
      </div>
      {isOverlay ? null : (
        <span
          className="absolute inset-x-3 bottom-0 z-30 flex h-3 cursor-ns-resize items-end justify-center"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          aria-label="Cambiar duración"
          role="slider"
          aria-valuemin={MIN_DURATION_MINUTES}
          aria-valuemax={MAX_DURATION_MINUTES}
        >
          <span className="mb-0.5 block h-1 w-8 rounded-full bg-primary/45" />
        </span>
      )}
    </article>
  );
};
