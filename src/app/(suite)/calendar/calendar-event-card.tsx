"use client";

import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Video } from "lucide-react";
import type { CalendarEventView } from "./types";
import { Badge } from "@/components/ui/badge";
import {
  APPOINTMENT_PURPOSE_LABELS,
  APPOINTMENT_PURPOSE_STYLES,
} from "@/lib/calendar/constants";
import { formatTime } from "@/lib/calendar/range";
import { cn } from "@/lib/utils";

type CalendarEventCardProps = {
  event: CalendarEventView;
  isOverlay?: boolean;
  onOpen: (event: CalendarEventView) => void;
};

export const CalendarEventCard = ({
  event,
  isOverlay = false,
  onOpen,
}: CalendarEventCardProps) => {
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
    if (isDragging || didDrag.current) {
      didDrag.current = false;
      return;
    }
    onOpen(event);
  };

  return (
    <article
      ref={isOverlay ? undefined : setNodeRef}
      className={cn(
        "relative z-20 flex w-full flex-col overflow-hidden rounded-xl border p-2.5 text-left shadow-sm",
        APPOINTMENT_PURPOSE_STYLES[event.purpose],
        isOverlay ? "cursor-grabbing shadow-2xl ring-2 ring-primary" : "cursor-grab",
        isDragging && "opacity-40",
      )}
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
        {event.listingTitle ? (
          <span className="truncate text-[11px] text-muted-foreground">{event.listingTitle}</span>
        ) : null}
      </div>
    </article>
  );
};
