import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createEventSchema = z.object({
  contactId: z.number().int().positive(),
  title: z.string().trim().min(3),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }

  // TODO: create Google Calendar event + persist appointment row
  return NextResponse.json({
    ok: true,
    appointment: {
      id: "local-draft",
      ...parsed.data,
    },
  });
}
