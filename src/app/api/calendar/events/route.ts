import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCalendarAppointmentAction } from "@/lib/calendar/actions";
import { getZonedTimeParts } from "@/lib/calendar/range";
import { zodErrorMessage } from "@/lib/validation/zod-es";

const createEventSchema = z.object({
  contactId: z.number().int().positive(),
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
  startsAt: z.string().datetime("La fecha de inicio no es válida."),
  endsAt: z.string().datetime("La fecha de fin no es válida."),
  notes: z.string().trim().optional(),
  createMeet: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: zodErrorMessage(parsed.error, "Los datos de la cita no son válidos.") },
      { status: 400 },
    );
  }

  const start = getZonedTimeParts(parsed.data.startsAt);
  const end = getZonedTimeParts(parsed.data.endsAt);
  const result = await createCalendarAppointmentAction({
    contactId: parsed.data.contactId,
    title: parsed.data.title,
    date: start.dateKey,
    startTime: `${String(start.hour).padStart(2, "0")}:${String(start.minute).padStart(2, "0")}`,
    endTime: `${String(end.hour).padStart(2, "0")}:${String(end.minute).padStart(2, "0")}`,
    notes: parsed.data.notes,
    createMeet: parsed.data.createMeet ?? true,
  });

  if (result.error || !result.data?.event) {
    return NextResponse.json({ error: result.error || "No se pudo crear la cita." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    appointment: result.data.event,
  });
}
