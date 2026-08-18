import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const inputSchema = z.object({
  conversationId: z.number().int().positive(),
  message: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payload" },
      { status: 400 },
    );
  }

  // TODO: call Gemini + tools (calendar, funnel, escalation)
  return NextResponse.json({
    ok: true,
    reply: "Endpoint base listo. Conectar motor de IA en siguiente fase.",
    conversationId: parsed.data.conversationId,
  });
}
